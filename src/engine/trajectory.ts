import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

export const TRAJECTORY_SEGMENTS = 140;
const DASH_RATIO = 0.75;
const SOFTENING_SQ = 25.0;

let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryLines: THREE.LineSegments;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;

// Holographic Prograde Reticle
let progradeGroup: THREE.Group;
let progradeRingMesh: THREE.Mesh;
let progradeDotMesh: THREE.Mesh;
let progradeChevronMesh: THREE.Mesh;
let progradeMaterial: THREE.MeshBasicMaterial;
let progradeDotMaterial: THREE.MeshBasicMaterial;

// Holographic Periapsis (PE) Swing-By Reticle
let periapsisGroup: THREE.Group;
let periapsisMaterial: THREE.MeshBasicMaterial;
let periapsisDotMaterial: THREE.MeshBasicMaterial;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _impactPos = new THREE.Vector3();
const _reticleTargetPos = new THREE.Vector3();
const _pePos = new THREE.Vector3();

// Exported trajectory coordinates for Minimap / HUD Radar
export const projectedTrajectoryPoints: { x: number; z: number; isGravityArc: boolean }[] = [];

export function initTrajectory() {
    const vertexCount = TRAJECTORY_SEGMENTS * 2;
    trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryPositions = new Float32Array(vertexCount * 3);
    trajectoryColors = new Float32Array(vertexCount * 3);

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(trajectoryColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        linewidth: 2.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    trajectoryLines = new THREE.LineSegments(trajectoryGeometry, lineMaterial);
    trajectoryLines.frustumCulled = false;
    trajectoryLines.renderOrder = 999;
    scene.add(trajectoryLines);

    // 1. Build Holographic Prograde Marker Reticle
    progradeGroup = new THREE.Group();
    progradeGroup.renderOrder = 1000;

    progradeMaterial = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    progradeDotMaterial = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Outer Thin Ring (0.8 radius)
    const ringGeo = new THREE.RingGeometry(0.65, 0.85, 32);
    ringGeo.rotateX(Math.PI / 2);
    progradeRingMesh = new THREE.Mesh(ringGeo, progradeMaterial);
    progradeGroup.add(progradeRingMesh);

    // Center Focal Core Dot
    const dotGeo = new THREE.SphereGeometry(0.22, 16, 16);
    progradeDotMesh = new THREE.Mesh(dotGeo, progradeDotMaterial);
    progradeDotMesh.position.y = 0.25;
    progradeGroup.add(progradeDotMesh);

    // Forward Direction Pointer Chevron
    const chevronGeo = new THREE.ConeGeometry(0.35, 0.8, 4);
    chevronGeo.rotateX(Math.PI / 2);
    progradeChevronMesh = new THREE.Mesh(chevronGeo, progradeMaterial);
    progradeChevronMesh.position.set(0, 0.25, 0.95);
    progradeGroup.add(progradeChevronMesh);

    progradeGroup.visible = false;
    scene.add(progradeGroup);

    // 2. Build Holographic Periapsis (PE) Swing-By Reticle
    periapsisGroup = new THREE.Group();
    periapsisGroup.renderOrder = 1001;

    periapsisMaterial = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    periapsisDotMaterial = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Diamond Reticle
    const peRingGeo = new THREE.RingGeometry(0.6, 0.85, 4);
    peRingGeo.rotateX(Math.PI / 2);
    peRingGeo.rotateY(Math.PI / 4); // 45 deg tilt for diamond icon
    const peRingMesh = new THREE.Mesh(peRingGeo, periapsisMaterial);
    periapsisGroup.add(peRingMesh);

    // Pulsing inner beacon
    const peDotGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const peDotMesh = new THREE.Mesh(peDotGeo, periapsisDotMaterial);
    peDotMesh.position.y = 0.25;
    periapsisGroup.add(peDotMesh);

    periapsisGroup.visible = false;
    scene.add(periapsisGroup);
}

/**
 * Calculates net gravity at pos and checks if pos collides with any solid body.
 * Also returns the strongest gravity influence factor (0 = flat space, 1 = intense well).
 */
export function calculateGravityAndCheckCollision(
    pos: THREE.Vector3,
    simTime: number,
    outAcc: THREE.Vector3,
    outImpactPoint?: THREE.Vector3,
    outClosestInfo?: { source: any; dist: number }
): { collided: boolean; maxGravityRatio: number } {
    outAcc.set(0, 0, 0);
    const sources = STATE.gravitySources;
    const count = sources.length;
    let collided = false;
    let maxGravityRatio = 0;
    let minDist = Infinity;
    let closestSource: any = null;

    for (let s = 0; s < count; s++) {
        const source = sources[s];
        if (source.isAbsorbed) continue;

        let sourceX = source.position.x;
        let sourceZ = source.position.z;

        // Predict moving planetary orbits in future simulation time
        if (source.type === 'planet') {
            const planetEntry = activePlanets.find(p => p.source === source);
            if (planetEntry && !planetEntry.isMoon) {
                const futureAngle = planetEntry.angle + planetEntry.speed * simTime;
                sourceX = planetEntry.distance * Math.cos(futureAngle);
                sourceZ = planetEntry.distance * Math.sin(futureAngle);
            }
        }

        const dx = sourceX - pos.x;
        const dz = sourceZ - pos.z;
        const distSq = dx * dx + dz * dz;
        const distance = Math.max(0.01, Math.sqrt(distSq));

        if (distance < minDist) {
            minDist = distance;
            closestSource = source;
        }

        // Physical collision boundary (Atmosphere / Surface clearance)
        const impactClearance = source.type === 'star' ? source.radius + 1.2 : source.radius + 0.6;
        if (distSq <= impactClearance * impactClearance) {
            collided = true;
            if (outImpactPoint) {
                outImpactPoint.set(
                    sourceX - (dx / distance) * impactClearance,
                    0.25,
                    sourceZ - (dz / distance) * impactClearance
                );
            }
            break;
        }

        const rangeSq = source.gravityRange * source.gravityRange;
        if (distSq < rangeSq) {
            // Softened Plummer gravity: F = G*M / (r^2 + r_soft^2)
            const forceStrength = (STATE.gConstant * source.mass) / (distSq + SOFTENING_SQ);
            const invDist = 1 / distance;

            outAcc.x += dx * invDist * forceStrength;
            outAcc.z += dz * invDist * forceStrength;

            const wellRatio = 1.0 - (distance / source.gravityRange);
            if (wellRatio > maxGravityRatio) {
                maxGravityRatio = wellRatio;
            }
        }
    }

    if (outClosestInfo && closestSource) {
        outClosestInfo.source = closestSource;
        outClosestInfo.dist = minDist;
    }

    return { collided, maxGravityRatio };
}

export function updateTrajectory() {
    if (!trajectoryLines || !progradeGroup || !periapsisGroup) return;

    const curSpeed = STATE.playerVelocity.length();
    // Smooth visibility threshold (fades in as speed exceeds 0.4)
    const speedFactor = Math.min(1.0, Math.max(0, (curSpeed - 0.4) / 3.0));

    // If practically parked, hide trajectory
    if (curSpeed < 0.35) {
        trajectoryLines.visible = false;
        progradeGroup.visible = false;
        periapsisGroup.visible = false;
        projectedTrajectoryPoints.length = 0;
        return;
    }

    trajectoryLines.visible = true;
    progradeGroup.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    let hasImpacted = false;
    _reticleTargetPos.copy(STATE.playerPosition);

    // Deep orbital time-step: scales adaptively with ship speed to ensure broad coverage
    // Predicts 20 to 35 seconds into the future across hundreds of space units!
    const baseDt = THREE.MathUtils.clamp(3.6 / Math.max(1.0, curSpeed), 0.12, 0.26);

    // Traveling wave phase for flowing energy beads
    const timeNow = Date.now() * 0.001;
    const wavePhase = (timeNow * 4.5) % (Math.PI * 2);

    // Periapsis tracking (closest approach during orbital swingby)
    let bestPeFound = false;
    let bestPeDist = Infinity;
    let lastDistToSource = Infinity;
    let hasApproached = false;

    projectedTrajectoryPoints.length = 0;
    projectedTrajectoryPoints.push({ x: _predPos.x, z: _predPos.z, isGravityArc: false });

    for (let seg = 0; seg < TRAJECTORY_SEGMENTS; seg++) {
        const v0 = seg * 2;
        const v1 = seg * 2 + 1;

        if (hasImpacted) {
            trajectoryPositions[v0 * 3 + 0] = _impactPos.x;
            trajectoryPositions[v0 * 3 + 1] = 0.25;
            trajectoryPositions[v0 * 3 + 2] = _impactPos.z;

            trajectoryPositions[v1 * 3 + 0] = _impactPos.x;
            trajectoryPositions[v1 * 3 + 1] = 0.25;
            trajectoryPositions[v1 * 3 + 2] = _impactPos.z;

            trajectoryColors[v0 * 3 + 0] = 0;
            trajectoryColors[v0 * 3 + 1] = 0;
            trajectoryColors[v0 * 3 + 2] = 0;

            trajectoryColors[v1 * 3 + 0] = 0;
            trajectoryColors[v1 * 3 + 1] = 0;
            trajectoryColors[v1 * 3 + 2] = 0;
            continue;
        }

        const simTime = seg * baseDt;

        // 1. Segment Start
        _segmentStart.copy(_predPos);

        const closestInfo = { source: null as any, dist: Infinity };
        const gCheck = calculateGravityAndCheckCollision(_segmentStart, simTime, _predAcc, _impactPos, closestInfo);

        // Check for Periapsis (local minimum distance inside a gravity well)
        if (closestInfo.source && closestInfo.dist < closestInfo.source.gravityRange) {
            if (closestInfo.dist < lastDistToSource) {
                hasApproached = true;
            } else if (hasApproached && !bestPeFound && closestInfo.dist < closestInfo.source.gravityRange * 0.85) {
                // Distance was decreasing and is now increasing: this is the Periapsis!
                bestPeFound = true;
                bestPeDist = closestInfo.dist;
                _pePos.copy(_segmentStart);
            }
            lastDistToSource = closestInfo.dist;
        }

        const isGravityArc = gCheck.maxGravityRatio > 0.12;

        if (gCheck.collided) {
            hasImpacted = true;
            _segmentStart.copy(_impactPos);
            _segmentEnd.copy(_impactPos);
            _reticleTargetPos.copy(_impactPos);
        } else {
            const dashDt = baseDt * DASH_RATIO;
            _predVel.addScaledVector(_predAcc, dashDt);
            _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * dashDt));
            _predPos.addScaledVector(_predVel, dashDt);

            // 2. Segment End
            _segmentEnd.copy(_predPos);
            _reticleTargetPos.copy(_segmentEnd);

            const endCheck = calculateGravityAndCheckCollision(_segmentEnd, simTime + dashDt, _predAcc, _impactPos);
            if (endCheck.collided) {
                hasImpacted = true;
                _segmentEnd.copy(_impactPos);
                _reticleTargetPos.copy(_impactPos);
            } else {
                const gapDt = baseDt * (1.0 - DASH_RATIO);
                calculateGravityAndCheckCollision(_predPos, simTime + dashDt, _predAcc);
                _predVel.addScaledVector(_predAcc, gapDt);
                _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * gapDt));
                _predPos.addScaledVector(_predVel, gapDt);
            }
        }

        // Store positions
        trajectoryPositions[v0 * 3 + 0] = _segmentStart.x;
        trajectoryPositions[v0 * 3 + 1] = 0.25;
        trajectoryPositions[v0 * 3 + 2] = _segmentStart.z;

        trajectoryPositions[v1 * 3 + 0] = _segmentEnd.x;
        trajectoryPositions[v1 * 3 + 1] = 0.25;
        trajectoryPositions[v1 * 3 + 2] = _segmentEnd.z;

        // Record point for Minimap (every 2nd segment or impact)
        if (seg % 2 === 0 || hasImpacted) {
            projectedTrajectoryPoints.push({
                x: _segmentEnd.x,
                z: _segmentEnd.z,
                isGravityArc
            });
        }

        // Dynamic Flowing Light-Pulse & Gravity Shift Calculation
        const progress = seg / TRAJECTORY_SEGMENTS;
        const distFade = Math.pow(1.0 - progress, 1.15); // Long graceful taper into deep space
        const nearFade = Math.min(1.0, seg * 0.3);      // Soft start near ship

        // Sine wave traveling along the trajectory line
        const flowWave = Math.sin(seg * 0.42 - wavePhase);
        const pulseBoost = (flowWave > 0 ? flowWave * 0.40 : 0.0);

        const totalAlpha = (distFade * nearFade * 0.80 + pulseBoost * 0.30) * speedFactor;

        // Color Spectrum: Shifts from Bioluminescent Cyan to Psionic Violet/Gold inside gravity wells!
        const gravBoost = THREE.MathUtils.clamp(gCheck.maxGravityRatio * 1.5, 0.0, 1.0);

        // Standard: Cyan (0.12, 0.85, 0.95)
        // In Gravity Well: Radiant Violet/Magenta (0.85, 0.25, 0.98)
        const baseR = THREE.MathUtils.lerp(0.12, 0.88, gravBoost);
        const baseG = THREE.MathUtils.lerp(0.85, 0.28, gravBoost);
        const baseB = THREE.MathUtils.lerp(0.95, 0.98, gravBoost);

        const r = baseR * totalAlpha;
        const g = baseG * totalAlpha;
        const b = baseB * totalAlpha;

        trajectoryColors[v0 * 3 + 0] = r;
        trajectoryColors[v0 * 3 + 1] = g;
        trajectoryColors[v0 * 3 + 2] = b;

        trajectoryColors[v1 * 3 + 0] = r;
        trajectoryColors[v1 * 3 + 1] = g;
        trajectoryColors[v1 * 3 + 2] = b;
    }

    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.color.needsUpdate = true;

    // 3. Update Prograde Reticle (Target Point or Impact Warning)
    if (progradeGroup) {
        progradeGroup.position.set(_reticleTargetPos.x, 0.25, _reticleTargetPos.z);

        const velHeading = Math.atan2(-_predVel.z, _predVel.x);
        progradeGroup.rotation.y = velHeading - Math.PI / 2;

        const reticleAlpha = speedFactor * (hasImpacted ? 0.95 : 0.80);
        const pulseScale = (1.0 + Math.sin(timeNow * 6.0) * 0.08);
        progradeGroup.scale.set(pulseScale, pulseScale, pulseScale);

        if (hasImpacted) {
            // Collision Alert: Crimson Crosshair
            progradeMaterial.color.setHex(0xf43f5e);
            progradeDotMaterial.color.setHex(0xf59e0b);
        } else {
            // Prograde Navigation: Electric Cyan
            progradeMaterial.color.setHex(0x38bdf8);
            progradeDotMaterial.color.setHex(0x10b981);
        }

        progradeMaterial.opacity = reticleAlpha;
        progradeDotMaterial.opacity = reticleAlpha;
    }

    // 4. Update Periapsis (PE) Swing-By Reticle
    if (periapsisGroup) {
        if (bestPeFound && !hasImpacted) {
            periapsisGroup.visible = true;
            periapsisGroup.position.set(_pePos.x, 0.25, _pePos.z);

            const pePulse = 1.0 + Math.sin(timeNow * 7.5) * 0.15;
            periapsisGroup.scale.set(pePulse, pePulse, pePulse);

            const peAlpha = speedFactor * 0.90;
            periapsisMaterial.opacity = peAlpha;
            periapsisDotMaterial.opacity = peAlpha;
        } else {
            periapsisGroup.visible = false;
        }
    }
}

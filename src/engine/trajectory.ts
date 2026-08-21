import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const FLOW_SEGMENTS = 36;
const FLOW_DT = 0.075;
const DASH_RATIO = 0.72;
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

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _impactPos = new THREE.Vector3();
const _reticleTargetPos = new THREE.Vector3();

export function initTrajectory() {
    const vertexCount = FLOW_SEGMENTS * 2;
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

    // Build Holographic Prograde Marker Reticle
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
}

/**
 * Calculates net gravity at pos and checks if pos collides with any solid body.
 * Returns true if position penetrated a planetary or stellar body.
 */
function calculateGravityAndCheckCollision(pos: THREE.Vector3, simTime: number, outAcc: THREE.Vector3, outImpactPoint?: THREE.Vector3): boolean {
    outAcc.set(0, 0, 0);
    const sources = STATE.gravitySources;
    const count = sources.length;
    let collided = false;

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

        // Physical collision boundary (Atmosphere / Surface clearance)
        const impactClearance = source.type === 'star' ? source.radius + 1.2 : source.radius + 0.6;
        if (distSq <= impactClearance * impactClearance) {
            collided = true;
            if (outImpactPoint) {
                const dist = Math.max(0.01, Math.sqrt(distSq));
                outImpactPoint.set(
                    sourceX - (dx / dist) * impactClearance,
                    0.25,
                    sourceZ - (dz / dist) * impactClearance
                );
            }
            break;
        }

        const rangeSq = source.gravityRange * source.gravityRange;
        if (distSq < rangeSq) {
            const distance = Math.sqrt(distSq);
            // Softened Plummer gravity: F = G*M / (r^2 + r_soft^2)
            const forceStrength = (STATE.gConstant * source.mass) / (distSq + SOFTENING_SQ);
            const invDist = 1 / Math.max(0.1, distance);

            outAcc.x += dx * invDist * forceStrength;
            outAcc.z += dz * invDist * forceStrength;
        }
    }

    return collided;
}

export function updateTrajectory() {
    if (!trajectoryLines || !progradeGroup) return;

    const curSpeed = STATE.playerVelocity.length();
    const speedFactor = Math.min(1.0, Math.max(0, (curSpeed - 0.8) / 4.0)); // 0 when parked, 1 when cruising

    // If practically stopped, hide the trajectory completely
    if (curSpeed < 0.6) {
        trajectoryLines.visible = false;
        progradeGroup.visible = false;
        return;
    }

    trajectoryLines.visible = true;
    progradeGroup.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    let hasImpacted = false;
    _reticleTargetPos.copy(STATE.playerPosition);

    // Traveling wave phase for flowing energy beads
    const timeNow = Date.now() * 0.001;
    const wavePhase = (timeNow * 4.2) % (Math.PI * 2);

    for (let seg = 0; seg < FLOW_SEGMENTS; seg++) {
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

        const simTime = seg * FLOW_DT;

        // 1. Segment Start
        _segmentStart.copy(_predPos);

        if (calculateGravityAndCheckCollision(_segmentStart, simTime, _predAcc, _impactPos)) {
            hasImpacted = true;
            _segmentStart.copy(_impactPos);
            _segmentEnd.copy(_impactPos);
            _reticleTargetPos.copy(_impactPos);
        } else {
            const dashDt = FLOW_DT * DASH_RATIO;
            _predVel.addScaledVector(_predAcc, dashDt);
            _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * dashDt));
            _predPos.addScaledVector(_predVel, dashDt);

            // 2. Segment End
            _segmentEnd.copy(_predPos);
            _reticleTargetPos.copy(_segmentEnd);

            if (calculateGravityAndCheckCollision(_segmentEnd, simTime + dashDt, _predAcc, _impactPos)) {
                hasImpacted = true;
                _segmentEnd.copy(_impactPos);
                _reticleTargetPos.copy(_impactPos);
            } else {
                const gapDt = FLOW_DT * (1.0 - DASH_RATIO);
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

        // Dynamic Flowing Light-Pulse Calculation
        const progress = seg / FLOW_SEGMENTS;
        const distFade = Math.pow(1.0 - progress, 1.4); // Smooth taper toward the tip
        const nearFade = Math.min(1.0, seg * 0.4);      // Smooth start right at ship

        // Sine wave traveling forward along the stream
        const flowWave = Math.sin(seg * 0.5 - wavePhase);
        const pulseBoost = (flowWave > 0 ? flowWave * 0.45 : 0.0);

        const totalAlpha = (distFade * nearFade * 0.75 + pulseBoost * 0.35) * speedFactor;

        // Glowing Bioluminescent Cyan / Teal Palette
        const r = 0.12 * totalAlpha;
        const g = 0.85 * totalAlpha;
        const b = 0.95 * totalAlpha;

        trajectoryColors[v0 * 3 + 0] = r;
        trajectoryColors[v0 * 3 + 1] = g;
        trajectoryColors[v0 * 3 + 2] = b;

        trajectoryColors[v1 * 3 + 0] = r;
        trajectoryColors[v1 * 3 + 1] = g;
        trajectoryColors[v1 * 3 + 2] = b;
    }

    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.color.needsUpdate = true;

    // Update Prograde Reticle Position & Animation
    if (progradeGroup) {
        progradeGroup.position.set(_reticleTargetPos.x, 0.25, _reticleTargetPos.z);
        
        // Orient reticle along velocity vector
        const velHeading = Math.atan2(-STATE.playerVelocity.z, STATE.playerVelocity.x);
        progradeGroup.rotation.y = velHeading - Math.PI / 2;

        // Pulsing scale & opacity
        const reticleAlpha = speedFactor * (hasImpacted ? 0.95 : 0.80);
        const pulseScale = (1.0 + Math.sin(timeNow * 6.0) * 0.08);
        progradeGroup.scale.set(pulseScale, pulseScale, pulseScale);

        if (hasImpacted) {
            // Hazard warning color (Amber/Crimson)
            progradeMaterial.color.setHex(0xf43f5e);
            progradeDotMaterial.color.setHex(0xf59e0b);
        } else {
            // Prograde Navigation color (Cyan/Emerald)
            progradeMaterial.color.setHex(0x38bdf8);
            progradeDotMaterial.color.setHex(0x10b981);
        }

        progradeMaterial.opacity = reticleAlpha;
        progradeDotMaterial.opacity = reticleAlpha;
    }
}

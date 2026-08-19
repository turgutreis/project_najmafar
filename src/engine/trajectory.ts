import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const DASH_SEGMENTS = 140;
const TRAJECTORY_DT = 0.08;
const DASH_RATIO = 0.65;
const SOFTENING_SQ = 25.0;

let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryLines: THREE.LineSegments;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _impactPos = new THREE.Vector3();

export function initTrajectory() {
    const vertexCount = DASH_SEGMENTS * 2;
    trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryPositions = new Float32Array(vertexCount * 3);
    trajectoryColors = new Float32Array(vertexCount * 3);

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(trajectoryColors, 3));

    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        linewidth: 2.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    trajectoryLines = new THREE.LineSegments(trajectoryGeometry, material);
    trajectoryLines.frustumCulled = false;
    trajectoryLines.renderOrder = 999;
    scene.add(trajectoryLines);
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
                // Clamp position right on the atmospheric rim
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
    if (!trajectoryLines) return;
    trajectoryLines.visible = true;

    const curSpeed = STATE.playerVelocity.length();
    _predPos.copy(STATE.playerPosition);
    if (curSpeed > 0.05) {
        _predVel.copy(STATE.playerVelocity);
    } else {
        // Minimal heading indicator when stopped
        const fX = Math.cos(STATE.shipHeading || 0);
        const fZ = -Math.sin(STATE.shipHeading || 0);
        _predVel.set(fX * 0.5, 0, fZ * 0.5);
    }

    let hasImpacted = false;

    for (let seg = 0; seg < DASH_SEGMENTS; seg++) {
        const v0 = seg * 2;
        const v1 = seg * 2 + 1;

        if (hasImpacted) {
            // Hide all segments beyond the impact point
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

        const simTime = seg * TRAJECTORY_DT;

        // 1. Dash Start
        _segmentStart.copy(_predPos);

        // Check if start of segment already inside a planet
        if (calculateGravityAndCheckCollision(_segmentStart, simTime, _predAcc, _impactPos)) {
            hasImpacted = true;
            _segmentStart.copy(_impactPos);
            _segmentEnd.copy(_impactPos);
        } else {
            // Advance sub-step for the dash segment length
            const dashDt = TRAJECTORY_DT * DASH_RATIO;
            _predVel.addScaledVector(_predAcc, dashDt);
            _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * dashDt));
            _predPos.addScaledVector(_predVel, dashDt);

            // 2. Dash End
            _segmentEnd.copy(_predPos);

            // Check if end of dash impacted a planet
            if (calculateGravityAndCheckCollision(_segmentEnd, simTime + dashDt, _predAcc, _impactPos)) {
                hasImpacted = true;
                _segmentEnd.copy(_impactPos);
            } else {
                // Advance sub-step for the gap
                const gapDt = TRAJECTORY_DT * (1.0 - DASH_RATIO);
                calculateGravityAndCheckCollision(_predPos, simTime + dashDt, _predAcc);
                _predVel.addScaledVector(_predAcc, gapDt);
                _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * gapDt));
                _predPos.addScaledVector(_predVel, gapDt);
            }
        }

        // Store vertices
        trajectoryPositions[v0 * 3 + 0] = _segmentStart.x;
        trajectoryPositions[v0 * 3 + 1] = 0.25;
        trajectoryPositions[v0 * 3 + 2] = _segmentStart.z;

        trajectoryPositions[v1 * 3 + 0] = _segmentEnd.x;
        trajectoryPositions[v1 * 3 + 1] = 0.25;
        trajectoryPositions[v1 * 3 + 2] = _segmentEnd.z;

        // Smooth alpha fade across distance
        const progress = seg / DASH_SEGMENTS;
        const alpha = Math.max(0.06, Math.pow(1.0 - progress, 1.2) * 0.92);

        // Azure / Cyan glowing navigation color
        const r = 0.20 * alpha;
        const g = 0.76 * alpha;
        const b = 0.98 * alpha;

        trajectoryColors[v0 * 3 + 0] = r;
        trajectoryColors[v0 * 3 + 1] = g;
        trajectoryColors[v0 * 3 + 2] = b;

        trajectoryColors[v1 * 3 + 0] = r;
        trajectoryColors[v1 * 3 + 1] = g;
        trajectoryColors[v1 * 3 + 2] = b;
    }

    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.color.needsUpdate = true;
}

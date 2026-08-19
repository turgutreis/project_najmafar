import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const DASH_SEGMENTS = 140; // 140 dashed road segments (280 vertices)
const TRAJECTORY_DT = 0.08;
const DASH_RATIO = 0.65; // 65% dash, 35% gap
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
    trajectoryLines.frustumCulled = false; // Prevent Three.js from culling when moving away from origin (0,0,0)
    trajectoryLines.renderOrder = 999;
    scene.add(trajectoryLines);
}

function calculateGravityAt(pos: THREE.Vector3, simTime: number, outAcc: THREE.Vector3) {
    outAcc.set(0, 0, 0);
    const sources = STATE.gravitySources;
    const count = sources.length;

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

    for (let seg = 0; seg < DASH_SEGMENTS; seg++) {
        const simTime = seg * TRAJECTORY_DT;

        // 1. Dash Start
        _segmentStart.copy(_predPos);

        // Advance sub-step for the dash segment length
        const dashDt = TRAJECTORY_DT * DASH_RATIO;
        calculateGravityAt(_predPos, simTime, _predAcc);
        _predVel.addScaledVector(_predAcc, dashDt);
        _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * dashDt));
        _predPos.addScaledVector(_predVel, dashDt);

        // 2. Dash End
        _segmentEnd.copy(_predPos);

        // Advance sub-step for the gap
        const gapDt = TRAJECTORY_DT * (1.0 - DASH_RATIO);
        calculateGravityAt(_predPos, simTime + dashDt, _predAcc);
        _predVel.addScaledVector(_predAcc, gapDt);
        _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * gapDt));
        _predPos.addScaledVector(_predVel, gapDt);

        // Store vertices (2 vertices per dash segment)
        const v0 = seg * 2;
        const v1 = seg * 2 + 1;

        trajectoryPositions[v0 * 3 + 0] = _segmentStart.x;
        trajectoryPositions[v0 * 3 + 1] = 0.25;
        trajectoryPositions[v0 * 3 + 2] = _segmentStart.z;

        trajectoryPositions[v1 * 3 + 0] = _segmentEnd.x;
        trajectoryPositions[v1 * 3 + 1] = 0.25;
        trajectoryPositions[v1 * 3 + 2] = _segmentEnd.z;

        // Smooth alpha fade across distance
        const progress = seg / DASH_SEGMENTS;
        const alpha = Math.max(0.06, Math.pow(1.0 - progress, 1.2) * 0.92);

        // Holographic Azure / Electric Cyan
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

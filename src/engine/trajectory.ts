import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 140;
const TRAJECTORY_DT = 0.08;

let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryLine: THREE.Line;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _thrustAcc = new THREE.Vector3();

export function initTrajectory() {
    trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryPositions = new Float32Array(TRAJECTORY_STEPS * 3);
    trajectoryColors = new Float32Array(TRAJECTORY_STEPS * 3);

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(trajectoryColors, 3));

    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    trajectoryLine = new THREE.Line(trajectoryGeometry, material);
    scene.add(trajectoryLine);
}

export function updateTrajectory() {
    if (!trajectoryLine) return;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    const isThrusting = STATE.keys ? STATE.keys.w : false;
    const isBraking = STATE.keys ? (STATE.keys.s || STATE.spaceBrakeActive) : false;

    if (isThrusting) {
        const hasEnergy = STATE.bioEnergy > 0;
        const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;
        const thrustMult = (STATE.crewBuffs ? STATE.crewBuffs.thrust : 1.0);

        const fX = Math.cos(STATE.shipHeading || 0);
        const fZ = -Math.sin(STATE.shipHeading || 0);
        _thrustAcc.set(fX, 0, fZ).multiplyScalar(effectiveThrust * thrustMult);
    } else if (isBraking) {
        if (_predVel.lengthSq() > 0.1) {
            _thrustAcc.copy(_predVel).normalize().negate().multiplyScalar(STATE.retroThrustStrength);
        } else {
            _thrustAcc.set(0, 0, 0);
        }
    } else {
        _thrustAcc.set(0, 0, 0);
    }

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        trajectoryPositions[step * 3 + 0] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.1;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        const progress = step / TRAJECTORY_STEPS;
        const alpha = Math.pow(1.0 - progress, 1.2) * 0.9;

        // Color coding: Emerald when actively accelerating, Cyan / Azure when coasting on gravity
        if (isThrusting) {
            trajectoryColors[step * 3 + 0] = 0.05 * alpha;
            trajectoryColors[step * 3 + 1] = 0.95 * alpha;
            trajectoryColors[step * 3 + 2] = 0.65 * alpha;
        } else if (isBraking) {
            trajectoryColors[step * 3 + 0] = 0.95 * alpha;
            trajectoryColors[step * 3 + 1] = 0.25 * alpha;
            trajectoryColors[step * 3 + 2] = 0.35 * alpha;
        } else {
            trajectoryColors[step * 3 + 0] = 0.20 * alpha;
            trajectoryColors[step * 3 + 1] = 0.75 * alpha;
            trajectoryColors[step * 3 + 2] = 0.98 * alpha;
        }

        _predAcc.copy(_thrustAcc);

        // Calculate gravitational acceleration at this predicted point in space
        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            const dx = source.position.x - _predPos.x;
            const dz = source.position.z - _predPos.z;
            const distSq = dx * dx + dz * dz;
            const rangeSq = source.gravityRange * source.gravityRange;

            if (distSq < rangeSq && distSq > 0.01) {
                const distance = Math.sqrt(distSq);
                const clampedDist = Math.max(distance, source.radius * 1.15);
                const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);
                const invDist = 1 / distance;

                _predAcc.x += dx * invDist * forceStrength;
                _predAcc.z += dz * invDist * forceStrength;
            }
        }

        _predVel.addScaledVector(_predAcc, TRAJECTORY_DT);
        _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * TRAJECTORY_DT));
        _predPos.addScaledVector(_predVel, TRAJECTORY_DT);
    }

    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.color.needsUpdate = true;
}

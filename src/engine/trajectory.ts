import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 160;
const TRAJECTORY_DT = 0.08;

let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryLine: THREE.Line;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _thrustAcc = new THREE.Vector3();
const _inputDir = new THREE.Vector3();

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
        blending: THREE.AdditiveBlending
    });

    trajectoryLine = new THREE.Line(trajectoryGeometry, material);
    scene.add(trajectoryLine);
}

export function updateTrajectory() {
    if (!trajectoryLine) return;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    _inputDir.set(0, 0, 0);
    if (STATE.keys.w) _inputDir.z -= 1;
    if (STATE.keys.s) _inputDir.z += 1;
    if (STATE.keys.a) _inputDir.x -= 1;
    if (STATE.keys.d) _inputDir.x += 1;

    const isThrusting = _inputDir.lengthSq() > 0;
    if (isThrusting) {
        _inputDir.normalize();
        const thrustMult = (STATE.crewBuffs ? STATE.crewBuffs.thrust : 1.0);
        _thrustAcc.copy(_inputDir).multiplyScalar(STATE.thrustStrength * thrustMult);
    } else {
        _thrustAcc.set(0, 0, 0);
    }

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        trajectoryPositions[step * 3] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.1;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        const progress = step / TRAJECTORY_STEPS;
        const alpha = 1.0 - progress * 0.9;

        if (isThrusting) {
            trajectoryColors[step * 3] = 0.0 * alpha;
            trajectoryColors[step * 3 + 1] = 1.0 * alpha;
            trajectoryColors[step * 3 + 2] = 0.53 * alpha;
        } else {
            trajectoryColors[step * 3] = 0.22 * alpha;
            trajectoryColors[step * 3 + 1] = 0.74 * alpha;
            trajectoryColors[step * 3 + 2] = 0.97 * alpha;
        }

        _predAcc.copy(_thrustAcc);

        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            const dx = source.position.x - _predPos.x;
            const dz = source.position.z - _predPos.z;
            const distSq = dx * dx + dz * dz;
            const rangeSq = source.gravityRange * source.gravityRange;

            if (distSq < rangeSq && distSq > 0.01) {
                const distance = Math.sqrt(distSq);
                const clampedDist = Math.max(distance, source.radius * 1.1);
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

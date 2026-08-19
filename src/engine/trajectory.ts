import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 65;
const TRAJECTORY_DT = 0.055;

let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryLine: THREE.Line;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();

export function initTrajectory() {
    trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryPositions = new Float32Array(TRAJECTORY_STEPS * 3);
    trajectoryColors = new Float32Array(TRAJECTORY_STEPS * 3);

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(trajectoryColors, 3));

    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        linewidth: 1.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    trajectoryLine = new THREE.Line(trajectoryGeometry, material);
    scene.add(trajectoryLine);
}

export function updateTrajectory() {
    if (!trajectoryLine) return;

    const curSpeed = STATE.playerVelocity.length();

    // Hide or collapse trajectory when ship is nearly motionless
    if (curSpeed < 0.4) {
        trajectoryLine.visible = false;
        return;
    }
    trajectoryLine.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        trajectoryPositions[step * 3 + 0] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.1;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        // Smooth quadratic alpha fade-out into the distance
        const t = step / TRAJECTORY_STEPS;
        const alpha = Math.pow(1.0 - t, 1.8) * Math.min(1.0, (curSpeed - 0.4) * 2.0);

        // Soft Cyan / Psionic Azure line color
        trajectoryColors[step * 3 + 0] = 0.22 * alpha;
        trajectoryColors[step * 3 + 1] = 0.75 * alpha;
        trajectoryColors[step * 3 + 2] = 0.98 * alpha;

        // Gravitational prediction across planetary/solar wells
        _predAcc.set(0, 0, 0);

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

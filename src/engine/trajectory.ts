import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 85;
const TRAJECTORY_DT = 0.07;
const SOFTENING_SQ = 9.0; // Plummer gravitational softening to prevent numerical singularity spikes

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

    const curSpeed = STATE.playerVelocity.length();
    const isThrusting = STATE.keys ? STATE.keys.w : false;
    const isBraking = STATE.keys ? (STATE.keys.s || STATE.spaceBrakeActive) : false;

    // Smooth visibility
    if (curSpeed < 0.2 && !isThrusting) {
        trajectoryLine.visible = false;
        return;
    }
    trajectoryLine.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    // If actively thrusting, add initial immediate impulse
    if (isThrusting) {
        const hasEnergy = STATE.bioEnergy > 0;
        const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;
        const fX = Math.cos(STATE.shipHeading || 0);
        const fZ = -Math.sin(STATE.shipHeading || 0);
        _predVel.x += fX * effectiveThrust * 0.12;
        _predVel.z += fZ * effectiveThrust * 0.12;
    }

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;
    let hitBody = false;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        if (hitBody) {
            // Fill remaining steps with the last impact point to avoid buffer stretching
            trajectoryPositions[step * 3 + 0] = _predPos.x;
            trajectoryPositions[step * 3 + 1] = 0.1;
            trajectoryPositions[step * 3 + 2] = _predPos.z;

            trajectoryColors[step * 3 + 0] = 0;
            trajectoryColors[step * 3 + 1] = 0;
            trajectoryColors[step * 3 + 2] = 0;
            continue;
        }

        trajectoryPositions[step * 3 + 0] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.1;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        const progress = step / TRAJECTORY_STEPS;
        const alpha = Math.pow(1.0 - progress, 1.4) * 0.95;

        if (isThrusting) {
            trajectoryColors[step * 3 + 0] = 0.10 * alpha;
            trajectoryColors[step * 3 + 1] = 0.95 * alpha;
            trajectoryColors[step * 3 + 2] = 0.65 * alpha;
        } else if (isBraking) {
            trajectoryColors[step * 3 + 0] = 0.95 * alpha;
            trajectoryColors[step * 3 + 1] = 0.30 * alpha;
            trajectoryColors[step * 3 + 2] = 0.35 * alpha;
        } else {
            trajectoryColors[step * 3 + 0] = 0.22 * alpha;
            trajectoryColors[step * 3 + 1] = 0.75 * alpha;
            trajectoryColors[step * 3 + 2] = 0.98 * alpha;
        }

        // Calculate net gravitational pull with orbital motion prediction
        _predAcc.set(0, 0, 0);
        const simTime = step * TRAJECTORY_DT;

        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            let sourceX = source.position.x;
            let sourceZ = source.position.z;

            // If source is an active orbiting planet, predict its future orbital position
            if (source.type === 'planet') {
                const planetEntry = activePlanets.find(p => p.source === source);
                if (planetEntry && !planetEntry.isMoon) {
                    const futureAngle = planetEntry.angle + planetEntry.speed * simTime;
                    sourceX = planetEntry.distance * Math.cos(futureAngle);
                    sourceZ = planetEntry.distance * Math.sin(futureAngle);
                }
            }

            const dx = sourceX - _predPos.x;
            const dz = sourceZ - _predPos.z;
            const distSq = dx * dx + dz * dz;

            // Surface collision check
            if (distSq <= source.radius * source.radius) {
                hitBody = true;
                break;
            }

            const rangeSq = source.gravityRange * source.gravityRange;
            if (distSq < rangeSq) {
                const distance = Math.sqrt(distSq);
                // Softened Newtonian gravity: F = G*M / (r^2 + eps^2)
                const forceStrength = (STATE.gConstant * source.mass) / (distSq + SOFTENING_SQ);
                const invDist = 1 / Math.max(0.1, distance);

                _predAcc.x += dx * invDist * forceStrength;
                _predAcc.z += dz * invDist * forceStrength;
            }
        }

        // Velocity Verlet / Exponential Damping Integration
        _predVel.addScaledVector(_predAcc, TRAJECTORY_DT);
        _predVel.multiplyScalar(Math.exp(-STATE.currentDrag * TRAJECTORY_DT));
        _predPos.addScaledVector(_predVel, TRAJECTORY_DT);
    }

    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.color.needsUpdate = true;
}

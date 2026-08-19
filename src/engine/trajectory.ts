import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 120;
const TRAJECTORY_DT = 0.07;
const SOFTENING_SQ = 16.0;

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
        opacity: 0.9,
        linewidth: 2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    trajectoryLine = new THREE.Line(trajectoryGeometry, material);
    scene.add(trajectoryLine);
}

export function updateTrajectory() {
    if (!trajectoryLine) return;
    trajectoryLine.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    const isThrusting = STATE.keys ? STATE.keys.w : false;
    const isBraking = STATE.keys ? STATE.keys.s : false;

    // Apply immediate impulse if thrusting
    if (isThrusting) {
        const hasEnergy = STATE.bioEnergy > 0;
        const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;
        const fX = Math.cos(STATE.shipHeading || 0);
        const fZ = -Math.sin(STATE.shipHeading || 0);
        _predVel.x += fX * effectiveThrust * 0.25;
        _predVel.z += fZ * effectiveThrust * 0.25;
    }

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        trajectoryPositions[step * 3 + 0] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.2;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        const progress = step / TRAJECTORY_STEPS;
        const alpha = Math.max(0.05, Math.pow(1.0 - progress, 1.1) * 0.9);

        if (isThrusting) {
            // Emerald thrust vector
            trajectoryColors[step * 3 + 0] = 0.05 * alpha;
            trajectoryColors[step * 3 + 1] = 0.95 * alpha;
            trajectoryColors[step * 3 + 2] = 0.55 * alpha;
        } else if (isBraking) {
            // Amber / Red retro-brake vector
            trajectoryColors[step * 3 + 0] = 0.95 * alpha;
            trajectoryColors[step * 3 + 1] = 0.40 * alpha;
            trajectoryColors[step * 3 + 2] = 0.20 * alpha;
        } else {
            // Azure / Cyan orbital gravity path
            trajectoryColors[step * 3 + 0] = 0.20 * alpha;
            trajectoryColors[step * 3 + 1] = 0.75 * alpha;
            trajectoryColors[step * 3 + 2] = 0.98 * alpha;
        }

        _predAcc.set(0, 0, 0);
        const simTime = step * TRAJECTORY_DT;

        // Calculate gravity at this projected point
        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            let sourceX = source.position.x;
            let sourceZ = source.position.z;

            // Account for moving planets in orbital prediction
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
            const rangeSq = source.gravityRange * source.gravityRange;

            if (distSq < rangeSq) {
                const distance = Math.sqrt(distSq);
                const forceStrength = (STATE.gConstant * source.mass) / (distSq + SOFTENING_SQ);
                const invDist = 1 / Math.max(0.1, distance);

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

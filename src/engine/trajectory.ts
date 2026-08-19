import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from './scene';

const TRAJECTORY_STEPS = 80;
const TRAJECTORY_DT = 0.065;
const SOFTENING_SQ = 12.0;

let trajectoryPoints: THREE.Points;
let trajectoryGeometry: THREE.BufferGeometry;
let trajectoryPositions: Float32Array;
let trajectoryColors: Float32Array;
let trajectorySizes: Float32Array;

const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();

export function initTrajectory() {
    trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryPositions = new Float32Array(TRAJECTORY_STEPS * 3);
    trajectoryColors = new Float32Array(TRAJECTORY_STEPS * 3);
    trajectorySizes = new Float32Array(TRAJECTORY_STEPS);

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(trajectoryColors, 3));
    trajectoryGeometry.setAttribute('size', new THREE.BufferAttribute(trajectorySizes, 1));

    // Create a smooth glowing circular dot texture for holographic nav nodes
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(56, 189, 248, 0.85)');
    grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const dotTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 2.2,
        vertexColors: true,
        map: dotTexture,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    trajectoryPoints = new THREE.Points(trajectoryGeometry, material);
    scene.add(trajectoryPoints);
}

export function updateTrajectory() {
    if (!trajectoryPoints) return;

    const curSpeed = STATE.playerVelocity.length();
    const isThrusting = STATE.keys ? STATE.keys.w : false;

    // Fade out when almost completely stopped
    if (curSpeed < 0.3 && !isThrusting) {
        trajectoryPoints.visible = false;
        return;
    }
    trajectoryPoints.visible = true;

    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);

    // If thrusting W, add initial impulse in heading direction
    if (isThrusting) {
        const hasEnergy = STATE.bioEnergy > 0;
        const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;
        const fX = Math.cos(STATE.shipHeading || 0);
        const fZ = -Math.sin(STATE.shipHeading || 0);
        _predVel.x += fX * effectiveThrust * 0.15;
        _predVel.z += fZ * effectiveThrust * 0.15;
    }

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;
    let hitSurface = false;

    for (let step = 0; step < TRAJECTORY_STEPS; step++) {
        if (hitSurface) {
            // Hide remaining steps if trajectory crashed into a celestial body
            trajectoryPositions[step * 3 + 0] = _predPos.x;
            trajectoryPositions[step * 3 + 1] = -100;
            trajectoryPositions[step * 3 + 2] = _predPos.z;
            trajectoryColors[step * 3 + 0] = 0;
            trajectoryColors[step * 3 + 1] = 0;
            trajectoryColors[step * 3 + 2] = 0;
            continue;
        }

        trajectoryPositions[step * 3 + 0] = _predPos.x;
        trajectoryPositions[step * 3 + 1] = 0.2;
        trajectoryPositions[step * 3 + 2] = _predPos.z;

        const progress = step / TRAJECTORY_STEPS;
        // Smooth fade out into distance
        const alpha = Math.pow(1.0 - progress, 1.2);

        // Color coding: Emerald when thrusting, Cyan when drifting in gravity orbit
        if (isThrusting) {
            trajectoryColors[step * 3 + 0] = 0.1 * alpha;
            trajectoryColors[step * 3 + 1] = 0.95 * alpha;
            trajectoryColors[step * 3 + 2] = 0.6 * alpha;
        } else {
            trajectoryColors[step * 3 + 0] = 0.2 * alpha;
            trajectoryColors[step * 3 + 1] = 0.75 * alpha;
            trajectoryColors[step * 3 + 2] = 0.98 * alpha;
        }

        // Calculate gravity at predicted position with moving planet orbits
        _predAcc.set(0, 0, 0);
        const simTime = step * TRAJECTORY_DT;

        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            let sourceX = source.position.x;
            let sourceZ = source.position.z;

            // Move orbiting planets in simulation time
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

            if (distSq <= source.radius * source.radius) {
                hitSurface = true;
                break;
            }

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

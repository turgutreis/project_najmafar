import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { camera, scene } from './scene';
import { playCrashSound, playBioCollectSound, playSiliconCollectSound } from './audio';
import { targetReticleGroup, createTargetReticle } from '../procedural/meshes';
import { addLogEntry, updateHUDStats } from '../ui/hud';
import { updateScannerUI } from '../systems/scanner';
import { updateMutationUI } from '../ui/deck';
import { triggerGameOver } from './game-over';

// Cached vectors for zero GC pressure
const _predPos = new THREE.Vector3();
const _bounceDir = new THREE.Vector3();
const _inputDir = new THREE.Vector3();

export function updatePhysics(dt: number) {
    // 0. Detect nearest planetary sub-system
    let nearestPlanet: any = null;
    let nearestPlanetDist = Infinity;

    activePlanets.forEach(p => {
        if (!p.isMoon) {
            const dx = STATE.playerPosition.x - p.mesh.position.x;
            const dz = STATE.playerPosition.z - p.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < nearestPlanetDist) {
                nearestPlanetDist = dist;
                nearestPlanet = p;
            }
        }
    });

    const orbitTriggerDist = 55.0;
    if (nearestPlanet && nearestPlanetDist < orbitTriggerDist) {
        STATE.isInPlanetOrbit = true;
        STATE.orbitPlanet = nearestPlanet;
        const rawProximity = Math.max(0, Math.min(1.0, 1.0 - (nearestPlanetDist / orbitTriggerDist)));
        const easedProximity = Math.sin(rawProximity * Math.PI / 2);
        STATE.orbitZoomFactor = THREE.MathUtils.lerp(STATE.orbitZoomFactor || 0, easedProximity, Math.min(1.0, dt * 4.0));
    } else {
        STATE.isInPlanetOrbit = false;
        STATE.orbitZoomFactor = THREE.MathUtils.lerp(STATE.orbitZoomFactor || 0, 0, Math.min(1.0, dt * 3.0));
    }

    const zoomFactor = STATE.orbitZoomFactor || 0;

    // 1. Update celestial orbits (Planets around star, Moons around parent planet)
    activePlanets.forEach(p => {
        if (!p.isMoon) {
            p.angle += dt * p.speed;
            const px = p.distance * Math.cos(p.angle);
            const pz = p.distance * Math.sin(p.angle);

            p.mesh.position.set(px, 0, pz);
            p.source.position.set(px, 0, pz);
            if (p.ringMesh) {
                p.ringMesh.position.set(px, 0, pz);
            }

            // Dynamic Planetary Scale: Planet expands smoothly into a colossal world in orbit mode
            const isFocus = STATE.isInPlanetOrbit && STATE.orbitPlanet === p;
            const targetScale = isFocus ? (1.0 + 1.8 * zoomFactor) : 1.0;
            const curScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetScale, Math.min(1.0, dt * 4.0));
            p.mesh.scale.set(curScale, curScale, curScale);
            p.source.radius = p.size * curScale;

            if (p.bodyMesh) {
                p.bodyMesh.rotation.y += (p.type === 'Gas Giant' ? 0.22 : 0.16) * dt;
            }
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += 0.22 * dt;
            }
            if (p.psioAuraMesh) {
                const aPulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.15;
                p.psioAuraMesh.scale.set(aPulse, aPulse, aPulse);
            }
        }
    });

    activePlanets.forEach(m => {
        if (m.isMoon && m.parentPlanet) {
            // Dynamic Sub-System Moon Expansion
            const isParentFocus = STATE.isInPlanetOrbit && (STATE.orbitPlanet === m.parentPlanet || STATE.orbitPlanet === m);
            const baseDist = m.baseDistance || m.distance || 6.0;
            const targetMoonDist = isParentFocus ? (baseDist + 24.0 * zoomFactor) : baseDist;
            m.distance = THREE.MathUtils.lerp(m.distance, targetMoonDist, Math.min(1.0, dt * 4.0));

            const targetMoonScale = isParentFocus ? (1.0 + 0.9 * zoomFactor) : 1.0;
            const curMScale = THREE.MathUtils.lerp(m.mesh.scale.x, targetMoonScale, Math.min(1.0, dt * 4.0));
            m.mesh.scale.set(curMScale, curMScale, curMScale);
            m.source.radius = m.size * curMScale;

            m.angle += dt * m.speed;
            const parentPos = m.parentPlanet.mesh.position;
            const mx = parentPos.x + m.distance * Math.cos(m.angle);
            const mz = parentPos.z + m.distance * Math.sin(m.angle);

            m.mesh.position.set(mx, 0, mz);
            m.source.position.set(mx, 0, mz);
            if (m.ringMesh) {
                m.ringMesh.position.copy(parentPos);
                const rScale = m.distance / baseDist;
                m.ringMesh.scale.set(rScale, 1, rScale);
            }

            if (m.bodyMesh) {
                m.bodyMesh.rotation.y += 0.20 * dt;
            }
        }
    });

    // 1.1 Asteroids 3D Tumbling Rotation
    STATE.gravitySources.forEach(s => {
        if (s.type === 'asteroid' && s.mesh && s.rotSpeed && !s.isAbsorbed) {
            s.mesh.rotation.x += s.rotSpeed.x * dt;
            s.mesh.rotation.y += s.rotSpeed.y * dt;
            s.mesh.rotation.z += s.rotSpeed.z * dt;
        }
    });

    // 2. Update 3D Target Reticle
    if (STATE.lockedTarget && STATE.lockedTarget.mesh) {
        if (!targetReticleGroup) createTargetReticle();
        if (targetReticleGroup) {
            targetReticleGroup.visible = true;
            targetReticleGroup.position.set(
                STATE.lockedTarget.mesh.position.x,
                0.4,
                STATE.lockedTarget.mesh.position.z
            );
            
            const curVisualScale = STATE.lockedTarget.mesh.scale.x || 1.0;
            const baseSize = STATE.lockedTarget.size || 2.5;
            const scale = baseSize * curVisualScale * 1.45;
            const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.08;
            targetReticleGroup.scale.set(scale * pulse, scale * pulse, scale * pulse);

            if (targetReticleGroup.children[0]) targetReticleGroup.children[0].rotation.z += dt * 1.2;
            if (targetReticleGroup.children[1]) targetReticleGroup.children[1].rotation.z -= dt * 0.8;
        }
    } else {
        if (targetReticleGroup) targetReticleGroup.visible = false;
    }

    // 3. Calculate closest or locked planet distance & update Scanner UI
    let targetPlanet: any = null;
    let targetDist = Infinity;

    if (STATE.lockedTarget && STATE.lockedTarget.mesh) {
        targetPlanet = STATE.lockedTarget;
        const dx = STATE.playerPosition.x - targetPlanet.mesh.position.x;
        const dz = STATE.playerPosition.z - targetPlanet.mesh.position.z;
        targetDist = Math.sqrt(dx * dx + dz * dz);
    } else {
        let minDist = Infinity;
        let closestPlanet: any = null;
        activePlanets.forEach(p => {
            const dx = STATE.playerPosition.x - p.mesh.position.x;
            const dz = STATE.playerPosition.z - p.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDist) {
                minDist = dist;
                closestPlanet = p;
            }
        });
        targetPlanet = closestPlanet;
        targetDist = minDist;
    }

    STATE.nearestPlanet = targetPlanet;
    updateScannerUI(targetPlanet, targetDist);

    // 4. Multi-Body Gravity Calculation (Inverse-square law with Softening)
    let netGx = 0;
    let netGz = 0;

    const sources = STATE.gravitySources;
    const count = sources.length;

    for (let i = 0; i < count; i++) {
        const s = sources[i];
        if (s.isAbsorbed) continue;

        const dx = s.position.x - STATE.playerPosition.x;
        const dz = s.position.z - STATE.playerPosition.z;
        const distSq = dx * dx + dz * dz;
        const rangeSq = s.gravityRange * s.gravityRange;

        if (distSq < rangeSq) {
            const dist = Math.sqrt(distSq);
            // Softened Plummer gravity: F = G*M / (r^2 + 25.0)
            const gForce = (STATE.gConstant * s.mass) / (distSq + 25.0);
            const invDist = 1 / Math.max(0.1, dist);

            netGx += dx * invDist * gForce;
            netGz += dz * invDist * gForce;
        }
    }

    STATE.playerVelocity.addScaledVector(STATE.playerAcceleration, dt);
    STATE.playerVelocity.x += netGx * dt;
    STATE.playerVelocity.z += netGz * dt;

    // 5. Apply Natural Vacuum Drag / Momentum preservation
    const effectiveDrag = STATE.currentDrag;
    STATE.playerVelocity.multiplyScalar(Math.exp(-effectiveDrag * dt));

    // Top Speed Clamp (Swift cosmic cruise speed)
    const pilotMult = STATE.crewBuffs ? (STATE.crewBuffs.thrust || 1.0) : 1.0;
    const maxSpeed = 36.0 * Math.max(1.0, pilotMult * 0.85);
    const curSpeed = STATE.playerVelocity.length();
    if (curSpeed > maxSpeed) {
        STATE.playerVelocity.multiplyScalar(maxSpeed / curSpeed);
    }

    // Update real-time speed in state for HUD
    STATE.shipSpeed = curSpeed;

    // 6. Integrate Position
    STATE.playerPosition.x += STATE.playerVelocity.x * dt;
    STATE.playerPosition.z += STATE.playerVelocity.z * dt;

    // Boundary wrapping (Vast Solar System Scale)
    const maxBound = 850;
    if (STATE.playerPosition.x > maxBound) { STATE.playerPosition.x = -maxBound; }
    if (STATE.playerPosition.x < -maxBound) { STATE.playerPosition.x = maxBound; }
    if (STATE.playerPosition.z > maxBound) { STATE.playerPosition.z = -maxBound; }
    if (STATE.playerPosition.z < -maxBound) { STATE.playerPosition.z = maxBound; }

    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);
    }

    // 6.5 Dynamic Framing
    let targetCamX = STATE.playerPosition.x;
    let targetCamZ = STATE.playerPosition.z;

    if (STATE.isInPlanetOrbit && STATE.orbitPlanet) {
        const framingWeight = 0.18 * zoomFactor;
        targetCamX = THREE.MathUtils.lerp(STATE.playerPosition.x, STATE.orbitPlanet.mesh.position.x, framingWeight);
        targetCamZ = THREE.MathUtils.lerp(STATE.playerPosition.z, STATE.orbitPlanet.mesh.position.z, framingWeight);
    }

    // Camera follow (Stable Height, Ship stays sleek & proportional)
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, Math.min(1.0, dt * 5.5));
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, Math.min(1.0, dt * 5.5));
    STATE.cameraHeight = 65.0;
    camera.position.y = 65.0;

    if (camera.fov !== 60.0) {
        camera.fov = 60.0;
        camera.updateProjectionMatrix();
    }

    // Check for Critical Biological Collapse (Game Over)
    if (STATE.health <= 0 && !STATE.isGameOver && STATE.gameStarted) {
        triggerGameOver("Biologischer Zellkern kollabiert durch extreme Umwelteinflüsse & Hüllenschaden.");
        return;
    }

    // 7. Update Collisions
    updateCollisions(dt);

    // 8. Passive Engineer Repair (Requires Silicon Nanites)
    if (STATE.crewBuffs && STATE.crewBuffs.repairRate > 0 && STATE.siliconRes >= 0.15 && STATE.health < STATE.maxHealth) {
        STATE.health = Math.min(STATE.maxHealth, STATE.health + STATE.crewBuffs.repairRate * dt);
        STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.25 * dt);
    }
}

function updateCollisions(dt: number) {
    const sources = STATE.gravitySources;
    const count = sources.length;

    for (let i = 0; i < count; i++) {
        const s = sources[i];
        if (s.isAbsorbed) continue;

        const dx = STATE.playerPosition.x - s.position.x;
        const dz = STATE.playerPosition.z - s.position.z;
        const distSq = dx * dx + dz * dz;

        // Resource Asteroids: Absorb on proximity
        if (s.isResource) {
            const collectRadius = s.radius + 1.8;
            if (distSq < collectRadius * collectRadius) {
                s.isAbsorbed = true;
                if (s.mesh) scene.remove(s.mesh);

                if (s.resourceType === 'bio') {
                    const gain = Math.round(((s as any).yield || 15) * (STATE.crewBuffs ? STATE.crewBuffs.bioGain : 1.0));
                    STATE.bioRes += gain;
                    addLogEntry("HARVEST", `+${gain} Biomasse geborgen (${s.name}).`);
                    playBioCollectSound();
                } else if (s.resourceType === 'silicon') {
                    const gain = Math.round((s as any).yield || 20);
                    STATE.siliconRes += gain;
                    addLogEntry("HARVEST", `+${gain} Silizium extrahiert (${s.name}).`);
                    playSiliconCollectSound();
                }

                updateHUDStats();
                updateMutationUI();
                continue;
            }
        }

        // Solid Celestial Collisions (Star, Planets, Moons)
        const minDist = s.type === 'star' ? s.radius + 1.2 : s.radius + 0.8;

        if (distSq < minDist * minDist) {
            const dist = Math.max(0.01, Math.sqrt(distSq));
            const nx = dx / dist;
            const nz = dz / dist;

            // Push ship smoothly to the atmospheric boundary
            STATE.playerPosition.x = s.position.x + nx * minDist;
            STATE.playerPosition.z = s.position.z + nz * minDist;

            if (STATE.playerGroup) {
                STATE.playerGroup.position.copy(STATE.playerPosition);
            }

            // Atmospheric Glide
            const inwardSpeed = STATE.playerVelocity.x * (-nx) + STATE.playerVelocity.z * (-nz);

            if (inwardSpeed > 0) {
                _bounceDir.set(nx, 0, nz);
                STATE.playerVelocity.addScaledVector(_bounceDir, inwardSpeed * 1.05);
                STATE.playerVelocity.multiplyScalar(0.92);

                if (inwardSpeed > 4.0) {
                    const rawDamage = Math.min(25, Math.floor(inwardSpeed * 1.5));
                    const armor = STATE.mutations?.armor?.purchased ? 0.35 : 0;
                    const dmg = Math.max(1, Math.floor(rawDamage * (1 - armor)));
                    STATE.health = Math.max(0, STATE.health - dmg);

                    playCrashSound();
                    addLogEntry("WARN", `Atmosphären-Kollision mit ${s.name}! -${dmg}% Hülle.`);
                    updateHUDStats();
                }
            }
        }
    }
}

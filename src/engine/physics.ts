import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { PlanetEntry } from '../types/game';
import { camera, scene } from './scene';
import { playCrashSound, playBioCollectSound, playSiliconCollectSound, playWarpSnapSound } from './audio';
import { clearActiveSystem, spawnPlanetsAndAsteroids, initiateSystemArrival } from '../systems/universe';
import { targetReticleGroup, createTargetReticle, updateTargetReticleState } from '../procedural/meshes';
import { addLogEntry, updateHUDStats } from '../ui/hud';
import { updateScannerUI } from '../systems/scanner';
import { updateMutationUI } from '../ui/deck';
import { triggerGameOver } from './game-over';

// Cached vectors for zero GC pressure
const _predPos = new THREE.Vector3();
const _bounceDir = new THREE.Vector3();
const _inputDir = new THREE.Vector3();

export function updatePhysics(dt: number) {
    // 0. Detect nearest planetary sub-system and nearest moon
    let nearestPlanet: PlanetEntry | null = null;
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

    let nearestMoon: PlanetEntry | null = null;
    let nearestMoonDist = Infinity;

    activePlanets.forEach(m => {
        if (m.isMoon) {
            const dx = STATE.playerPosition.x - m.mesh.position.x;
            const dz = STATE.playerPosition.z - m.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < nearestMoonDist) {
                nearestMoonDist = dist;
                nearestMoon = m;
            }
        }
    });

    // Continuous Distance-Based Cosmic Approach Calculation
    // As the player travels towards a planet across space (from 100 LJ down to 7 LJ),
    // the planet smoothly and continuously swells in size, and the camera descends in tandem.
    const planetApproachMax = 100.0;
    const planetApproachMin = 7.0;
    const rawPlanetApproach = nearestPlanet
        ? THREE.MathUtils.clamp((planetApproachMax - nearestPlanetDist) / (planetApproachMax - planetApproachMin), 0.0, 1.0)
        : 0.0;
    const planetApproachFactor = rawPlanetApproach * rawPlanetApproach * (3.0 - 2.0 * rawPlanetApproach);

    // Continuous Lunar Approach Calculation (from 20 LJ down to 3.5 LJ)
    const moonApproachMax = 20.0;
    const moonApproachMin = 3.5;
    const rawMoonApproach = nearestMoon
        ? THREE.MathUtils.clamp((moonApproachMax - nearestMoonDist) / (moonApproachMax - moonApproachMin), 0.0, 1.0)
        : 0.0;
    const moonApproachFactor = rawMoonApproach * rawMoonApproach * (3.0 - 2.0 * rawMoonApproach);

    // Continuous Orbit Transition Progress (0.0 in deep space -> 1.0 in close orbit)
    const combinedApproach = Math.max(planetApproachFactor, moonApproachFactor);
    STATE.orbitTransitionProgress = THREE.MathUtils.lerp(STATE.orbitTransitionProgress || 0, combinedApproach, Math.min(1.0, dt * 5.0));
    STATE.orbitZoomFactor = STATE.orbitTransitionProgress;

    // Contextual Orbit Status for HUD & Scanner
    if (moonApproachFactor > 0.45 && nearestMoon) {
        STATE.orbitLevel = 'moon';
        STATE.activeMoonOrbit = nearestMoon;
        STATE.isInPlanetOrbit = true;
        STATE.orbitPlanet = nearestMoon.parentPlanet || nearestPlanet;
    } else if (planetApproachFactor > 0.35 && nearestPlanet) {
        STATE.orbitLevel = 'planet';
        STATE.activeMoonOrbit = null;
        STATE.isInPlanetOrbit = true;
        STATE.orbitPlanet = nearestPlanet;
    } else {
        STATE.orbitLevel = 'solar';
        STATE.activeMoonOrbit = null;
        STATE.isInPlanetOrbit = false;
        STATE.orbitPlanet = null;
    }

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

            // Continuous Distance-Based Planetary Scale:
            // As you fly towards this planet, it smoothly and majestically swells in your field of view!
            const dx = STATE.playerPosition.x - px;
            const dz = STATE.playerPosition.z - pz;
            const distToPlanet = Math.sqrt(dx * dx + dz * dz);
            const thisRawApproach = THREE.MathUtils.clamp((planetApproachMax - distToPlanet) / (planetApproachMax - planetApproachMin), 0.0, 1.0);
            const thisApproachFactor = thisRawApproach * thisRawApproach * (3.0 - 2.0 * thisRawApproach);

            // Continuously scales from 1.0x up to 2.85x smoothly with distance!
            const targetScale = 1.0 + 1.85 * thisApproachFactor;
            const curScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetScale, Math.min(1.0, dt * 5.0));
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
            // Dynamic Moon Distance: As the parent planet expands, the moons dynamically expand outward!
            const baseDist = m.baseDistance || 8.0;
            const siblingMoons = activePlanets.filter(s => s.isMoon && s.parentPlanet === m.parentPlanet);
            const moonIdx = siblingMoons.indexOf(m);
            const staggerOffset = (moonIdx >= 0 ? moonIdx : 0) * 5.0;

            // As player approaches the parent planet, moons smoothly expand outward from baseDist
            const targetDist = baseDist + (14.0 + staggerOffset) * planetApproachFactor;
            m.distance = THREE.MathUtils.lerp(m.distance, targetDist, Math.min(1.0, dt * 4.0));

            m.angle += dt * m.speed;
            const parentPos = m.parentPlanet.mesh.position;
            const mx = parentPos.x + m.distance * Math.cos(m.angle);
            const mz = parentPos.z + m.distance * Math.sin(m.angle);

            m.mesh.position.set(mx, 0, mz);
            m.source.position.set(mx, 0, mz);

            // Orbit ring remains centered on parent planet and scales with moon distance!
            if (m.ringMesh) {
                m.ringMesh.position.set(parentPos.x, 0, parentPos.z);
                const ringScale = m.distance / baseDist;
                m.ringMesh.scale.set(ringScale, 1, ringScale);
            }

            // Continuous Distance-Based Moon Scale:
            const dx = STATE.playerPosition.x - mx;
            const dz = STATE.playerPosition.z - mz;
            const distToMoon = Math.sqrt(dx * dx + dz * dz);
            const thisMoonRaw = THREE.MathUtils.clamp((moonApproachMax - distToMoon) / (moonApproachMax - moonApproachMin), 0.0, 1.0);
            const thisMoonApproach = thisMoonRaw * thisMoonRaw * (3.0 - 2.0 * thisMoonRaw);

            // Moon swells smoothly from 1.0x up to 1.65x as you approach it
            const targetMoonScale = 1.0 + 0.65 * thisMoonApproach;
            const curMScale = THREE.MathUtils.lerp(m.mesh.scale.x, targetMoonScale, Math.min(1.0, dt * 5.0));
            m.mesh.scale.set(curMScale, curMScale, curMScale);
            m.source.radius = m.size * curMScale;

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
    const focusTarget = STATE.lockedTarget || ((STATE.orbitLevel === 'moon' && STATE.activeMoonOrbit) ? STATE.activeMoonOrbit : (STATE.isInPlanetOrbit && STATE.orbitPlanet ? STATE.orbitPlanet : null));

    if (focusTarget && focusTarget.mesh) {
        if (!targetReticleGroup) createTargetReticle();
        if (targetReticleGroup) {
            targetReticleGroup.visible = true;
            targetReticleGroup.position.set(
                focusTarget.mesh.position.x,
                0.25,
                focusTarget.mesh.position.z
            );
            
            const curVisualScale = focusTarget.mesh.scale.x || 1.0;
            const baseSize = focusTarget.size || 2.5;
            // Frame cleanly outside the planet body (1.28x) without slicing the equator
            const scale = baseSize * curVisualScale * 1.28;
            const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.03;
            targetReticleGroup.scale.set(scale * pulse, scale * pulse, scale * pulse);

            updateTargetReticleState(focusTarget, dt);
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
    } else if (STATE.orbitLevel === 'moon' && STATE.activeMoonOrbit && STATE.activeMoonOrbit.mesh) {
        targetPlanet = STATE.activeMoonOrbit;
        const dx = STATE.playerPosition.x - targetPlanet.mesh.position.x;
        const dz = STATE.playerPosition.z - targetPlanet.mesh.position.z;
        targetDist = Math.sqrt(dx * dx + dz * dz);
    } else if (STATE.orbitLevel === 'planet' && STATE.orbitPlanet && STATE.orbitPlanet.mesh) {
        targetPlanet = STATE.orbitPlanet;
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

    // 4.3 Interstellar Departure Sequence (Warp Spooling & Fold Punch)
    if (STATE.systemDepartureActive) {
        STATE.systemDepartureTimer = (STATE.systemDepartureTimer || 1.6) - dt;
        const depMax = STATE.systemDepartureMaxTime || 1.6;
        const depProgress = 1.0 - Math.max(0, STATE.systemDepartureTimer / depMax);

        // Turn ship smoothly towards departure vector
        const targetHeading = Math.atan2(-STATE.systemDepartureDirection.z, STATE.systemDepartureDirection.x);
        const angleDiff = (targetHeading - STATE.shipHeading + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        STATE.shipHeading += angleDiff * Math.min(1.0, dt * 7.0);
        if (STATE.playerGroup) {
            STATE.playerGroup.rotation.y = STATE.shipHeading;
        }

        if (depProgress < 0.55) {
            // Phase 1: Energy spool-up & alignment - ship steadies its drift
            STATE.playerVelocity.multiplyScalar(Math.exp(-3.5 * dt));
        } else {
            // Phase 2: Fold Punch! Sudden massive acceleration forward into hyperspace
            const punchT = (depProgress - 0.55) / 0.45;
            const punchSpeed = THREE.MathUtils.lerp(4.0, 52.0, Math.pow(punchT, 2.2));
            STATE.playerVelocity.copy(STATE.systemDepartureDirection).multiplyScalar(punchSpeed);
        }

        if (STATE.systemDepartureTimer <= 0) {
            STATE.systemDepartureActive = false;
            const targetSys = STATE.systemDepartureTarget;
            const fromSys = STATE.universe?.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe?.systems[0];

            playWarpSnapSound();

            const warpFlash = document.getElementById('warp-flash');
            if (warpFlash) {
                warpFlash.style.display = 'block';
                warpFlash.style.opacity = '0.95';
                setTimeout(() => {
                    warpFlash.style.opacity = '0';
                    setTimeout(() => {
                        warpFlash.style.display = 'none';
                    }, 350);
                }, 60);
            }

            if (targetSys) {
                STATE.currentSystemId = targetSys.id;
                clearActiveSystem();
                spawnPlanetsAndAsteroids();
                initiateSystemArrival(fromSys, targetSys);
            }
        }
    } else if (STATE.systemArrivalActive) {
        STATE.systemArrivalTimer -= dt;
        const progress = 1.0 - Math.max(0, STATE.systemArrivalTimer / STATE.systemArrivalMaxTime);
        // Smooth non-linear deceleration from 32.0 down to 7.5 LJ/s
        const arrivalSpeed = THREE.MathUtils.lerp(32.0, 7.5, Math.pow(progress, 0.6));
        STATE.playerVelocity.copy(STATE.systemArrivalDirection).multiplyScalar(arrivalSpeed);
        STATE.shipHeading = Math.atan2(-STATE.systemArrivalDirection.z, STATE.systemArrivalDirection.x);

        if (STATE.playerGroup) {
            STATE.playerGroup.rotation.y = STATE.shipHeading;
        }

        if (STATE.systemArrivalTimer <= 0) {
            STATE.systemArrivalActive = false;
        }
    } else {
        STATE.playerVelocity.addScaledVector(STATE.playerAcceleration, dt);
        STATE.playerVelocity.x += netGx * dt;
        STATE.playerVelocity.z += netGz * dt;

        // 5. Apply Natural Vacuum Drag
        const effectiveDrag = STATE.currentDrag;
        STATE.playerVelocity.multiplyScalar(Math.exp(-effectiveDrag * dt));

        // Top Speed Clamp (Harmonized cosmic cruise speed)
        const pilotMult = STATE.crewBuffs ? (STATE.crewBuffs.thrust || 1.0) : 1.0;
        const maxSpeed = 28.0 * Math.max(1.0, pilotMult * 0.85);
        const curSpeed = STATE.playerVelocity.length();
        if (curSpeed > maxSpeed) {
            STATE.playerVelocity.multiplyScalar(maxSpeed / curSpeed);
        }
    }

    // Update real-time speed in state for HUD
    STATE.shipSpeed = STATE.playerVelocity.length();

    // 6. Integrate Position
    STATE.playerPosition.x += STATE.playerVelocity.x * dt;
    STATE.playerPosition.z += STATE.playerVelocity.z * dt;

    // Boundary wrapping (Vast Solar System Scale)
    const maxBound = 1450;
    if (STATE.playerPosition.x > maxBound) { STATE.playerPosition.x = -maxBound; }
    if (STATE.playerPosition.x < -maxBound) { STATE.playerPosition.x = maxBound; }
    if (STATE.playerPosition.z > maxBound) { STATE.playerPosition.z = -maxBound; }
    if (STATE.playerPosition.z < -maxBound) { STATE.playerPosition.z = maxBound; }

    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);

        // Dynamic Ship Scaling: Ship gracefully scales down from 0.42 to 0.20 as you approach colossal worlds
        const targetShipScale = 0.42 - 0.22 * combinedApproach;
        const curShipScale = THREE.MathUtils.lerp(STATE.playerGroup.scale.x, targetShipScale, Math.min(1.0, dt * 5.0));
        STATE.playerGroup.scale.set(curShipScale, curShipScale, curShipScale);
    }

    // 6.5 Continuous Distance-Based Camera Altitude & Responsive Following
    // Seamlessly descends from 82.0 down to 64.0 as you approach a colossal planet, and down to 48.0 near a moon
    const planetAltitudeOffset = 18.0 * planetApproachFactor;
    const moonAltitudeOffset = 16.0 * moonApproachFactor;
    let targetHeight = Math.max(48.0, 82.0 - planetAltitudeOffset - moonAltitudeOffset);

    if (STATE.systemDepartureActive) {
        const depMax = STATE.systemDepartureMaxTime || 1.6;
        const depRatio = 1.0 - Math.max(0, (STATE.systemDepartureTimer || 0) / depMax);
        // Dynamic camera pullback as space-time warps around ship
        const warpDistortion = Math.sin(depRatio * Math.PI) * 14.0;
        targetHeight = (STATE.targetCameraHeight || 65.0) + warpDistortion;
    } else if (STATE.systemArrivalActive) {
        const arrivalRatio = Math.max(0, STATE.systemArrivalTimer / STATE.systemArrivalMaxTime);
        // Blend from elevated wide-angle establishing shot (92.0) down to cruise height
        targetHeight = THREE.MathUtils.lerp(targetHeight, 92.0, Math.pow(arrivalRatio, 0.8));
    }

    STATE.targetCameraHeight = targetHeight;
    if (camera) {
        const camLerpSpeed = STATE.systemArrivalActive ? 2.5 : 4.0;
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetHeight, Math.min(1.0, dt * camLerpSpeed));
        STATE.cameraHeight = camera.position.y;

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, STATE.playerPosition.x, Math.min(1.0, dt * 7.5));
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, STATE.playerPosition.z, Math.min(1.0, dt * 7.5));

        // Rock-solid fixed orientation: strictly prevent any camera rotation when ship moves or turns
        camera.rotation.set(-Math.PI / 2, 0, 0);
        camera.up.set(0, 0, -1);

        if (camera.fov !== 60.0) {
            camera.fov = 60.0;
            camera.updateProjectionMatrix();
        }
    } else {
        STATE.cameraHeight = targetHeight;
    }

    // Check for Critical Biological Collapse (Game Over)
    if (STATE.health <= 0 && !STATE.isGameOver && STATE.gameStarted) {
        triggerGameOver("Biologischer Zellkern kollabiert durch extreme Umwelteinflüsse & Hüllenschaden.");
        return;
    }

    // 7. Update Collisions
    updateCollisions(dt);

    // 8. Auto Nanite Hull Repair (Consumes Silicon Nanites)
    const baseRepairRate = 0.25;
    const engineerBonus = (STATE.crewBuffs && STATE.crewBuffs.repairRate > 0) ? STATE.crewBuffs.repairRate : 0;
    const totalRepairRate = baseRepairRate + engineerBonus;
    if (totalRepairRate > 0 && STATE.siliconRes >= 0.1 && STATE.health < STATE.maxHealth) {
        STATE.health = Math.min(STATE.maxHealth, STATE.health + totalRepairRate * dt);
        STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.20 * dt);
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

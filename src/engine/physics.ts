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

            if (p.bodyMesh) {
                p.bodyMesh.rotation.y += (p.isGasGiant ? 0.06 : 0.035) * dt;
            }
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += 0.05 * dt;
            }
            if (p.psioAuraMesh) {
                const aPulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.15;
                p.psioAuraMesh.scale.set(aPulse, aPulse, aPulse);
            }
        }
    });

    activePlanets.forEach(m => {
        if (m.isMoon && m.parentPlanet) {
            m.angle += dt * m.speed;
            const parentPos = m.parentPlanet.mesh.position;
            const mx = parentPos.x + m.distance * Math.cos(m.angle);
            const mz = parentPos.z + m.distance * Math.sin(m.angle);

            m.mesh.position.set(mx, 0, mz);
            m.source.position.set(mx, 0, mz);
            if (m.ringMesh) {
                m.ringMesh.position.copy(parentPos);
            }

            if (m.bodyMesh) {
                m.bodyMesh.rotation.y += 0.05 * dt;
            }
        }
    });

    // 2. Update 3D Target Reticle
    if (STATE.lockedTarget && STATE.lockedTarget.mesh) {
        if (!targetReticleGroup) createTargetReticle();
        if (targetReticleGroup) {
            targetReticleGroup.visible = true;
            targetReticleGroup.position.copy(STATE.lockedTarget.mesh.position);
            
            const scale = (STATE.lockedTarget.size || 2.5) * 1.5;
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

    // 4. Update Psionic Compass HUD
    const compassHud = document.getElementById('psionic-compass-hud');
    if (compassHud) {
        const targetBody = STATE.lockedTarget || activePlanets.find(p => p.attributes && p.attributes.species && p.attributes.species.population > 0);
        if (targetBody) {
            compassHud.style.display = 'flex';
            const cdx = targetBody.mesh.position.x - STATE.playerPosition.x;
            const cdz = targetBody.mesh.position.z - STATE.playerPosition.z;
            const cdist = Math.sqrt(cdx * cdx + cdz * cdz);

            const angle = Math.atan2(cdz, cdx) - Math.PI / 2;

            const nameEl = document.getElementById('compass-planet-name');
            const distEl = document.getElementById('compass-distance-text');
            const needleEl = document.getElementById('compass-arrow-needle');

            if (nameEl) {
                const specTag = (targetBody.attributes && targetBody.attributes.species) ? ` (${targetBody.attributes.species.name})` : '';
                nameEl.innerText = `${targetBody.name}${specTag}`;
            }
            if (distEl) distEl.innerText = `Distanz: ${cdist.toFixed(0)} Einheiten`;
            if (needleEl) needleEl.style.transform = `rotate(${angle * (180 / Math.PI)}deg)`;
        } else {
            compassHud.style.display = 'none';
        }
    }

    // 5. Calculate Net Gravitational Forces (Input thrust already added by processInput)

    const sources = STATE.gravitySources;
    const sourceCount = sources.length;
    let minSourceDist = Infinity;
    let closestSource: any = null;

    for (let s = 0; s < sourceCount; s++) {
        const source = sources[s];
        if (source.isAbsorbed) continue;

        const dx = source.position.x - STATE.playerPosition.x;
        const dz = source.position.z - STATE.playerPosition.z;
        const distSq = dx * dx + dz * dz;
        const rangeSq = source.gravityRange * source.gravityRange;

        if (distSq < rangeSq && distSq > 0.01) {
            const distance = Math.sqrt(distSq);
            if (distance < minSourceDist) {
                minSourceDist = distance;
                closestSource = source;
            }

            const clampedDist = Math.max(distance, source.radius * 1.2);
            const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);
            const invDist = 1 / distance;

            STATE.playerAcceleration.x += dx * invDist * forceStrength;
            STATE.playerAcceleration.z += dz * invDist * forceStrength;
        }
    }

    // Stellar Radiation / Star Hazard
    const starSource = STATE.gravitySources.find(s => s.type === 'star');
    if (starSource) {
        const sdistSq = STATE.playerPosition.x * STATE.playerPosition.x + STATE.playerPosition.z * STATE.playerPosition.z;
        const radiationRadius = starSource.radius * 2.4;
        if (sdistSq < radiationRadius * radiationRadius) {
            const distance = Math.sqrt(sdistSq);
            const radRatio = 1 - (distance / radiationRadius);
            const burnDamage = (3.5 + radRatio * 7.0) * dt;
            STATE.health = Math.max(0, STATE.health - burnDamage);
            STATE.crew.forEach(c => c.stress = Math.min(100, c.stress + (3.0 + radRatio * 5.0) * dt));
            if (Math.random() < 0.012) {
                addLogEntry("SYSTEM", `⚠️ THERMISCHE WARNUNG: Sonnennähe zu ${starSource.name}! Strahlungsschaden erlitten.`);
            }
        }
    }

    // 6. Integrate Equations of Motion (Euler with exponential drag)
    STATE.playerVelocity.addScaledVector(STATE.playerAcceleration, dt);
    STATE.playerVelocity.multiplyScalar(Math.exp(-STATE.currentDrag * dt));
    STATE.playerPosition.addScaledVector(STATE.playerVelocity, dt);

    // Boundary wrapping
    const maxBound = 500;
    if (STATE.playerPosition.x > maxBound) { STATE.playerPosition.x = -maxBound; }
    if (STATE.playerPosition.x < -maxBound) { STATE.playerPosition.x = maxBound; }
    if (STATE.playerPosition.z > maxBound) { STATE.playerPosition.z = -maxBound; }
    if (STATE.playerPosition.z < -maxBound) { STATE.playerPosition.z = maxBound; }

    if (STATE.playerGroup) {
        STATE.playerGroup.position.copy(STATE.playerPosition);
    }

    // Camera smoothly follows player
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, STATE.playerPosition.x, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, STATE.playerPosition.z, 0.05);
    camera.position.y = 80;

    // Check for Critical Biological Collapse (Game Over)
    if (STATE.health <= 0 && !STATE.isGameOver && STATE.gameStarted) {
        triggerGameOver("Biologischer Zellkern kollabiert durch extreme Umwelteinflüsse & Hüllenschaden.");
        return;
    }

    // 7. Update Collisions
    updateCollisions(dt);

    // 8. Passive Engineer Repair
    if (STATE.crewBuffs && STATE.crewBuffs.repairRate > 0 && STATE.siliconRes >= 0.05 && STATE.health < STATE.maxHealth) {
        STATE.health = Math.min(STATE.maxHealth, STATE.health + STATE.crewBuffs.repairRate * dt);
        STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.04 * dt);
    }

    // 9. Emergency Bio-Photosynthesis Trickle
    if (STATE.bioEnergy < 15) {
        const regenRate = STATE.bioEnergy <= 0 ? 1.5 : 0.8;
        STATE.bioEnergy = Math.min(15, STATE.bioEnergy + regenRate * dt);
    }

    // Passive decay of bioEnergy over time
    if (STATE.bioEnergy > 15) {
        STATE.bioEnergy = Math.max(15, STATE.bioEnergy - 0.35 * dt);
    }

    if (STATE.bioEnergy <= 0) {
        STATE.health = Math.max(0, STATE.health - 1.2 * dt);
        if (Math.random() < 0.004) {
            addLogEntry("SYSTEM", "Kritischer Nahrungsmangel. Organismus verhungert (-1.2 Kernintegrität).");
        }
    }

    // 10. Determine harmony state for HUD
    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;
    const isHarmony = uniqueRoles >= 3 && STATE.crew.length >= 3;

    updateHUDStats(isHarmony);
}

export function updateCollisions(dt: number) {
    if (STATE.collisionCooldown > 0) {
        STATE.collisionCooldown = Math.max(0, STATE.collisionCooldown - dt);
    }

    STATE.gravitySources.forEach((source) => {
        if (source.isAbsorbed) return;

        const distance = STATE.playerPosition.distanceTo(source.position);
        const colDistance = source.radius + 1.8;

        if (distance < colDistance) {
            if (source.type === 'asteroid' && source.isResource) {
                source.isAbsorbed = true;
                if (source.mesh) source.mesh.scale.set(0.01, 0.01, 0.01);

                const bioMult = (STATE.crewBuffs ? STATE.crewBuffs.bioGain : 1.0);

                if (source.resourceType === 'bio') {
                    STATE.health = Math.min(STATE.maxHealth, STATE.health + 30);
                    const gain = Math.round(25 * bioMult);
                    STATE.bioRes += gain;
                    addLogEntry("SYSTEM", `Organischer Asteroid absorbiert. +${gain} Biomasse gewonnen. Zellkern repariert (+30 HP).`);
                    playBioCollectSound();
                } else {
                    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 50);
                    const gain = Math.round(25 * bioMult);
                    STATE.siliconRes += gain;
                    addLogEntry("SYSTEM", `Silizium-Komet absorbiert. +${gain} Silizium gewonnen (+50% Energie).`);
                    playSiliconCollectSound();
                }
                updateMutationUI();
                respawnAsteroid(source);
            } else if (source.type === 'planet' || source.type === 'star') {
                _bounceDir.subVectors(STATE.playerPosition, source.position).normalize();

                // Snap cleanly outside collider radius
                STATE.playerPosition.copy(source.position).addScaledVector(_bounceDir, colDistance + 0.6);
                if (STATE.playerGroup) STATE.playerGroup.position.copy(STATE.playerPosition);

                // Elastic Repulsion Reflex
                const currentOutwardSpeed = STATE.playerVelocity.dot(_bounceDir);
                const bounceForce = Math.max(22, Math.abs(currentOutwardSpeed) * 0.8 + 16);
                STATE.playerVelocity.copy(_bounceDir).multiplyScalar(bounceForce);

                if (STATE.collisionCooldown === 0) {
                    STATE.collisionCooldown = 1.2;

                    const damage = STATE.mutations.armor.purchased ? 15 : 30;
                    STATE.health = Math.max(0, STATE.health - damage);

                    playCrashSound();

                    const stressMult = (STATE.crewBuffs ? STATE.crewBuffs.stressDampening : 1.0);
                    const stressAmount = (STATE.mutations.o2.purchased ? 10 : 22) * stressMult;
                    STATE.crew.forEach(c => c.stress = Math.min(100, c.stress + stressAmount));

                    if (STATE.mutations.armor.purchased) {
                        addLogEntry("SYSTEM", `Kollision mit ${source.name}! Chitin-Panzerung dämpft Aufprall (-15 HP).`);
                    } else {
                        addLogEntry("SYSTEM", `WARNUNG: Harter Aufprall auf ${source.name}! Zellhülle schwer beschädigt (-30 HP).`);
                    }
                }
            }
        }
    });
}

function respawnAsteroid(sourceObj: any) {
    setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 120;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const size = 0.4 + Math.random() * 0.45;

        const geo = new THREE.DodecahedronGeometry(size, 1);
        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
            const vx = posAttr.getX(j);
            const vy = posAttr.getY(j);
            const vz = posAttr.getZ(j);
            const scale = 1 + (Math.random() - 0.5) * 0.3;
            posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
        }
        geo.computeVertexNormals();

        const isOrganic = Math.random() > 0.45;
        const color = isOrganic ? 0x00ff88 : 0x06b6d4;

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.8,
            emissive: isOrganic ? 0x003311 : 0x002233
        });

        if (sourceObj.mesh) {
            scene.remove(sourceObj.mesh);
            sourceObj.mesh.geometry.dispose();
            sourceObj.mesh.material.dispose();
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0, z);
        scene.add(mesh);

        sourceObj.position.set(x, 0, z);
        sourceObj.mesh = mesh;
        sourceObj.name = isOrganic ? "Organische Biosphäre" : "Silizium-Komet";
        sourceObj.resourceType = isOrganic ? 'bio' : 'silicon';
        sourceObj.mass = size * 4;
        sourceObj.radius = size;
        sourceObj.gravityRange = size * 3;
        sourceObj.isAbsorbed = false;

        if (sourceObj.ringMesh) {
            sourceObj.ringMesh.position.set(x, 0, z);
            sourceObj.ringMesh.scale.set(sourceObj.gravityRange / (size * 3), 1, sourceObj.gravityRange / (size * 3));
            (sourceObj.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        }
    }, 15000);
}

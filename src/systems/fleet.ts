import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { FleetShip, FleetProjectile, PlanetEntry } from '../types/game';
import { addLogEntry } from '../ui/hud';
import { playCrashSound, playSiliconCollectSound } from '../engine/audio';

let shockwaveMesh: THREE.Mesh | null = null;
let shockwaveTimer = 0;

export function initPlanetDefenseFleets() {
    clearFleet();

    let shipIdCounter = 1;

    activePlanets.forEach(p => {
        if (!p.attributes || !p.attributes.species) return;
        const spec = p.attributes.species;

        if (spec.techLevel === 'Spacefaring' || spec.techLevel === 'Hyper-Advanced') {
            const shipCount = spec.techLevel === 'Hyper-Advanced' ? 4 : 2;
            const planetPos = p.mesh.position;

            for (let i = 0; i < shipCount; i++) {
                const orbitRadius = p.size * 2.2 + 3.0 + i * 2.5;
                const orbitAngle = (i / shipCount) * Math.PI * 2;
                const isCorvette = (i === 0 && spec.techLevel === 'Hyper-Advanced');

                const shipGroup = new THREE.Group();

                // 1. Procedural Fighter Hull
                const hullGeo = isCorvette
                    ? new THREE.ConeGeometry(0.9, 2.2, 5)
                    : new THREE.ConeGeometry(0.5, 1.4, 4);
                hullGeo.rotateX(Math.PI / 2);

                const hullMat = new THREE.MeshStandardMaterial({
                    color: spec.techLevel === 'Hyper-Advanced' ? 0x6366f1 : 0xe0e7ff,
                    metalness: 0.9,
                    roughness: 0.2,
                    flatShading: true
                });
                const hullMesh = new THREE.Mesh(hullGeo, hullMat);
                shipGroup.add(hullMesh);

                // 2. Glowing Engine Thrusters
                const engineGeo = new THREE.SphereGeometry(isCorvette ? 0.35 : 0.2, 8, 8);
                const engineMat = new THREE.MeshBasicMaterial({
                    color: spec.techLevel === 'Hyper-Advanced' ? 0x818cf8 : 0x38bdf8
                });
                const engineMesh = new THREE.Mesh(engineGeo, engineMat);
                engineMesh.position.set(0, 0, isCorvette ? -1.0 : -0.7);
                shipGroup.add(engineMesh);

                // 3. Wing / Antenna Hardpoints
                const wingGeo = new THREE.BoxGeometry(isCorvette ? 2.4 : 1.5, 0.08, 0.6);
                const wingMat = new THREE.MeshStandardMaterial({
                    color: 0x334155,
                    metalness: 0.8,
                    roughness: 0.4
                });
                const wingMesh = new THREE.Mesh(wingGeo, wingMat);
                wingMesh.position.set(0, 0, -0.2);
                shipGroup.add(wingMesh);

                const sx = planetPos.x + Math.cos(orbitAngle) * orbitRadius;
                const sz = planetPos.z + Math.sin(orbitAngle) * orbitRadius;
                shipGroup.position.set(sx, 0, sz);

                scene.add(shipGroup);

                const fleetShip: FleetShip = {
                    id: shipIdCounter++,
                    mesh: shipGroup,
                    bodyMesh: hullMesh,
                    type: isCorvette ? 'corvette' : 'interceptor',
                    name: `${spec.name} ${isCorvette ? 'Korvette' : 'Abfangjäger'} #${i + 1}`,
                    position: shipGroup.position,
                    velocity: new THREE.Vector3(0, 0, 0),
                    homePlanet: p,
                    orbitRadius: orbitRadius,
                    orbitAngle: orbitAngle,
                    orbitSpeed: (0.35 / Math.sqrt(orbitRadius)) * (i % 2 === 0 ? 1 : -1),
                    health: isCorvette ? 60 : 25,
                    maxHealth: isCorvette ? 60 : 25,
                    state: 'patrol',
                    attackCooldown: Math.random() * 2,
                    alertTimer: 0
                };

                STATE.fleetShips.push(fleetShip);
            }
        }
    });

    if (STATE.fleetShips.length > 0) {
        addLogEntry("SYSTEM", `Sensoren geortet: ${STATE.fleetShips.length} planetare Abfangjäger & Patrouillenschiffe im Sektor aktiv.`);
    }
}

export function updateFleet(dt: number) {
    // 1. Update Bio-Discharge Cooldown & Visual Shockwave
    if (STATE.bioDischargeCooldown > 0) {
        STATE.bioDischargeCooldown = Math.max(0, STATE.bioDischargeCooldown - dt);
    }

    if (shockwaveMesh && shockwaveTimer > 0) {
        shockwaveTimer -= dt;
        const progress = 1.0 - (shockwaveTimer / 0.5);
        const scale = 2.0 + progress * 24.0;
        shockwaveMesh.scale.set(scale, 1, scale);
        (shockwaveMesh.material as THREE.Material).opacity = (1.0 - progress) * 0.7;

        if (shockwaveTimer <= 0) {
            scene.remove(shockwaveMesh);
            shockwaveMesh.geometry.dispose();
            (shockwaveMesh.material as THREE.Material).dispose();
            shockwaveMesh = null;
        }
    }

    const playerPos = STATE.playerPosition;

    // 2. Update Fleet Ships AI & Movement
    STATE.fleetShips.forEach(ship => {
        if (ship.state === 'disabled') {
            // Drifting inert wreckage
            ship.position.addScaledVector(ship.velocity, dt);
            ship.velocity.multiplyScalar(Math.exp(-0.8 * dt));
            ship.mesh.rotation.y += 0.8 * dt;
            ship.mesh.rotation.z += 0.5 * dt;

            // Check if player is near to salvage (Assimilate)
            const dPlayer = ship.position.distanceTo(playerPos);
            if (dPlayer < 6.0) {
                // Salvageable prompt
                if (Math.random() < 0.02) {
                    addLogEntry("SYSTEM", `Deaktiviertes Wrack von ${ship.name} in Reichweite. Drücke [E] zum Absorbieren!`);
                }
            }
            return;
        }

        const planetPos = ship.homePlanet.mesh.position;
        const distToPlayer = ship.position.distanceTo(playerPos);
        const distPlanetToPlayer = planetPos.distanceTo(playerPos);

        const isPlayerThreatening = (
            distPlanetToPlayer < 35.0 ||
            (STATE.scanningPlanet && STATE.scanningPlanet.name === ship.homePlanet.name) ||
            (STATE.abductActive && STATE.abductTarget && STATE.abductTarget.name === ship.homePlanet.name)
        );

        if (isPlayerThreatening && ship.state === 'patrol') {
            ship.state = 'intercept';
            ship.alertTimer = 15.0; // Stay alert for 15s
            addLogEntry("CREW", `Capt. Miller: 'Militärische Abfangjäger von ${ship.homePlanet.name} lösen sich aus dem Orbit! Sie formieren Abfangkurs!'`);
        }

        if (ship.state === 'intercept') {
            ship.alertTimer -= dt;
            if (ship.alertTimer <= 0 && distToPlayer > 40.0) {
                ship.state = 'patrol';
                addLogEntry("SYSTEM", `${ship.name} bricht Verfolgung ab und kehrt in planetaren Patrouillen-Orbit zurück.`);
            }

            // Lead Pursuit & Orbit Circle AI
            const toPlayer = new THREE.Vector3().subVectors(playerPos, ship.position);
            const dist = toPlayer.length();
            toPlayer.normalize();

            // Target hover distance between 10 and 16 units
            const desiredDist = 12.0;
            const distDiff = dist - desiredDist;

            const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
            const accel = new THREE.Vector3();

            accel.addScaledVector(toPlayer, Math.min(20, distDiff * 2.5));
            accel.addScaledVector(tangent, 15.0);

            ship.velocity.addScaledVector(accel, dt);
            ship.velocity.clampLength(0, ship.type === 'corvette' ? 18.0 : 26.0);
            ship.velocity.multiplyScalar(Math.exp(-0.4 * dt));

            ship.position.addScaledVector(ship.velocity, dt);

            // Orient ship towards movement velocity
            if (ship.velocity.lengthSq() > 0.1) {
                const angle = Math.atan2(ship.velocity.x, ship.velocity.z);
                ship.mesh.rotation.y = angle;
            }

            // Weapon Attack Loop
            ship.attackCooldown -= dt;
            if (ship.attackCooldown <= 0 && dist < 25.0) {
                ship.attackCooldown = ship.type === 'corvette' ? 1.8 : 2.5;
                fireFleetProjectile(ship, playerPos);
            }
        } else {
            // Patrol Orbit around Home Planet
            ship.orbitAngle += ship.orbitSpeed * dt;
            const targetX = planetPos.x + Math.cos(ship.orbitAngle) * ship.orbitRadius;
            const targetZ = planetPos.z + Math.sin(ship.orbitAngle) * ship.orbitRadius;

            ship.position.x = THREE.MathUtils.lerp(ship.position.x, targetX, 0.1);
            ship.position.z = THREE.MathUtils.lerp(ship.position.z, targetZ, 0.1);
            ship.position.y = 0;

            const forwardAngle = ship.orbitAngle + (ship.orbitSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
            ship.mesh.rotation.y = forwardAngle;
        }
    });

    // 3. Update Projectiles Simulation
    for (let pIdx = STATE.fleetProjectiles.length - 1; pIdx >= 0; pIdx--) {
        const proj = STATE.fleetProjectiles[pIdx];
        proj.life -= dt;
        proj.position.addScaledVector(proj.velocity, dt);

        // Check collision with Player Bioship
        const dToPlayer = proj.position.distanceTo(playerPos);
        if (dToPlayer < 2.5) {
            // Hit Player Bioship!
            playCrashSound();

            const damage = STATE.mutations.armor.purchased ? proj.damage * 0.5 : proj.damage;
            STATE.health = Math.max(0, STATE.health - damage);

            // EMP Disruption to Dream Matrix
            STATE.crew.forEach(c => {
                c.stress = Math.min(100, c.stress + 8.5);
                c.illusionStability = Math.max(0, c.illusionStability - 12.0);
            });

            addLogEntry("CREW", `ALARM: EMP-Geschoss durchschlägt Hülle! Die Illusion flackert (+Stress). Stabilisiere mit [LEERTASTE]!`);

            // Dispose projectile
            scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            (proj.mesh.material as THREE.Material).dispose();
            STATE.fleetProjectiles.splice(pIdx, 1);
            continue;
        }

        if (proj.life <= 0) {
            scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            (proj.mesh.material as THREE.Material).dispose();
            STATE.fleetProjectiles.splice(pIdx, 1);
        }
    }
}

function fireFleetProjectile(ship: FleetShip, targetPos: THREE.Vector3) {
    const isCorvette = ship.type === 'corvette';
    const projGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
    projGeo.rotateX(Math.PI / 2);

    const projMat = new THREE.MeshBasicMaterial({
        color: isCorvette ? 0x818cf8 : 0x38bdf8
    });
    const projMesh = new THREE.Mesh(projGeo, projMat);
    projMesh.position.copy(ship.position);
    scene.add(projMesh);

    const dir = new THREE.Vector3().subVectors(targetPos, ship.position).normalize();
    // Add slight aim imperfection
    dir.x += (Math.random() - 0.5) * 0.1;
    dir.z += (Math.random() - 0.5) * 0.1;
    dir.normalize();

    const speed = 36.0;
    const velocity = dir.clone().multiplyScalar(speed);

    projMesh.rotation.y = Math.atan2(dir.x, dir.z);

    const projectile: FleetProjectile = {
        mesh: projMesh,
        position: projMesh.position,
        velocity: velocity,
        life: 2.2,
        damage: isCorvette ? 8 : 4,
        type: isCorvette ? 'emp' : 'laser'
    };

    STATE.fleetProjectiles.push(projectile);
}

// Player Action: Bio-Electric EMP Discharge (Key X / Gamepad X)
export function triggerBioDischarge() {
    if (!STATE.gameStarted) return;

    if (STATE.bioDischargeCooldown > 0) {
        addLogEntry("SYSTEM", `Bio-Elektrische Entladung noch in Kalibrierung (${STATE.bioDischargeCooldown.toFixed(1)}s Cooldown).`);
        return;
    }

    if (STATE.bioEnergy < 15 || STATE.mentalEnergy < 10) {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie oder Mentalkraft für Bio-Elektrische Entladung!`);
        return;
    }

    // Deduct Costs & Trigger Cooldown
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 15);
    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 10);
    STATE.bioDischargeCooldown = 4.5; // 4.5s cooldown

    // Spawn Visual Shockwave Ring
    if (shockwaveMesh) {
        scene.remove(shockwaveMesh);
        shockwaveMesh.geometry.dispose();
        (shockwaveMesh.material as THREE.Material).dispose();
    }

    const shockGeo = new THREE.RingGeometry(0.8, 1.8, 48);
    shockGeo.rotateX(Math.PI / 2);
    const shockMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    shockwaveMesh = new THREE.Mesh(shockGeo, shockMat);
    shockwaveMesh.position.copy(STATE.playerPosition);
    scene.add(shockwaveMesh);
    shockwaveTimer = 0.5;

    playCrashSound();
    addLogEntry("SYSTEM", `⚡ BIO-ELEKTRISCHE EMP-ENTLADUNG GEZÜNDET! Elektromagnetische Schockwelle expandiert.`);

    // Check & Disable nearby Fleet Ships within 20 units
    const radius = 20.0;
    let disabledCount = 0;

    STATE.fleetShips.forEach(ship => {
        if (ship.state !== 'disabled') {
            const dist = ship.position.distanceTo(STATE.playerPosition);
            if (dist <= radius) {
                ship.state = 'disabled';
                ship.velocity.copy(new THREE.Vector3().subVectors(ship.position, STATE.playerPosition).normalize().multiplyScalar(12));
                (ship.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x475569);
                (ship.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);

                disabledCount++;
            }
        }
    });

    if (disabledCount > 0) {
        addLogEntry("CREW", `Capt. Miller: 'Feindliche Abfangjäger durch EMP lahmgelegt! Ihre Systeme sind kollabiert!'`);
        addLogEntry("SYSTEM", `${disabledCount} Abfangjäger deaktiviert. Wrackteile können assimiliert werden [E].`);
        playSiliconCollectSound();
    }
}

// Salvage disabled fleet wreck
export function salvageNearestWreck(): boolean {
    const playerPos = STATE.playerPosition;
    const disabledShips = STATE.fleetShips.filter(s => s.state === 'disabled');

    for (let i = 0; i < disabledShips.length; i++) {
        const ship = disabledShips[i];
        if (ship.position.distanceTo(playerPos) <= 7.0) {
            // Salvage successful!
            scene.remove(ship.mesh);

            STATE.siliconRes += 35;
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 30);
            addLogEntry("SYSTEM", `Schiffswrack von ${ship.name} assimiliert: +35 Silizium & +30 Bio-Energie gewonnen!`);
            playSiliconCollectSound();

            const idx = STATE.fleetShips.findIndex(s => s.id === ship.id);
            if (idx !== -1) {
                STATE.fleetShips.splice(idx, 1);
            }
            return true;
        }
    }
    return false;
}

export function clearFleet() {
    STATE.fleetShips.forEach(ship => {
        if (ship.mesh) scene.remove(ship.mesh);
    });
    STATE.fleetProjectiles.forEach(proj => {
        if (proj.mesh) scene.remove(proj.mesh);
    });
    if (shockwaveMesh) {
        scene.remove(shockwaveMesh);
        shockwaveMesh = null;
    }
    STATE.fleetShips = [];
    STATE.fleetProjectiles = [];
}

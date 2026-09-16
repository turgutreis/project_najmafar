import * as THREE from 'three';
import { scene } from '../engine/scene';
import { STATE } from '../core/state';
import { createAlienBioShip, AlienShipController } from './alien-ship';

export let playerMesh: THREE.Mesh;
export let playerGlowMesh: THREE.Mesh;
export let playerLight: THREE.PointLight;
export let thrustLight: THREE.PointLight;
export let empLight: THREE.PointLight;
export let alienShipController: AlienShipController | null = null;
export let targetReticleGroup: THREE.Group | null = null;
export let sonarWaveMesh: THREE.Mesh | null = null;
export let abductBeamMesh: THREE.Line | null = null;
export let harvestBeamMesh: THREE.Line | null = null;

export const gravityCircles: { mesh: THREE.Mesh; pulseSpeed: number; baseOpacity: number }[] = [];

export function createPlayerMesh(): THREE.Group {
    const ship = createAlienBioShip();
    alienShipController = ship;

    playerMesh = ship.coreMesh;
    playerGlowMesh = ship.shieldGlowMesh;

    // Dynamic Bioluminescent Aura Light (Lights up nearby asteroids & terrain)
    playerLight = new THREE.PointLight(0x00ff88, 1.2, 30, 1.8);
    ship.group.add(playerLight);

    // Dynamic Plasma Thrust Flare Light (Illuminates space debris behind ship when thrusting)
    thrustLight = new THREE.PointLight(0x38bdf8, 0.0, 35, 1.5);
    thrustLight.position.set(-2.4, 0, 0);
    ship.group.add(thrustLight);

    // EMP Shockwave Flash Light (Lights up entire sector on discharge [X])
    empLight = new THREE.PointLight(0xd946ef, 0.0, 180, 1.0);
    ship.group.add(empLight);

    ship.group.position.copy(STATE.playerPosition);
    ship.group.scale.set(0.42, 0.42, 0.42);
    scene.add(ship.group);
    STATE.playerGroup = ship.group;

    return ship.group;
}

export function createGravityRing(x: number, z: number, radius: number, color: number, baseOpacity = 0.12): THREE.Mesh {
    const segments = 64;
    const geometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, segments);
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: baseOpacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(x, 0, z);
    scene.add(ring);

    gravityCircles.push({
        mesh: ring,
        pulseSpeed: 1 + Math.random() * 2,
        baseOpacity: baseOpacity
    });
    return ring;
}

export let reticleBracketMaterial: THREE.LineBasicMaterial | null = null;
export let reticleInnerMaterial: THREE.MeshBasicMaterial | null = null;

export function createTargetReticle() {
    if (targetReticleGroup) return;
    targetReticleGroup = new THREE.Group();

    // 1. Sleek 4 Corner Brackets using LineSegments in X-Z plane
    const bracketPoints: THREE.Vector3[] = [];
    const numSegmentsPerCorner = 10;
    const baseR = 1.25;

    for (let c = 0; c < 4; c++) {
        const centerAngle = (c * Math.PI / 2) + Math.PI / 4;
        const startAngle = centerAngle - 0.28;
        const endAngle = centerAngle + 0.28;
        const step = (endAngle - startAngle) / numSegmentsPerCorner;

        for (let i = 0; i < numSegmentsPerCorner; i++) {
            const a1 = startAngle + i * step;
            const a2 = startAngle + (i + 1) * step;
            bracketPoints.push(
                new THREE.Vector3(baseR * Math.cos(a1), 0, baseR * Math.sin(a1)),
                new THREE.Vector3(baseR * Math.cos(a2), 0, baseR * Math.sin(a2))
            );
        }

        // Corner accent tick pointing outward
        const tickR1 = baseR;
        const tickR2 = baseR + 0.16;
        bracketPoints.push(
            new THREE.Vector3(tickR1 * Math.cos(centerAngle), 0, tickR1 * Math.sin(centerAngle)),
            new THREE.Vector3(tickR2 * Math.cos(centerAngle), 0, tickR2 * Math.sin(centerAngle))
        );
    }

    // 2. Cardinal Precision Pips (N, S, E, W) pointing inward
    for (let c = 0; c < 4; c++) {
        const angle = c * Math.PI / 2;
        bracketPoints.push(
            new THREE.Vector3((baseR - 0.14) * Math.cos(angle), 0, (baseR - 0.14) * Math.sin(angle)),
            new THREE.Vector3((baseR + 0.08) * Math.cos(angle), 0, (baseR + 0.08) * Math.sin(angle))
        );
    }

    const bracketGeo = new THREE.BufferGeometry().setFromPoints(bracketPoints);
    reticleBracketMaterial = new THREE.LineBasicMaterial({
        color: 0xf59e0b, // Amber (Unscanned default)
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
    });
    const bracketMesh = new THREE.LineSegments(bracketGeo, reticleBracketMaterial);
    targetReticleGroup.add(bracketMesh);

    // 3. Subtle Inner Concentric Dashed Ring
    const innerRingGeo = new THREE.RingGeometry(baseR * 0.86, baseR * 0.88, 48);
    innerRingGeo.rotateX(Math.PI / 2);
    reticleInnerMaterial = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const innerRing = new THREE.Mesh(innerRingGeo, reticleInnerMaterial);
    targetReticleGroup.add(innerRing);

    targetReticleGroup.visible = false;
    scene.add(targetReticleGroup);
}

export function updateTargetReticleState(target: any, dt: number) {
    if (!targetReticleGroup || !target) return;

    const isScanned = target.scanned || (STATE.scannedPlanets && STATE.scannedPlanets[target.name]);
    const isDepleted = target.depleted || target.harvested || (STATE.depletedPlanets && STATE.depletedPlanets[target.name]);

    let targetHex = 0xf59e0b; // Amber (Scan required)
    let targetOpacity = 0.85;

    if (isDepleted) {
        targetHex = 0x64748b; // Slate Gray (Depleted)
        targetOpacity = 0.45;
    } else if (isScanned) {
        targetHex = 0x06b6d4; // Cyan (Scanned & Harvest ready)
        targetOpacity = 0.90;
    }

    if (reticleBracketMaterial) {
        reticleBracketMaterial.color.setHex(targetHex);
        reticleBracketMaterial.opacity = targetOpacity;
    }
    if (reticleInnerMaterial) {
        reticleInnerMaterial.color.setHex(targetHex);
        reticleInnerMaterial.opacity = targetOpacity * 0.4;
    }

    // Smooth level rotation on Y axis without gimbal tilting
    targetReticleGroup.rotation.y += dt * 0.45;
}

export function createAbductBeam(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    if (abductBeamMesh) {
        scene.remove(abductBeamMesh);
        abductBeamMesh.geometry.dispose();
        (abductBeamMesh.material as THREE.Material).dispose();
    }

    const points = [startPos.clone(), targetPos.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xd946ef,
        linewidth: 3,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    abductBeamMesh = new THREE.Line(geometry, material);
    scene.add(abductBeamMesh);
}

export function updateAbductBeam(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    if (!abductBeamMesh) return;
    const positions = (abductBeamMesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    positions[0] = startPos.x;
    positions[1] = startPos.y;
    positions[2] = startPos.z;
    positions[3] = targetPos.x;
    positions[4] = targetPos.y;
    positions[5] = targetPos.z;
    abductBeamMesh.geometry.attributes.position.needsUpdate = true;
    (abductBeamMesh.material as THREE.Material).opacity = 0.6 + Math.sin(Date.now() * 0.03) * 0.35;
}

export function removeAbductBeam() {
    if (abductBeamMesh) {
        scene.remove(abductBeamMesh);
        abductBeamMesh.geometry.dispose();
        (abductBeamMesh.material as THREE.Material).dispose();
        abductBeamMesh = null;
    }
}

export function createHarvestBeam(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    if (harvestBeamMesh) {
        scene.remove(harvestBeamMesh);
        harvestBeamMesh.geometry.dispose();
        (harvestBeamMesh.material as THREE.Material).dispose();
    }

    const points = [startPos.clone(), targetPos.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0x00ff88,
        linewidth: 3,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    harvestBeamMesh = new THREE.Line(geometry, material);
    scene.add(harvestBeamMesh);
}

export function updateHarvestBeam(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    if (!harvestBeamMesh) return;
    const positions = (harvestBeamMesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    positions[0] = startPos.x;
    positions[1] = startPos.y;
    positions[2] = startPos.z;
    positions[3] = targetPos.x;
    positions[4] = targetPos.y;
    positions[5] = targetPos.z;
    harvestBeamMesh.geometry.attributes.position.needsUpdate = true;
    (harvestBeamMesh.material as THREE.Material).opacity = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
}

export function removeHarvestBeam() {
    if (harvestBeamMesh) {
        scene.remove(harvestBeamMesh);
        harvestBeamMesh.geometry.dispose();
        (harvestBeamMesh.material as THREE.Material).dispose();
        harvestBeamMesh = null;
    }
}

// 3D Holographic Spectral Scanner Visuals (Dual Mandible Laser Beams & Planetary Scanner Ring)
export let scanBeamMesh: THREE.LineSegments | null = null;
export let scanPlanetRingMesh: THREE.Mesh | null = null;

export function createScanVisuals(startPos: THREE.Vector3, targetPos: THREE.Vector3, targetSize: number = 3.0) {
    removeScanVisuals();

    // 1. Dual Spectral Sensor Beams
    const pts = [
        startPos.clone(), targetPos.clone(),
        startPos.clone(), targetPos.clone()
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        linewidth: 3,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    scanBeamMesh = new THREE.LineSegments(geo, mat);
    scene.add(scanBeamMesh);

    // 2. Holographic Scan Grid Envelope around Planet (Concentric spherical envelope)
    const scanGeo = new THREE.SphereGeometry(targetSize * 1.15, 24, 16);
    const scanMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
        blending: THREE.AdditiveBlending
    });
    scanPlanetRingMesh = new THREE.Mesh(scanGeo, scanMat);
    scanPlanetRingMesh.position.copy(targetPos);
    scene.add(scanPlanetRingMesh);
}

export function updateScanVisuals(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    if (scanBeamMesh) {
        const positions = (scanBeamMesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        // Left Mandible Beam
        positions[0] = startPos.x;
        positions[1] = startPos.y + 0.3;
        positions[2] = startPos.z + 0.6;
        positions[3] = targetPos.x;
        positions[4] = targetPos.y;
        positions[5] = targetPos.z;

        // Right Mandible Beam
        positions[6] = startPos.x;
        positions[7] = startPos.y + 0.3;
        positions[8] = startPos.z - 0.6;
        positions[9] = targetPos.x;
        positions[10] = targetPos.y;
        positions[11] = targetPos.z;

        scanBeamMesh.geometry.attributes.position.needsUpdate = true;
        (scanBeamMesh.material as THREE.Material).opacity = 0.65 + Math.sin(Date.now() * 0.04) * 0.35;
    }

    if (scanPlanetRingMesh) {
        scanPlanetRingMesh.position.copy(targetPos);
        scanPlanetRingMesh.rotation.y += 0.02;
        const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.03;
        scanPlanetRingMesh.scale.set(pulse, pulse, pulse);
        (scanPlanetRingMesh.material as THREE.Material).opacity = 0.25 + Math.sin(Date.now() * 0.015) * 0.15;
    }
}

export function removeScanVisuals() {
    if (scanBeamMesh) {
        scene.remove(scanBeamMesh);
        scanBeamMesh.geometry.dispose();
        (scanBeamMesh.material as THREE.Material).dispose();
        scanBeamMesh = null;
    }
    if (scanPlanetRingMesh) {
        scene.remove(scanPlanetRingMesh);
        scanPlanetRingMesh.geometry.dispose();
        (scanPlanetRingMesh.material as THREE.Material).dispose();
        scanPlanetRingMesh = null;
    }
}

// 4. Supermassive Black Hole 3D Simulation (Event Horizon, Photon Ring, Accretion Disk & Polar Jets)
export function createBlackHoleMesh(size: number) {
    const group = new THREE.Group();

    // A. Pitch-Black Event Horizon (Zero reflection, absolute light trap)
    const horizonGeo = new THREE.SphereGeometry(size, 48, 48);
    const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    group.add(horizonMesh);

    // B. Relativistic Photon Ring (Blinding razor-thin white light boundary)
    const photonGeo = new THREE.RingGeometry(size * 1.02, size * 1.12, 64);
    photonGeo.rotateX(Math.PI / 2.3);
    const photonMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const photonRing = new THREE.Mesh(photonGeo, photonMat);
    group.add(photonRing);

    // C. Glowing Accretion Disk (Swirling multi-temperature plasma matter)
    const diskGeo = new THREE.RingGeometry(size * 1.15, size * 3.8, 64);
    diskGeo.rotateX(Math.PI / 2.3);
    const diskMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    group.add(accretionDisk);

    // D. Outer Gravitational Warping Lensing Halo
    const lensGeo = new THREE.RingGeometry(size * 1.2, size * 5.2, 64);
    lensGeo.rotateX(Math.PI / 2.3);
    const lensMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const lensRing = new THREE.Mesh(lensGeo, lensMat);
    group.add(lensRing);

    // E. Relativistic Twin Polar Jets
    const jetGeo = new THREE.CylinderGeometry(0.15, size * 0.9, size * 9.0, 16);
    const jetMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
    });
    const topJet = new THREE.Mesh(jetGeo, jetMat);
    topJet.position.y = size * 4.5;
    group.add(topJet);

    const bottomJet = topJet.clone();
    bottomJet.position.y = -size * 4.5;
    bottomJet.rotation.z = Math.PI;
    group.add(bottomJet);

    return {
        group,
        update: (dt: number) => {
            accretionDisk.rotation.z += 0.8 * dt;
            lensRing.rotation.z -= 0.3 * dt;
            photonRing.rotation.z += 1.2 * dt;
            (topJet.material as THREE.Material).opacity = 0.35 + Math.sin(Date.now() * 0.008) * 0.15;
            (bottomJet.material as THREE.Material).opacity = 0.35 + Math.sin(Date.now() * 0.008) * 0.15;
        }
    };
}

// 5. Ancient Precursor Chrono-Construct (Mega-Konstrukt at Sagittarius A*)
export function createPrecursorConstructMesh(size: number) {
    const group = new THREE.Group();

    // A. Central Geometric Monolith Core
    const coreGeo = new THREE.OctahedronGeometry(size * 0.8, 0);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.95
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // B. Inner Gyroscope Ring
    const ring1Geo = new THREE.TorusGeometry(size * 1.3, 0.08, 16, 48);
    const ring1Mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.2,
        roughness: 0.1,
        metalness: 0.9
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    group.add(ring1);

    // C. Outer Dyson-Gimbal Ring
    const ring2Geo = new THREE.TorusGeometry(size * 1.8, 0.1, 16, 64);
    const ring2Mat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.9
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 3;
    group.add(ring2);

    return {
        group,
        update: (dt: number) => {
            coreMesh.rotation.y += 0.4 * dt;
            coreMesh.rotation.x += 0.2 * dt;
            ring1.rotation.x += 0.8 * dt;
            ring1.rotation.y += 0.5 * dt;
            ring2.rotation.y -= 0.6 * dt;
            ring2.rotation.z += 0.4 * dt;
        }
    };
}

// 6. Relativistic Accretion Plasma Vortex
export function createPlasmaVortexMesh(size: number, colorHex: number) {
    const group = new THREE.Group();

    const sphereGeo = new THREE.SphereGeometry(size, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphereMesh);

    const auraGeo = new THREE.RingGeometry(size * 1.05, size * 2.2, 32);
    auraGeo.rotateX(Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    group.add(auraMesh);

    return {
        group,
        update: (dt: number) => {
            sphereMesh.rotation.y += 1.4 * dt;
            auraMesh.rotation.z += 2.0 * dt;
            (sphereMesh.material as THREE.Material).opacity = 0.75 + Math.sin(Date.now() * 0.01) * 0.2;
        }
    };
}

// 7. Interstellar Faction Jump Gate & Navigational Beacon
export interface JumpGateController {
    group: THREE.Group;
    update: (dt: number) => void;
    beaconLight: THREE.PointLight;
    energyDisc: THREE.Mesh;
    factionColor: number;
}

export const activeJumpGates: JumpGateController[] = [];

export function clearJumpGates() {
    activeJumpGates.forEach(jg => {
        scene.remove(jg.group);
        jg.group.traverse(obj => {
            if ((obj as THREE.Mesh).geometry) {
                (obj as THREE.Mesh).geometry.dispose();
            }
            if ((obj as THREE.Mesh).material) {
                const mat = (obj as THREE.Mesh).material;
                if (Array.isArray(mat)) {
                    mat.forEach(m => m.dispose());
                } else {
                    mat.dispose();
                }
            }
        });
    });
    activeJumpGates.length = 0;
}

export function createJumpGateMesh(size: number = 9.0, factionColor: number = 0x38bdf8): JumpGateController {
    const group = new THREE.Group();

    // A. Hexagonal / Octagonal Outer Pylon Ring Structure
    const gateGeo = new THREE.TorusGeometry(size, 0.45, 8, 32);
    const gateMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: factionColor,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.9
    });
    const gateRing = new THREE.Mesh(gateGeo, gateMat);
    group.add(gateRing);

    // B. Inner Gyro Accretion Ring
    const innerRingGeo = new THREE.TorusGeometry(size * 0.82, 0.2, 8, 24);
    const innerRingMat = new THREE.MeshBasicMaterial({
        color: factionColor,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    group.add(innerRing);

    // C. Translucent Subspace Event Horizon Energy Vortex
    const vortexGeo = new THREE.RingGeometry(0.1, size * 0.8, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
        color: factionColor,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const energyDisc = new THREE.Mesh(vortexGeo, vortexMat);
    group.add(energyDisc);

    // D. 4 Cardinal Navigation Pylons / Guide Beacons
    for (let i = 0; i < 4; i++) {
        const pylonAngle = (i * Math.PI / 2);
        const pylonGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const pylonMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: factionColor,
            emissiveIntensity: 1.4,
            metalness: 0.95
        });
        const pylonMesh = new THREE.Mesh(pylonGeo, pylonMat);
        pylonMesh.position.set(Math.cos(pylonAngle) * (size + 0.6), Math.sin(pylonAngle) * (size + 0.6), 0);
        group.add(pylonMesh);
    }

    // E. Dynamic Pulsing Nav-Beacon Light
    const beaconLight = new THREE.PointLight(factionColor, 2.8, 85, 1.4);
    beaconLight.position.set(0, 0, 0.5);
    group.add(beaconLight);

    const controller: JumpGateController = {
        group,
        beaconLight,
        energyDisc,
        factionColor,
        update: (dt: number) => {
            innerRing.rotation.z += 0.8 * dt;
            innerRing.rotation.y += 0.4 * dt;
            energyDisc.rotation.z -= 1.2 * dt;
            const pulse = 0.5 + Math.sin(Date.now() * 0.006) * 0.25;
            (energyDisc.material as THREE.Material).opacity = pulse;
            beaconLight.intensity = 2.0 + Math.sin(Date.now() * 0.009) * 1.2;
        }
    };

    activeJumpGates.push(controller);
    scene.add(group);
    return controller;
}

// 7. Historical Voyager 2 Space Probe POI
export function createVoyagerProbeMesh(size: number = 2.2) {
    const group = new THREE.Group();

    // A. Main 10-sided Equipment Bus (Central Body)
    const busGeo = new THREE.CylinderGeometry(size * 0.45, size * 0.45, size * 0.35, 10);
    const busMat = new THREE.MeshStandardMaterial({
        color: 0x27272a,
        metalness: 0.8,
        roughness: 0.3
    });
    const busMesh = new THREE.Mesh(busGeo, busMat);
    group.add(busMesh);

    // B. Parabolic High-Gain Antenna Dish (3.7m diameter representation)
    const dishGeo = new THREE.SphereGeometry(size * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.38);
    const dishMat = new THREE.MeshStandardMaterial({
        color: 0xf4f4f5,
        metalness: 0.5,
        roughness: 0.25,
        side: THREE.DoubleSide
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.rotation.x = Math.PI; // Concave facing upwards / forwards
    dishMesh.position.set(0, size * 0.35, 0);
    group.add(dishMesh);

    // C. Sub-Reflector Tripod Feed
    const feedPoleGeo = new THREE.CylinderGeometry(0.02 * size, 0.02 * size, size * 0.6, 6);
    const feedMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.9, roughness: 0.2 });
    const feedPole = new THREE.Mesh(feedPoleGeo, feedMat);
    feedPole.position.set(0, size * 0.75, 0);
    group.add(feedPole);

    const subReflectorGeo = new THREE.ConeGeometry(size * 0.12, size * 0.12, 8);
    const subReflector = new THREE.Mesh(subReflectorGeo, feedMat);
    subReflector.rotation.x = Math.PI;
    subReflector.position.set(0, size * 1.05, 0);
    group.add(subReflector);

    // D. The Golden Record (Gold-Plated Phonograph Record on Probe Flank)
    const recordGeo = new THREE.CylinderGeometry(size * 0.32, size * 0.32, 0.03 * size, 32);
    const recordMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        metalness: 0.98,
        roughness: 0.12
    });
    const goldenRecord = new THREE.Mesh(recordGeo, recordMat);
    goldenRecord.position.set(size * 0.46, -size * 0.05, 0);
    goldenRecord.rotation.z = Math.PI / 2; // Flat against the side bus
    group.add(goldenRecord);

    // Subtle Grooves Center Ring
    const recordCenterGeo = new THREE.CylinderGeometry(size * 0.08, size * 0.08, 0.035 * size, 16);
    const recordCenterMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.5 });
    const recordCenter = new THREE.Mesh(recordCenterGeo, recordCenterMat);
    recordCenter.position.copy(goldenRecord.position);
    recordCenter.rotation.copy(goldenRecord.rotation);
    group.add(recordCenter);

    // E. Magnetometer Boom (Long structural truss)
    const boomGeo = new THREE.CylinderGeometry(0.025 * size, 0.025 * size, size * 3.2, 8);
    const boomMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.85, roughness: 0.3 });
    const boomMesh = new THREE.Mesh(boomGeo, boomMat);
    boomMesh.position.set(-size * 1.6, -size * 0.2, 0);
    boomMesh.rotation.z = Math.PI / 2.3;
    group.add(boomMesh);

    // Magnetometer Canister at Boom Tip
    const magCanisterGeo = new THREE.CylinderGeometry(size * 0.08, size * 0.08, size * 0.22, 12);
    const magCanister = new THREE.Mesh(magCanisterGeo, recordMat);
    magCanister.position.set(-size * 3.1, size * 0.3, 0);
    group.add(magCanister);

    // F. RTG Power Source Boom (Radioisotope Thermoelectric Generators)
    const rtgGeo = new THREE.BoxGeometry(size * 0.7, size * 0.2, size * 0.2);
    const rtgMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.4 });
    const rtgMesh = new THREE.Mesh(rtgGeo, rtgMat);
    rtgMesh.position.set(size * 0.7, -size * 0.4, size * 0.5);
    group.add(rtgMesh);

    // G. Optical Beacon Light & Golden Signal Halo
    const beaconLight = new THREE.PointLight(0xf59e0b, 1.8, 45, 1.2);
    beaconLight.position.set(0, size * 1.1, 0);
    group.add(beaconLight);

    const haloGeo = new THREE.RingGeometry(size * 0.4, size * 0.55, 32);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
    });
    const signalHalo = new THREE.Mesh(haloGeo, haloMat);
    signalHalo.position.set(0, size * 1.15, 0);
    signalHalo.rotation.x = Math.PI / 2;
    group.add(signalHalo);

    return {
        group,
        goldenRecord,
        beaconLight,
        signalHalo,
        update: (dt: number) => {
            // Gentle spatial drift / rotation
            group.rotation.y += 0.05 * dt;
            group.rotation.x += 0.02 * dt;
            // Golden Record rotation
            goldenRecord.rotation.y += 1.2 * dt;
            // Pulsing carrier wave beacon
            const pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
            beaconLight.intensity = 1.0 + pulse * 1.5;
            signalHalo.scale.setScalar(1.0 + pulse * 0.4);
            (signalHalo.material as THREE.Material).opacity = 0.25 + pulse * 0.4;
        }
    };
}


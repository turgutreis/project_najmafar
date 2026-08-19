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
    ship.group.scale.set(0.65, 0.65, 0.65);
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

export function createTargetReticle() {
    if (targetReticleGroup) return;
    targetReticleGroup = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(1.2, 1.4, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    targetReticleGroup.add(ringMesh);

    const boxGeo = new THREE.RingGeometry(1.55, 1.7, 4);
    boxGeo.rotateX(Math.PI / 2);
    boxGeo.rotateY(Math.PI / 4);
    const boxMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    targetReticleGroup.add(boxMesh);

    targetReticleGroup.visible = false;
    scene.add(targetReticleGroup);
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

    // 2. Holographic Scan Grid Ring around Planet
    const ringGeo = new THREE.RingGeometry(targetSize * 1.05, targetSize * 1.35, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        wireframe: true
    });
    scanPlanetRingMesh = new THREE.Mesh(ringGeo, ringMat);
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
        scanPlanetRingMesh.position.y = Math.sin(Date.now() * 0.008) * 1.5;
        scanPlanetRingMesh.rotation.y += 0.04;
        (scanPlanetRingMesh.material as THREE.Material).opacity = 0.5 + Math.sin(Date.now() * 0.02) * 0.4;
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

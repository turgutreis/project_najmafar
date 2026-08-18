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

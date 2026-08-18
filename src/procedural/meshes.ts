import * as THREE from 'three';
import { scene } from '../engine/scene';
import { STATE } from '../core/state';

export let playerMesh: THREE.Mesh;
export let playerGlowMesh: THREE.Mesh;
export let playerLight: THREE.PointLight;
export let thrustLight: THREE.PointLight;
export let empLight: THREE.PointLight;
export let targetReticleGroup: THREE.Group | null = null;
export let sonarWaveMesh: THREE.Mesh | null = null;
export let abductBeamMesh: THREE.Line | null = null;
export let harvestBeamMesh: THREE.Line | null = null;

export const gravityCircles: { mesh: THREE.Mesh; pulseSpeed: number; baseOpacity: number }[] = [];

export function createPlayerMesh(): THREE.Group {
    const playerGroup = new THREE.Group();

    // Core body (Elongated ellipsoid)
    const coreGeo = new THREE.SphereGeometry(2, 32, 16);
    coreGeo.scale(1.5, 0.8, 0.8);

    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x111827,
        flatShading: true
    });

    playerMesh = new THREE.Mesh(coreGeo, coreMat);
    playerGroup.add(playerMesh);

    // Bioluminescent outer shield shell
    const glowGeo = new THREE.SphereGeometry(2.4, 16, 16);
    glowGeo.scale(1.6, 0.9, 0.9);

    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });

    playerGlowMesh = new THREE.Mesh(glowGeo, glowMat);
    playerGroup.add(playerGlowMesh);

    // Dynamic Bioluminescent Aura Light (Lights up nearby asteroids & terrain)
    playerLight = new THREE.PointLight(0x00ff88, 1.2, 30, 1.8);
    playerGroup.add(playerLight);

    // Dynamic Plasma Thrust Flare Light (Illuminates space debris behind ship when thrusting)
    thrustLight = new THREE.PointLight(0x38bdf8, 0.0, 35, 1.5);
    thrustLight.position.set(-2.4, 0, 0);
    playerGroup.add(thrustLight);

    // EMP Shockwave Flash Light (Lights up entire sector on discharge [X])
    empLight = new THREE.PointLight(0xd946ef, 0.0, 180, 1.0);
    playerGroup.add(empLight);

    // Bio-Tentacles (appendages that sway)
    const tentacleCount = 4;
    for (let i = 0; i < tentacleCount; i++) {
        const tentacleGroup = new THREE.Group();
        const jointCount = 5;
        let lastParent = tentacleGroup;

        for (let j = 0; j < jointCount; j++) {
            const jointGeo = new THREE.SphereGeometry(0.5 - j * 0.08, 8, 8);
            const jointMat = new THREE.MeshStandardMaterial({
                color: 0x00ff88,
                emissive: 0x003311,
                roughness: 0.2
            });
            const jointMesh = new THREE.Mesh(jointGeo, jointMat);
            jointMesh.position.x = -1.2 - j * 0.8;
            jointMesh.position.z = (i - 1.5) * 0.6;
            lastParent.add(jointMesh);
            lastParent = jointMesh as any;
        }

        playerGroup.add(tentacleGroup);
    }

    playerGroup.position.copy(STATE.playerPosition);
    scene.add(playerGroup);
    STATE.playerGroup = playerGroup;

    return playerGroup;
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

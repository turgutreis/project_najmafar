import * as THREE from 'three';

export interface CosmicBackgroundController {
    group: THREE.Group;
    update: (dt: number, playerPos: THREE.Vector3) => void;
    dispose: () => void;
}

export function createRealisticStarfield(): CosmicBackgroundController {
    const group = new THREE.Group();

    // 1. Layer A: Deep Cosmic Micro-Stars (4500 particles, seamless full field)
    const microCount = 4500;
    const microGeo = new THREE.BufferGeometry();
    const microPos = new Float32Array(microCount * 3);
    const microCol = new Float32Array(microCount * 3);

    for (let i = 0; i < microCount; i++) {
        // Full uniform circular distribution (from 0 to 650 - NO HOLES in the center!)
        const r = Math.sqrt(Math.random()) * 650;
        const theta = Math.random() * Math.PI * 2;

        microPos[i * 3] = Math.cos(theta) * r;
        microPos[i * 3 + 1] = -180 - Math.random() * 120; // Deep background layer
        microPos[i * 3 + 2] = Math.sin(theta) * r;

        // Astronomical spectral types
        const rand = Math.random();
        if (rand < 0.40) {
            // Crisp White (A/F type)
            microCol[i * 3] = 0.95; microCol[i * 3 + 1] = 0.95; microCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.65) {
            // Sol Yellow / Gold (G type)
            microCol[i * 3] = 1.0; microCol[i * 3 + 1] = 0.90; microCol[i * 3 + 2] = 0.65;
        } else if (rand < 0.85) {
            // Electric Cyan / Blue (O/B type)
            microCol[i * 3] = 0.45; microCol[i * 3 + 1] = 0.85; microCol[i * 3 + 2] = 1.0;
        } else {
            // Warm Orange / Red Dwarf (K/M type)
            microCol[i * 3] = 1.0; microCol[i * 3 + 1] = 0.55; microCol[i * 3 + 2] = 0.45;
        }
    }

    microGeo.setAttribute('position', new THREE.BufferAttribute(microPos, 3));
    microGeo.setAttribute('color', new THREE.BufferAttribute(microCol, 3));

    const microMat = new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
    });

    const microPoints = new THREE.Points(microGeo, microMat);
    group.add(microPoints);

    // 2. Layer B: Mid-Field Bright Stars (1200 particles)
    const midCount = 1200;
    const midGeo = new THREE.BufferGeometry();
    const midPos = new Float32Array(midCount * 3);
    const midCol = new Float32Array(midCount * 3);

    for (let i = 0; i < midCount; i++) {
        const r = Math.sqrt(Math.random()) * 600;
        const theta = Math.random() * Math.PI * 2;

        midPos[i * 3] = Math.cos(theta) * r;
        midPos[i * 3 + 1] = -140 - Math.random() * 60;
        midPos[i * 3 + 2] = Math.sin(theta) * r;

        const rand = Math.random();
        if (rand < 0.35) {
            midCol[i * 3] = 1.0; midCol[i * 3 + 1] = 1.0; midCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.60) {
            midCol[i * 3] = 0.35; midCol[i * 3 + 1] = 0.88; midCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.85) {
            midCol[i * 3] = 1.0; midCol[i * 3 + 1] = 0.82; midCol[i * 3 + 2] = 0.35;
        } else {
            midCol[i * 3] = 0.95; midCol[i * 3 + 1] = 0.45; midCol[i * 3 + 2] = 0.85;
        }
    }

    midGeo.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
    midGeo.setAttribute('color', new THREE.BufferAttribute(midCol, 3));

    const midMat = new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.90,
        depthWrite: false
    });

    const midPoints = new THREE.Points(midGeo, midMat);
    group.add(midPoints);

    // 3. Layer C: Prominent Celestial Beacon Stars (120 prominent stars)
    const beaconCount = 120;
    const beaconGeo = new THREE.BufferGeometry();
    const beaconPos = new Float32Array(beaconCount * 3);
    const beaconCol = new Float32Array(beaconCount * 3);

    for (let i = 0; i < beaconCount; i++) {
        const r = Math.sqrt(Math.random()) * 550;
        const theta = Math.random() * Math.PI * 2;

        beaconPos[i * 3] = Math.cos(theta) * r;
        beaconPos[i * 3 + 1] = -110 - Math.random() * 40;
        beaconPos[i * 3 + 2] = Math.sin(theta) * r;

        const rand = Math.random();
        if (rand < 0.4) {
            beaconCol[i * 3] = 0.5; beaconCol[i * 3 + 1] = 0.95; beaconCol[i * 3 + 2] = 1.0;
        } else if (rand < 0.7) {
            beaconCol[i * 3] = 1.0; beaconCol[i * 3 + 1] = 0.88; beaconCol[i * 3 + 2] = 0.3;
        } else {
            beaconCol[i * 3] = 1.0; beaconCol[i * 3 + 1] = 1.0; beaconCol[i * 3 + 2] = 1.0;
        }
    }

    beaconGeo.setAttribute('position', new THREE.BufferAttribute(beaconPos, 3));
    beaconGeo.setAttribute('color', new THREE.BufferAttribute(beaconCol, 3));

    const beaconMat = new THREE.PointsMaterial({
        size: 1.7,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
    });

    const beaconPoints = new THREE.Points(beaconGeo, beaconMat);
    group.add(beaconPoints);

    // 4. Subtle Procedural Deep Space Nebula Clouds (Soft cosmic dust)
    const nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = 256;
    nebulaCanvas.height = 256;
    const nCtx = nebulaCanvas.getContext('2d')!;
    const gradient = nCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
    gradient.addColorStop(0.35, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(0.7, 'rgba(15, 23, 42, 0.12)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nCtx.fillStyle = gradient;
    nCtx.fillRect(0, 0, 256, 256);

    const nebulaTex = new THREE.CanvasTexture(nebulaCanvas);
    const nebulaGeo = new THREE.PlaneGeometry(350, 350);
    nebulaGeo.rotateX(-Math.PI / 2);

    const nebulaColors = [0x6366f1, 0x06b6d4, 0xd946ef, 0x3b82f6];
    const nebulaMeshes: THREE.Mesh[] = [];

    for (let k = 0; k < 6; k++) {
        const nMat = new THREE.MeshBasicMaterial({
            map: nebulaTex,
            color: nebulaColors[k % nebulaColors.length],
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const nMesh = new THREE.Mesh(nebulaGeo, nMat);
        const ang = (k / 6) * Math.PI * 2 + 0.4;
        const dist = 120 + (k % 3) * 110;
        nMesh.position.set(Math.cos(ang) * dist, -240 - k * 15, Math.sin(ang) * dist);
        nMesh.rotation.y = k * 1.1;
        group.add(nMesh);
        nebulaMeshes.push(nMesh);
    }

    let totalTime = 0;

    return {
        group,
        update: (dt: number, playerPos: THREE.Vector3) => {
            totalTime += dt;

            // Slow cosmic rotation
            group.rotation.y = totalTime * 0.0015;

            // Subtle parallax with player movement
            if (playerPos) {
                microPoints.position.x = playerPos.x * 0.015;
                microPoints.position.z = playerPos.z * 0.015;

                midPoints.position.x = playerPos.x * 0.035;
                midPoints.position.z = playerPos.z * 0.035;

                beaconPoints.position.x = playerPos.x * 0.06;
                beaconPoints.position.z = playerPos.z * 0.06;
            }
        },
        dispose: () => {
            microGeo.dispose();
            microMat.dispose();
            midGeo.dispose();
            midMat.dispose();
            beaconGeo.dispose();
            beaconMat.dispose();
            nebulaGeo.dispose();
            nebulaTex.dispose();
            nebulaMeshes.forEach(m => (m.material as THREE.Material).dispose());
        }
    };
}

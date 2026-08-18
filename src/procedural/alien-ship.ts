import * as THREE from 'three';
import { STATE } from '../core/state';

export interface AlienShipController {
    group: THREE.Group;
    coreMesh: THREE.Mesh;
    psioCoreMesh: THREE.Mesh;
    shieldGlowMesh: THREE.Mesh;
    leftWing: THREE.Group;
    rightWing: THREE.Group;
    leftMandible: THREE.Group;
    rightMandible: THREE.Group;
    ventFlaps: THREE.Mesh[];
    tendrils: THREE.Group[];
    update: (dt: number) => void;
}

export function createAlienBioShip(): AlienShipController {
    const group = new THREE.Group();

    // 1. Materials
    // Dark metallic iridescent bio-chitin carapace
    const chitinMat = new THREE.MeshStandardMaterial({
        color: 0x0a101f,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0x050c18,
        flatShading: false
    });

    // Segmented spinal plate carapace
    const dorsalPlateMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x022c22
    });

    // Bioluminescent psionic nerve tissue
    const biolumMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.2
    });

    // Translucent Psionic Nucleus
    const nucleusMat = new THREE.MeshPhysicalMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.6,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        transmission: 0.6,
        ior: 1.45
    });

    // 2. Central Streamlined Fuselage (Thorax & Head)
    const bodyGeo = new THREE.ConeGeometry(1.6, 4.6, 16);
    bodyGeo.rotateZ(-Math.PI / 2); // Point towards +X
    bodyGeo.scale(1.0, 0.45, 0.75); // Flattened streamline
    const coreMesh = new THREE.Mesh(bodyGeo, chitinMat);
    coreMesh.position.x = 0.4;
    group.add(coreMesh);

    // 3. Segmented Dorsal Carapace Plates (Overlapping Trilobite-like spinal crests)
    const plateCount = 4;
    for (let i = 0; i < plateCount; i++) {
        const pSize = 1.4 - i * 0.22;
        const plateGeo = new THREE.CylinderGeometry(pSize * 0.7, pSize, 0.5, 8);
        plateGeo.rotateZ(-Math.PI / 2);
        plateGeo.scale(0.8, 0.4, 0.9);
        const plate = new THREE.Mesh(plateGeo, dorsalPlateMat);
        plate.position.set(0.6 - i * 0.7, 0.25 - i * 0.04, 0);
        group.add(plate);
    }

    // 4. Central Psionic Neural Core (Breathing Bio-Sphere)
    const nucGeo = new THREE.SphereGeometry(0.75, 24, 24);
    nucGeo.scale(1.4, 0.6, 0.7);
    const psioCoreMesh = new THREE.Mesh(nucGeo, nucleusMat);
    psioCoreMesh.position.set(0.3, 0.38, 0);
    group.add(psioCoreMesh);

    // 5. Bioluminescent Neural Veins running along spine
    const veinGeo = new THREE.BoxGeometry(2.4, 0.08, 0.12);
    const veinMesh = new THREE.Mesh(veinGeo, biolumMat);
    veinMesh.position.set(0.1, 0.42, 0);
    group.add(veinMesh);

    // 6. Front Predatory Mandibles (Grasping pincers that open/close)
    const leftMandible = new THREE.Group();
    const rightMandible = new THREE.Group();

    const mandGeo = new THREE.ConeGeometry(0.35, 1.8, 8);
    mandGeo.rotateZ(-Math.PI / 2.3);
    mandGeo.scale(1.0, 0.4, 0.8);

    const leftMandMesh = new THREE.Mesh(mandGeo, dorsalPlateMat);
    leftMandMesh.position.set(0.7, 0, 0.35);
    leftMandible.add(leftMandMesh);
    leftMandible.position.set(1.9, 0, 0.45);

    const rightMandMesh = new THREE.Mesh(mandGeo, dorsalPlateMat);
    rightMandMesh.position.set(0.7, 0, -0.35);
    rightMandible.add(rightMandMesh);
    rightMandible.position.set(1.9, 0, -0.45);

    group.add(leftMandible);
    group.add(rightMandible);

    // 7. Broad Cosmic Manta Wings (Undulating Bio-Wings with glowing leading edges)
    const leftWing = new THREE.Group();
    const rightWing = new THREE.Group();

    // Custom Wing Shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.8, -2.8);
    wingShape.bezierCurveTo(0.2, -4.2, -1.2, -3.8, -2.2, -2.0);
    wingShape.lineTo(-1.2, 0);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2); // Lay flat on XZ plane

    const leftWingMesh = new THREE.Mesh(wingGeo, chitinMat);
    leftWing.add(leftWingMesh);
    leftWing.position.set(0.2, 0, 0.6);

    const rightWingGeo = wingGeo.clone();
    rightWingGeo.scale(1, 1, -1);
    const rightWingMesh = new THREE.Mesh(rightWingGeo, chitinMat);
    rightWing.add(rightWingMesh);
    rightWing.position.set(0.2, 0, -0.6);

    // Bioluminescent Wing Edge Beams
    const wingEdgeGeo = new THREE.CylinderGeometry(0.08, 0.04, 3.4, 6);
    wingEdgeGeo.rotateZ(Math.PI / 3);
    const leftEdge = new THREE.Mesh(wingEdgeGeo, biolumMat);
    leftEdge.position.set(0.4, 0.05, 1.8);
    leftWing.add(leftEdge);

    const rightEdge = new THREE.Mesh(wingEdgeGeo, biolumMat);
    rightEdge.position.set(0.4, 0.05, -1.8);
    rightWing.add(rightEdge);

    group.add(leftWing);
    group.add(rightWing);

    // 8. Rear Breathing Vent Flaps (Adaptive Biological Thruster Exhaust)
    const ventFlaps: THREE.Mesh[] = [];
    for (let v = 0; v < 3; v++) {
        const vGeo = new THREE.BoxGeometry(0.8, 0.08, 0.4);
        const vMesh = new THREE.Mesh(vGeo, dorsalPlateMat);
        vMesh.position.set(-1.6 - v * 0.3, 0.15 - v * 0.05, (v - 1) * 0.45);
        group.add(vMesh);
        ventFlaps.push(vMesh);
    }

    // 9. Twin Bio-Whip Tendrils (Swaying tail appendages)
    const tendrils: THREE.Group[] = [];
    const tendrilCount = 2;
    for (let t = 0; t < tendrilCount; t++) {
        const tendrilGroup = new THREE.Group();
        tendrilGroup.position.set(-2.0, 0, (t === 0 ? 0.4 : -0.4));
        
        let lastJoint = tendrilGroup;
        const segmentCount = 6;
        for (let s = 0; s < segmentCount; s++) {
            const segGeo = new THREE.ConeGeometry(0.24 - s * 0.035, 0.7, 6);
            segGeo.rotateZ(Math.PI / 2);
            const segMat = s === segmentCount - 1 ? biolumMat : chitinMat;
            const segMesh = new THREE.Mesh(segGeo, segMat);
            segMesh.position.x = -0.55;
            lastJoint.add(segMesh);
            lastJoint = segMesh as any;
        }
        
        group.add(tendrilGroup);
        tendrils.push(tendrilGroup);
    }

    // 10. Outer Psionic Shield Shell
    const shieldGeo = new THREE.SphereGeometry(2.6, 20, 16);
    shieldGeo.scale(1.5, 0.6, 1.4);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    const shieldGlowMesh = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shieldGlowMesh);

    let animTime = 0;

    return {
        group,
        coreMesh,
        psioCoreMesh,
        shieldGlowMesh,
        leftWing,
        rightWing,
        leftMandible,
        rightMandible,
        ventFlaps,
        tendrils,
        update: (dt: number) => {
            animTime += dt;

            // A. Breathing Psionic Core & Shield Pulse
            const breath = Math.sin(animTime * 2.5);
            const coreScale = 1.0 + breath * 0.08;
            psioCoreMesh.scale.set(1.4 * coreScale, 0.6 * coreScale, 0.7 * coreScale);
            shieldGlowMesh.scale.set(1.5 * (1.0 + breath * 0.04), 0.6 * (1.0 + breath * 0.04), 1.4 * (1.0 + breath * 0.04));

            // Dynamic color state
            let activeColor = 0x00ff88;
            if (STATE.health < 30) {
                activeColor = 0xf43f5e; // Emergency red
            } else if (STATE.telepathyActive) {
                activeColor = 0xa855f7; // Psionic trance violet
            }

            (psioCoreMesh.material as THREE.MeshPhysicalMaterial).color.setHex(activeColor);
            (psioCoreMesh.material as THREE.MeshPhysicalMaterial).emissive.setHex(activeColor);
            (biolumMat as THREE.MeshStandardMaterial).color.setHex(activeColor);
            (biolumMat as THREE.MeshStandardMaterial).emissive.setHex(activeColor);
            (shieldGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(activeColor);

            // B. Undulating Wing Motion (Manta wave)
            const speedMagnitude = STATE.playerVelocity ? STATE.playerVelocity.length() : 0;
            const wingFreq = 3.5 + Math.min(speedMagnitude * 0.15, 4.0);
            const wingWave = Math.sin(animTime * wingFreq) * 0.18;

            leftWing.rotation.x = wingWave;
            leftWing.rotation.z = Math.cos(animTime * wingFreq) * 0.06;

            rightWing.rotation.x = -wingWave;
            rightWing.rotation.z = -Math.cos(animTime * wingFreq) * 0.06;

            // C. Front Mandibles Swaying / Grasping
            const isAbducting = STATE.abductActive || STATE.extractingPlanet !== null;
            const mandAngle = isAbducting ? 0.35 + Math.sin(animTime * 8.0) * 0.12 : 0.08 + Math.sin(animTime * 1.5) * 0.05;
            leftMandible.rotation.y = mandAngle;
            rightMandible.rotation.y = -mandAngle;

            // D. Breathing Rear Vents (Flares open when thrusting)
            const isThrusting = STATE.keys ? STATE.keys.w : false;
            const targetVentAngle = isThrusting ? 0.45 : 0.08 + Math.sin(animTime * 2.0) * 0.04;
            ventFlaps.forEach((f, idx) => {
                f.rotation.z = targetVentAngle * (idx === 1 ? 1.2 : 0.8);
            });

            // E. Twin Tail Tendril Physics Simulation
            tendrils.forEach((tGroup, tIdx) => {
                let currentJoint: any = tGroup;
                let depth = 0;
                while (currentJoint && currentJoint.children && currentJoint.children.length > 0) {
                    const next = currentJoint.children[0];
                    if (next) {
                        const phase = animTime * 4.0 + depth * 0.6 + tIdx * Math.PI;
                        next.rotation.z = Math.sin(phase) * 0.14;
                        next.rotation.y = Math.cos(phase * 0.8) * 0.10;
                        currentJoint = next;
                        depth++;
                    } else {
                        break;
                    }
                }
            });
        }
    };
}

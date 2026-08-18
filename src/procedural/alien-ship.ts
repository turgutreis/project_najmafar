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
    // Deep obsidian iridescent bio-chitin carapace
    const chitinMat = new THREE.MeshStandardMaterial({
        color: 0x070d1a,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x030814
    });

    // Segmented dorsal armor plates (Bio-metallic scales)
    const dorsalPlateMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.15,
        metalness: 0.95,
        emissive: 0x064e3b
    });

    // Radiant Bioluminescent Psionic Veins
    const biolumMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 1.2,
        roughness: 0.1,
        metalness: 0.1
    });

    // Translucent Glowing Neural Heart (Bio-Core)
    const nucleusMat = new THREE.MeshPhysicalMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.9,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
        transmission: 0.7,
        ior: 1.5
    });

    // 2. Central Streamlined Fuselage (Thorax & Head)
    const bodyGeo = new THREE.ConeGeometry(1.8, 5.2, 24);
    bodyGeo.rotateZ(-Math.PI / 2); // Point forward (+X)
    bodyGeo.scale(1.0, 0.45, 0.75); // Flattened aerodynamic bio-fuselage
    const coreMesh = new THREE.Mesh(bodyGeo, chitinMat);
    coreMesh.position.x = 0.5;
    group.add(coreMesh);

    // 3. Segmented Dorsal Carapace Plates (Trilobite spinal crests)
    const plateCount = 5;
    for (let i = 0; i < plateCount; i++) {
        const pSize = 1.6 - i * 0.22;
        const plateGeo = new THREE.CylinderGeometry(pSize * 0.65, pSize, 0.55, 12);
        plateGeo.rotateZ(-Math.PI / 2);
        plateGeo.scale(0.85, 0.45, 0.95);
        const plate = new THREE.Mesh(plateGeo, dorsalPlateMat);
        plate.position.set(0.8 - i * 0.75, 0.28 - i * 0.03, 0);
        group.add(plate);
    }

    // 4. Central Psionic Neural Core (Pulsing Bio-Heart)
    const nucGeo = new THREE.SphereGeometry(0.85, 24, 24);
    nucGeo.scale(1.4, 0.55, 0.75);
    const psioCoreMesh = new THREE.Mesh(nucGeo, nucleusMat);
    psioCoreMesh.position.set(0.35, 0.42, 0);
    group.add(psioCoreMesh);

    // 5. Bioluminescent Neural Spine Ridge
    const veinGeo = new THREE.BoxGeometry(2.8, 0.1, 0.14);
    const veinMesh = new THREE.Mesh(veinGeo, biolumMat);
    veinMesh.position.set(0.1, 0.46, 0);
    group.add(veinMesh);

    // 6. Front Predatory Mandibles (Grasping pincers that open/close)
    const leftMandible = new THREE.Group();
    const rightMandible = new THREE.Group();

    const mandGeo = new THREE.ConeGeometry(0.38, 2.2, 12);
    mandGeo.rotateZ(-Math.PI / 2.3);
    mandGeo.scale(1.0, 0.35, 0.75);

    const leftMandMesh = new THREE.Mesh(mandGeo, dorsalPlateMat);
    leftMandMesh.position.set(0.9, 0, 0.35);
    leftMandible.add(leftMandMesh);
    leftMandible.position.set(2.2, 0, 0.5);

    const rightMandMesh = new THREE.Mesh(mandGeo, dorsalPlateMat);
    rightMandMesh.position.set(0.9, 0, -0.35);
    rightMandible.add(rightMandMesh);
    rightMandible.position.set(2.2, 0, -0.5);

    // Mandible glowing bio-fangs
    const fangGeo = new THREE.CylinderGeometry(0.06, 0.02, 1.2, 6);
    fangGeo.rotateZ(Math.PI / 3);
    const leftFang = new THREE.Mesh(fangGeo, biolumMat);
    leftFang.position.set(0.9, 0.05, 0.4);
    leftMandible.add(leftFang);

    const rightFang = new THREE.Mesh(fangGeo, biolumMat);
    rightFang.position.set(0.9, 0.05, -0.4);
    rightMandible.add(rightFang);

    group.add(leftMandible);
    group.add(rightMandible);

    // 7. Broad Cosmic Manta Wings (Undulating Bio-Wings with glowing leading edges)
    const leftWing = new THREE.Group();
    const rightWing = new THREE.Group();

    // Sculpted Manta Wing Shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.2, -3.4);
    wingShape.bezierCurveTo(0.4, -5.2, -1.6, -4.8, -2.8, -2.4);
    wingShape.lineTo(-1.6, 0);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.14, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2); // Flat on XZ plane

    const leftWingMesh = new THREE.Mesh(wingGeo, chitinMat);
    leftWing.add(leftWingMesh);
    leftWing.position.set(0.2, 0, 0.7);

    const rightWingGeo = wingGeo.clone();
    rightWingGeo.scale(1, 1, -1);
    const rightWingMesh = new THREE.Mesh(rightWingGeo, chitinMat);
    rightWing.add(rightWingMesh);
    rightWing.position.set(0.2, 0, -0.7);

    // Glowing Bioluminescent Wing Edge Ribs
    const wingEdgeGeo = new THREE.CylinderGeometry(0.09, 0.04, 4.2, 6);
    wingEdgeGeo.rotateZ(Math.PI / 3);
    const leftEdge = new THREE.Mesh(wingEdgeGeo, biolumMat);
    leftEdge.position.set(0.6, 0.06, 2.2);
    leftWing.add(leftEdge);

    const rightEdge = new THREE.Mesh(wingEdgeGeo, biolumMat);
    rightEdge.position.set(0.6, 0.06, -2.2);
    rightWing.add(rightEdge);

    group.add(leftWing);
    group.add(rightWing);

    // 8. Rear Breathing Vent Flaps (Adaptive Biological Thruster Exhaust)
    const ventFlaps: THREE.Mesh[] = [];
    for (let v = 0; v < 3; v++) {
        const vGeo = new THREE.BoxGeometry(0.9, 0.1, 0.45);
        const vMesh = new THREE.Mesh(vGeo, dorsalPlateMat);
        vMesh.position.set(-1.8 - v * 0.35, 0.16 - v * 0.05, (v - 1) * 0.5);
        group.add(vMesh);
        ventFlaps.push(vMesh);
    }

    // 9. Twin Bio-Whip Tendrils (Swaying tail appendages)
    const tendrils: THREE.Group[] = [];
    const tendrilCount = 2;
    for (let t = 0; t < tendrilCount; t++) {
        const tendrilGroup = new THREE.Group();
        tendrilGroup.position.set(-2.4, 0, (t === 0 ? 0.45 : -0.45));
        
        let lastJoint = tendrilGroup;
        const segmentCount = 7;
        for (let s = 0; s < segmentCount; s++) {
            const segGeo = new THREE.ConeGeometry(0.26 - s * 0.032, 0.75, 8);
            segGeo.rotateZ(Math.PI / 2);
            const segMat = s >= segmentCount - 2 ? biolumMat : chitinMat;
            const segMesh = new THREE.Mesh(segGeo, segMat);
            segMesh.position.x = -0.6;
            lastJoint.add(segMesh);
            lastJoint = segMesh as any;
        }
        
        group.add(tendrilGroup);
        tendrils.push(tendrilGroup);
    }

    // 10. Outer Psionic Shield Energy Membrane (Smooth Fresnel Halo - NO WIREFRAME)
    const shieldGeo = new THREE.SphereGeometry(3.2, 32, 16);
    shieldGeo.scale(1.5, 0.45, 1.4);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: false,
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const shieldGlowMesh = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shieldGlowMesh);

    // Set prominent scale for clear, crisp visibility
    group.scale.set(1.4, 1.4, 1.4);

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
            psioCoreMesh.scale.set(1.4 * coreScale, 0.55 * coreScale, 0.75 * coreScale);

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
            const wingFreq = 3.2 + Math.min(speedMagnitude * 0.15, 3.5);
            const wingWave = Math.sin(animTime * wingFreq) * 0.22;

            leftWing.rotation.x = wingWave;
            leftWing.rotation.z = Math.cos(animTime * wingFreq) * 0.08;

            rightWing.rotation.x = -wingWave;
            rightWing.rotation.z = -Math.cos(animTime * wingFreq) * 0.08;

            // C. Front Mandibles Swaying / Grasping
            const isAbducting = STATE.abductActive || STATE.extractingPlanet !== null;
            const mandAngle = isAbducting ? 0.45 + Math.sin(animTime * 8.0) * 0.15 : 0.08 + Math.sin(animTime * 1.5) * 0.05;
            leftMandible.rotation.y = mandAngle;
            rightMandible.rotation.y = -mandAngle;

            // D. Breathing Rear Vents (Flares open when thrusting)
            const isThrusting = STATE.keys ? STATE.keys.w : false;
            const targetVentAngle = isThrusting ? 0.55 : 0.08 + Math.sin(animTime * 2.0) * 0.04;
            ventFlaps.forEach((f, idx) => {
                f.rotation.z = targetVentAngle * (idx === 1 ? 1.3 : 0.9);
            });

            // E. Twin Tail Tendril Physics Simulation
            tendrils.forEach((tGroup, tIdx) => {
                let currentJoint: any = tGroup;
                let depth = 0;
                while (currentJoint && currentJoint.children && currentJoint.children.length > 0) {
                    const next = currentJoint.children[0];
                    if (next) {
                        const phase = animTime * 4.0 + depth * 0.6 + tIdx * Math.PI;
                        next.rotation.z = Math.sin(phase) * 0.16;
                        next.rotation.y = Math.cos(phase * 0.8) * 0.12;
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

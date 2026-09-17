import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene } from '../engine/scene';
import { createAlienCarapaceTexture, createAlienWingTexture, createAlienVeinTexture } from './textures';

export interface SpacetimeRipple {
    position: THREE.Vector3;
    progress: number;
    worldRadius: number;
}

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
    dorsalPlates: THREE.Mesh[];
    tendrils: THREE.Group[];
    pulseRingsGroup: THREE.Group;
    getRipples: () => SpacetimeRipple[];
    update: (dt: number) => void;
}

export function createAlienBioShip(): AlienShipController {
    const group = new THREE.Group();

    // 1. Procedural Bio-Textures
    const carapaceTex = createAlienCarapaceTexture(1337);
    const wingTex = createAlienWingTexture(555);
    const veinTex = createAlienVeinTexture(777);

    // 2. Materials
    // Deep obsidian iridescent bio-chitin carapace with relief scales
    const chitinMat = new THREE.MeshStandardMaterial({
        map: carapaceTex.map,
        bumpMap: carapaceTex.bumpMap,
        bumpScale: 0.08,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 0x030814
    });

    // Segmented dorsal armor plates (Bio-metallic scales)
    const dorsalPlateMat = new THREE.MeshStandardMaterial({
        map: carapaceTex.map,
        bumpMap: carapaceTex.bumpMap,
        bumpScale: 0.12,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0x064e3b,
        emissiveIntensity: 0.3
    });

    // Sculpted Manta Wing Membrane with muscle striations
    const wingMat = new THREE.MeshStandardMaterial({
        map: wingTex,
        bumpMap: carapaceTex.bumpMap,
        bumpScale: 0.06,
        roughness: 0.38,
        metalness: 0.65,
        side: THREE.DoubleSide
    });

    // Radiant Bioluminescent Psionic Veins
    const biolumMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveMap: veinTex,
        emissiveIntensity: 1.4,
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

    // 3. Central Streamlined Fuselage (Thorax & Head)
    const bodyGeo = new THREE.ConeGeometry(1.8, 5.2, 24);
    bodyGeo.rotateZ(-Math.PI / 2); // Point forward (+X)
    bodyGeo.scale(1.0, 0.45, 0.75); // Flattened aerodynamic bio-fuselage
    const coreMesh = new THREE.Mesh(bodyGeo, chitinMat);
    coreMesh.position.x = 0.5;
    group.add(coreMesh);

    // 4. Segmented Dorsal Carapace Plates (Trilobite spinal crests)
    const plateCount = 5;
    const dorsalPlates: THREE.Mesh[] = [];
    for (let i = 0; i < plateCount; i++) {
        const pSize = 1.6 - i * 0.22;
        const plateGeo = new THREE.CylinderGeometry(pSize * 0.65, pSize, 0.55, 12);
        plateGeo.rotateZ(-Math.PI / 2);
        plateGeo.scale(0.85, 0.45, 0.95);
        const plate = new THREE.Mesh(plateGeo, dorsalPlateMat);
        plate.position.set(0.8 - i * 0.75, 0.28 - i * 0.03, 0);
        group.add(plate);
        dorsalPlates.push(plate);
    }

    // 5. Central Psionic Neural Core (Pulsing Bio-Heart)
    const nucGeo = new THREE.SphereGeometry(0.85, 24, 24);
    nucGeo.scale(1.4, 0.55, 0.75);
    const psioCoreMesh = new THREE.Mesh(nucGeo, nucleusMat);
    psioCoreMesh.position.set(0.35, 0.42, 0);
    group.add(psioCoreMesh);

    // 6. Bioluminescent Neural Spine Ridge
    const veinGeo = new THREE.BoxGeometry(2.8, 0.1, 0.14);
    const veinMesh = new THREE.Mesh(veinGeo, biolumMat);
    veinMesh.position.set(0.1, 0.46, 0);
    group.add(veinMesh);

    // 7. Front Predatory Mandibles (Grasping pincers that open/close)
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

    // 8. Broad Cosmic Manta Wings (Undulating Bio-Wings with glowing leading edges)
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

    const leftWingMesh = new THREE.Mesh(wingGeo, wingMat);
    leftWing.add(leftWingMesh);
    leftWing.position.set(0.2, 0, 0.7);

    const rightWingGeo = wingGeo.clone();
    rightWingGeo.scale(1, 1, -1);
    const rightWingMesh = new THREE.Mesh(rightWingGeo, wingMat);
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

    // 9. Rear Breathing Vent Flaps (Adaptive Biological Thruster Exhaust)
    const ventFlaps: THREE.Mesh[] = [];
    for (let v = 0; v < 3; v++) {
        const vGeo = new THREE.BoxGeometry(0.9, 0.1, 0.45);
        const vMesh = new THREE.Mesh(vGeo, dorsalPlateMat);
        vMesh.position.set(-1.8 - v * 0.35, 0.16 - v * 0.05, (v - 1) * 0.5);
        group.add(vMesh);
        ventFlaps.push(vMesh);
    }

    // 10. Twin Bio-Whip Tendrils (Swaying tail appendages)
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

    // Set prominent scale for clear, crisp visibility
    group.scale.set(1.5, 1.5, 1.5);

    // 11. World-Space Bio-Pulse Rings (Spacetime Distortion Waves)
    const pulseRingsGroup = new THREE.Group();
    if (scene) {
        scene.add(pulseRingsGroup);
    }

    interface BioPulseRing {
        group: THREE.Group;
        life: number;
        maxLife: number;
        velocity: THREE.Vector3;
        currentRadius: number;
        mats: THREE.MeshBasicMaterial[];
    }

    const activePulseRings: BioPulseRing[] = [];
    const pulseRingGeo = new THREE.RingGeometry(0.85, 1.4, 36);
    pulseRingGeo.rotateX(Math.PI / 2); // Flat on X-Z plane, directly facing top-down camera
    const pulseInnerEchoGeo = new THREE.RingGeometry(0.42, 0.72, 28);
    pulseInnerEchoGeo.rotateX(Math.PI / 2);

    let pulseEmitTimer = 0;
    let animTime = 0;

    return {
        group,
        coreMesh,
        psioCoreMesh,
        shieldGlowMesh: null as any,
        leftWing,
        rightWing,
        leftMandible,
        rightMandible,
        ventFlaps,
        dorsalPlates,
        tendrils,
        pulseRingsGroup,
        getRipples: () => {
            return activePulseRings.map(r => ({
                position: r.group.position,
                progress: r.life / r.maxLife,
                worldRadius: r.currentRadius
            }));
        },
        update: (dt: number) => {
            animTime += dt;

            // Ensure pulseRingsGroup stays attached to scene
            if (scene && pulseRingsGroup.parent !== scene) {
                scene.add(pulseRingsGroup);
            }

            const isThrusting = Boolean(STATE.isThrusting || (STATE.keys && STATE.keys.w));
            const isRetroBraking = Boolean(STATE.isRetroBraking || (STATE.keys && STATE.keys.s));
            const speedMagnitude = STATE.playerVelocity ? STATE.playerVelocity.length() : 0;

            // A. Breathing Psionic Core Pulse & Bioluminescent Intensity Flare
            const breathSpeed = isThrusting ? 5.5 : 2.5;
            const breath = Math.sin(animTime * breathSpeed);
            const coreScale = 1.0 + breath * (isThrusting ? 0.14 : 0.08);
            psioCoreMesh.scale.set(1.4 * coreScale, 0.55 * coreScale, 0.75 * coreScale);

            // Dynamic color state
            let activeColor = 0x00ff88;
            if (STATE.health < 30) {
                activeColor = 0xf43f5e; // Emergency red
            } else if (STATE.telepathyActive) {
                activeColor = 0xa855f7; // Psionic trance violet
            } else if (isThrusting) {
                activeColor = 0x38bdf8; // Cyber cyan bio-flux on full thrust
            }

            const targetEmissive = isThrusting ? 2.4 : (isRetroBraking ? 1.8 : 1.1);
            (psioCoreMesh.material as THREE.MeshPhysicalMaterial).color.setHex(activeColor);
            (psioCoreMesh.material as THREE.MeshPhysicalMaterial).emissive.setHex(activeColor);
            (psioCoreMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = THREE.MathUtils.lerp(
                (psioCoreMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity,
                targetEmissive,
                Math.min(1.0, dt * 6.0)
            );

            (biolumMat as THREE.MeshStandardMaterial).color.setHex(activeColor);
            (biolumMat as THREE.MeshStandardMaterial).emissive.setHex(activeColor);
            (biolumMat as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp(
                (biolumMat as THREE.MeshStandardMaterial).emissiveIntensity,
                targetEmissive,
                Math.min(1.0, dt * 6.0)
            );

            // B. Undulating Wing Motion (Progressive traveling wave from shoulder to wingtips)
            const wingFreq = isThrusting ? (5.8 + Math.min(speedMagnitude * 0.22, 4.0)) : (2.4 + Math.min(speedMagnitude * 0.1, 1.8));
            const wingAmp = isThrusting ? 0.42 : (isRetroBraking ? 0.12 : 0.22);
            const wingWave = Math.sin(animTime * wingFreq) * wingAmp;
            const wingTipWave = Math.cos(animTime * wingFreq - 0.45) * (isThrusting ? 0.18 : 0.08);

            leftWing.rotation.x = wingWave;
            leftWing.rotation.z = wingTipWave;

            rightWing.rotation.x = -wingWave;
            rightWing.rotation.z = -wingTipWave;

            // Wing pitch angle: Cups backwards during retro-braking, angles sleek during forward thrust
            const targetWingPitch = isRetroBraking ? -0.35 : (isThrusting ? 0.10 : 0.0);
            leftWing.rotation.y = THREE.MathUtils.lerp(leftWing.rotation.y, targetWingPitch, Math.min(1.0, dt * 8.0));
            rightWing.rotation.y = THREE.MathUtils.lerp(rightWing.rotation.y, -targetWingPitch, Math.min(1.0, dt * 8.0));

            // C. Dorsal Carapace Plates & Spine Wave (Wellenförmige Bio-Rückenbewegung)
            const spineWaveFreq = wingFreq * 0.75;
            coreMesh.position.y = Math.sin(animTime * spineWaveFreq) * 0.06;

            dorsalPlates.forEach((plate, idx) => {
                const waveDelay = idx * 0.38;
                const spinalWave = Math.sin(animTime * spineWaveFreq - waveDelay) * 0.04;
                const targetRotZ = isRetroBraking ? (-Math.PI / 2 - 0.38 * (idx + 1) * 0.18) : (-Math.PI / 2 + spinalWave * 0.6);
                const targetPosY = isRetroBraking ? (0.42 - idx * 0.02) : (0.28 - idx * 0.03 + spinalWave);
                plate.rotation.z = THREE.MathUtils.lerp(plate.rotation.z, targetRotZ, Math.min(1.0, dt * 9.0));
                plate.position.y = THREE.MathUtils.lerp(plate.position.y, targetPosY, Math.min(1.0, dt * 9.0));
            });

            // D. Front Mandibles Swaying / Grasping
            const isAbducting = STATE.abductActive || STATE.extractingPlanet !== null;
            const mandAngle = isAbducting ? 0.45 + Math.sin(animTime * 8.0) * 0.15 : 0.08 + Math.sin(animTime * 1.5) * 0.05;
            leftMandible.rotation.y = mandAngle;
            rightMandible.rotation.y = -mandAngle;

            // E. Breathing Rear Vents (Flares wide on thrust)
            const targetVentAngle = isThrusting ? 0.65 : (isRetroBraking ? -0.25 : 0.08 + Math.sin(animTime * 2.0) * 0.04);
            ventFlaps.forEach((f, idx) => {
                f.rotation.z = THREE.MathUtils.lerp(f.rotation.z, targetVentAngle * (idx === 1 ? 1.3 : 0.9), Math.min(1.0, dt * 8.0));
            });

            // F. Twin Tail Tendril Physics Simulation (Streams back tightly on thrust with traveling wave)
            tendrils.forEach((tGroup, tIdx) => {
                let currentJoint: any = tGroup;
                let depth = 0;
                while (currentJoint && currentJoint.children && currentJoint.children.length > 0) {
                    const next = currentJoint.children[0];
                    if (next) {
                        const phase = animTime * (isThrusting ? 7.0 : 3.8) + depth * 0.65 + tIdx * Math.PI;
                        const tendrilAmp = isThrusting ? 0.10 : 0.18;
                        next.rotation.z = Math.sin(phase) * tendrilAmp;
                        next.rotation.y = Math.cos(phase * 0.8) * (tendrilAmp * 0.7);
                        currentJoint = next;
                        depth++;
                    } else {
                        break;
                    }
                }
            });

            // G. Spacetime Bio-Pulse Rings Emission (Wellenförmige Raumzeit-Ringe)
            if (isThrusting) {
                pulseEmitTimer += dt;
                const emitInterval = Math.max(0.12, 0.20 - Math.min(speedMagnitude * 0.005, 0.07));
                if (pulseEmitTimer >= emitInterval) {
                    pulseEmitTimer = 0;
                    const forwardX = Math.cos(STATE.shipHeading);
                    const forwardZ = -Math.sin(STATE.shipHeading);
                    const shipScale = STATE.playerGroup ? STATE.playerGroup.scale.x : 0.42;

                    const ringGroup = new THREE.Group();
                    const ringMat1 = new THREE.MeshBasicMaterial({
                        color: activeColor,
                        transparent: true,
                        opacity: 0.55,
                        side: THREE.DoubleSide,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });
                    const ringMat2 = new THREE.MeshBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity: 0.35,
                        side: THREE.DoubleSide,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    const mesh1 = new THREE.Mesh(pulseRingGeo, ringMat1);
                    const mesh2 = new THREE.Mesh(pulseInnerEchoGeo, ringMat2);
                    ringGroup.add(mesh1);
                    ringGroup.add(mesh2);

                    // Spawn at rear vents
                    ringGroup.position.set(
                        STATE.playerPosition.x - forwardX * (3.0 * shipScale),
                        0.15,
                        STATE.playerPosition.z - forwardZ * (3.0 * shipScale)
                    );
                    ringGroup.scale.set(0.65, 0.65, 0.65);

                    // Counter-drift velocity with gentle wave dispersion
                    const driftVel = new THREE.Vector3(-forwardX * 3.4, 0, -forwardZ * 3.4);
                    if (STATE.playerVelocity) {
                        driftVel.addScaledVector(STATE.playerVelocity, 0.15);
                    }

                    pulseRingsGroup.add(ringGroup);
                    activePulseRings.push({
                        group: ringGroup,
                        life: 0,
                        maxLife: 0.68,
                        velocity: driftVel,
                        currentRadius: 1.2,
                        mats: [ringMat1, ringMat2]
                    });
                }
            }

            // Update & expand active bio-pulse rings with wave ripple undulation
            for (let i = activePulseRings.length - 1; i >= 0; i--) {
                const ring = activePulseRings[i];
                ring.life += dt;
                const progress = ring.life / ring.maxLife;
                if (progress >= 1.0) {
                    pulseRingsGroup.remove(ring.group);
                    ring.mats.forEach(m => m.dispose());
                    activePulseRings.splice(i, 1);
                } else {
                    // Wave ripple in scale (like ripples spreading across a pond)
                    const waveRipple = Math.sin(progress * Math.PI * 3.0) * 0.25;
                    const expandScale = THREE.MathUtils.lerp(0.65, 4.8, Math.pow(progress, 0.58)) + waveRipple;
                    ring.currentRadius = expandScale * 1.5;
                    ring.group.scale.set(expandScale, expandScale, expandScale);
                    ring.group.position.addScaledVector(ring.velocity, dt);
                    const alpha = Math.pow(1.0 - progress, 0.85) * (0.50 + Math.sin(progress * Math.PI * 4.0) * 0.08);
                    ring.mats[0].opacity = alpha;
                    ring.mats[1].opacity = alpha * 0.55;
                }
            }
        }
    };
}

import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { createGravityRing } from '../procedural/meshes';
import { createPlanetTextures, createGasGiantTextures, createIceMoonTextures, createVolcanicMoonTextures, createCraterMoonTextures, createStarTexture } from '../procedural/textures';
import { generatePlanetAttributes, generateFallbackMoons } from './scanner';
import { addLogEntry } from '../ui/hud';

export async function checkUniverseData() {
    try {
        let data: any = null;

        // 1. If running in Electron, load directly from filesystem via IPC (instant & 100% reliable)
        if (typeof (window as any).api !== 'undefined' && (window as any).api.loadUniverseData) {
            try {
                const res = await (window as any).api.loadUniverseData();
                if (res && res.success && res.data) {
                    data = res.data;
                }
            } catch (err) {
                console.warn("Najmafar: IPC universe load failed, falling back to fetch", err);
            }
        }

        // 2. Browser / Fallback fetch
        if (!data) {
            try {
                const res = await fetch('./universe_data.json');
                if (res.ok) {
                    data = await res.json();
                } else {
                    const resAlt = await fetch('universe_data.json');
                    if (resAlt.ok) {
                        data = await resAlt.json();
                    }
                }
            } catch (fetchErr) {
                console.warn("Najmafar: Fetch universe load failed", fetchErr);
            }
        }

        if (data && data.systems && data.systems.length > 0) {
            STATE.universe = data;
            const sysCount = data.systems.length;
            const univName = data.name || "Najmafar Quanten-Galaxie";
            console.log("Najmafar: Quantum Universe Data loaded successfully!", univName, sysCount);

            const statusDiv = document.getElementById('generation-status');
            if (statusDiv) {
                statusDiv.innerText = `🌌 Quanten-Universum aktiv: ${sysCount} Systeme geladen.`;
                statusDiv.style.color = "#10b981";
            }

            clearActiveSystem();
            spawnPlanetsAndAsteroids();
        } else {
            console.warn("Najmafar: No systems found in universe_data.json");
        }
    } catch (e) {
        console.warn("Najmafar: Failed to load universe_data.json, fallback generation active.", e);
    }
}

export function clearActiveSystem() {
    STATE.gravitySources.forEach(source => {
        if (source.mesh) {
            scene.remove(source.mesh);
        }
        if (source.ringMesh) {
            scene.remove(source.ringMesh);
        }
    });
    STATE.gravitySources = [];
    STATE.asteroids = [];
    activePlanets.length = 0;
}

export function spawnPlanetsAndAsteroids() {
    if (!STATE.universe || !STATE.universe.systems) {
        // Fallback procedural system
        const count = 4;
        const colors = [0x38bdf8, 0xa855f7, 0x10b981, 0xf59e0b];

        for (let i = 0; i < count; i++) {
            const dist = 50 + i * 35;
            const angle = (i * Math.PI) / 2 + 0.5;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const size = 3.0 + i * 0.8;
            const color = colors[i % colors.length];

            const geo = new THREE.SphereGeometry(size, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.7,
                metalness: 0.1
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0, z);
            scene.add(mesh);

            const range = size * 4.5;
            const sourceObj: any = {
                mesh: mesh,
                type: 'planet',
                name: `Prozeduraler Planet ${i + 1}`,
                mass: size * size * 4,
                radius: size,
                gravityRange: range,
                position: new THREE.Vector3(x, 0, z)
            };

            STATE.gravitySources.push(sourceObj);
            sourceObj.ringMesh = createGravityRing(x, z, range, color, 0.08);
        }
        return;
    }

    const activeSystem = STATE.universe.systems[STATE.currentSystemId];
    if (!activeSystem) return;

    // 1. Central Star
    const starData = activeSystem.star;
    if (starData.type !== "Black Hole") {
        const starSeed = STATE.currentSystemId * 1337 + 42;
        const starTex = createStarTexture(starData.color, starSeed);

        const starGeo = new THREE.SphereGeometry(starData.size, 32, 32);
        const starMat = new THREE.MeshStandardMaterial({
            map: starTex.map,
            emissive: parseInt(starData.color),
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.1
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(0, 0, 0);
        scene.add(starMesh);

        const starLight = new THREE.PointLight(parseInt(starData.color), 3, 300, 0.4);
        starLight.position.set(0, 0, 0);
        scene.add(starLight);

        starData.colorCss = starData.color.replace("0x", "#");

        const starRange = starData.size * 6;
        const starSource: any = {
            mesh: starMesh,
            type: 'star',
            name: `${activeSystem.name} (Zentralstern)`,
            mass: starData.mass * 8,
            radius: starData.size,
            gravityRange: starRange,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        starSource.ringMesh = createGravityRing(0, 0, starRange, parseInt(starData.color), 0.05);
    }

    // 2. Planets & Moons
    activeSystem.planets.forEach((p, idx) => {
        const angle = (idx * 1.8) + (STATE.currentSystemId * 0.5);
        const px = p.distance * Math.cos(angle);
        const pz = p.distance * Math.sin(angle);

        const seed = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx * 77;
        const isGas = p.type === 'Gas Giant';
        const isHab = p.type === 'Habitable';

        let texData: any;
        if (isGas) {
            texData = createGasGiantTextures(p.color, seed);
        } else {
            texData = createPlanetTextures(p.color, seed);
        }

        const geo = new THREE.SphereGeometry(p.size, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            map: texData.map,
            roughness: isGas ? 0.3 : 0.8,
            metalness: isGas ? 0.1 : 0.2,
            bumpScale: 0.05
        });

        const mesh = new THREE.Mesh(geo, mat);
        const planetGroup = new THREE.Group();
        planetGroup.position.set(px, 0, pz);
        planetGroup.add(mesh);

        let cloudMesh: THREE.Mesh | null = null;
        if (texData.cloudMap && !isGas) {
            const cloudGeo = new THREE.SphereGeometry(p.size * 1.025, 32, 32);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: texData.cloudMap,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending
            });
            cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            planetGroup.add(cloudMesh);
        }

        let psioAuraMesh: THREE.Mesh | null = null;
        if (isHab) {
            const auraGeo = new THREE.RingGeometry(p.size * 1.4, p.size * 1.6, 32);
            auraGeo.rotateX(Math.PI / 2);
            const auraMat = new THREE.MeshBasicMaterial({
                color: 0xd946ef,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            psioAuraMesh = new THREE.Mesh(auraGeo, auraMat);
            planetGroup.add(psioAuraMesh);
        }

        scene.add(planetGroup);

        const pMass = p.size * p.size * 4;
        const pRange = p.size * 4.5;

        const sourceObj: any = {
            mesh: planetGroup,
            type: 'planet',
            name: p.name,
            mass: pMass,
            radius: p.size,
            gravityRange: pRange,
            position: new THREE.Vector3(px, 0, pz)
        };
        STATE.gravitySources.push(sourceObj);

        const ring = createGravityRing(px, pz, pRange, parseInt(p.color), 0.08);

        const orbitSpeed = 0.045 / Math.sqrt(p.distance);
        const pColorCss = p.color.replace("0x", "#");
        const generated = generatePlanetAttributes(p);

        let finalSpecies = p.species || generated.species;
        if (p.type === 'Habitable') {
            if (!finalSpecies || !finalSpecies.candidates || finalSpecies.candidates.length === 0) {
                finalSpecies = generated.species;
            }
        }

        const planetEntry: any = {
            mesh: planetGroup,
            bodyMesh: mesh,
            cloudMesh: cloudMesh,
            psioAuraMesh: psioAuraMesh,
            source: sourceObj,
            ringMesh: ring,
            angle: angle,
            speed: orbitSpeed,
            distance: p.distance,
            name: p.name,
            type: p.type,
            size: p.size,
            color: p.color,
            colorCss: pColorCss,
            isMoon: false,
            scanned: false,
            attributes: {
                atmos: p.atmos || generated.atmos,
                temp: p.temp || generated.temp,
                bio: p.bio || generated.bio,
                res: p.res || generated.res,
                species: finalSpecies
            }
        };
        activePlanets.push(planetEntry);

        // Spawn Moons
        const moonsList = p.moons || generateFallbackMoons(p);
        moonsList.forEach((m, m_idx) => {
            const moonAngle = (m_idx * 2.2) + (idx * 0.7) + 0.5;
            const mx = px + m.distance * Math.cos(moonAngle);
            const mz = pz + m.distance * Math.sin(moonAngle);

            const mSeed = m.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + m_idx * 133;
            let mTex: any;
            if (m.type === 'Eismond') {
                mTex = createIceMoonTextures(m.color, mSeed);
            } else if (m.type === 'Vulkanmond') {
                mTex = createVolcanicMoonTextures(m.color, mSeed);
            } else {
                mTex = createCraterMoonTextures(m.color, mSeed);
            }

            const mGeo = new THREE.SphereGeometry(m.size, 16, 16);
            const mMat = new THREE.MeshStandardMaterial({
                map: mTex.map,
                roughness: 0.9,
                metalness: 0.1
            });
            const mMesh = new THREE.Mesh(mGeo, mMat);
            const moonGroup = new THREE.Group();
            moonGroup.position.set(mx, 0, mz);
            moonGroup.add(mMesh);
            scene.add(moonGroup);

            const mMass = m.size * m.size * 2;
            const mRange = m.size * 3.5;
            const mSource: any = {
                mesh: moonGroup,
                type: 'planet',
                name: m.name,
                mass: mMass,
                radius: m.size,
                gravityRange: mRange,
                position: new THREE.Vector3(mx, 0, mz)
            };
            STATE.gravitySources.push(mSource);

            const mRing = createGravityRing(px, pz, m.distance, parseInt(m.color), 0.04);
            const moonOrbitSpeed = 0.12 + 0.06 / Math.sqrt(m.distance);

            const moonEntry: any = {
                mesh: moonGroup,
                bodyMesh: mMesh,
                source: mSource,
                ringMesh: mRing,
                angle: moonAngle,
                speed: moonOrbitSpeed,
                distance: m.distance,
                name: m.name,
                type: m.type,
                size: m.size,
                color: m.color,
                colorCss: m.color.replace("0x", "#"),
                isMoon: true,
                parentPlanet: planetEntry,
                scanned: false,
                attributes: {
                    atmos: m.atmos,
                    temp: m.temp,
                    bio: m.bio,
                    res: m.res,
                    species: null
                }
            };
            activePlanets.push(moonEntry);
        });
    });

    // 3. Spawn Asteroids
    const asteroidCount = 18;
    for (let i = 0; i < asteroidCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 120;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const size = 0.8 + Math.random() * 1.2;

        const isOrganicResource = (i % 2 === 0);
        const color = isOrganicResource ? 0x00ff88 : 0x38bdf8;

        const geo = new THREE.DodecahedronGeometry(size, 1);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.8,
            emissive: isOrganicResource ? 0x003311 : 0x002233
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0, z);
        scene.add(mesh);

        const range = size * 3;
        const sourceObj: any = {
            mesh: mesh,
            type: 'asteroid',
            name: isOrganicResource ? "Organische Biosphäre" : "Silizium-Komet",
            mass: size * 4,
            radius: size,
            gravityRange: range,
            position: new THREE.Vector3(x, 0, z),
            isResource: true,
            resourceType: isOrganicResource ? 'bio' : 'energy',
            isAbsorbed: false,
            ringMesh: null
        };

        STATE.gravitySources.push(sourceObj);
        STATE.asteroids.push(sourceObj);
        sourceObj.ringMesh = createGravityRing(x, z, range, color, 0.05);
    }
}

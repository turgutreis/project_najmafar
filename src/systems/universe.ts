import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { PlanetEntry, StarSystem } from '../types/game';
import { createGravityRing } from '../procedural/meshes';
import { createHabitableTextures, createGasGiantTextures, createRockyTextures, createIceMoonTextures, createVolcanicMoonTextures, createStarTexture, createCloudTexture, createCityLightsTexture } from '../procedural/textures';
import { generatePlanetAttributes, generateFallbackMoons, updateScannerUI } from './scanner';
import { initPlanetDefenseFleets, clearFleet } from './fleet';
import { addLogEntry } from '../ui/hud';
import { createSunCoronaMesh } from '../procedural/sun-shader';
import { createAtmosphereMesh } from '../procedural/atmosphere-shader';
import { createSunRays, SunRaysController } from '../procedural/sun-rays';

export const activeCoronaMeshes: THREE.Mesh[] = [];
export const activeCoronaUpdaters: ((dt: number) => void)[] = [];
export const activeStarLights: THREE.PointLight[] = [];
export let activeSunRays: SunRaysController | null = null;

export function updateUniverseShaders(dt: number, cam?: THREE.Camera) {
    activeCoronaUpdaters.forEach(fn => fn(dt));
    if (activeSunRays && cam) {
        activeSunRays.update(dt, cam);
    }
}

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
            const resp = await fetch('universe_data.json');
            if (resp.ok) {
                data = await resp.json();
            }
        }

        if (data && data.systems && data.systems.length > 0) {
            STATE.universe = data;
            const sysCount = data.systems.length;
            const meta = data.meta;

            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.removeAttribute('disabled');
                startBtn.style.opacity = '1';
                startBtn.innerText = "Najmafar betreten";
            }

            const status = document.getElementById('generation-status');
            const mapBadge = document.getElementById('galaxy-provenance-badge');

            if (meta) {
                const isQpu = meta.generatorMode === 'IBM_QPU';
                const label = isQpu
                    ? `🌌 IBM Quantum QPU (${meta.backendName})`
                    : `🔬 Qiskit Simulator (${meta.backendName || 'basic_simulator'})`;

                if (status) {
                    status.innerText = `Galaxie aktiv (${sysCount} Systeme) — ${label}`;
                    status.style.color = isQpu ? '#34d399' : '#38bdf8';
                }

                if (mapBadge) {
                    mapBadge.innerText = `${label} • ${sysCount} Systeme`;
                    mapBadge.style.color = isQpu ? '#34d399' : '#38bdf8';
                    mapBadge.style.borderColor = isQpu ? 'rgba(52, 211, 153, 0.4)' : 'rgba(56, 189, 248, 0.3)';
                    mapBadge.style.background = isQpu ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)';
                }
            } else {
                if (status) {
                    status.innerText = `Galaxie aktiv (${sysCount} Sternensysteme).`;
                    status.style.color = '#10b981';
                }
            }

            // Spawn initial system
            clearActiveSystem();
            spawnPlanetsAndAsteroids();
        } else {
            console.warn("Najmafar: universe_data.json contains no systems");
        }
    } catch (e) {
        console.error("Najmafar: Error loading universe data:", e);
    }
}

export function clearActiveSystem() {
    activePlanets.forEach(p => {
        if (p.mesh) scene.remove(p.mesh);
        if (p.ringMesh) scene.remove(p.ringMesh);
    });
    STATE.asteroids.forEach(a => {
        if (a.mesh) scene.remove(a.mesh);
        if (a.ringMesh) scene.remove(a.ringMesh);
    });
    STATE.gravitySources.forEach(source => {
        if (source.mesh && source.mesh !== STATE.playerGroup) {
            scene.remove(source.mesh);
        }
        if (source.ringMesh) {
            scene.remove(source.ringMesh);
        }
    });

    activeCoronaMeshes.forEach(m => scene.remove(m));
    activeCoronaMeshes.length = 0;
    activeCoronaUpdaters.length = 0;

    activeStarLights.forEach(l => scene.remove(l));
    activeStarLights.length = 0;

    if (activeSunRays) {
        scene.remove(activeSunRays.group);
        activeSunRays.dispose();
        activeSunRays = null;
    }

    STATE.gravitySources = [];
    STATE.asteroids = [];
    activePlanets.length = 0;

    // Reset Target Locks, Scanners and 3D Reticle
    STATE.lockedTarget = null;
    STATE.nearestPlanet = null;
    STATE.scanningPlanet = null;
    STATE.extractingPlanet = null;
    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.scanProgress = 0;
    STATE.harvestProgress = 0;
    STATE.abductProgress = 0;

    clearFleet();

    const badge = document.getElementById('target-lock-badge');
    const label = document.getElementById('target-label-text');
    if (badge) badge.style.display = 'none';
    if (label) label.innerText = 'Nächster Planet:';

    updateScannerUI(null, Infinity);
}

export function spawnPlanetsAndAsteroids() {
    if (!STATE.universe || !STATE.universe.systems) {
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
            emissiveIntensity: 0.9,
            roughness: 0.2,
            metalness: 0.1
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(0, 0, 0);
        scene.add(starMesh);

        // Animated Procedural Solar Corona Plasma Layer
        const corona = createSunCoronaMesh(starData.size, parseInt(starData.color));
        scene.add(corona.mesh);
        activeCoronaMeshes.push(corona.mesh);
        activeCoronaUpdaters.push(corona.update);

        // Volumetric Solar God-Rays, Anamorphic Lens Flare, & Diffraction Spikes
        activeSunRays = createSunRays(starData.size, parseInt(starData.color));
        scene.add(activeSunRays.group);

        // Radiant Stellar Light Source (Illuminates all planets directly from star center)
        const starLight = new THREE.PointLight(parseInt(starData.color), 3.2, 0, 0.0);
        starLight.position.set(0, 0, 0);
        scene.add(starLight);
        activeStarLights.push(starLight);

        starData.colorCss = starData.color.replace("0x", "#");

        const starRange = 24.0;
        const starSource: any = {
            mesh: starMesh,
            type: 'star',
            name: `${activeSystem.name} (Zentralstern)`,
            mass: starData.mass * 0.35,
            radius: starData.size,
            gravityRange: starRange,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        starSource.ringMesh = createGravityRing(0, 0, starRange, parseInt(starData.color), 0.06);
    }

    // 2. Planets & Moons (Astronomical 5-Zone Distance Scaling: Innermost >= 38)
    activeSystem.planets.forEach((p, idx) => {
        const scaledDist = 38.0 + (p.distance * 1.55) + (idx * 12.0);
        const angle = (idx * 1.8) + (STATE.currentSystemId * 0.5);
        const px = scaledDist * Math.cos(angle);
        const pz = scaledDist * Math.sin(angle);

        const seed = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx * 77;
        const isGas = p.type === 'Gas Giant';
        const isHab = p.type === 'Habitable';
        const generated = generatePlanetAttributes(p);
        let finalSpecies = p.species || generated.species;
        if (p.type === 'Habitable' && (!finalSpecies || !finalSpecies.candidates || finalSpecies.candidates.length === 0)) {
            finalSpecies = generated.species;
        }

        let texData: any;
        let cloudTexture: THREE.CanvasTexture | null = null;
        let cityLightsTexture: THREE.CanvasTexture | null = null;

        if (isHab) {
            texData = createHabitableTextures(p.color, seed);
            cloudTexture = createCloudTexture(seed + 999);
            if (finalSpecies && finalSpecies.population > 0) {
                cityLightsTexture = createCityLightsTexture(seed, finalSpecies.techLevel || 'Spacefaring');
            }
        } else if (isGas) {
            texData = createGasGiantTextures(p.color, seed);
        } else {
            texData = createRockyTextures(p.color, seed);
        }

        const geo = new THREE.SphereGeometry(p.size, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            map: texData.map,
            bumpMap: texData.bumpMap || null,
            bumpScale: isGas ? 0 : 0.08,
            roughness: isGas ? 0.35 : 0.68,
            metalness: isGas ? 0.1 : 0.12,
            emissive: cityLightsTexture ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
            emissiveMap: cityLightsTexture || null,
            emissiveIntensity: cityLightsTexture ? 0.85 : 0.0,
            transparent: false,
            depthWrite: true,
            depthTest: true
        });

        const mesh = new THREE.Mesh(geo, mat);

        // Realistic Astronomical Axial Tilt (e.g. 12° to 28° like Earth/Mars)
        const axialTilt = (((seed % 17) + 12) * Math.PI) / 180;
        mesh.rotation.z = axialTilt;
        mesh.rotation.x = (((seed % 7) - 3) * Math.PI) / 180;

        const planetGroup = new THREE.Group();
        planetGroup.position.set(px, 0, pz);
        planetGroup.add(mesh);

        // Rayleigh Atmospheric Scattering Halo
        if (isHab || isGas) {
            const atmoHex = isHab ? 0x38bdf8 : parseInt(p.color);
            const atmoMesh = createAtmosphereMesh(p.size, atmoHex, isHab ? 1.2 : 1.0);
            planetGroup.add(atmoMesh);
        }

        let cloudMesh: THREE.Mesh | null = null;
        if (cloudTexture && isHab) {
            const cloudGeo = new THREE.SphereGeometry(p.size * 1.018, 32, 32);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.85,
                blending: THREE.NormalBlending,
                depthWrite: false,
                roughness: 0.9,
                metalness: 0.0
            });
            cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            cloudMesh.rotation.z = axialTilt;
            planetGroup.add(cloudMesh);
        }

        let psioAuraMesh: THREE.Mesh | null = null;

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

        const orbitSpeed = 0.055 / Math.sqrt(scaledDist);
        const pColorCss = p.color.replace("0x", "#");

        const planetEntry: any = {
            mesh: planetGroup,
            bodyMesh: mesh,
            cloudMesh: cloudMesh,
            psioAuraMesh: psioAuraMesh,
            source: sourceObj,
            ringMesh: ring,
            angle: angle,
            speed: orbitSpeed,
            distance: scaledDist,
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
        moonsList.forEach((m: any, m_idx: number) => {
            const moonAngle = (m_idx * 2.2) + (idx * 0.7) + 0.5;
            const mx = px + m.distance * Math.cos(moonAngle);
            const mz = pz + m.distance * Math.sin(moonAngle);

            const mSeed = m.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + m_idx * 133;
            let mTex: any;
            if (m.type === 'Eismond') {
                mTex = createIceMoonTextures(m.color, mSeed);
            } else if (m.type === 'Vulkanmond') {
                mTex = createVolcanicMoonTextures(m.color, mSeed);
            } else {
                mTex = createRockyTextures(m.color, mSeed);
            }

            const mGeo = new THREE.SphereGeometry(m.size, 24, 24);
            const mMat = new THREE.MeshStandardMaterial({
                map: mTex.map,
                bumpMap: mTex.bumpMap || null,
                bumpScale: 0.05,
                emissiveMap: mTex.emissiveMap || null,
                emissive: m.type === 'Vulkanmond' ? new THREE.Color(0xff4500) : new THREE.Color(0x000000),
                emissiveIntensity: m.type === 'Vulkanmond' ? 0.6 : 0,
                roughness: 0.85,
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

    // 3. Spawn Asteroids (Realistic cosmic debris & fragment scaling)
    const asteroidsList = (activeSystem.asteroids && activeSystem.asteroids.length > 0) ? activeSystem.asteroids : generateFallbackAsteroids();
    asteroidsList.forEach((ast: any) => {
        const size = 0.4 + Math.random() * 0.45;
        const geo = new THREE.DodecahedronGeometry(size, 1);

        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
            const vx = posAttr.getX(j);
            const vy = posAttr.getY(j);
            const vz = posAttr.getZ(j);
            const scale = 1 + (Math.random() - 0.5) * 0.3;
            posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
        }
        geo.computeVertexNormals();

        const isOrganic = ast.type === 'bio';
        const color = isOrganic ? 0x00ff88 : 0x06b6d4;

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.8,
            emissive: isOrganic ? 0x003311 : 0x002233
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ast.x, 0, ast.z);
        scene.add(mesh);

        const range = size * 3;
        const sourceObj: any = {
            mesh: mesh,
            type: 'asteroid',
            name: isOrganic ? "Organische Biosphäre" : "Silizium-Komet",
            mass: size * 4,
            radius: size,
            gravityRange: range,
            position: new THREE.Vector3(ast.x, 0, ast.z),
            isResource: true,
            resourceType: isOrganic ? 'bio' : 'silicon',
            isAbsorbed: false,
            rotSpeed: {
                x: (Math.random() - 0.5) * 0.6,
                y: (Math.random() - 0.5) * 0.8,
                z: (Math.random() - 0.5) * 0.6
            },
            ringMesh: null
        };

        STATE.gravitySources.push(sourceObj);
        STATE.asteroids.push(sourceObj);
        sourceObj.ringMesh = createGravityRing(ast.x, ast.z, range, color, 0.05);
    });

    // 4. Initialize Spacefaring Planetary Defense Fleets (Phase B)
    initPlanetDefenseFleets();
}

function generateFallbackAsteroids() {
    const list = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Split between inner temperate belt (48 - 75) and outer Kuiper belt (115 - 230)
        const isOuter = i % 2 === 0;
        const dist = isOuter ? (115 + Math.random() * 115) : (48 + Math.random() * 27);
        list.push({
            x: Math.cos(angle) * dist,
            z: Math.sin(angle) * dist,
            type: Math.random() > 0.45 ? 'bio' : 'energy'
        });
    }
    return list;
}

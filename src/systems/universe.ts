import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { PlanetEntry, StarSystem } from '../types/game';
import { createGravityRing, createBlackHoleMesh, createPrecursorConstructMesh, createPlasmaVortexMesh } from '../procedural/meshes';
import { createHabitableTextures, createGasGiantTextures, createRockyTextures, createIceMoonTextures, createVolcanicMoonTextures, createStarTexture, createCloudTexture, createCityLightsTexture } from '../procedural/textures';
import { generatePlanetAttributes, generateFallbackMoons, updateScannerUI } from './scanner';
import { initPlanetDefenseFleets, clearFleet } from './fleet';
import { addLogEntry } from '../ui/hud';
import { createSunCoronaMesh } from '../procedural/sun-shader';
import { createAtmosphereMesh } from '../procedural/atmosphere-shader';
import { createPlanetaryRings } from '../procedural/planet-rings';
import { createSunRays, SunRaysController } from '../procedural/sun-rays';

export const activeCoronaMeshes: THREE.Object3D[] = [];
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

        // 1. If running in Electron, load directly from filesystem via IPC
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

function disposeObject3D(obj: THREE.Object3D | null | undefined) {
    if (!obj) return;
    obj.traverse((child: any) => {
        if (child.geometry && typeof child.geometry.dispose === 'function') {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m && typeof m.dispose === 'function' && m.dispose());
            } else if (typeof child.material.dispose === 'function') {
                child.material.dispose();
            }
        }
    });
}

export function clearActiveSystem() {
    activePlanets.forEach(p => {
        if (p.mesh) {
            scene.remove(p.mesh);
            disposeObject3D(p.mesh);
        }
        if (p.ringMesh) {
            scene.remove(p.ringMesh);
            disposeObject3D(p.ringMesh);
        }
    });

    STATE.gravitySources.forEach(s => {
        if (s.ringMesh) {
            scene.remove(s.ringMesh);
            disposeObject3D(s.ringMesh);
        }
        if (s.mesh) {
            scene.remove(s.mesh);
            disposeObject3D(s.mesh);
        }
    });

    STATE.asteroids.forEach(a => {
        if (a.mesh) {
            scene.remove(a.mesh);
            disposeObject3D(a.mesh);
        }
    });

    activeCoronaMeshes.forEach(m => {
        scene.remove(m);
        disposeObject3D(m);
    });
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

    // Reset Target Locks, Scanners and Reticles
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

    // 1. Central Star or Supermassive Black Hole
    const starData = activeSystem.star;
    if (starData.type === "Black Hole") {
        const blackHole = createBlackHoleMesh(starData.size);
        scene.add(blackHole.group);
        activeCoronaMeshes.push(blackHole.group);
        activeCoronaUpdaters.push(blackHole.update);

        const starLight = new THREE.PointLight(0xa855f7, 2.5, 0, 0.0);
        starLight.position.set(0, 0, 0);
        scene.add(starLight);
        activeStarLights.push(starLight);

        starData.colorCss = "#7c3aed";

        const starRange = 42.0;
        const starSource: any = {
            mesh: blackHole.group,
            type: 'star',
            name: `${activeSystem.name} (Ereignishorizont)`,
            mass: starData.mass * 0.5,
            radius: starData.size,
            gravityRange: starRange,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        starSource.ringMesh = createGravityRing(0, 0, starRange, 0x7c3aed, 0.14);
    } else {
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

        // Radiant Stellar Light Source
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

    // 2. Celestial Bodies (Planets, Constructs, Vortices, Captured Stars)
    activeSystem.planets.forEach((p, idx) => {
        const scaledDist = 65.0 + (p.distance * 2.8) + (idx * 24.0);
        const angle = (idx * 1.8) + (STATE.currentSystemId * 0.5);
        const px = scaledDist * Math.cos(angle);
        const pz = scaledDist * Math.sin(angle);

        const seed = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx * 77;
        const planetGroup = new THREE.Group();
        planetGroup.position.set(px, 0, pz);

        let bodyMesh: THREE.Object3D | null = null;
        let cloudMesh: THREE.Mesh | null = null;
        let psioAuraMesh: THREE.Mesh | null = null;
        let generated: any = null;
        let finalSpecies: any = null;

        const isConstruct = p.type === 'Vorläufer-Konstrukt';
        const isPlasmaVortex = p.type === 'Plasma-Wirbel';
        const isCapturedStar = p.type === 'Gefangener Stern';
        const isHab = p.type === 'Habitable';
        const isGas = p.type === 'Gas Giant';

        if (isConstruct) {
            const construct = createPrecursorConstructMesh(p.size);
            planetGroup.add(construct.group);
            activeCoronaUpdaters.push(construct.update);
            bodyMesh = construct.group;
        } else if (isPlasmaVortex) {
            const vortex = createPlasmaVortexMesh(p.size, parseInt(p.color));
            planetGroup.add(vortex.group);
            activeCoronaUpdaters.push(vortex.update);
            bodyMesh = vortex.group;
        } else if (isCapturedStar) {
            const starGeo = new THREE.SphereGeometry(p.size, 32, 32);
            const starMat = new THREE.MeshStandardMaterial({
                color: parseInt(p.color),
                emissive: parseInt(p.color),
                emissiveIntensity: 1.2,
                roughness: 0.2
            });
            const starMesh = new THREE.Mesh(starGeo, starMat);
            planetGroup.add(starMesh);
            bodyMesh = starMesh;

            const capturedLight = new THREE.PointLight(parseInt(p.color), 1.8, 45, 1.2);
            planetGroup.add(capturedLight);
        } else {
            generated = generatePlanetAttributes(p);
            finalSpecies = p.species || generated.species;
            if (isHab && (!finalSpecies || !finalSpecies.candidates || finalSpecies.candidates.length === 0)) {
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
            const axialTilt = (((seed % 17) + 12) * Math.PI) / 180;
            mesh.rotation.z = axialTilt;
            mesh.rotation.x = (((seed % 7) - 3) * Math.PI) / 180;
            planetGroup.add(mesh);
            bodyMesh = mesh;

            if (isHab || isGas) {
                const atmoHex = isHab ? 0x38bdf8 : parseInt(p.color);
                const atmoMesh = createAtmosphereMesh(p.size, atmoHex, isHab ? 1.2 : 1.0);
                planetGroup.add(atmoMesh);
            }

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

            // Procedural Planetary Rings (Saturn-like dust and ice particle rings)
            const hasRings = isGas || (seed % 6 === 0);
            if (hasRings) {
                const ringColor = isGas ? parseInt(p.color) : 0xc0c6d0;
                const pRings = createPlanetaryRings(p.size, ringColor, seed);
                planetGroup.add(pRings);
            }
        }

        scene.add(planetGroup);

        const pMass = p.size * 4.0 * (isGas ? 1.4 : 1.0);
        const pRange = Math.max(18.0, p.size * 4.5);

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
            bodyMesh: bodyMesh,
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
                atmos: p.atmos || (generated ? generated.atmos : "Vakuum"),
                temp: p.temp || (generated ? generated.temp : "0°C"),
                bio: p.bio || (generated ? generated.bio : "Steril"),
                res: p.res || (generated ? generated.res : "Gestein"),
                species: finalSpecies || p.species || null
            }
        };
        activePlanets.push(planetEntry);

        // Spawn Moons
        const moonsList = p.moons || [];
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
                bumpScale: 0.06,
                roughness: 0.75,
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
                baseDistance: m.distance,
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
    const asteroidsList = (activeSystem.asteroids && activeSystem.asteroids.length > 0) ? activeSystem.asteroids : [];
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
        mesh.position.set(ast.x * 2.2, (Math.random() - 0.5) * 1.5, ast.z * 2.2);
        scene.add(mesh);

        const astRange = size * 2.8;
        const sourceObj: any = {
            mesh: mesh,
            type: 'asteroid',
            name: isOrganic ? 'Organische Biomasse-Trümmer' : 'Silizium-Kristall-Fragment',
            mass: size * 1.5,
            radius: size,
            gravityRange: astRange,
            position: mesh.position,
            isResource: true,
            resourceType: isOrganic ? 'bio' : 'silicon',
            yield: isOrganic ? 15 : 20
        };
        STATE.gravitySources.push(sourceObj);

        STATE.asteroids.push(sourceObj);
    });

    initPlanetDefenseFleets();
    addLogEntry("NAV", `Sensoren initialisiert: ${activeSystem.name} [${activeSystem.sectorName || 'Sektor'}].`);
}

export function updateActivePlanets(dt: number) {
    activePlanets.forEach(p => {
        if (!p.isMoon) {
            p.angle += p.speed * dt;
            const px = p.distance * Math.cos(p.angle);
            const pz = p.distance * Math.sin(p.angle);
            p.mesh.position.set(px, 0, pz);
            p.source.position.set(px, 0, pz);

            // Dynamic Planetary Sub-System Scale: Planet smoothly expands into a colossal world
            const isOrbitFocus = !!(STATE.isInPlanetOrbit && STATE.orbitPlanet === p);
            const targetScale = isOrbitFocus ? 2.8 : 1.0;
            const curScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetScale, Math.min(1.0, dt * 3.0));
            p.mesh.scale.set(curScale, curScale, curScale);
            p.source.radius = p.size * curScale;

            if (p.bodyMesh && p.bodyMesh instanceof THREE.Mesh) {
                p.bodyMesh.rotation.y += 0.08 * dt;
            }
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += 0.12 * dt;
            }
            if (p.ringMesh) {
                p.ringMesh.position.set(px, 0, pz);
            }
        } else if (p.isMoon && p.parentPlanet) {
            // Dynamic Sub-System Expansion: Expand moon distance & size for the orbital level
            const isOrbitFocus = !!(STATE.isInPlanetOrbit && (STATE.orbitPlanet === p.parentPlanet || STATE.orbitPlanet === p));
            const baseDist = p.baseDistance || 6.0;
            const targetDist = isOrbitFocus ? (baseDist * 3.4 + 10.0) : baseDist;
            p.distance = THREE.MathUtils.lerp(p.distance, targetDist, Math.min(1.0, dt * 3.5));

            const targetMoonScale = isOrbitFocus ? 1.8 : 1.0;
            const curMoonScale = THREE.MathUtils.lerp(p.mesh.scale.x, targetMoonScale, Math.min(1.0, dt * 3.0));
            p.mesh.scale.set(curMoonScale, curMoonScale, curMoonScale);
            p.source.radius = p.size * curMoonScale;

            p.angle += p.speed * dt;
            const parentPos = p.parentPlanet.mesh.position;
            const mx = parentPos.x + p.distance * Math.cos(p.angle);
            const mz = parentPos.z + p.distance * Math.sin(p.angle);
            p.mesh.position.set(mx, 0, mz);
            p.source.position.set(mx, 0, mz);

            if (p.bodyMesh && p.bodyMesh instanceof THREE.Mesh) {
                p.bodyMesh.rotation.y += 0.15 * dt;
            }
            if (p.ringMesh) {
                p.ringMesh.position.set(parentPos.x, 0, parentPos.z);
                const ringScale = p.distance / baseDist;
                p.ringMesh.scale.set(ringScale, 1, ringScale);
            }
        }
    });

    STATE.asteroids.forEach(a => {
        a.mesh.rotation.x += 0.005;
        a.mesh.rotation.y += 0.008;
    });
}

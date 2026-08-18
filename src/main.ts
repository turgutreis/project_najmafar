import * as THREE from 'three';
import { STATE } from './core/state';
import { initScene, starfield, renderer, scene, camera } from './engine/scene';
import { initPostProcessing, renderPostProcessing } from './engine/postprocessing';
import { initTrajectory, updateTrajectory } from './engine/trajectory';
import { createPlayerMesh, playerMesh, playerGlowMesh, playerLight, thrustLight, empLight, gravityCircles } from './procedural/meshes';
import { setupControls, processInput } from './input/controls';
import { checkUniverseData, clearActiveSystem, spawnPlanetsAndAsteroids, updateUniverseShaders } from './systems/universe';
import { updatePhysics } from './engine/physics';
import { updateScanning, triggerScanStart } from './systems/scanner';
import { updateHarvesting, triggerHarvestStart } from './systems/harvesting';
import { updateAbduction, triggerAbductStart } from './systems/abduction';
import { updateFleet } from './systems/fleet';
import { updateCrewSimulation, renderCrewUI } from './systems/crew';
import { updateMinimap, updateSonarWave, initHUD, addLogEntry } from './ui/hud';
import { initDeckUI, updateMutationUI } from './ui/deck';
import { toggleGalaxyMap, warpToSystem, isMapOpen } from './systems/galaxy-map';
import { toggleMusic, isMusicPlaying, isMusicUserMuted } from './engine/audio';
import { initGameOverUI, updateExplosionEffects } from './engine/game-over';

let lastTime = 0;

function animate(time: number) {
    if (time === undefined) {
        requestAnimationFrame(animate);
        return;
    }
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // Background starfield slow rotation
    if (starfield) {
        starfield.rotation.y += dt * 0.005;
    }

    // Update active procedural shaders (solar corona, volumetric sun rays, and lens flares)
    updateUniverseShaders(dt, camera);

    // Pulse gravity rings
    gravityCircles.forEach(c => {
        const timePulse = Math.sin(Date.now() * 0.003 * c.pulseSpeed);
        (c.mesh.material as THREE.Material).opacity = c.baseOpacity + timePulse * (c.baseOpacity * 0.5);
    });

    if (STATE.gameStarted) {
        // Unified Keyboard and Gamepad input processing
        processInput(dt);

        // Core Physics simulation (orbits, gravity, collisions)
        updatePhysics(dt);

        // Subsystems updates
        updateScanning(dt);
        updateHarvesting(dt);
        updateAbduction(dt);
        updateFleet(dt);
        updateCrewSimulation(dt);
        updateSonarWave(dt);
        updateExplosionEffects(dt);

        // Trajectory prediction
        updateTrajectory();

        // Minimap 2D radar
        updateMinimap();

        // Biomechanical tentacle animation
        if (STATE.playerGroup) {
            const timeVal = Date.now() * 0.005;
            STATE.playerGroup.children.forEach((child, index) => {
                if (index >= 3) { // Tentacle groups
                    let parent: any = child;
                    let depth = 0;
                    while (parent && parent.children && parent.children.length > 0) {
                        const joint = parent.children[0];
                        if (joint) {
                            joint.rotation.z = Math.sin(timeVal + index + depth * 0.5) * 0.15;
                            joint.rotation.y = Math.cos(timeVal + depth * 0.3) * 0.1;
                            parent = joint;
                            depth++;
                        } else {
                            break;
                        }
                    }
                }
            });
        }

        // Bioluminescent shell pulse & dynamic color reaction
        if (playerGlowMesh) {
            const glowPulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.08;
            playerGlowMesh.scale.set(1.6 * glowPulse, 0.9 * glowPulse, 0.9 * glowPulse);

            if (STATE.health < 30) {
                (playerGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xf43f5e); // Red emergency alert
            } else if (STATE.telepathyActive) {
                (playerGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xa855f7); // Purple psionic trance
            } else {
                (playerGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ff88); // Bio green nominal
            }
        }

        // Dynamic Ship, Thrust, and EMP PointLights
        if (thrustLight) {
            const isThrusting = STATE.keys.w;
            const targetThrust = isThrusting ? (2.6 + Math.random() * 0.5) : 0.0;
            thrustLight.intensity += (targetThrust - thrustLight.intensity) * Math.min(1.0, dt * 12.0);
        }
        if (empLight && empLight.intensity > 0.0) {
            empLight.intensity = Math.max(0.0, empLight.intensity - dt * 20.0);
        }
        if (playerLight) {
            if (STATE.health < 30) {
                playerLight.color.setHex(0xf43f5e);
            } else if (STATE.telepathyActive) {
                playerLight.color.setHex(0xa855f7);
            } else {
                playerLight.color.setHex(0x00ff88);
            }
        }
    }

    renderPostProcessing();
    requestAnimationFrame(animate);
}

function init() {
    console.log("Najmafar: Initializing 3D engine and game systems...");
    const container = document.getElementById('canvas-container') || document.body;

    // 1. Three.js Scene Setup & Cinematic Post-Processing
    initScene(container);
    initPostProcessing();

    // 2. Meshes & Trajectory
    createPlayerMesh();
    initTrajectory();

    // 3. UI & Controls
    setupControls();
    initHUD();
    initDeckUI();
    initGameOverUI();
    renderCrewUI();
    updateMutationUI();

    // 4. Universe Initialization
    checkUniverseData();

    // 5. Setup Menu Listeners
    setupMenuListeners();

    // 6. Start Render Loop
    requestAnimationFrame(animate);
    console.log("Najmafar: Game engine running!");
}

function setupMenuListeners() {
    const startBtn = document.getElementById('start-game-btn');
    const mainMenu = document.getElementById('main-menu');
    const resumeBtn = document.getElementById('resume-game-btn');

    if (startBtn && mainMenu) {
        startBtn.addEventListener('click', () => {
            mainMenu.classList.add('menu-hidden');
            STATE.gameStarted = true;
            document.body.classList.add('game-started');
            if (resumeBtn) resumeBtn.style.display = 'block';

            if (STATE.universe) {
                clearActiveSystem();
                spawnPlanetsAndAsteroids();
                STATE.playerPosition.set(0, 0, 65);
                STATE.playerVelocity.set(5, 0, 0);
                if (STATE.playerGroup) {
                    STATE.playerGroup.position.set(0, 0, 65);
                }
            }

            if (!isMusicPlaying() && !isMusicUserMuted()) {
                toggleMusic(true);
            }

            addLogEntry("SYSTEM", "Biologisches Raumschiff erwacht. Psionische Sensoren online.");
            addLogEntry("CREW", "Capt. Miller: 'Systeme nominal. Wir fliegen mit vollem Schub!'");
        });
    }

    if (resumeBtn && mainMenu) {
        resumeBtn.addEventListener('click', () => {
            mainMenu.classList.add('menu-hidden');
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const howToModal = document.getElementById('how-to-play-modal');
            if (howToModal && howToModal.style.display === 'flex') {
                howToModal.style.display = 'none';
                return;
            }

            if (isMapOpen()) {
                toggleGalaxyMap();
                return;
            }

            if (!mainMenu) return;
            const runningInElectron = typeof (window as any).api !== 'undefined';
            if (STATE.gameStarted) {
                mainMenu.classList.toggle('menu-hidden');
            } else if (runningInElectron) {
                (window as any).api.closeApp();
            }
        }
    });

    const howToBtn = document.getElementById('how-to-play-btn');
    const howToModal = document.getElementById('how-to-play-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (howToBtn && howToModal) {
        howToBtn.addEventListener('click', () => { howToModal.style.display = 'flex'; });
    }
    if (closeModalBtn && howToModal) {
        closeModalBtn.addEventListener('click', () => { howToModal.style.display = 'none'; });
    }

    const mapBtn = document.getElementById('galaxy-map-btn');
    const closeMapBtn = document.getElementById('close-map-btn');
    if (mapBtn) mapBtn.addEventListener('click', toggleGalaxyMap);
    if (closeMapBtn) closeMapBtn.addEventListener('click', toggleGalaxyMap);

    const startScanBtn = document.getElementById('start-scan-btn');
    if (startScanBtn) startScanBtn.addEventListener('click', triggerScanStart);

    const startHarvestBtn = document.getElementById('start-harvest-btn');
    if (startHarvestBtn) startHarvestBtn.addEventListener('click', triggerHarvestStart);

    const startAbductBtn = document.getElementById('start-abduct-btn');
    if (startAbductBtn) startAbductBtn.addEventListener('click', triggerAbductStart);

    // Electron Quit Button
    const runningInElectron = typeof (window as any).api !== 'undefined';
    if (runningInElectron) {
        const exitBtn = document.getElementById('exit-btn');
        if (exitBtn) {
            exitBtn.style.display = 'block';
            exitBtn.addEventListener('click', () => {
                (window as any).api.closeApp();
            });
        }
    }

    // IBM Quantum Universe Generator Button in Menu
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const keyInput = document.getElementById('ibm-key-input') as HTMLInputElement;
            const qpuChk = document.getElementById('use-qpu-chk') as HTMLInputElement;
            const statusDiv = document.getElementById('generation-status');

            const apiKey = keyInput ? keyInput.value.trim() : '';
            const useQpu = qpuChk ? qpuChk.checked : false;

            if (statusDiv) {
                statusDiv.innerText = "Lade Quantenschaltkreis... Bitte warten...";
                statusDiv.style.color = "#a855f7";
            }
            generateBtn.disabled = true;

            if (runningInElectron) {
                try {
                    const res = await (window as any).api.generateUniverse(apiKey, useQpu);
                    if (res.success) {
                        if (statusDiv) {
                            statusDiv.innerText = "Galaxie generiert! Najmafar erwacht.";
                            statusDiv.style.color = "#10b981";
                        }
                        await checkUniverseData();
                    } else {
                        if (statusDiv) {
                            statusDiv.innerText = "Fehler: " + res.error;
                            statusDiv.style.color = "#ef4444";
                        }
                        generateBtn.disabled = false;
                    }
                } catch (e: any) {
                    if (statusDiv) {
                        statusDiv.innerText = "Fehler: " + e.message;
                        statusDiv.style.color = "#ef4444";
                    }
                    generateBtn.disabled = false;
                }
            } else {
                if (statusDiv) {
                    statusDiv.innerText = "Quantum-Generierung benötigt Electron Desktop Client!";
                    statusDiv.style.color = "#f59e0b";
                }
                generateBtn.disabled = false;
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

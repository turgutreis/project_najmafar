import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { camera, renderer } from '../engine/scene';
import { playLockOnSound, setThrusterSound, toggleMusic, isMusicPlaying, isMusicUserMuted } from '../engine/audio';
import { toggleGalaxyMap, isMapOpen } from '../systems/galaxy-map';
import { triggerScanStart } from '../systems/scanner';
import { triggerHarvestStart } from '../systems/harvesting';
import { triggerAbductStart } from '../systems/abduction';
import { triggerBioDischarge, salvageNearestWreck } from '../systems/fleet';
import { triggerPsionicSonar, addLogEntry } from '../ui/hud';
import { buyMutation } from '../ui/deck';
import { openDiplomacyComms, closeDiplomacyComms } from '../systems/diplomacy';

const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
let prevGpButtons: boolean[] = [];

export function setupControls() {
    // Keyboard down
    window.addEventListener('keydown', (e) => {
        let key = e.key.toLowerCase();

        // Prevent page scroll on space and arrows
        if (key === ' ' || e.code === 'Space' || e.key.startsWith('Arrow')) {
            e.preventDefault();
        }

        if (key === 'z') {
            toggleFlightAssist();
        }
        if (key === 'm') {
            toggleGalaxyMap();
        }
        if (key === 'q') {
            triggerPsionicSonar();
        }
        if (key === 't') {
            cycleTarget(1);
        }
        if (key === 'x') {
            triggerBioDischarge();
        }
        if (key === 'c') {
            const target = STATE.lockedTarget || STATE.nearestPlanet;
            if (target && target.attributes && target.attributes.species) {
                openDiplomacyComms(target);
            }
        }
        if (key === 'escape') {
            closeDiplomacyComms();
        }
        if (key === 'f') {
            if (STATE.nearestPlanet) {
                const isScanned = STATE.nearestPlanet.scanned || (STATE.scannedPlanets && STATE.scannedPlanets[STATE.nearestPlanet.name]);
                if (isScanned) {
                    if (STATE.nearestPlanet.attributes.species && STATE.nearestPlanet.attributes.species.population > 0) {
                        triggerAbductStart();
                    } else {
                        addLogEntry("SYSTEM", `Planet ${STATE.nearestPlanet.name} ist bereits gescannt. Keine biologischen Wesen für Transfer.`);
                    }
                } else {
                    triggerScanStart();
                }
            }
        }
        if (key === 'e') {
            const salvaged = salvageNearestWreck();
            if (!salvaged) {
                triggerHarvestStart();
            }
        }

        if (key === 'w' || e.key === 'ArrowUp') STATE.keys.w = true;
        if (key === 's' || e.key === 'ArrowDown') STATE.keys.s = true;
        if (key === 'a' || e.key === 'ArrowLeft') STATE.keys.a = true;
        if (key === 'd' || e.key === 'ArrowRight') STATE.keys.d = true;
        if (key === ' ' || e.code === 'Space') STATE.keys.Space = true;
        if (key === 'shift' || e.key === 'Shift') STATE.keys.Shift = true;
    });

    // Keyboard up
    window.addEventListener('keyup', (e) => {
        let key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'ArrowUp') STATE.keys.w = false;
        if (key === 's' || e.key === 'ArrowDown') STATE.keys.s = false;
        if (key === 'a' || e.key === 'ArrowLeft') STATE.keys.a = false;
        if (key === 'd' || e.key === 'ArrowRight') STATE.keys.d = false;
        if (key === ' ' || e.code === 'Space') STATE.keys.Space = false;
        if (key === 'shift' || e.key === 'Shift') STATE.keys.Shift = false;
    });

    // Flight Assist Mode HUD Button
    const assistBtn = document.getElementById('flight-mode-toggle-btn') || document.getElementById('flight-dynamics-hud');
    if (assistBtn) {
        assistBtn.addEventListener('click', toggleFlightAssist);
    }

    // UI Button Click for Telepathy
    const btn = document.getElementById('telepathy-toggle-btn');
    if (btn) {
        btn.addEventListener('click', toggleTelepathy);
    }

    const empBtn = document.getElementById('trigger-emp-btn');
    if (empBtn) {
        empBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerBioDischarge();
        });
    }

    // Music Toggle Buttons
    const musicBtn = document.getElementById('music-toggle-btn');
    if (musicBtn) {
        musicBtn.addEventListener('click', () => toggleMusic());
    }

    const menuMusicBtn = document.getElementById('menu-music-toggle-btn');
    if (menuMusicBtn) {
        menuMusicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });
    }

    // Auto-start music on first interaction
    const startAudioOnInteraction = () => {
        if (!isMusicPlaying() && !isMusicUserMuted()) {
            toggleMusic(true);
        }
        window.removeEventListener('click', startAudioOnInteraction);
        window.removeEventListener('keydown', startAudioOnInteraction);
    };
    window.addEventListener('click', startAudioOnInteraction);
    window.addEventListener('keydown', startAudioOnInteraction);

    // Mouse Lock-on Raycasting (Click in 3D scene)
    window.addEventListener('pointerdown', (e) => {
        if (!STATE.gameStarted || isMapOpen()) return;

        const target = e.target as HTMLElement;
        if (target.closest('.glass-panel') || target.closest('button') || target.closest('.modal-overlay')) {
            return;
        }

        mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouseVec, camera);

        const clickableMeshes: THREE.Object3D[] = [];
        activePlanets.forEach(p => {
            if (p.mesh) clickableMeshes.push(p.mesh);
            if (p.bodyMesh) clickableMeshes.push(p.bodyMesh);
        });

        const intersects = raycaster.intersectObjects(clickableMeshes, true);
        if (intersects.length > 0) {
            let hitObj: THREE.Object3D | null = intersects[0].object;
            while (hitObj && hitObj.parent && hitObj.parent.type === 'Group' && hitObj.parent !== camera) {
                const matchedPlanet = activePlanets.find(p => p.mesh === hitObj);
                if (matchedPlanet) {
                    setLockedTarget(matchedPlanet);
                    return;
                }
                hitObj = hitObj.parent;
            }
            const directMatch = activePlanets.find(p => p.mesh === hitObj || p.bodyMesh === hitObj);
            if (directMatch) {
                setLockedTarget(directMatch);
            }
        }
    });

    // Clear Target Lock Button
    const unlockBtn = document.getElementById('unlock-target-btn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearLockedTarget();
        });
    }

    // Dynamic Camera Zoom via Mouse Wheel
    window.addEventListener('wheel', (e) => {
        if (!STATE.gameStarted || isMapOpen()) return;
        const target = e.target as HTMLElement;
        if (target.closest('.scanner-scroll-body') || target.closest('.log-container') || target.closest('.deck-scroll-container')) {
            return;
        }

        const zoomDelta = e.deltaY * 0.08;
        const minHeight = 35;
        const maxHeight = 135;
        STATE.targetCameraHeight = Math.min(maxHeight, Math.max(minHeight, (STATE.targetCameraHeight || 65) + zoomDelta));
    }, { passive: true });
}

export function toggleFlightAssist() {
    STATE.flightAssist = !STATE.flightAssist;
    if (STATE.flightAssist) {
        addLogEntry("SYSTEM", "🕹️ FLUG-ASSISTENT AKTIV: Automatische Bremsdüsen stabilisieren das Schiff.");
    } else {
        addLogEntry("SYSTEM", "🌌 NEWTONSCHER DRIFT AKTIV: Vakuum-Trägheit freigeschaltet (Endloses Gleiten).");
    }
}

export function setLockedTarget(planet: any) {
    if (STATE.lockedTarget === planet) return;
    STATE.lockedTarget = planet;
    playLockOnSound();
    addLogEntry("SYSTEM", `Zielerfassung fixiert auf: ${planet.name} (${planet.type}).`);
    updateTargetLockBadgeUI();
}

export function clearLockedTarget() {
    if (!STATE.lockedTarget) return;
    addLogEntry("SYSTEM", `Zielerfassung auf ${STATE.lockedTarget.name} aufgehoben.`);
    STATE.lockedTarget = null;
    updateTargetLockBadgeUI();
}

export function cycleTarget(direction: number = 1) {
    if (activePlanets.length === 0) return;

    const sorted = [...activePlanets].sort((a, b) => {
        const da = a.mesh.position.distanceTo(STATE.playerPosition);
        const db = b.mesh.position.distanceTo(STATE.playerPosition);
        return da - db;
    });

    if (!STATE.lockedTarget) {
        setLockedTarget(sorted[0]);
    } else {
        const curIdx = sorted.findIndex(p => p.name === STATE.lockedTarget!.name);
        let nextIdx = (curIdx + direction + sorted.length) % sorted.length;
        setLockedTarget(sorted[nextIdx]);
    }
}

export function updateTargetLockBadgeUI() {
    const badge = document.getElementById('target-lock-badge');
    const label = document.getElementById('target-label-text');
    if (badge) {
        badge.style.display = STATE.lockedTarget ? 'flex' : 'none';
    }
    if (label) {
        label.innerText = STATE.lockedTarget ? 'Fixiertes Ziel:' : 'Nächster Planet:';
    }
}

export function toggleTelepathy() {
    if (STATE.mentalEnergy <= 5 && !STATE.telepathyActive) {
        addLogEntry("SYSTEM", "Warnung: Zu wenig mentale Energie für telepathische Illusionen!");
        return;
    }

    STATE.telepathyActive = !STATE.telepathyActive;

    const btn = document.getElementById('telepathy-toggle-btn');
    const overlay = document.getElementById('telepathic-overlay');

    if (STATE.telepathyActive) {
        if (btn) btn.classList.add('active');
        if (btn) btn.querySelector('.btn-text')!.textContent = "Illusion Deaktivieren";
        if (overlay) overlay.className = "active";
        addLogEntry("TELEPATHY", "Telepathische Überstrahlung initiiert. Crew-Stress nimmt ab. Mentale Feldstärke sinkt...");

        const cabin = document.getElementById('schematic-cabin');
        const status = document.getElementById('schematic-status');
        if (cabin) cabin.setAttribute('stroke', '#a855f7');
        if (status) {
            status.textContent = "Geist beruhigt";
            status.setAttribute('fill', '#c084fc');
        }
    } else {
        if (btn) btn.classList.remove('active');
        if (btn) btn.querySelector('.btn-text')!.textContent = "Telepathische Illusion aktivieren";
        if (overlay) overlay.className = "inactive";
        addLogEntry("TELEPATHY", "Telepathischer Kontakt abgebrochen. Crew registriert biologische Umgebung!");

        const cabin = document.getElementById('schematic-cabin');
        const status = document.getElementById('schematic-status');
        if (cabin) cabin.setAttribute('stroke', '#38bdf8');
        if (status) {
            status.textContent = "Druck stabil";
            status.setAttribute('fill', '#38bdf8');
        }
    }
}

export function processInput(dt: number) {
    // Reset acceleration each frame (input adds thrust, then physics adds gravity)
    STATE.playerAcceleration.set(0, 0, 0);

    let isThrusting = false;
    let isRetroBraking = false;
    let turnInput = 0; // -1 = Left (CCW), +1 = Right (CW)
    STATE.spaceBrakeActive = false;

    // 1. Keyboard Input
    if (STATE.keys.w) isThrusting = true;
    if (STATE.keys.s) isRetroBraking = true;
    if (STATE.keys.a) turnInput += 1;
    if (STATE.keys.d) turnInput -= 1;
    if (STATE.keys.Shift) STATE.spaceBrakeActive = true;

    // 2. Gamepad Input
    let gp: Gamepad | null = null;
    if (navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i]!.connected) {
                gp = gamepads[i];
                break;
            }
        }
    }

    if (gp) {
        const deadzone = 0.15;
        let stickX = gp.axes[0] || 0;
        let stickY = gp.axes[1] || 0;
        let rtVal = (gp.buttons[7] ? gp.buttons[7].value : 0);
        let ltVal = (gp.buttons[6] ? gp.buttons[6].value : 0);

        if (Math.abs(stickX) > deadzone) turnInput -= stickX;
        if (stickY < -0.3 || rtVal > 0.2) isThrusting = true;
        if (stickY > 0.3 || ltVal > 0.2) isRetroBraking = true;
        if (gp.buttons[1] && gp.buttons[1].pressed) STATE.spaceBrakeActive = true; // Button B = Space Brake

        // Edge-triggered Buttons
        function isPressedEdge(btnIdx: number) {
            const btn = gp!.buttons[btnIdx];
            const isDown = btn ? (btn.pressed || btn.value > 0.5) : false;
            const wasDown = prevGpButtons[btnIdx] || false;
            return isDown && !wasDown;
        }

        if (isPressedEdge(0)) { // Button A
            if (STATE.nearestPlanet) {
                const isScanned = STATE.nearestPlanet.scanned || (STATE.scannedPlanets && STATE.scannedPlanets[STATE.nearestPlanet.name]);
                if (isScanned) {
                    if (STATE.nearestPlanet.attributes.species && STATE.nearestPlanet.attributes.species.population > 0) {
                        triggerAbductStart();
                    }
                } else {
                    triggerScanStart();
                }
            }
        }

        if (isPressedEdge(2)) triggerHarvestStart(); // Button X
        if (isPressedEdge(3)) triggerPsionicSonar();   // Button Y
        if (isPressedEdge(4)) cycleTarget(-1); // LB
        if (isPressedEdge(5)) cycleTarget(1);  // RB
        if (isPressedEdge(8)) toggleGalaxyMap(); // Select
        if (isPressedEdge(10)) toggleFlightAssist(); // L3 (Left Stick Click)

        if (isPressedEdge(9)) { // Start / Menu
            const mainMenu = document.getElementById('main-menu');
            if (mainMenu && STATE.gameStarted) {
                mainMenu.classList.toggle('menu-hidden');
            }
        }

        prevGpButtons = gp.buttons.map(b => b ? (b.pressed || b.value > 0.5) : false);
    }

    // 3. Yaw Steering & Heading Dynamics
    if (turnInput !== 0) {
        STATE.shipAngularVelocity = turnInput * STATE.turnSpeed;
    } else {
        STATE.shipAngularVelocity = THREE.MathUtils.lerp(STATE.shipAngularVelocity || 0, 0, Math.min(1.0, dt * 8.0));
    }
    STATE.shipHeading = (STATE.shipHeading || 0) + STATE.shipAngularVelocity * dt;

    // 4. Main Forward Thrust (Along Ship Nose Vector)
    const hasEnergy = STATE.bioEnergy > 0;
    const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;

    // Forward direction in world coordinates (Ship nose points along +X in local space when rotation.y = 0)
    const forwardX = Math.cos(STATE.shipHeading);
    const forwardZ = -Math.sin(STATE.shipHeading);
    const forwardDir = new THREE.Vector3(forwardX, 0, forwardZ);

    if (isThrusting) {
        STATE.playerAcceleration.addScaledVector(forwardDir, effectiveThrust);

        // Bio-Energy fuel consumption
        if (hasEnergy) {
            STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 2.6 * dt);
        }

        setThrusterSound(true);
    } else {
        setThrusterSound(false);
    }

    // 5. Active Retro-Braking (Counter-Thrust on 'S')
    if (isRetroBraking) {
        const curSpeed = STATE.playerVelocity.length();
        if (curSpeed > 0.4) {
            // Apply counter-force opposite to current velocity vector
            const counterDir = STATE.playerVelocity.clone().normalize().negate();
            STATE.playerAcceleration.addScaledVector(counterDir, STATE.retroThrustStrength);
        } else {
            // Gentle reverse push
            STATE.playerAcceleration.addScaledVector(forwardDir, -effectiveThrust * 0.4);
        }

        if (hasEnergy) {
            STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 1.8 * dt);
        }
    }

    // 6. Space Handbrake / Inertial All-Stop (Holding Space / Shift)
    if (STATE.spaceBrakeActive) {
        const curSpeed = STATE.playerVelocity.length();
        if (curSpeed > 0.1) {
            const counterDir = STATE.playerVelocity.clone().normalize().negate();
            STATE.playerAcceleration.addScaledVector(counterDir, STATE.retroThrustStrength * 1.6);
        }
    }

    // 7. Space Drag & Flight Assist Integration
    if (STATE.spaceBrakeActive) {
        STATE.currentDrag = STATE.brakeDrag;
    } else if (STATE.flightAssist) {
        // Flight Assist ON: Gentle retro-dampening only when no keys are pressed
        if (!isThrusting && !isRetroBraking) {
            STATE.currentDrag = 0.85;
        } else {
            STATE.currentDrag = STATE.drag;
        }
    } else {
        // Newtonian Drift Mode: Pure vacuum inertia (0.005 drag)
        STATE.currentDrag = STATE.drag;
    }

    // 8. Alien Ship 3D Orientation & Organic Banking Roll
    if (STATE.playerGroup) {
        STATE.playerGroup.rotation.y = STATE.shipHeading;

        // Dynamic banking roll into turns (Z-axis local roll)
        const targetRoll = -turnInput * 0.32;
        STATE.playerGroup.rotation.z = THREE.MathUtils.lerp(STATE.playerGroup.rotation.z, targetRoll, Math.min(1.0, dt * 6.0));

        // Pitch tilt on acceleration (Nose dipping slightly into high thrust)
        const targetPitch = isThrusting ? 0.06 : (isRetroBraking ? -0.06 : 0.0);
        STATE.playerGroup.rotation.x = THREE.MathUtils.lerp(STATE.playerGroup.rotation.x, targetPitch, Math.min(1.0, dt * 6.0));
    }
}

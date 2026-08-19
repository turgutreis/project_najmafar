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
        if (key === ' ' || e.code === 'Space') {
            toggleTelepathy();
            e.preventDefault();
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
            if (target && target.attributes.species) {
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
    });

    // Keyboard up
    window.addEventListener('keyup', (e) => {
        let key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'ArrowUp') STATE.keys.w = false;
        if (key === 's' || e.key === 'ArrowDown') STATE.keys.s = false;
        if (key === 'a' || e.key === 'ArrowLeft') STATE.keys.a = false;
        if (key === 'd' || e.key === 'ArrowRight') STATE.keys.d = false;
    });

    // UI Button Click
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

    // Mutation buttons listeners
    document.querySelectorAll('.mut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = (e.target as HTMLElement).dataset.mutation;
            if (type) buyMutation(type);
        });
    });

    setupTargetRaycasting();

    // Mouse Wheel Camera Zoom Listener (Zoom in up-close to see Alien anatomy, or out for system view)
    window.addEventListener('wheel', (e) => {
        if (e.target && (e.target as HTMLElement).closest('#main-menu, #how-to-play-modal, #deck-container, #diplomacy-overlay')) {
            return;
        }
        const delta = Math.sign(e.deltaY) * 6;
        STATE.targetCameraHeight = Math.max(30, Math.min(130, (STATE.targetCameraHeight || 65) + delta));
    }, { passive: true });
}

export function setupTargetRaycasting() {
    let pointerDownPos = { x: 0, y: 0 };
    window.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) return;

        if (e.target && (e.target as HTMLElement).closest('#hud-container, #galaxy-map-overlay, #main-menu, #how-to-play-modal')) {
            return;
        }

        if (!STATE.gameStarted || !renderer || !camera) return;

        mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouseVec, camera);

        const targetMeshes: THREE.Object3D[] = [];
        activePlanets.forEach(p => {
            if (p.mesh) targetMeshes.push(p.mesh);
        });

        const intersects = raycaster.intersectObjects(targetMeshes, true);
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const target = activePlanets.find(p => {
                if (p.mesh === hitObject || p.bodyMesh === hitObject) return true;
                let cur: THREE.Object3D | null = hitObject;
                while (cur) {
                    if (cur === p.mesh) return true;
                    cur = cur.parent;
                }
                return false;
            });
            if (target) {
                setLockedTarget(target);
                return;
            }
        }

        if (STATE.lockedTarget) {
            clearLockedTarget();
        }
    });

    const unlockBtn = document.getElementById('unlock-target-btn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearLockedTarget();
        });
    }
}

export function setLockedTarget(target: any) {
    if (!target) return;
    STATE.lockedTarget = target;
    playLockOnSound();
    const typeLabel = target.isMoon ? `Mond (${target.type})` : target.type;
    addLogEntry("SYSTEM", `🎯 ZIEL MANUELL FIXIERT: ${target.name} [${typeLabel}]. Scanner ausgerichtet.`);
    updateTargetLockBadgeUI();
}

export function clearLockedTarget() {
    if (STATE.lockedTarget) {
        addLogEntry("SYSTEM", `Ziel fixierung aufgehoben. Automatischer Distanz-Sensor aktiv.`);
    }
    STATE.lockedTarget = null;
    updateTargetLockBadgeUI();
}

export function cycleTarget(direction = 1) {
    if (!activePlanets || activePlanets.length === 0) return;

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

    const inputVec = new THREE.Vector3(0, 0, 0);

    // 1. Keyboard Input
    if (STATE.keys.w) inputVec.z -= 1;
    if (STATE.keys.s) inputVec.z += 1;
    if (STATE.keys.a) inputVec.x -= 1;
    if (STATE.keys.d) inputVec.x += 1;

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
        if (Math.abs(stickX) < deadzone) stickX = 0;
        if (Math.abs(stickY) < deadzone) stickY = 0;

        // D-Pad buttons
        if (gp.buttons[12] && gp.buttons[12].pressed) stickY = -1.0;
        if (gp.buttons[13] && gp.buttons[13].pressed) stickY = 1.0;
        if (gp.buttons[14] && gp.buttons[14].pressed) stickX = -1.0;
        if (gp.buttons[15] && gp.buttons[15].pressed) stickX = 1.0;

        if (inputVec.lengthSq() === 0 && (Math.abs(stickX) > 0 || Math.abs(stickY) > 0)) {
            inputVec.set(stickX, 0, stickY);
        }

        // Left Trigger (Button 6) = Hold Telepathic Calming Field
        const ltPressed = (gp.buttons[6] && gp.buttons[6].pressed) || (gp.buttons[6] && gp.buttons[6].value > 0.3);
        if (ltPressed && !STATE.telepathyActive) {
            toggleTelepathy();
        } else if (!ltPressed && STATE.telepathyActive && !STATE.keys.Space) {
            toggleTelepathy();
        }

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
        if (isPressedEdge(1)) {                      // Button B
            if (isMapOpen()) {
                toggleGalaxyMap();
            } else if (STATE.lockedTarget) {
                clearLockedTarget();
            }
        }

        if (isPressedEdge(4)) cycleTarget(-1); // LB
        if (isPressedEdge(5)) cycleTarget(1);  // RB
        if (isPressedEdge(8)) toggleGalaxyMap(); // Select

        if (isPressedEdge(9)) { // Start / Menu
            const mainMenu = document.getElementById('main-menu');
            if (mainMenu && STATE.gameStarted) {
                mainMenu.classList.toggle('menu-hidden');
            }
        }

        prevGpButtons = gp.buttons.map(b => b ? (b.pressed || b.value > 0.5) : false);
    }

    // 3. Movement Integration (via Acceleration, not direct Velocity)
    const isThrusting = inputVec.lengthSq() > 0;
    if (isThrusting) {
        inputVec.normalize();

        const hasEnergy = STATE.bioEnergy > 0;
        const effectiveThrust = hasEnergy ? STATE.thrustStrength : STATE.thrustStrength * 0.35;

        // Apply thrust as acceleration (integrated later in physics.ts)
        STATE.playerAcceleration.addScaledVector(inputVec, effectiveThrust);

        // Fuel consumption: 3.2 Bio-Energy/s during active thrusting
        if (hasEnergy) {
            STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 3.2 * dt);
        }

        // Rotate ship towards movement direction smoothly (natural flight orientation)
        if (STATE.playerGroup) {
            // Ship nose is along +X in local space. Angle to point +X along (inputVec.x, inputVec.z):
            const targetAngle = -Math.atan2(inputVec.z, inputVec.x);
            let diff = targetAngle - STATE.playerGroup.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            STATE.playerGroup.rotation.y += diff * Math.min(1.0, dt * 10.0);

            // Natural organic banking roll into turns
            const turnRoll = -diff * 0.35;
            STATE.playerGroup.rotation.x = THREE.MathUtils.lerp(STATE.playerGroup.rotation.x, turnRoll, 0.1);
        }

        // Thrusting drag (low - responsive flight)
        STATE.currentDrag = STATE.drag;

        setThrusterSound(true);
    } else {
        // Level out banking roll
        if (STATE.playerGroup) {
            STATE.playerGroup.rotation.x = THREE.MathUtils.lerp(STATE.playerGroup.rotation.x, 0, 0.1);
        }

        // Retro-dampening (high drag - ship brakes when not thrusting)
        STATE.currentDrag = STATE.brakeDrag;

        setThrusterSound(false);
    }
}

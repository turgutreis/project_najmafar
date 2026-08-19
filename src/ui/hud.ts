import * as THREE from 'three';
import { STATE, activePlanets } from '../core/state';
import { scene } from '../engine/scene';
import { playSonarChime } from '../engine/audio';
import { toggleDeckModal } from './deck';
import { toggleGalaxyMap } from '../systems/galaxy-map';
import { toggleFlightAssist } from '../input/controls';
import { triggerBioDischarge } from '../systems/fleet';

let minimapCanvas: HTMLCanvasElement | null = null;
let minimapCtx: CanvasRenderingContext2D | null = null;

let sonarWaveMesh: THREE.Mesh | null = null;
let sonarTimer = 0;

export function initHUD() {
    minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (minimapCanvas) {
        minimapCtx = minimapCanvas.getContext('2d');
    }

    const sonarBtn = document.getElementById('psionic-sonar-btn') || document.getElementById('dock-sonar-btn');
    if (sonarBtn) {
        sonarBtn.addEventListener('click', triggerPsionicSonar);
    }

    const dockDeckBtn = document.getElementById('dock-deck-btn');
    if (dockDeckBtn) {
        dockDeckBtn.addEventListener('click', () => toggleDeckModal());
    }

    const closeDeckBtn = document.getElementById('close-deck-modal-btn');
    if (closeDeckBtn) {
        closeDeckBtn.addEventListener('click', () => toggleDeckModal(false));
    }

    const dockMapBtn = document.getElementById('dock-map-btn');
    if (dockMapBtn) {
        dockMapBtn.addEventListener('click', () => toggleGalaxyMap());
    }

    const dockAssistBtn = document.getElementById('dock-assist-btn');
    if (dockAssistBtn) {
        dockAssistBtn.addEventListener('click', () => toggleFlightAssist());
    }
}

export function addLogEntry(category: string, message: string) {
    const list = document.getElementById('log-list');
    const toastStream = document.getElementById('hud-fading-log-stream');

    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let catClass = 'sys';
    let catText = 'SYSTEM';
    if (category === 'TELEPATHY') {
        catClass = 'telepathy';
        catText = 'TELEPATHIE';
    } else if (category === 'CREW') {
        catClass = 'crew';
        catText = 'CREW-FUNK';
    } else if (category === 'EVOLUTION') {
        catClass = 'evolution';
        catText = 'EVOLUTION';
    }

    // 1. Persistent Log History (Inside Deck Modal)
    if (list) {
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <span class="log-time">[${timeStr}]</span>
            <span class="log-cat ${catClass}">[${catText}]</span>
            <span class="log-msg">${message}</span>
        `;
        list.prepend(li);
        while (list.children.length > 50) {
            list.removeChild(list.lastChild!);
        }
    }

    // 2. Fading Toast on HUD (Auto-cleans after 5 seconds)
    if (toastStream) {
        const toast = document.createElement('div');
        toast.className = `fading-toast ${catClass}`;
        toast.innerHTML = `<span style="font-weight: bold; margin-right: 4px;">[${catText}]</span> ${message}`;
        toastStream.appendChild(toast);

        // Keep maximum 4 toasts visible simultaneously
        while (toastStream.children.length > 4) {
            toastStream.removeChild(toastStream.firstChild!);
        }

        setTimeout(() => {
            if (toast.parentNode === toastStream) {
                toastStream.removeChild(toast);
            }
        }, 5000);
    }
}

export function updateHUDStats(isHarmony = false) {
    const hpBar = document.getElementById('core-health-bar') || document.getElementById('health-bar');
    const hpTxt = document.getElementById('core-health-text') || document.getElementById('health-text');
    const bioBar = document.getElementById('bio-energy-bar') || document.getElementById('energy-bar');
    const bioTxt = document.getElementById('bio-energy-text') || document.getElementById('energy-text');
    const mentalBar = document.getElementById('telepathy-energy-bar') || document.getElementById('mental-bar');
    const mentalTxt = document.getElementById('telepathy-energy-text') || document.getElementById('mental-text');
    const loneBar = document.getElementById('loneliness-bar');
    const loneTxt = document.getElementById('loneliness-text');

    if (hpBar) {
        hpBar.style.width = `${(STATE.health / STATE.maxHealth) * 100}%`;
        if (STATE.health < 30) {
            hpBar.className = "progress-bar health danger";
        } else {
            hpBar.className = "progress-bar health";
        }
    }
    if (hpTxt) hpTxt.innerText = `${Math.round(STATE.health)}%`;

    if (bioBar) bioBar.style.width = `${(STATE.bioEnergy / STATE.maxBioEnergy) * 100}%`;
    if (bioTxt) bioTxt.innerText = `${Math.round(STATE.bioEnergy)}%`;

    if (mentalBar) mentalBar.style.width = `${(STATE.mentalEnergy / STATE.maxMentalEnergy) * 100}%`;
    if (mentalTxt) mentalTxt.innerText = `${Math.round(STATE.mentalEnergy)}/${STATE.maxMentalEnergy}`;

    if (loneBar) {
        loneBar.style.width = `${STATE.loneliness}%`;
        if (isHarmony) {
            loneBar.style.background = 'linear-gradient(90deg, #10b981, #38bdf8)';
        } else {
            loneBar.style.background = STATE.loneliness > 60 ? 'linear-gradient(90deg, #d946ef, #ef4444)' : 'linear-gradient(90deg, #38bdf8, #a855f7)';
        }
    }
    if (loneTxt) {
        let loneState = "Verzweiflung";
        if (isHarmony) loneState = "💫 Kosmische Harmonie";
        else if (STATE.loneliness < 30) loneState = "Duale Resonanz";
        else if (STATE.loneliness < 60) loneState = "Erste Bindung";
        else if (STATE.loneliness < 70) loneState = "Geistige Sättigung";
        loneTxt.innerText = `${Math.round(STATE.loneliness)}% (${loneState})`;
    }

    const currentSys = STATE.universe?.systems?.find(s => s.id === STATE.currentSystemId);
    const sysNameEl = document.getElementById('hud-current-system-name');
    if (sysNameEl) {
        sysNameEl.innerText = `🪐 ${currentSys ? currentSys.name : 'Sol Invictus'}`;
    }

    const bioCountEl = document.getElementById('res-bio-count');
    if (bioCountEl) {
        bioCountEl.innerText = `${Math.floor(STATE.bioRes || 0)}`;
    }

    const silCountEl = document.getElementById('res-silicon-count');
    if (silCountEl) {
        silCountEl.innerText = `${Math.floor(STATE.siliconRes || 0)}`;
    }

    const chronosCountEl = document.getElementById('chronos-count');
    if (chronosCountEl) {
        const visited = STATE.visitedSystemIds ? STATE.visitedSystemIds.length : (STATE.systemsVisited || 1);
        chronosCountEl.innerText = `${visited}`;
    }
}

export function updateMinimap() {
    if (!minimapCanvas || !minimapCtx) return;

    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const range = 450;

    minimapCtx.fillStyle = 'rgba(3, 7, 18, 0.85)';
    minimapCtx.fillRect(0, 0, width, height);

    const radius = width / 2 - 4;
    minimapCtx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    minimapCtx.lineWidth = 1;

    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    minimapCtx.stroke();

    const invRangeRadius = radius / range;

    // Draw gravity sources / planets
    STATE.gravitySources.forEach(source => {
        if (source.isAbsorbed) return;

        const dx = source.position.x - STATE.playerPosition.x;
        const dz = source.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;

            if (source.type === 'star') {
                minimapCtx.fillStyle = '#f59e0b';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 4, 0, Math.PI * 2);
                minimapCtx.fill();
            } else if (source.type === 'planet') {
                const planetEntry = activePlanets.find(p => p.source === source);
                const hasSentient = planetEntry && planetEntry.attributes.species && planetEntry.attributes.species.population > 0;

                if (hasSentient) {
                    minimapCtx.fillStyle = '#d946ef';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, 3.5, 0, Math.PI * 2);
                    minimapCtx.fill();

                    minimapCtx.strokeStyle = 'rgba(217, 70, 239, 0.8)';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, 5.5 + Math.sin(Date.now() * 0.008) * 1.5, 0, Math.PI * 2);
                    minimapCtx.stroke();
                } else {
                    minimapCtx.fillStyle = planetEntry && planetEntry.isMoon ? '#94a3b8' : '#38bdf8';
                    minimapCtx.beginPath();
                    minimapCtx.arc(sx, sy, planetEntry && planetEntry.isMoon ? 1.5 : 2.5, 0, Math.PI * 2);
                    minimapCtx.fill();
                }
            } else if (source.type === 'asteroid') {
                minimapCtx.fillStyle = source.resourceType === 'bio' ? '#00ff88' : '#38bdf8';
                minimapCtx.fillRect(sx - 1, sy - 1, 2, 2);
            }
        }
    });

    // Draw Fleet Ships (Spacefaring Defense Fleets)
    STATE.fleetShips.forEach(ship => {
        const dx = ship.position.x - STATE.playerPosition.x;
        const dz = ship.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;

            if (ship.state === 'disabled') {
                minimapCtx.fillStyle = '#64748b';
                minimapCtx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
            } else if (ship.state === 'intercept') {
                minimapCtx.fillStyle = '#f43f5e';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 3, 0, Math.PI * 2);
                minimapCtx.fill();

                minimapCtx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 5.0 + Math.sin(Date.now() * 0.015) * 1.5, 0, Math.PI * 2);
                minimapCtx.stroke();
            } else {
                // Patrol
                minimapCtx.fillStyle = '#f59e0b';
                minimapCtx.beginPath();
                minimapCtx.arc(sx, sy, 2, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    });

    // Draw Fleet Projectiles
    STATE.fleetProjectiles.forEach(proj => {
        const dx = proj.position.x - STATE.playerPosition.x;
        const dz = proj.position.z - STATE.playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < range) {
            const sx = cx + dx * invRangeRadius;
            const sy = cy + dz * invRangeRadius;
            minimapCtx.fillStyle = proj.type === 'emp' ? '#a855f7' : '#38bdf8';
            minimapCtx.fillRect(sx - 1, sy - 1, 2, 2);
        }
    });

    // Draw Player
    minimapCtx.fillStyle = '#10b981';
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = '#38bdf8';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.moveTo(cx, cy);
    const heading = (STATE.playerGroup ? STATE.playerGroup.rotation.y : 0);
    minimapCtx.lineTo(cx + Math.sin(heading) * 8, cy + Math.cos(heading) * 8);
    minimapCtx.stroke();
}

export function triggerPsionicSonar() {
    if (!STATE.gameStarted) return;
    if (STATE.mentalEnergy < 15) {
        addLogEntry("SYSTEM", "Zu wenig Mentalkraft für psionischen Sonar-Ruf (15% benötigt)!");
        return;
    }

    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 15);

    if (sonarWaveMesh) {
        scene.remove(sonarWaveMesh);
        if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
        if (sonarWaveMesh.material) (sonarWaveMesh.material as THREE.Material).dispose();
    }

    const ringGeo = new THREE.RingGeometry(1, 4, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    sonarWaveMesh = new THREE.Mesh(ringGeo, ringMat);
    sonarWaveMesh.position.copy(STATE.playerPosition);
    scene.add(sonarWaveMesh);
    sonarTimer = 1.0;

    playSonarChime();

    const sentientPlanets = activePlanets.filter(p => p.attributes && p.attributes.species && p.attributes.species.population > 0);
    if (sentientPlanets.length > 0) {
        const names = sentientPlanets.map(p => `${p.name} (${p.attributes.species.name})`).join(', ');
        addLogEntry("SYSTEM", `PSIONISCHER RUF: Mentales Resonanz-Echo empfangen von: ${names}! Kompass aktiv.`);
    } else {
        addLogEntry("SYSTEM", "PSIONISCHER RUF: Keine Gedanken-Signaturen in diesem System (Kosmische Stille).");
    }
}

export function updateSonarWave(dt: number) {
    if (!sonarWaveMesh) return;
    sonarTimer -= dt;
    const progress = 1.0 - sonarTimer;
    const scale = 1.0 + progress * 60;
    sonarWaveMesh.scale.set(scale, 1, scale);
    (sonarWaveMesh.material as THREE.Material).opacity = Math.max(0, sonarTimer * 0.9);

    if (sonarTimer <= 0) {
        scene.remove(sonarWaveMesh);
        if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
        if (sonarWaveMesh.material) (sonarWaveMesh.material as THREE.Material).dispose();
        sonarWaveMesh = null;
    }
}

import { STATE } from '../core/state';
import { StarSystem } from '../types/game';
import { playSiliconCollectSound, playCrashSound, setThrusterSound } from '../engine/audio';
import { addLogEntry } from '../ui/hud';
import { clearActiveSystem, spawnPlanetsAndAsteroids } from './universe';

let mapOpen = false;
let selectedSystem: StarSystem | null = null;
let hoverSystem: StarSystem | null = null;
let filterLifeOnly = false;

// Zoom & Pan state
let mapZoom = 1.0;
let mapPanX = 0;
let mapPanY = 0;
let isDraggingMap = false;
let dragStartX = 0;
let dragStartY = 0;
let mapMouseX = -1;
let mapMouseY = -1;
let mapAnimFrameId: number | null = null;

export function isMapOpen(): boolean {
    return mapOpen;
}

export function toggleGalaxyMap() {
    if (!STATE.gameStarted) return;

    const overlay = document.getElementById('galaxy-map-overlay');
    if (!overlay) return;

    mapOpen = !mapOpen;
    if (mapOpen) {
        overlay.style.display = 'flex';
        renderGalaxyMap();
        startGalaxyMapLoop();
    } else {
        overlay.style.display = 'none';
        stopGalaxyMapLoop();
    }
}

export function startGalaxyMapLoop() {
    stopGalaxyMapLoop();
    function mapLoop() {
        if (!mapOpen) return;
        drawGalaxyMap(mapMouseX, mapMouseY);
        mapAnimFrameId = requestAnimationFrame(mapLoop);
    }
    mapAnimFrameId = requestAnimationFrame(mapLoop);
}

export function stopGalaxyMapLoop() {
    if (mapAnimFrameId) {
        cancelAnimationFrame(mapAnimFrameId);
        mapAnimFrameId = null;
    }
}

let drawGalaxyMap: (mouseX: number, mouseY: number) => void = () => {};

export function renderGalaxyMap() {
    const canvas = document.getElementById('galaxy-map-canvas') as HTMLCanvasElement;
    if (!canvas || !STATE.universe) return;

    const ctx = canvas.getContext('2d')!;
    const rect = canvas.parentNode ? (canvas.parentNode as HTMLElement).getBoundingClientRect() : canvas.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 600;

    const width = canvas.width;
    const height = canvas.height;

    const systems = STATE.universe.systems;
    let maxDist = 0;
    systems.forEach(sys => {
        const dist = Math.sqrt(sys.x * sys.x + sys.z * sys.z);
        if (dist > maxDist) maxDist = dist;
    });
    const baseScale = Math.min(width, height) / (maxDist * 2.3 || 1);

    if (!selectedSystem) {
        selectedSystem = systems.find(s => s.id === STATE.currentSystemId) || systems[0];
    }
    updateSystemDetails(selectedSystem);
    populateQuickBeaconsList();

    drawGalaxyMap = function(mouseX = -1, mouseY = -1) {
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        const currentScale = baseScale * mapZoom;
        const centerX = width / 2 + mapPanX;
        const centerY = height / 2 + mapPanY;

        // Grid lines with pan/zoom
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        const gridSize = 40 * mapZoom;
        const startX = (centerX % gridSize);
        const startY = (centerY % gridSize);
        for (let x = startX; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = startY; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Center Axis
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
        ctx.beginPath();
        ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
        ctx.stroke();

        // Galactic Center Core Glow
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50 * currentScale);
        coreGrad.addColorStop(0, 'rgba(168, 85, 247, 0.15)');
        coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50 * currentScale, 0, Math.PI * 2);
        ctx.fill();

        // Current system indicator halo & Range Circles
        const currentSys = systems.find(s => s.id === STATE.currentSystemId) || systems[0];
        if (currentSys) {
            const curScreenX = centerX + currentSys.x * currentScale;
            const curScreenY = centerY + currentSys.z * currentScale;

            // Draw Warp Range Circle (Cyan dashed)
            const warpRadiusScreen = STATE.warpRange * currentScale;
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, warpRadiusScreen, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Psionic Detection Circle (Magenta dotted)
            const psioRadiusScreen = STATE.psionicRange * currentScale;
            ctx.strokeStyle = 'rgba(217, 70, 239, 0.35)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, psioRadiusScreen, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pulsing current ship beacon
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, 14 * Math.min(1.5, Math.max(0.7, mapZoom)) + Math.sin(Date.now() * 0.006) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        hoverSystem = null;

        systems.forEach(sys => {
            const screenX = centerX + sys.x * currentScale;
            const screenY = centerY + sys.z * currentScale;

            if (screenX < -30 || screenX > width + 30 || screenY < -30 || screenY > height + 30) {
                return;
            }

            const dxFromCur = sys.x - currentSys.x;
            const dzFromCur = sys.z - currentSys.z;
            const distFromCur = Math.sqrt(dxFromCur * dxFromCur + dzFromCur * dzFromCur);

            const inWarpRange = distFromCur <= STATE.warpRange;
            const inPsionicRange = distFromCur <= STATE.psionicRange;

            const dx = mouseX - screenX;
            const dy = mouseY - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const isSelected = selectedSystem && selectedSystem.id === sys.id;
            const isActive = STATE.currentSystemId === sys.id;
            const hasSentient = sys.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));

            // Only show thought beacon if sentient life exists AND is within the Psionic Sensor Range!
            const showLifeBeacon = hasSentient && inPsionicRange;

            if (filterLifeOnly && !showLifeBeacon && !isActive && !isSelected) {
                ctx.globalAlpha = 0.08;
            } else if (!inWarpRange && !isActive && !isSelected) {
                ctx.globalAlpha = 0.45; // Dim out-of-range stars
            } else {
                ctx.globalAlpha = 1.0;
            }

            let baseSize = 2.8 * Math.min(1.6, Math.max(0.7, mapZoom));
            if (isActive) baseSize = 4.8;
            if (isSelected) baseSize = 6.0;

            if (dist < 10) {
                hoverSystem = sys;
                baseSize += 2.5;
            }

            // --- PSIONIC THOUGHT BEACON (Only if within Psionic Range!) ---
            if (showLifeBeacon) {
                const glowR = (baseSize + 14) * Math.min(1.4, Math.max(0.8, mapZoom));
                const glowGrad = ctx.createRadialGradient(screenX, screenY, baseSize, screenX, screenY, glowR);
                glowGrad.addColorStop(0, 'rgba(217, 70, 239, 0.45)');
                glowGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.15)');
                glowGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
                ctx.fill();

                const timeSec = (Date.now() % 2400) / 2400;
                for (let w = 0; w < 2; w++) {
                    const waveProg = (timeSec + w * 0.5) % 1.0;
                    const waveR = baseSize + 2 + waveProg * 14 * Math.min(1.4, Math.max(0.8, mapZoom));
                    const waveAlpha = (1.0 - waveProg) * 0.85;
                    ctx.strokeStyle = `rgba(217, 70, 239, ${waveAlpha})`;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, waveR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.fillStyle = '#f472b6';
                ctx.font = 'bold 8px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧠', screenX, screenY + baseSize + 9);
            }

            let starColor = '#f59e0b';
            if (sys.star.type === 'Blue Giant') starColor = '#3b82f6';
            if (sys.star.type === 'Red Dwarf') starColor = '#ef4444';
            if (sys.star.type === 'White Dwarf') starColor = '#cbd5e1';
            if (sys.star.type === 'Black Hole') starColor = '#8b5cf6';

            if (isSelected) {
                ctx.fillStyle = inWarpRange ? 'rgba(168, 85, 247, 0.4)' : 'rgba(239, 68, 68, 0.3)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = inWarpRange ? '#e879f9' : '#f87171';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (isActive) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = starColor;
            ctx.beginPath();
            ctx.arc(screenX, screenY, baseSize, 0, Math.PI * 2);
            ctx.fill();

            // Smart LOD Labeling: Only show labels if selected, active, hovered, or when zoomed in!
            const shouldShowLabel = isSelected || isActive || dist < 10 || (mapZoom > 2.0) || (showLifeBeacon && mapZoom > 1.2);
            if (shouldShowLabel) {
                ctx.fillStyle = isSelected ? (inWarpRange ? '#e879f9' : '#f87171') : (isActive ? '#38bdf8' : (showLifeBeacon ? '#f8fafc' : '#94a3b8'));
                ctx.font = isSelected ? 'bold 9px Orbitron, sans-serif' : '8px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(sys.name, screenX, screenY - baseSize - 4);
            }
        });

        ctx.globalAlpha = 1.0;

        // Hover tooltip
        if (hoverSystem) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
            ctx.strokeStyle = 'rgba(217, 70, 239, 0.6)';
            ctx.lineWidth = 1.5;

            const tooltipX = mouseX + 15;
            const tooltipY = mouseY - 15;
            const hasSentient = hoverSystem.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
            const text = `${hoverSystem.name} (${hoverSystem.star.type}) ${hasSentient ? '🧠 Leben' : ''}`;

            ctx.font = '9.5px Orbitron, sans-serif';
            const textWidth = ctx.measureText(text).width;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(tooltipX, tooltipY - 18, textWidth + 20, 24, 5);
            } else {
                ctx.rect(tooltipX, tooltipY - 18, textWidth + 20, 24);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(text, tooltipX + 10, tooltipY - 2);
        }
    };

    // --- INTERACTIVE ZOOM & PAN CONTROLS ---
    canvas.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.min(5.0, Math.max(0.6, mapZoom * zoomFactor));
        mapZoom = newZoom;
    };

    canvas.onmousedown = (e) => {
        isDraggingMap = true;
        dragStartX = e.clientX - mapPanX;
        dragStartY = e.clientY - mapPanY;
    };

    window.addEventListener('mouseup', () => {
        isDraggingMap = false;
    });

    canvas.onmousemove = (e) => {
        const mRect = canvas.getBoundingClientRect();
        mapMouseX = e.clientX - mRect.left;
        mapMouseY = e.clientY - mRect.top;

        if (isDraggingMap) {
            mapPanX = e.clientX - dragStartX;
            mapPanY = e.clientY - dragStartY;
        }
    };

    canvas.ondblclick = () => {
        mapZoom = 1.0;
        mapPanX = 0;
        mapPanY = 0;
    };

    canvas.onmouseleave = () => {
        mapMouseX = -1;
        mapMouseY = -1;
    };

    canvas.onclick = () => {
        if (hoverSystem) {
            selectedSystem = hoverSystem;
            updateSystemDetails(selectedSystem);
            populateQuickBeaconsList();
            playSiliconCollectSound();
        }
    };

    // Attach Warp Button & Life Filter listeners once
    const warpBtn = document.getElementById('warp-btn');
    if (warpBtn && !warpBtn.dataset.listenerAttached) {
        warpBtn.dataset.listenerAttached = 'true';
        warpBtn.addEventListener('click', () => {
            if (selectedSystem) {
                warpToSystem(selectedSystem.id);
            }
        });
    }

    const lifeFilterBtn = document.getElementById('life-filter-toggle-btn');
    if (lifeFilterBtn && !lifeFilterBtn.dataset.listenerAttached) {
        lifeFilterBtn.dataset.listenerAttached = 'true';
        lifeFilterBtn.addEventListener('click', () => {
            filterLifeOnly = !filterLifeOnly;
            if (filterLifeOnly) {
                lifeFilterBtn.classList.add('filter-active');
                lifeFilterBtn.innerText = "🧠 Gedanken-Echo Filter: AN";
            } else {
                lifeFilterBtn.classList.remove('filter-active');
                lifeFilterBtn.innerText = "🧠 Gedanken-Echo Filter: AUS";
            }
        });
    }
}

export function populateQuickBeaconsList() {
    const listEl = document.getElementById('psionic-beacons-quick-list');
    if (!listEl || !STATE.universe) return;

    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];

    const livingSystems = STATE.universe.systems
        .map(s => {
            const dx = s.x - currentSys.x;
            const dz = s.z - currentSys.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            return { system: s, dist: dist };
        })
        .filter(entry => {
            const hasSentient = entry.system.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
            return hasSentient && entry.dist <= STATE.psionicRange;
        })
        .sort((a, b) => a.dist - b.dist);
    
    if (livingSystems.length === 0) {
        listEl.innerHTML = `<li style="font-size: 0.72rem; color: #64748b; padding: 6px; text-align: center;">Keine Gedanken-Echos im Sensorradius (${STATE.psionicRange} LJ) geortet.<br><span style="color: #a855f7; font-size: 0.65rem;">Reise näher heran oder erweitere Synapsen!</span></li>`;
        return;
    }

    let html = '';
    livingSystems.forEach(entry => {
        const sys = entry.system;
        const habPlanet = sys.planets.find(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
        let specName = "Habitables Ökosystem";
        if (habPlanet && habPlanet.species && habPlanet.species.name) {
            specName = habPlanet.species.name;
        }
        const isSel = selectedSystem && selectedSystem.id === sys.id;
        const inWarp = entry.dist <= STATE.warpRange;
        
        html += `
            <li class="beacon-quick-item ${isSel ? 'active-item' : ''}" data-sys-id="${sys.id}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="beacon-sys-name">✨ ${sys.name}</span>
                    <span style="font-size: 0.65rem; color: ${inWarp ? '#38bdf8' : '#f87171'};">${entry.dist.toFixed(0)} LJ</span>
                </div>
                <span class="beacon-species-tag">${specName}</span>
            </li>
        `;
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.beacon-quick-item').forEach(item => {
        item.addEventListener('click', () => {
            const sysId = parseInt(item.getAttribute('data-sys-id') || '0');
            const target = STATE.universe?.systems.find(s => s.id === sysId);
            if (target) {
                selectedSystem = target;
                updateSystemDetails(selectedSystem);
                populateQuickBeaconsList();
                playSiliconCollectSound();
            }
        });
    });
}

export function updateSystemDetails(sys: StarSystem | null) {
    const placeholder = document.getElementById('detail-system-placeholder');
    const statsPanel = document.getElementById('detail-system-stats');

    if (!sys || !STATE.universe) {
        if (placeholder) placeholder.style.display = 'flex';
        if (statsPanel) statsPanel.style.display = 'none';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (statsPanel) statsPanel.style.display = 'flex';

    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];
    const dx = sys.x - currentSys.x;
    const dz = sys.z - currentSys.z;
    const distFromCur = Math.sqrt(dx * dx + dz * dz);
    const inWarpRange = distFromCur <= STATE.warpRange;
    const inPsionicRange = distFromCur <= STATE.psionicRange;

    const nameEl = document.getElementById('detail-system-name');
    const coordXEl = document.getElementById('val-coord-x');
    const coordZEl = document.getElementById('val-coord-z');
    const starTypeEl = document.getElementById('val-star-type');
    const starMassEl = document.getElementById('val-star-mass');
    const planetCountEl = document.getElementById('val-planet-count');

    if (nameEl) nameEl.innerText = sys.name;
    if (coordXEl) coordXEl.innerText = String(sys.x);
    if (coordZEl) coordZEl.innerText = String(sys.z);
    if (starTypeEl) starTypeEl.innerText = sys.star.type;
    if (starMassEl) starMassEl.innerText = sys.star.mass + " SM";
    if (planetCountEl) planetCountEl.innerText = String(sys.planets.length);

    // Update Psionic Resonance details
    const hasSentient = sys.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
    const resRow = document.getElementById('detail-psionic-resonance');
    if (resRow) {
        if (hasSentient && inPsionicRange) {
            resRow.innerHTML = `<span style="color: #d946ef; font-weight: bold;">📶 Starke neuronale Resonanz</span> <span style="color: #cbd5e1; font-size: 0.65rem;">(Intelligentes Leben, ${distFromCur.toFixed(0)} LJ)</span>`;
        } else if (hasSentient && !inPsionicRange) {
            resRow.innerHTML = `<span style="color: #64748b; font-size: 0.72rem;">❓ Außerhalb Psio-Horizont (${distFromCur.toFixed(0)} / ${STATE.psionicRange} LJ)</span>`;
        } else {
            resRow.innerHTML = `<span style="color: #64748b; font-size: 0.72rem;">✖️ Keine Gedanken-Echos (Stille)</span>`;
        }
    }

    const list = document.getElementById('val-planets-list');
    if (list) {
        list.innerHTML = "";
        sys.planets.forEach(p => {
            const li = document.createElement('li');

            let pColor = '#94a3b8';
            if (p.type === 'Gas Giant') pColor = '#c084fc';
            if (p.type === 'Habitable') pColor = '#10b981';

            li.innerHTML = `
                <span>
                    <span class="planet-indicator-dot" style="background-color: ${pColor};"></span>
                    ${p.name}
                </span>
                <span style="color: #64748b; font-size: 0.65rem;">${p.type} (${p.size}x)</span>
            `;
            list.appendChild(li);
        });
    }

    const costMult = STATE.mutations.folddrive && STATE.mutations.folddrive.purchased ? 0.7 : 1.0;
    const warpCost = Math.round((15 + distFromCur * 0.15) * costMult);

    const warpBtn = document.getElementById('warp-btn') as HTMLButtonElement;
    if (warpBtn) {
        if (sys.id === STATE.currentSystemId) {
            warpBtn.disabled = true;
            warpBtn.innerText = "Etablierter Standort";
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else if (!inWarpRange) {
            warpBtn.disabled = true;
            warpBtn.innerText = `❌ Zu weit entfernt (${distFromCur.toFixed(0)} / Max ${STATE.warpRange} LJ)`;
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else if (STATE.bioEnergy < warpCost) {
            warpBtn.disabled = true;
            warpBtn.innerText = `⚡ Zu wenig Bio-Energie (${warpCost}% nötig)`;
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else {
            warpBtn.disabled = false;
            warpBtn.innerText = `🌀 Quantenfeld falten (${distFromCur.toFixed(0)} LJ | -${warpCost}% Energie)`;
            warpBtn.style.opacity = "1";
            warpBtn.style.pointerEvents = "auto";
        }
    }
}

export function warpToSystem(systemId: number) {
    if (!STATE.universe) return;
    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];
    const targetSys = STATE.universe.systems.find(s => s.id === systemId);
    if (!targetSys) return;

    const dx = targetSys.x - currentSys.x;
    const dz = targetSys.z - currentSys.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > STATE.warpRange) {
        addLogEntry("SYSTEM", `Hypersprung abgebrochen: Distanz zu ${targetSys.name} (${dist.toFixed(0)} LJ) überschreitet maximale Faltungsreichweite (${STATE.warpRange} LJ)!`);
        return;
    }

    const costMult = STATE.mutations.folddrive && STATE.mutations.folddrive.purchased ? 0.7 : 1.0;
    const warpCost = Math.round((15 + dist * 0.15) * costMult);

    if (STATE.bioEnergy < warpCost) {
        addLogEntry("SYSTEM", `Hypersprung abgebrochen: Nicht genügend Bio-Energie (${warpCost}% benötigt, aktuell ${Math.round(STATE.bioEnergy)}%)!`);
        return;
    }

    // Deduct calculated Warp Bio-Energy cost
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - warpCost);

    const warpOverlay = document.getElementById('warp-overlay');
    if (warpOverlay) {
        warpOverlay.style.display = 'flex';
        warpOverlay.style.opacity = '1';
    }

    // Stop engine rumble during warp
    setThrusterSound(false);
    // Play heavy warp crash/rumble audio feedback
    playCrashSound();

    // Fast 600ms hyperspace jump
    setTimeout(() => {
        STATE.currentSystemId = systemId;
        STATE.systemsVisited++;
        const activeSystem = STATE.universe!.systems[systemId];

        // Clear current and spawn new
        clearActiveSystem();
        spawnPlanetsAndAsteroids();

        // Reset player in safe orbit
        STATE.playerPosition.set(0, 0, 65);
        STATE.playerVelocity.set(5, 0, 0);
        if (STATE.playerGroup) {
            STATE.playerGroup.position.set(0, 0, 65);
        }

        addLogEntry("SYSTEM", `Hypersprung abgeschlossen. Raumfaltung um ${activeSystem.name} (${dist.toFixed(0)} LJ, -${warpCost}% Energie) stabilisiert.`);

        // Close panels
        if (warpOverlay) {
            warpOverlay.style.display = 'none';
        }
        toggleGalaxyMap();
    }, 600);
}

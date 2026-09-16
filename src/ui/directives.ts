import { STATE } from '../core/state';
import { addLogEntry } from './hud';

export interface DirectiveItem {
    id: number;
    badge: string;
    title: string;
    instruction: string;
    hint: string;
}

export const FTUE_DIRECTIVES: DirectiveItem[] = [
    {
        id: 0,
        badge: "PHASE 1",
        title: "Lebensfunke",
        instruction: "Bewege die Najmafar mit [W/A/S/D] oder [Maus-Lenkung]",
        hint: "Aktiviere den Bio-Schub und richte deine Sinnesorgane aus."
    },
    {
        id: 1,
        badge: "PHASE 2",
        title: "Archaisches Signal",
        instruction: "Folge dem goldenen Radar-Signal & Scanne Voyager 2 mit [F] oder [Klick]",
        hint: "Ein uraltes Artefakt (Voyager 2) treibt im Sektor. Halte Abstand < 22 AE."
    },
    {
        id: 2,
        badge: "PHASE 3",
        title: "Funke der Hoffnung",
        instruction: "Öffne die Golden Record im Dialog & höre die Botschaft der Erde",
        hint: "Die Klänge der Menschheit vertreiben die Depression (+50% Mentalkraft)."
    },
    {
        id: 3,
        badge: "PHASE 4",
        title: "Aufbruch ins Leben",
        instruction: "Öffne die Sternenkarte [M] – Kurs auf System mit Biosphäre",
        hint: "Im Startsystem gibt es kein Leben. Finde eine bewohnbare Welt im Nachbarsystem!"
    },
    {
        id: 4,
        badge: "PHASE 5",
        title: "Der erste Wirt",
        instruction: "Scanne eine bewohnte Welt & führe eine Entführung [F] durch",
        hint: "Übernehme ein intelligentes Wesen in deine Kokon-Matrix gegen die Einsamkeit."
    }
];

let isCollapsed = false;

export function initDirectivesHUD() {
    const toggleBtn = document.getElementById('toggle-directives-btn');
    const container = document.getElementById('hud-directives');

    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            container.classList.toggle('collapsed', isCollapsed);
            toggleBtn.innerText = isCollapsed ? '📋' : '➖';
        });
    }

    renderDirectives();
}

export function renderDirectives() {
    const container = document.getElementById('directives-list');
    if (!container) return;

    const currentStep = STATE.ftueStep || 0;

    let html = '';
    FTUE_DIRECTIVES.forEach((d) => {
        const isDone = d.id < currentStep;
        const isActive = d.id === currentStep;
        const isLocked = d.id > currentStep;

        const statusClass = isDone ? 'done' : (isActive ? 'active' : 'locked');
        const checkmark = isDone ? '✔' : (isActive ? '◉' : '○');

        html += `
            <div class="directive-card ${statusClass}" data-step="${d.id}">
                <div class="directive-status-icon">${checkmark}</div>
                <div class="directive-body">
                    <div class="directive-header">
                        <span class="directive-badge">${d.badge}</span>
                        <span class="directive-title">${d.title}</span>
                    </div>
                    <div class="directive-instruction">${d.instruction}</div>
                    ${isActive ? `<div class="directive-hint">${d.hint}</div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

export function advanceFtueStep(targetStep: number) {
    const current = STATE.ftueStep || 0;
    if (targetStep > current) {
        STATE.ftueStep = targetStep;

        // Flash celebratory animation or log
        const completedDirective = FTUE_DIRECTIVES[current];
        if (completedDirective) {
            addLogEntry("SYSTEM", `Direktive erfüllt: [${completedDirective.title}] ✔`);
        }

        if (targetStep >= FTUE_DIRECTIVES.length) {
            STATE.ftueCompleted = true;
            addLogEntry("SYSTEM", "Alle Einführungs-Direktiven abgeschlossen. Das Schicksal der Galaxie liegt in deinen Händen.");
        }

        renderDirectives();
    }
}

export function updateVoyagerHUDTracker() {
    const trackerEl = document.getElementById('voyager-nav-tracker');
    if (!trackerEl) return;

    // Show tracker if Voyager is in system, not yet scanned or active step is 1
    if (!STATE.voyagerProbe || STATE.voyagerScanned) {
        trackerEl.style.display = 'none';
        return;
    }

    const playerPos = STATE.playerPosition;
    const probePos = STATE.voyagerProbe.position;
    if (!playerPos || !probePos) return;

    const dx = probePos.x - playerPos.x;
    const dz = probePos.z - playerPos.z;
    const dist = Math.hypot(dx, dz);

    trackerEl.style.display = 'flex';

    const distEl = document.getElementById('voyager-nav-dist');
    const angleEl = document.getElementById('voyager-nav-arrow');

    if (distEl) {
        distEl.innerText = `${dist.toFixed(1)} AE`;
    }

    if (angleEl) {
        // Calculate relative angle from ship heading
        const targetAngle = Math.atan2(dz, dx);
        const heading = STATE.shipHeading || 0;
        const relativeAngleDeg = ((targetAngle - heading) * 180 / Math.PI);
        angleEl.style.transform = `rotate(${relativeAngleDeg}deg)`;
    }
}

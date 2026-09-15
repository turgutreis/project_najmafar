import { STATE } from '../core/state';
import { CrewMember } from '../types/game';
import { rejuvenateCrewMember } from '../systems/crew';

let lastRenderedCrewIds = '';

/**
 * Renders and live-updates the RPG Party-Grid HUD on the left edge of the screen
 */
export function updatePartyGrid(): void {
    const container = document.getElementById('hud-party-grid');
    if (!container) return;

    const crew = STATE.crew;
    if (!crew || crew.length === 0) {
        if (container.innerHTML !== '') {
            container.innerHTML = '';
            lastRenderedCrewIds = '';
        }
        return;
    }

    // Check if member IDs or order changed
    const currentCrewIds = crew.map(c => `${c.id}_${c.ageCategory}`).join('|');
    const structureChanged = currentCrewIds !== lastRenderedCrewIds;

    if (structureChanged) {
        lastRenderedCrewIds = currentCrewIds;
        container.innerHTML = crew.map(c => renderPartyCard(c)).join('');
        attachPartyGridEvents();
    } else {
        // Fast DOM live-update for age bars, percentages, and status
        crew.forEach(c => {
            const card = document.getElementById(`party-card-${c.id}`);
            if (!card) return;

            const maxLife = c.maxLifespan || 540;
            const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
            const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

            // Color coding
            let barColor = '#10b981'; // Green
            if (lifePercent < 15) barColor = '#ef4444'; // Red
            else if (lifePercent < 45) barColor = '#f59e0b'; // Amber

            const ageBar = card.querySelector<HTMLElement>('.party-age-fill');
            if (ageBar) {
                ageBar.style.width = `${lifePercent}%`;
                ageBar.style.backgroundColor = barColor;
            }

            const ageText = card.querySelector<HTMLElement>('.party-age-val');
            if (ageText) {
                ageText.innerText = `${lifePercent}%`;
                ageText.style.color = barColor;
            }

            const stressBar = card.querySelector<HTMLElement>('.party-stress-fill');
            if (stressBar) {
                stressBar.style.width = `${Math.min(100, Math.round(c.stress))}%`;
            }

            const stabilityBar = card.querySelector<HTMLElement>('.party-stability-fill');
            if (stabilityBar) {
                stabilityBar.style.width = `${Math.min(100, Math.round(c.illusionStability))}%`;
            }

            // Critical age pulse class
            if (lifePercent <= 10 || c.ageCategory === 'critical') {
                if (!card.classList.contains('critical-pulse')) {
                    card.classList.add('critical-pulse');
                }
            } else {
                card.classList.remove('critical-pulse');
            }
        });
    }
}

function renderPartyCard(c: CrewMember): string {
    const maxLife = c.maxLifespan || 540;
    const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
    const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

    let barColor = '#10b981';
    if (lifePercent < 15) barColor = '#ef4444';
    else if (lifePercent < 45) barColor = '#f59e0b';

    const isCritical = lifePercent <= 10 || c.ageCategory === 'critical';
    const speciesColor = c.speciesColor || '#38bdf8';
    const avatar = c.avatarIcon || '👤';
    const station = c.stationName || c.roleName || c.role;
    const traitText = c.trait ? `${c.trait.name}: ${c.trait.desc}` : (c.perk || c.buffDesc);

    return `
        <div id="party-card-${c.id}" class="party-card glass-panel ${isCritical ? 'critical-pulse' : ''}" data-crew-id="${c.id}">
            <!-- Left Portrait Badge -->
            <div class="party-portrait" style="--species-glow: ${speciesColor}">
                <div class="party-avatar-ring">
                    <span class="party-avatar-icon">${avatar}</span>
                </div>
                <div class="party-station-icon" title="${station}">${c.roleIcon || '⚙️'}</div>
            </div>

            <!-- Card Body / Vital Details -->
            <div class="party-details">
                <div class="party-top-row">
                    <span class="party-name" title="${c.name} (${c.species})">${c.name}</span>
                    <button class="party-rejuv-btn" data-rejuv-id="${c.id}" title="Zell-Verjüngung (-35% Alter, Kosten: 20 Bio / 10 Biomasse)">💉</button>
                </div>
                <div class="party-station-label">${station}</div>

                <!-- Lifespan Bar -->
                <div class="party-meter-row" title="Biologische Vitalität / Restlebensspanne">
                    <span class="party-meter-label">⏳</span>
                    <div class="party-meter-track">
                        <div class="party-age-fill" style="width: ${lifePercent}%; background-color: ${barColor};"></div>
                    </div>
                    <span class="party-age-val" style="color: ${barColor};">${lifePercent}%</span>
                </div>

                <!-- Dual Micro Meters: Stability & Stress -->
                <div class="party-micro-meters">
                    <div class="micro-meter" title="Traum-Stabilität: ${Math.round(c.illusionStability)}%">
                        <span class="micro-label">🔮</span>
                        <div class="micro-track">
                            <div class="party-stability-fill" style="width: ${Math.round(c.illusionStability)}%;"></div>
                        </div>
                    </div>
                    <div class="micro-meter" title="Stress: ${Math.round(c.stress)}%">
                        <span class="micro-label">⚡</span>
                        <div class="micro-track">
                            <div class="party-stress-fill" style="width: ${Math.round(c.stress)}%;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rich Tooltip on Hover -->
            <div class="party-card-tooltip">
                <div class="tooltip-header">
                    <strong>${c.name}</strong>
                    <span style="color: ${speciesColor}; font-size: 0.7rem;">${c.species}</span>
                </div>
                <div class="tooltip-row"><strong>Station:</strong> ${station}</div>
                <div class="tooltip-row"><strong>Eigenschaft:</strong> ${traitText}</div>
                <div class="tooltip-row"><strong>Alter:</strong> ${Math.floor(currentAge / 60)}:${String(currentAge % 60).padStart(2, '0')} / ${Math.floor(maxLife / 60)}:00 Min.</div>
                <div class="tooltip-thought">💭 <em>"${c.thought}"</em></div>
            </div>
        </div>
    `;
}

function attachPartyGridEvents(): void {
    const rejuvBtns = document.querySelectorAll<HTMLButtonElement>('.party-rejuv-btn');
    rejuvBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute('data-rejuv-id'));
            if (id) {
                rejuvenateCrewMember(id);
                updatePartyGrid();
            }
        };
    });
}

/**
 * Triggers an unmissable tribute and dissolution banner when a crew member passes away
 */
export function triggerCrewDeathNotification(name: string, species: string, avatar: string = '👤'): void {
    const container = document.getElementById('crew-death-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'crew-death-toast';
    toast.innerHTML = `
        <div class="death-toast-left">
            <span class="death-avatar">${avatar}</span>
            <div class="death-aura-circle"></div>
        </div>
        <div class="death-toast-content">
            <div class="death-kicker">⚰️ BIOLOGISCHER ZELLTOD & RESORPTION</div>
            <div class="death-title">${name}</div>
            <div class="death-meta">${species} ist friedlich in den Nährstoffkreislauf des Rumpfes übergegangen.</div>
            <div class="death-resorption-badge">+45 Bio-Energie resorbiert</div>
        </div>
        <button class="death-toast-dismiss" title="Schließen">✕</button>
    `;

    const dismissBtn = toast.querySelector('.death-toast-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            toast.classList.add('dissolve-out');
            setTimeout(() => toast.remove(), 400);
        });
    }

    container.appendChild(toast);

    // Auto dismiss after 7 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('dissolve-out');
            setTimeout(() => toast.remove(), 400);
        }
    }, 7000);
}

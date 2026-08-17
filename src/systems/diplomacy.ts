import { PlanetEntry, FactionId } from '../types/game';
import { STATE } from '../core/state';
import { getFaction, modifyReputation, getReputationTitle } from './factions';
import { addLogEntry } from '../ui/hud';
import { playSiliconCollectSound, playBioCollectSound } from '../engine/audio';

const ALIEN_GLYPHS = ["⍝", "⏁", "⍀", "⏃", "⋏", "⌇", "⌰", "⏃", "⏁", "⟟", "⍜", "⋏", "⍾", "⎍", "⏃", "⋏", "⏁", "⎍", "⋔", "Ψ", "Ω", "Δ", "Ξ", "Φ", "λ", "θ", "π", "Σ"];

function generateAlienGlyphs(length = 120): string {
    let s = "";
    for (let i = 0; i < length; i++) {
        s += ALIEN_GLYPHS[Math.floor(Math.random() * ALIEN_GLYPHS.length)];
        if (i % 8 === 0 && i > 0) s += " ";
    }
    return s;
}

export function openDiplomacyComms(planet: PlanetEntry) {
    if (!planet || !planet.attributes.species) return;

    STATE.activeDiplomacyPlanet = planet;
    const spec = planet.attributes.species;
    const factionId: FactionId = spec.factionId || (spec.quantumCiv ? spec.quantumCiv.factionId : 'free_traders');
    const faction = getFaction(factionId);
    const repScore = STATE.reputation[factionId] || 0;
    const repInfo = getReputationTitle(repScore);

    const hasTranslator = STATE.mutations.translator && STATE.mutations.translator.purchased;

    const overlay = document.getElementById('diplomacy-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    // Header & Species Info
    const headerTitle = document.getElementById('diplomacy-planet-name');
    const factionEmblem = document.getElementById('diplomacy-faction-emblem');
    const factionName = document.getElementById('diplomacy-faction-name');
    const repBadge = document.getElementById('diplomacy-rep-badge');

    if (headerTitle) headerTitle.innerText = `${planet.name} – ${spec.name}`;
    if (factionEmblem) factionEmblem.innerText = faction.emblem;
    if (factionName) {
        factionName.innerText = faction.name;
        factionName.style.color = faction.colorCss;
    }
    if (repBadge) {
        repBadge.innerText = `${repInfo.label} (${repScore > 0 ? '+' : ''}${repScore})`;
        repBadge.style.color = repInfo.color;
    }

    // Dialogue Content
    const dialogueBox = document.getElementById('diplomacy-dialogue-text');
    const historyBox = document.getElementById('diplomacy-history-chronicle');

    if (dialogueBox) {
        if (!hasTranslator) {
            dialogueBox.innerHTML = `
                <div class="untranslated-warning">⚠️ KEIN DSCHINN-ÜBERSETZER AKTIV: Übertragungsfrequenz stark verschlüsselt.</div>
                <div class="alien-glyph-stream">${generateAlienGlyphs(160)}</div>
                <div class="translator-hint">Kaufe die Mutation 'Dschinn-Übersetzer' im Evolutions-Deck, um Sprache, Absichten und Quests zu verstehen.</div>
            `;
        } else {
            let greeting = "";
            if (spec.quantumCiv && spec.quantumCiv.worshipsPlayer) {
                greeting = `„O Reisende aus dem gefalteten Raum! Unsere Synapsen-Priester haben dein Erscheinen im Quanten-Rauschen vorhergesagt. Dein lebendiger Leib trägt das Erbe der Ur-Schöpfer. Wie dürfen wir deinem Glanz dienen?“`;
            } else if (repScore < -40) {
                greeting = `„Achtung, bio-organische Anomalie! Deine Entführungen und Grenzverletzungen sind im gesamten Sektor registriert. Drehe sofort ab, oder unsere planetaren Railguns eröffnen das Feuer!“`;
            } else if (factionId === 'vega_collective') {
                greeting = `„Logische Grußsequenz initiiert. Wir registrieren eine 99.4% nicht-mechanische Entropie-Signatur in deinem Kern. Wir schlagen einen Datenaustausch von Silizium-Ressourcen gegen Hyperraum-Telemetrie vor.“`;
            } else if (factionId === 'xenomilitary_ash') {
                greeting = `„Hier spricht die Grenzkontrolle der Asche-Gilde. Halte deine Tentakel in neutraler Position. Wir tolerieren keine psionischen Übergriffe in diesem System.“`;
            } else {
                greeting = `„Willkommen im Orbit von ${planet.name}, fremder Wanderer! Unsere Handelsgilden sind bereit, Rohstoffe auszutauschen und deine Hülle zu versorgen.“`;
            }

            dialogueBox.innerHTML = `
                <p class="translated-speech">${greeting}</p>
                <div class="quantum-entanglement-tag">
                    ⚛️ ${spec.quantumCiv ? spec.quantumCiv.quantumCollapseLog : 'Quanten-Resonanz stabil'}
                </div>
            `;
        }
    }

    // History Chronicle tab
    if (historyBox) {
        if (spec.quantumCiv && spec.quantumCiv.historyEras) {
            historyBox.innerHTML = spec.quantumCiv.historyEras.map(era => `
                <div class="era-chronicle-item">
                    <span class="era-title">📜 ${era.eraName}</span>
                    <p class="era-desc">${era.event}</p>
                    <span class="era-paradox">🌀 Quanten-Paradoxon: ${era.paradoxDetail}</span>
                </div>
            `).join('');
        } else {
            historyBox.innerHTML = `<p style="color: #64748b;">Keine historischen Aufzeichnungen im aktuellen Sektor gefunden.</p>`;
        }
    }

    renderDiplomacyActions(planet, factionId);
}

function renderDiplomacyActions(planet: PlanetEntry, factionId: FactionId) {
    const actionsContainer = document.getElementById('diplomacy-actions-container');
    if (!actionsContainer) return;

    actionsContainer.innerHTML = "";

    // Action 1: Peaceful Resource Trade
    const tradeBtn = document.createElement('button');
    tradeBtn.className = 'diplo-action-btn trade';
    tradeBtn.innerHTML = `<span>🔄 Ressourcen-Tausch (40 Silizium ➔ 45 Bio)</span><span class="diplo-badge">+8 Rep</span>`;
    tradeBtn.onclick = () => {
        if (STATE.siliconRes >= 40) {
            STATE.siliconRes -= 40;
            STATE.bioRes += 45;
            playBioCollectSound();
            modifyReputation(factionId, 8, `Erfolgreicher Handelsvertrag mit ${planet.name}.`);
            openDiplomacyComms(planet);
        } else {
            addLogEntry("SYSTEM", "Zu wenig Silizium für diesen Handel (40 benötigt)!");
        }
    };
    actionsContainer.appendChild(tradeBtn);

    // Action 2: Tribute to Deity / Offering
    const tributeBtn = document.createElement('button');
    tributeBtn.className = 'diplo-action-btn tribute';
    tributeBtn.innerHTML = `<span>🎁 Friedens-Tribut darbringen (30 Bio opfern)</span><span class="diplo-badge">+15 Rep</span>`;
    tributeBtn.onclick = () => {
        if (STATE.bioRes >= 30) {
            STATE.bioRes -= 30;
            STATE.health = Math.min(STATE.maxHealth, STATE.health + 25);
            playSiliconCollectSound();
            modifyReputation(factionId, 15, `Großzügiger Tribut an ${planet.name} übergeben (+25 HP Hüllenreparatur).`);
            openDiplomacyComms(planet);
        } else {
            addLogEntry("SYSTEM", "Zu wenig Biomasse für Tribut (30 benötigt)!");
        }
    };
    actionsContainer.appendChild(tributeBtn);

    // Action 3: Psionic Blessing
    const blessingBtn = document.createElement('button');
    blessingBtn.className = 'diplo-action-btn psionic';
    blessingBtn.innerHTML = `<span>🧠 Telepathischer Segen (25 Mentalkraft)</span><span class="diplo-badge">+20 Rep</span>`;
    blessingBtn.onclick = () => {
        if (STATE.mentalEnergy >= 25) {
            STATE.mentalEnergy -= 25;
            STATE.crew.forEach(c => c.stress = Math.max(0, c.stress - 20));
            modifyReputation(factionId, 20, `Telepathischer Segen harmonisiert planetare Geister (-20 Crew-Stress).`);
            openDiplomacyComms(planet);
        } else {
            addLogEntry("SYSTEM", "Zu wenig Mentalkraft für telepathischen Segen (25% benötigt)!");
        }
    };
    actionsContainer.appendChild(blessingBtn);

    // Action 4: Threaten & Demand Surrender
    const threatBtn = document.createElement('button');
    threatBtn.className = 'diplo-action-btn threat';
    threatBtn.innerHTML = `<span>⚔️ Drohung & Unterwerfung fordern</span><span class="diplo-badge danger">-30 Rep</span>`;
    threatBtn.onclick = () => {
        modifyReputation(factionId, -30, `Kriegerische Drohung gegen ${planet.name} ausgesprochen! Alarmstufe erhöht.`);
        closeDiplomacyComms();
    };
    actionsContainer.appendChild(threatBtn);
}

export function closeDiplomacyComms() {
    const overlay = document.getElementById('diplomacy-overlay');
    if (overlay) overlay.style.display = 'none';
    STATE.activeDiplomacyPlanet = null;
}

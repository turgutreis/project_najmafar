import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';

export function calculateCrewBuffs() {
    let thrustMult = 1.0;
    let bioMult = 1.0;
    let scanMult = 1.0;
    let repair = 0;
    let stressDamp = 1.0;
    let psioBonus = 0;

    const hiveBonus = STATE.mutations.hivemind && STATE.mutations.hivemind.purchased ? 1.2 : 1.0;

    STATE.crew.forEach(c => {
        if (c.role === 'pilot') thrustMult += 0.15 * hiveBonus;
        if (c.role === 'biologist') {
            bioMult += 0.30 * hiveBonus;
            scanMult += 0.25 * hiveBonus;
        }
        if (c.role === 'engineer') repair += 0.6 * hiveBonus;
        if (c.role === 'psychologist') stressDamp *= (1.0 - 0.40 * hiveBonus);
        if (c.role === 'cryptologist') psioBonus += 30 * hiveBonus;
    });

    STATE.crewBuffs = {
        thrust: thrustMult,
        bioGain: bioMult,
        scanSpeed: scanMult,
        repairRate: repair,
        stressDampening: stressDamp,
        psionicBonus: Math.round(psioBonus)
    };

    const basePsio = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 140 : 75;
    STATE.psionicRange = basePsio + STATE.crewBuffs.psionicBonus;
}

export function renderCrewUI() {
    const container = document.getElementById('crew-list-container');
    const badge = document.getElementById('crew-count-badge');
    const capText = document.getElementById('crew-capacity-text');
    const synTitle = document.getElementById('crew-synergy-title');
    const synDesc = document.getElementById('crew-synergy-desc');
    const synBanner = document.getElementById('crew-synergy-banner');

    if (badge) badge.innerText = String(STATE.crew.length);
    if (capText) capText.innerText = `${STATE.crew.length} / ${STATE.maxCrewCapacity}`;

    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;
    const totalCrew = STATE.crew.length;

    if (synBanner && synTitle && synDesc) {
        if (totalCrew === 0) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = "🌌 Kosmische Einsamkeit";
            synDesc.innerText = "Keine Geister an Bord. Das Wesen sehnt sich nach Gedanken-Resonanz.";
        } else if (totalCrew === 1) {
            if (STATE.crewSatietyTimer > 45) {
                synBanner.className = 'crew-synergy-banner satiety-decay';
                synTitle.innerText = "⏳ Geistige Sättigung (Eintönigkeit)";
                synDesc.innerText = "Alle Gedanken des Individuums erforscht. Das Wesen verlangt nach neuen Perspektiven!";
            } else {
                synBanner.className = 'crew-synergy-banner';
                synTitle.innerText = "🌱 Erste Gedanken-Resonanz";
                synDesc.innerText = "1 Geist an Bord. Erweitere das Kollektiv für stärkere Synergien.";
            }
        } else if (uniqueRoles === 2) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = "✨ Duale Resonanz";
            synDesc.innerText = "2 Rollen im Einklang. Einsamkeit stabil, passive Buffs verstärkt.";
        } else if (uniqueRoles >= 3) {
            synBanner.className = 'crew-synergy-banner harmony';
            synTitle.innerText = "💫 Kosmische Harmonie";
            synDesc.innerText = "Diverses Kollektiv aktiv! Einsamkeit auf 0% & +15% Bio/Mental-Regeneration!";
        }
    }

    if (!container) return;

    if (STATE.crew.length === 0) {
        container.innerHTML = `
            <div class="matrix-empty-card">
                <span class="highlight">Keine Vernunftbegabten Wesen</span>
                Die psionische Traum-Matrix ist leer. Das Schiff leidet unter existenzieller kosmischer Einsamkeit.<br><br>
                <em>Scanne habitable Planeten nach intelligentem Leben und starte eine psionische Entführung [F]!</em>
            </div>
        `;
        return;
    }

    let html = '';
    STATE.crew.forEach(c => {
        let cardClass = 'crew-member';
        if (c.illusionStability < 35 || c.stress > 70) cardClass += ' panic';
        else if (c.illusionStability < 65 || c.stress > 45) cardClass += ' suspicious';

        html += `
            <div class="${cardClass}">
                <div class="crew-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="crew-name" style="font-weight: 700; color: #f8fafc; font-size: 0.8rem;">${c.name}</span>
                    <span class="crew-role-badge">${c.roleIcon || '👤'} ${c.roleName || c.role}</span>
                </div>
                <div class="crew-buff-tag">⚡ ${c.buffDesc || c.perk}</div>
                
                <div class="stability-container">
                    <span class="stability-label">Traum-Stabilität:</span>
                    <div class="stability-bar-bg">
                        <div class="stability-bar" style="width: ${c.illusionStability}%;"></div>
                    </div>
                    <span style="color: #a855f7; font-size: 0.68rem; font-weight: 700;">${Math.round(c.illusionStability)}%</span>
                </div>

                <div class="stress-container" style="display: flex; align-items: center; gap: 6px;">
                    <span class="stress-label" style="width: 90px; font-size: 0.68rem; color: #94a3b8;">Stress:</span>
                    <div class="stress-bar-bg" style="flex: 1; height: 5px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
                        <div class="stress-bar" style="width: ${c.stress}%; height: 100%; background: ${c.stress > 70 ? '#ef4444' : '#f59e0b'};"></div>
                    </div>
                    <span class="stress-percentage" style="font-size: 0.68rem;">${Math.round(c.stress)}%</span>
                </div>

                <div class="thought-whisper ${c.illusionStability < 35 ? 'terrified' : ''}">
                    💭 "${c.thought}"
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

const crewDialogueBank: Record<string, { lineA: string; lineB: string }[]> = {
    pilot_engineer: [
        { lineA: 'Miller: "Petrov, diese biomolekularen Trägheitsdämpfer... das Schiff richtet die Schubvektoren aus, bevor ich überhaupt lenke."', lineB: 'Petrov: "Die Naniten im Chitin leiten unsere Gedanken direkt weiter. Das ist kein Raumschiff, das ist ein lebendes Cockpit."' },
        { lineA: 'Miller: "Wie sieht die Hüllenintegrität aus, wenn wir durch Asteroidengürtel tauchen?"', lineB: 'Petrov: "Silizium-Naniten schließen Risse im Flug. Solange wir Mineralien aufnehmen, hält die organische Panzerung stand."' }
    ],
    biologist_psychologist: [
        { lineA: 'Dr. Song: "Die Traum-Matrix synchronisiert unsere neuronalen REM-Phasen. Es absorbiert nicht unsere Körper, sondern unsere Gefühle."', lineB: 'Dr. Vance: "Ein psionischer Stoffwechsel. Solange wir Gelassenheit und Zuversicht ausstrahlen, ernährt sich die Entität von Harmonie statt Verzweiflung."' },
        { lineA: 'Dr. Song: "Die Biolumineszenz an den Synapsen-Wänden pulsiert im Takt unseres Herzschlags."', lineB: 'Dr. Vance: "Ein biologischer Resonanzraum. Wir halten das Wesen am Leben – und es beschützt uns vor der tödlichen Kälte des Alls."' }
    ],
    cryptologist_pilot: [
        { lineA: 'Novak: "Ich fange schwache Tachyonen-Echos aus dem nächsten Sternensystem auf. Psio-Sensorhorizont erweitert."', lineB: 'Miller: "Kurs ist korrigiert, Novak. Bringen wir uns in den nächsten planetaren Orbit."' }
    ],
    engineer_biologist: [
        { lineA: 'Petrov: "Dr. Song, die organischen Leitungen um die Faltungsmembran regenerieren erstaunlich schnell."', lineB: 'Dr. Song: "Es ist ein symbiotisches Ökosystem. Jede Ressource, die wir assimilieren, stärkt die Zellwände des Schiffes."' }
    ],
    general: [
        { lineA: 'Crew-Funk: "Die Traum-Matrix flüstert Erinnerungen an Sternensysteme, die Lichtjahre entfernt liegen..."', lineB: 'Crew-Funk: "Wir reisen durch das Herz einer Galaxie, die kein Mensch zuvor erblickt hat."' }
    ]
};

export function triggerMultiCrewDialogue() {
    if (STATE.crew.length < 2) return;

    const hasTranslator = STATE.mutations.translator && STATE.mutations.translator.purchased;

    const c1 = STATE.crew[Math.floor(Math.random() * STATE.crew.length)];
    const others = STATE.crew.filter(c => c !== c1);
    const c2 = others[Math.floor(Math.random() * others.length)];

    let pairKey = `${c1.role}_${c2.role}`;
    let revPairKey = `${c2.role}_${c1.role}`;
    let dialogues = crewDialogueBank[pairKey] || crewDialogueBank[revPairKey] || crewDialogueBank.general;

    const dialog = dialogues[Math.floor(Math.random() * dialogues.length)];

    const name1 = c1.name.split(' ')[1] || c1.name;
    const name2 = c2.name.split(' ')[1] || c2.name;

    if (hasTranslator) {
        addLogEntry("CREW", dialog.lineA.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name1));
        setTimeout(() => {
            addLogEntry("CREW", dialog.lineB.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name2));
        }, 3200);
    } else {
        addLogEntry("CREW", `[Verschlüsselter Datenstrom zwischen ${c1.name} & ${c2.name}... Dschinn-Übersetzer benötigt!]`);
    }
}

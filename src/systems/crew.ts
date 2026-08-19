import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { toggleTelepathy } from '../input/controls';
import { playBioHarvestSound, playCrashSound } from '../engine/audio';
import { CrewMember } from '../types/game';

export function calculateCrewBuffs() {
    let thrustMult = 1.0;
    let bioMult = 1.0;
    let scanMult = 1.0;
    let repair = 0;
    let stressDamp = 1.0;
    let psioBonus = 0;

    const hiveBonus = STATE.mutations.hivemind && STATE.mutations.hivemind.purchased ? 1.2 : 1.0;

    STATE.crew.forEach(c => {
        // Vital or mature minds give full bonus, critical minds suffer a small penalty
        const agePenalty = c.ageCategory === 'critical' ? 0.6 : (c.ageCategory === 'senescent' ? 0.85 : 1.0);

        if (c.role === 'pilot') thrustMult += 0.15 * hiveBonus * agePenalty;
        if (c.role === 'biologist') {
            bioMult += 0.30 * hiveBonus * agePenalty;
            scanMult += 0.25 * hiveBonus * agePenalty;
        }
        if (c.role === 'engineer') repair += 0.6 * hiveBonus * agePenalty;
        if (c.role === 'psychologist') stressDamp *= (1.0 - 0.40 * hiveBonus * agePenalty);
        if (c.role === 'cryptologist') psioBonus += 30 * hiveBonus * agePenalty;
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

const STORY_LOGS = [
    { time: 6, sender: "Capt. Miller", text: "Das Ding lebt! Wir sind im Bauch eines Lovecraft-Monsters gefangen! Wo ist die Luft?" },
    { time: 24, sender: "Dr. Song", text: "Die Schiffswände atmen... Valeria, das Schiff absorbiert Weltraummaterie um sich zu heilen!" },
    { time: 48, sender: "Valeria", text: "Jamal, guck dir die Messgeräte an. Die kosmische Hintergrundstrahlung... Die Expansion verlangsamt sich!" },
    { time: 70, sender: "Jamal", text: "Das ist kein Fehler. Jemand macht eine kosmische Vollbremsung. Dieses Wesen... versucht es uns zu warnen?" },
    { time: 95, sender: "Capt. Miller", text: "Es sendet Gedankenwellen. Die Software übersetzt es als... Dschinn? Es ist einsam." }
];
let storyIndex = 0;
let playTime = 0;

export function encryptText(text: string): string {
    const alienGlyphs = "⏁⊑⟒⋔⍜⋏☿⏁⟒⍃⍜⌰⎍⌇⌇⊑⟟⌿⌇⏃⋏⎅⌇⏁⏃⍀⌇⏁⍀⟒☍⏁⊑⟒⌇⊑⟟⌿⟟⌇⏃⌰⟟⎎⟒";
    return text.split('').map(char => {
        if (char === ' ' || char === '"' || char === '\'' || char === ':' || char === '.' || char === ',' || char === '?' || char === '!' || char === '-' || char === '(' || char === ')') return char;
        return alienGlyphs[Math.floor(Math.random() * alienGlyphs.length)];
    }).join('');
}

export function encryptCrewMessage(sender: string, text: string): string {
    let outText = text;
    if (!STATE.mutations.translator.purchased) {
        outText = encryptText(text);
    }
    return `${sender}: "${outText}"`;
}

export function updateCrewSimulation(dt: number) {
    playTime += dt;
    if (storyIndex < STORY_LOGS.length && playTime >= STORY_LOGS[storyIndex].time) {
        const logObj = STORY_LOGS[storyIndex];
        storyIndex++;
        addLogEntry("CREW", encryptCrewMessage(logObj.sender, logObj.text));
    }

    const totalCrew = STATE.crew.length;
    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;

    // 1. Loneliness & Satiety Decay System
    let targetLoneliness = 100;
    let isHarmony = false;

    if (totalCrew === 0) {
        targetLoneliness = 100;
    } else if (totalCrew === 1) {
        STATE.crewSatietyTimer += dt;
        const decay = Math.min(20, (STATE.crewSatietyTimer / 120) * 20);
        targetLoneliness = 45 + decay; // Single companion: 45-65% loneliness
    } else if (totalCrew === 2) {
        targetLoneliness = uniqueRoles === 2 ? 20 : 30; // 2 crew: 20-30% loneliness
    } else if (totalCrew >= 3) {
        if (uniqueRoles >= 3) {
            targetLoneliness = Math.max(0, 5 - (totalCrew - 3) * 2);
            isHarmony = true; // Complete Trio Harmony
        } else {
            targetLoneliness = Math.max(5, 15 - (totalCrew - 3) * 3);
            if (totalCrew >= 4) isHarmony = true;
        }
    }

    if (STATE.loneliness < targetLoneliness) {
        STATE.loneliness = Math.min(targetLoneliness, STATE.loneliness + 3 * dt);
    } else if (STATE.loneliness > targetLoneliness) {
        STATE.loneliness = Math.max(targetLoneliness, STATE.loneliness - 18 * dt);
    }

    if (isHarmony) {
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 0.5 * dt);
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 0.3 * dt);
    }

    // 2. Individual Dream Matrix, Aging & Stress Loop
    let speed = STATE.playerVelocity.length();
    let speedStressModifier = speed > 10.0 ? 0.6 : 0;

    for (let i = STATE.crew.length - 1; i >= 0; i--) {
        const c = STATE.crew[i];

        // Aging Process
        c.age = (c.age || 0) + dt;
        const maxLife = c.maxLifespan || 540;
        const lifeRatio = Math.min(1.0, c.age / maxLife);

        if (lifeRatio < 0.55) {
            c.ageCategory = 'vital';
        } else if (lifeRatio < 0.85) {
            c.ageCategory = 'mature';
            c.stress = Math.min(100, c.stress + 0.35 * dt);
        } else if (lifeRatio < 0.95) {
            c.ageCategory = 'senescent';
            c.stress = Math.min(100, c.stress + 0.9 * dt);
        } else {
            c.ageCategory = 'critical';
            c.stress = Math.min(100, c.stress + 1.8 * dt);
        }

        // Biological Death from Old Age
        if (c.age >= maxLife) {
            addLogEntry("SYSTEM", `⚰️ BIOLOGISCHER ZELLTOD: ${c.name} (${c.species}) ist an Altersschwäche gestorben. Biomasse resorbiert (+45 Bio-Energie).`);
            STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 45);
            STATE.loneliness = Math.min(100, STATE.loneliness + 20);

            STATE.crew.forEach(other => {
                if (other !== c) {
                    other.stress = Math.min(100, other.stress + 20);
                    other.illusionStability = Math.max(0, other.illusionStability - 15);
                }
            });

            STATE.crew.splice(i, 1);
            calculateCrewBuffs();
            continue;
        }

        // Dream Stability & Mental Stress
        const decayRate = (0.35 + c.stress * 0.006) * dt;
        c.illusionStability = Math.max(0, c.illusionStability - decayRate);

        if (STATE.telepathyActive && STATE.mentalEnergy > 0) {
            c.stress = Math.max(0, c.stress - 7.5 * dt);
            c.illusionStability = Math.min(100, c.illusionStability + 8.0 * dt);
            c.status = "Traum-Trance";
            c.thought = "Fühlt eine warme, beruhigende Welle... 'Alles ist friedlich.'";
        } else {
            if (c.illusionStability < 35) {
                c.stress = Math.min(100, c.stress + (4.5 + speedStressModifier) * dt);
                c.status = "Panik";
                c.thought = "Verzweifelt: 'Die Wände pulsieren... das ist keine Station!'";
            } else if (c.illusionStability < 65) {
                c.stress = Math.min(100, c.stress + (1.2 + speedStressModifier) * dt);
                c.status = "Misstrauisch";
                c.thought = "Stutzt: 'Höre ich ein Atmen in den Lüftungsschächten?'";
            } else {
                c.stress = Math.max(0, c.stress - 2.0 * dt);
                c.status = "Arbeitet";
                if (c.ageCategory === 'senescent') {
                    c.thought = "Erschöpft: 'Die Jahre vergehen... aber die Sterne bleiben ewig.'";
                } else {
                    c.thought = "Konzentriert: 'Sternenkartierung verläuft nach Plan.'";
                }
            }
        }

        // Symbiotic Perks from calm minds
        if (c.illusionStability >= 50) {
            if (c.role === 'engineer') {
                STATE.health = Math.min(STATE.maxHealth, STATE.health + 0.25 * dt);
            } else if (c.role === 'biologist') {
                STATE.bioRes += 0.1 * dt;
            } else if (c.role === 'psychologist') {
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 1.5 * dt);
            }
        }

        // Panic Sabotage at extreme stress
        if (c.stress >= 80) {
            STATE.health = Math.max(0, STATE.health - 3.2 * dt);
            if (Math.random() < 0.008) {
                addLogEntry("CREW", `MATRIX-ALARM: ${c.name} randaliert in Panik und beschädigt Zellwände! Beruhige mit [LEERTASTE]!`);
            }
        }
    }

    // 3. Mental Energy Drain / Regen
    if (STATE.telepathyActive) {
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 8.5 * dt);
        if (STATE.mentalEnergy === 0) {
            toggleTelepathy();
            addLogEntry("SYSTEM", "Mentale Reserven erschöpft! Telepathische Traum-Matrix flackert.");
        }
    } else {
        const regenSpeed = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 7.0 * dt : 3.5 * dt;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + regenSpeed);
    }

    // 4. Periodic Multi-Crew Dialogue
    STATE.crewDialogueTimer -= dt;
    if (STATE.crewDialogueTimer <= 0 && STATE.crew.length >= 2) {
        STATE.crewDialogueTimer = 20 + Math.random() * 8;
        triggerMultiCrewDialogue();
    }

    // Update Crew DOM cards periodically
    renderCrewUI();
}

// User Action: Bio-Rejuvenation (Extends Lifespan & Reduces Age)
export function rejuvenateCrewMember(id: number) {
    const member = STATE.crew.find(c => c.id === id);
    if (!member) return;

    if (STATE.bioEnergy < 20 || STATE.bioRes < 10) {
        addLogEntry("SYSTEM", `Zu wenig Bio-Energie oder Biomasse für Zell-Verjüngung (benötigt 20 Bio / 10 Biomasse)!`);
        return;
    }

    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 20);
    STATE.bioRes = Math.max(0, STATE.bioRes - 10);

    const maxLife = member.maxLifespan || 540;
    member.age = Math.max(0, member.age - maxLife * 0.35);
    member.stress = Math.max(0, member.stress - 25);
    member.rejuvenationCount = (member.rejuvenationCount || 0) + 1;

    playBioHarvestSound();
    addLogEntry("SYSTEM", `💉 ZELL-REGENERATION: Telomere von ${member.name} erneuert (-35% Alter)! Lebenszeit verlängert.`);
    calculateCrewBuffs();
    renderCrewUI();
}

// User Action: Genome Assimilation (Sacrifice crew for permanent resources)
export function assimilateCrewMember(id: number) {
    const idx = STATE.crew.findIndex(c => c.id === id);
    if (idx === -1) return;
    const member = STATE.crew[idx];

    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 50);
    STATE.bioRes += 35;
    STATE.siliconRes += 20;

    addLogEntry("SYSTEM", `🧬 GENOM-ASSIMILATION: ${member.name} (${member.species}) aufgelöst: +50 Bio-Energie, +35 Biomasse & +20 Silizium.`);
    playCrashSound();

    STATE.crew.splice(idx, 1);
    calculateCrewBuffs();
    renderCrewUI();
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

        const maxLife = c.maxLifespan || 540;
        const currentAge = Math.min(maxLife, Math.floor(c.age || 0));
        const lifePercent = Math.max(0, Math.min(100, Math.round((1.0 - (currentAge / maxLife)) * 100)));

        let speciesTag = '👨‍🚀 Mortal';
        if (c.speciesType === 'ephemeral') speciesTag = '🪲 Ephemeral';
        else if (c.speciesType === 'longlived') speciesTag = '🤖 Synthet';
        else if (c.speciesType === 'ancient') speciesTag = '💎 Uralt';

        let ageLabel = '🟢 Vital';
        let ageColor = '#00ff88';
        if (c.ageCategory === 'mature') {
            ageLabel = '🟡 Reife';
            ageColor = '#facc15';
        } else if (c.ageCategory === 'senescent') {
            ageLabel = '🟠 Seneszenz';
            ageColor = '#fb923c';
        } else if (c.ageCategory === 'critical') {
            ageLabel = '🔴 Altersschwäche';
            ageColor = '#f43f5e';
        }

        const ageMin = Math.floor(currentAge / 60);
        const ageSec = String(currentAge % 60).padStart(2, '0');
        const maxMin = Math.floor(maxLife / 60);

        html += `
            <div class="${cardClass}">
                <div class="crew-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="crew-name" style="font-weight: 700; color: #f8fafc; font-size: 0.8rem;">${c.name}</span>
                        <span style="font-size: 0.65rem; color: #94a3b8; margin-left: 4px;">(${speciesTag})</span>
                    </div>
                    <span class="crew-role-badge">${c.roleIcon || '👤'} ${c.roleName || c.role}</span>
                </div>
                <div class="crew-buff-tag">⚡ ${c.buffDesc || c.perk}</div>

                <!-- Lifespan & Biological Age Bar -->
                <div class="lifespan-container" style="margin: 4px 0; background: rgba(15,23,42,0.6); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #cbd5e1; margin-bottom: 2px;">
                        <span>⏳ Alter: ${ageMin}:${ageSec} / ${maxMin}:00 Min.</span>
                        <span style="color: ${ageColor}; font-weight: 700;">${ageLabel} (${lifePercent}% übrig)</span>
                    </div>
                    <div class="lifespan-bar-bg" style="height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden;">
                        <div class="lifespan-bar" style="width: ${lifePercent}%; height: 100%; background: ${ageColor}; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                
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

                <!-- Interactive Crew Care & Action Buttons -->
                <div class="crew-actions" style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="crew-action-btn rejuv-btn" onclick="window.rejuvenateCrew(${c.id})" title="Zell-Verjüngung: -35% Alter (Kosten: 20 Bio / 10 Biomasse)">
                        💉 Verjüngen
                    </button>
                    <button class="crew-action-btn assimilate-btn" onclick="window.assimilateCrew(${c.id})" title="Genom-Assimilation: Löst das Wesen in +50 Bio-Energie, +35 Biomasse & +20 Silizium auf">
                        🧬 Assimilieren
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Expose handlers to window for inline onclick execution
if (typeof window !== 'undefined') {
    (window as any).rejuvenateCrew = (id: number) => rejuvenateCrewMember(id);
    (window as any).assimilateCrew = (id: number) => assimilateCrewMember(id);
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

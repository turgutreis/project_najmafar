import { FactionId, FactionData } from '../types/game';
import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';

export const FACTIONS: Record<FactionId, FactionData> = {
    vega_collective: {
        id: 'vega_collective',
        name: "Das Vega-Qubit-Kollektiv",
        shortName: "Vega-Kollektiv",
        emblem: "⚛️",
        color: "0x6366f1",
        colorCss: "#6366f1",
        doctrine: "Quanten-Logik & Kybernetische Ordnung",
        description: "Ein Verbund aus vernetzten Maschinen-Intelligenzen und Transhumanen, die das Universum als gigantische Rechenoperation begreifen.",
        specialTrait: "+30% Silizium-Handelskurs | EMP-Resistente Drohnen",
        baseDisposition: 'Defensive'
    },
    olyndar_psion: {
        id: 'olyndar_psion',
        name: "Der Psionische Bund von Olyndar",
        shortName: "Psioniker von Olyndar",
        emblem: "🔮",
        color: "0xd946ef",
        colorCss: "#d946ef",
        doctrine: "Telepathische Resonanz & Bio-Götterkult",
        description: "Spirituelle Wesen, die mit der kosmischen Leere resonieren und dein Bio-Schiff als lebendige Sternengottheit verehren.",
        specialTrait: "Freiwillige Crew-Kandidaten | Keine Abfangstaffeln",
        baseDisposition: 'Pacifist'
    },
    xenomilitary_ash: {
        id: 'xenomilitary_ash',
        name: "Die Asche-Gilde der Xenomilitärs",
        shortName: "Asche-Gilde",
        emblem: "⚔️",
        color: "0xf43f5e",
        colorCss: "#f43f5e",
        doctrine: "Totale Vorherrschaft & Kinetische Feuerkraft",
        description: "Eine schwer gepanzerte Militär-Junta mit Schlachtschiffen und automatisierten Orbital-Bastionen. Misstraut organischen Anomalien.",
        specialTrait: "Schwere Kampf-Korvetten | Verfolgung über Sektorgrenzen",
        baseDisposition: 'Militaristic'
    },
    free_traders: {
        id: 'free_traders',
        name: "Konsortium der Freien Sternen-Händler",
        shortName: "Händler-Konsortium",
        emblem: "🌿",
        color: "0x10b981",
        colorCss: "#10b981",
        doctrine: "Freier Austausch & Symbiotische Allianzen",
        description: "Pragmatische interstellare Händlergilden, die bereitwillig Silizium gegen Biomasse tauschen und Schiffsreparaturen anbieten.",
        specialTrait: "Günstiger Ressourcentausch | Kartographie-Angebote",
        baseDisposition: 'Pacifist'
    },
    aethelgard_guardians: {
        id: 'aethelgard_guardians',
        name: "Die Vorläufer-Wächter von Aethelgard",
        shortName: "Aethelgard-Wächter",
        emblem: "🌌",
        color: "0x38bdf8",
        colorCss: "#38bdf8",
        doctrine: "Bewahrung des Kosmischen Gleichgewichts",
        description: "Eine uralte, schlummernde Zivilisation, deren Relikte und Megastrukturen seit Millionen Jahren die Expansion der Galaxie dämpfen.",
        specialTrait: "Exklusive Vorläufer-Mutationen | Hyper-Raumzeit-Schilde",
        baseDisposition: 'Defensive'
    }
};

export function getFaction(id: FactionId): FactionData {
    return FACTIONS[id] || FACTIONS.free_traders;
}

export function getReputationTitle(score: number): { label: string; color: string; tier: string } {
    if (score >= 60) {
        return { label: "🌟 Verehrt / Heilige Allianz", color: "#d946ef", tier: "allied" };
    } else if (score >= 20) {
        return { label: "🤝 Kooperativ / Handelspartner", color: "#10b981", tier: "friendly" };
    } else if (score > -20) {
        return { label: "⚖️ Neutral", color: "#94a3b8", tier: "neutral" };
    } else if (score > -60) {
        return { label: "⚔️ Feindselig / Wachsam", color: "#f59e0b", tier: "hostile" };
    } else {
        return { label: "🚨 Todfeind / Galaktisches Kopfgeld", color: "#f43f5e", tier: "nemesis" };
    }
}

export function modifyReputation(factionId: FactionId, delta: number, reason: string) {
    if (!STATE.reputation[factionId]) {
        STATE.reputation[factionId] = 0;
    }

    const prevScore = STATE.reputation[factionId];
    STATE.reputation[factionId] = Math.max(-100, Math.min(100, STATE.reputation[factionId] + delta));
    const newScore = STATE.reputation[factionId];

    const faction = getFaction(factionId);
    const sign = delta > 0 ? `+${delta}` : `${delta}`;

    if (delta > 0) {
        addLogEntry("SYSTEM", `🌟 REPUTATION GESTIEGEN: ${faction.name} (${sign} -> ${newScore} Punkte). ${reason}`);
    } else {
        addLogEntry("SYSTEM", `⚠️ REPUTATION GESUNKEN: ${faction.name} (${sign} -> ${newScore} Punkte). ${reason}`);
    }

    renderFactionReputationUI();
}

export function renderFactionReputationUI() {
    const listContainer = document.getElementById('faction-reputation-list');
    if (!listContainer) return;

    listContainer.innerHTML = "";

    (Object.keys(FACTIONS) as FactionId[]).forEach(fId => {
        const faction = FACTIONS[fId];
        const score = STATE.reputation[fId] || 0;
        const repInfo = getReputationTitle(score);

        const card = document.createElement('div');
        card.className = 'faction-rep-card';
        card.innerHTML = `
            <div class="faction-card-header">
                <span class="faction-emblem">${faction.emblem}</span>
                <div class="faction-title-group">
                    <span class="faction-name" style="color: ${faction.colorCss};">${faction.shortName}</span>
                    <span class="faction-doctrine">${faction.doctrine}</span>
                </div>
                <span class="faction-score" style="color: ${repInfo.color};">${score > 0 ? '+' : ''}${score}</span>
            </div>
            <div class="faction-rep-bar-bg">
                <div class="faction-rep-bar" style="width: ${Math.max(5, (score + 100) / 2)}%; background: ${repInfo.color};"></div>
            </div>
            <div class="faction-status-row">
                <span class="faction-status-label" style="color: ${repInfo.color};">${repInfo.label}</span>
                <span class="faction-trait-tag">${faction.specialTrait}</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

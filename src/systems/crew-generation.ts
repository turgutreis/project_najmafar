import { CrewMember, SpeciesLifespanCategory } from '../types/game';

// ----------------------------------------------------------------------------
// PROCEDURAL CREW & ABDUCTION SPECIES GENERATOR
// Generates diverse, unique, personality-rich beings for the alien bio-ship
// ----------------------------------------------------------------------------

export interface SpeciesArchetype {
    speciesName: string;
    speciesType: SpeciesLifespanCategory;
    avatarIcon: string;
    speciesColor: string;
    names: string[];
    titles: string[];
    origins: string[];
    preferredRoles: ('pilot' | 'biologist' | 'engineer' | 'psychologist')[];
    traits: { name: string; desc: string; type: 'bio' | 'stress' | 'speed' | 'repair' | 'psionic' | 'quirk' }[];
}

export const SPECIES_ARCHETYPES: SpeciesArchetype[] = [
    {
        speciesName: "Myzel-Symbiont",
        speciesType: "ephemeral",
        avatarIcon: "🍄",
        speciesColor: "#10b981", // Emerald
        names: ["Thal", "Zhirr", "Oona", "Vael", "Kael", "Myco", "Sula", "Spore-7", "Phael", "Nyra"],
        titles: ["Bio-Architekt", "Sporen-Priester", "Membran-Wächter", "Kokon-Flechter", "Xenobotaniker"],
        origins: ["den Phosphor-Höhlen", "dem Myzel-Gürtel", "den Flechten-Ozeanen", "den Sporen-Nebeln"],
        preferredRoles: ["biologist", "engineer"],
        traits: [
            { name: "Biolumineszent", desc: "+25% Biomasse-Metabolismus im Kokon", type: "bio" },
            { name: "Sporen-Empathie", desc: "Beruhigt benachbarte Gefangene im Raumschiff", type: "stress" },
            { name: "Schnell-Zellerneuerung", desc: "Hohe Regeneration, jedoch rascher Alterungsprozess", type: "quirk" }
        ]
    },
    {
        speciesName: "Cyborg-Synthet",
        speciesType: "longlived",
        avatarIcon: "🤖",
        speciesColor: "#38bdf8", // Sky Cyan
        names: ["Dax-04", "Rex-Sigma", "Cipher-9", "Unit-77", "Nexus-V", "Kinet-8", "Proxy-Zero", "Vectis", "Null-1"],
        titles: ["Naniten-Meister", "Kybernetiker", "Subraum-Logiker", "Quanten-Mechaniker", "Reaktor-Pfleger"],
        origins: ["der Silizium-Schmiede", "dem Schaltkreis-Archipel", "den Titan-Minen", "den Daten-Gürteln"],
        preferredRoles: ["engineer", "pilot"],
        traits: [
            { name: "Maschinen-Synästhesie", desc: "+0.4 HP/s Naniten-Schiffshüllenreparatur", type: "repair" },
            { name: "Emotionsloser Stoizismus", desc: "Immun gegen leichten Panikstress bei Hüllenschäden", type: "stress" },
            { name: "Optische Übertaktung", desc: "+15% Manövrierbarkeit beim Flug", type: "speed" }
        ]
    },
    {
        speciesName: "Olyndar-Empath",
        speciesType: "ancient",
        avatarIcon: "🧝",
        speciesColor: "#a855f7", // Purple
        names: ["Astraea", "Maya", "Solas", "Elyon", "Kaelen", "Lyra", "Seraph", "Zephyra", "Olynn", "Val-Marek"],
        titles: ["Gedanken-Diplomat", "Astromant", "Resonanz-Weber", "Seelen-Navigator", "Traum-Hüter"],
        origins: ["den schwebenden Kristallsphären", "dem Äther-Konsens", "den Saphir-Tempeln", "den Ringwäldern"],
        preferredRoles: ["psychologist", "pilot"],
        traits: [
            { name: "Resonanz-Träumer", desc: "Senkt kosmische Einsamkeit des Schiffs um weitere 15%", type: "psionic" },
            { name: "Telepathischer Anker", desc: "Verlangsamt Illusion-Decay aller Kokon-Wirte", type: "stress" },
            { name: "Zeitloser Geist", desc: "Enorme biologische Langlebigkeit (über 20 Minuten)", type: "quirk" }
        ]
    },
    {
        speciesName: "Tiefsee-Oktanoide",
        speciesType: "mortal",
        avatarIcon: "🐙",
        speciesColor: "#06b6d4", // Cyan
        names: ["Kraal", "Triton", "Nautis", "Cala", "Mael", "Hydros", "Pelagos", "Vell", "Moros"],
        titles: ["Druckwellen-Lotse", "Hydro-Ingenieur", "Kiemen-Navigator", "Tiefen-Echoforscher"],
        origins: ["den Methan-Gräben", "den Abyssal-Schloten", "den Salzwasser-Kernen", "den Gezeiten-Riffen"],
        preferredRoles: ["pilot", "biologist"],
        traits: [
            { name: "Druckresistenz", desc: "+20% Hüllendämpfung bei Gravitations-Stößen", type: "repair" },
            { name: "Fluid-Schub", desc: "+20% Beschleunigung bei interstellarem Flug", type: "speed" },
            { name: "Hydro-Synthese", desc: "Wandelt kinetische Energie langsam in Bio-Ressourcen um", type: "bio" }
        ]
    },
    {
        speciesName: "Kristalliner Lithoid",
        speciesType: "longlived",
        avatarIcon: "💠",
        speciesColor: "#f59e0b", // Amber
        names: ["Quarz-9", "Obsid", "Pyrit", "Beryll", "Granat", "Feldspat", "Zirkon", "Silikat-Rho"],
        titles: ["Kristall-Geologe", "Prismen-Harmoniker", "Seismologe", "Kern-Resonator"],
        origins: ["den Obsidian-Stollen", "den Geoden-Schluchten", "den tektonischen Falten", "den Basalt-Hochebenen"],
        preferredRoles: ["engineer", "psychologist"],
        traits: [
            { name: "Silizium-Katalysator", desc: "Reduziert Silizium-Verbrauch bei Naniten-Reparaturen", type: "repair" },
            { name: "Refraktions-Matrix", desc: "+35 psionische Reichweite für Schiffssensoren", type: "psionic" },
            { name: "Träge Zellteilung", desc: "Sehr langsame Alterung, benötigt selten Verjüngung", type: "quirk" }
        ]
    },
    {
        speciesName: "Terranischer Pionier",
        speciesType: "mortal",
        avatarIcon: "🧑‍🚀",
        speciesColor: "#3b82f6", // Blue
        names: ["Capt. Miller", "Dr. Song", "Valeria", "Jamal", "Elena", "Vance", "Chen", "Thorne", "Sarah", "Aris"],
        titles: ["Astral-Pilot", "Kolonie-Scout", "System-Astrophysiker", "Missions-Chirurg", "Überlebens-Experte"],
        origins: ["der Orbital-Station Alpha", "dem Kolonieschiff Exodus", "den Mars-Glaskuppeln", "den Mond-Außenposten"],
        preferredRoles: ["pilot", "engineer", "biologist"],
        traits: [
            { name: "Unbeugsamer Wille", desc: "+25% Triebwerkschub bei kritischer Schiffs-Energie", type: "speed" },
            { name: "Wissenschaftlicher Eifer", desc: "+30% Forschungs- & Telemetriegewinn beim Scannen", type: "psionic" },
            { name: "Kollaborations-Drang", desc: "Verstärkt die Synergieeffekte anderer Crew-Mitglieder", type: "quirk" }
        ]
    }
];

export const ROLE_DEFINITIONS: Record<string, {
    roleName: string;
    roleIcon: string;
    station: 'nervous_system' | 'metabolism_chamber' | 'nanite_forge' | 'psi_resonator';
    stationName: string;
    buffDesc: string;
    baseStressRate: number;
}> = {
    pilot: {
        roleName: "🛸 Astral-Pilot",
        roleIcon: "🛸",
        station: "nervous_system",
        stationName: "🧠 Nervenknoten-Kern",
        buffDesc: "+30% Schubkraft & Manövrierbarkeit",
        baseStressRate: 0.18
    },
    biologist: {
        roleName: "🌱 Bio-Architekt",
        roleIcon: "🌱",
        station: "metabolism_chamber",
        stationName: "🧬 Verdauungs-Membran",
        buffDesc: "+45% Biomasse-Ertrag beim Ernten",
        baseStressRate: 0.15
    },
    engineer: {
        roleName: "🔧 Naniten-Meister",
        roleIcon: "🔧",
        station: "nanite_forge",
        stationName: "⚙️ Naniten-Schmiede",
        buffDesc: "+0.6 HP/s Naniten-Reparatur",
        baseStressRate: 0.20
    },
    psychologist: {
        roleName: "🧘 Gedanken-Diplomat",
        roleIcon: "🧘",
        station: "psi_resonator",
        stationName: "🔮 Psionischer Resonator",
        buffDesc: "-40% Crew-Stressaufbau & Psi-Fokus",
        baseStressRate: 0.12
    }
};

const LIFESPAN_PRESETS: Record<SpeciesLifespanCategory, { base: number; variance: number }> = {
    ephemeral: { base: 280, variance: 80 },  // ~4.5 - 6 Min.
    mortal:    { base: 560, variance: 120 }, // ~8 - 11 Min.
    longlived: { base: 950, variance: 200 }, // ~14 - 19 Min.
    ancient:   { base: 1400, variance: 300 } // ~20 - 28 Min.
};

/**
 * Procedurally generates an array of distinct, unique candidates for a planet
 */
export function generateProceduralCandidates(seedHash: number, count: number = 2): CrewMember[] {
    const candidates: CrewMember[] = [];
    const roles: ('pilot' | 'biologist' | 'engineer' | 'psychologist')[] = ['pilot', 'biologist', 'engineer', 'psychologist'];

    for (let i = 0; i < count; i++) {
        const itemHash = (seedHash * 31 + i * 179 + 42) >>> 0;

        // Pick archetype
        const arch = SPECIES_ARCHETYPES[itemHash % SPECIES_ARCHETYPES.length];

        // Pick role (biased towards archetype's preferred roles)
        let role: 'pilot' | 'biologist' | 'engineer' | 'psychologist' = roles[(itemHash + i) % roles.length];
        if (arch.preferredRoles && arch.preferredRoles.length > 0 && (itemHash % 3 !== 0)) {
            role = arch.preferredRoles[itemHash % arch.preferredRoles.length];
        }
        const roleDef = ROLE_DEFINITIONS[role];

        // Pick name, title, and origin
        const firstName = arch.names[(itemHash + i * 3) % arch.names.length];
        const title = arch.titles[(itemHash + i * 5) % arch.titles.length];
        const origin = arch.origins[(itemHash + i * 7) % arch.origins.length];
        const fullName = `${title} ${firstName}`;

        // Pick trait
        const trait = arch.traits[(itemHash + i) % arch.traits.length];

        // Calculate lifespan
        const preset = LIFESPAN_PRESETS[arch.speciesType];
        const lifespan = preset.base + ((itemHash % 100) / 100) * preset.variance;

        // Initial age (starts young: 5% - 25% of lifespan)
        const initialAge = lifespan * (0.05 + ((itemHash % 20) / 100));

        candidates.push({
            id: Date.now() + Math.floor(Math.random() * 100000) + i,
            name: fullName,
            species: `${arch.speciesName} (${origin})`,
            speciesType: arch.speciesType,
            role: role,
            roleName: roleDef.roleName,
            roleIcon: roleDef.roleIcon,
            station: roleDef.station,
            stationName: roleDef.stationName,
            buffDesc: roleDef.buffDesc,
            perk: trait.desc,
            trait: trait,
            avatarIcon: arch.avatarIcon,
            speciesColor: arch.speciesColor,
            stress: 15 + (itemHash % 15),
            baseStressRate: roleDef.baseStressRate,
            illusionStability: 100,
            status: "Harmonisch",
            thought: `Wartet im Kokon... Träumt von ${origin}.`,
            age: initialAge,
            maxLifespan: Math.round(lifespan),
            ageCategory: 'vital',
            rejuvenationCount: 0,
            criticalAlertTriggered: false
        });
    }

    return candidates;
}

/**
 * Returns dynamic, organic thoughts reflecting ship events and biological life inside the alien craft
 */
export function getCrewReactiveThought(
    c: CrewMember,
    eventType: 'warp_start' | 'warp_arrival' | 'ship_damage' | 'harvest' | 'telepathy_calm' | 'old_age' | 'idle',
    context?: any
): string {
    switch (eventType) {
        case 'warp_start':
            if (c.role === 'pilot') return "Die Raumzeit dehnt sich... Mein Geist lenkt den Subraum-Sprung!";
            if (c.role === 'engineer') return "Reaktormembran federt die Gravitationswelle ab. Systeme stabil!";
            return "Spürt ein gewaltiges Ziehen... Das Schiff faltet das Gefüge des Raums!";

        case 'warp_arrival':
            return `Austritt gelungen. Neue Sternenstrahlen dringen durch die biolumineszenten Wände.`;

        case 'ship_damage':
            if (c.role === 'engineer') return "Alarm! Zellwände beschädigt – ich leite Naniten zur Leckage um!";
            if (c.illusionStability < 50) return "Panik! Das Lebewesen schreit vor Schmerz... Wir werden zerquetscht!";
            return "Ein heftiger Schlag erschüttert die Nervenbahnen des Rumpfes!";

        case 'harvest':
            if (c.role === 'biologist') return "Reine planetare Biomasse fließt durch die Nährstoffkanäle. Exzellente Ausbeute!";
            return "Warme Nährstoffe strömen durch die Kokon-Wände... Die Schiffsenergie steigt.";

        case 'telepathy_calm':
            return "Eine warme, sanfte Berührung des Dschinn... 'Frieden. Alles ist im Fluss.'";

        case 'old_age':
            return "Meine biologische Uhr läuft ab... aber mein Geist lebt in den Synapsen des Schiffs weiter.";

        case 'idle':
        default:
            if (c.ageCategory === 'critical') {
                return "Atmet schwer: 'Die Telomere zerfallen... Ich brauche Zell-Verjüngung!'";
            }
            if (c.ageCategory === 'senescent') {
                return "Erschöpft aber weise: 'Die Jahre vergehen, doch die Sterne bleiben ewig.'";
            }
            if (c.status === "Panik") {
                return "Verzweifelt: 'Die Wände pulsieren... das ist keine Raumstation!'";
            }
            if (c.status === "Misstrauisch") {
                return "Misstrauisch: 'Höre ich ein Atmen in den Lüftungsschächten?'";
            }
            return `Arbeitet ruhig in der Station ${c.stationName || 'Kokon-Kammer'}.`;
    }
}

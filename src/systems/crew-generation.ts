import { STATE } from '../core/state';
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
    firstNames: string[];
    lastNames?: string[];
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
        firstNames: ["Thal", "Zhirr", "Oona", "Vael", "Kael", "Myco-9", "Sula", "Spore-7", "Phael", "Nyra", "Hypha-4", "Xylos", "Chitin-V", "Mycorrh", "Biolux-3", "Sporan-Rho", "Calyx", "Rhizo-2"],
        titles: ["Bio-Architekt", "Sporen-Priester", "Membran-Wächter", "Kokon-Flechter", "Xenobotaniker", "Symbiose-Lotse", "Fungus-Resonator"],
        origins: ["den Phosphor-Höhlen", "dem Myzel-Gürtel", "den Flechten-Ozeanen", "den Sporen-Nebeln", "den Bio-Kavernen", "den Nährstoff-Sümpfen"],
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
        firstNames: ["Dax-04", "Rex-Sigma", "Cipher-9", "Unit-77", "Nexus-V", "Kinet-8", "Proxy-Zero", "Vectis-9", "Null-1", "Synapse-X", "Core-42", "Aegis-7", "Proton-11", "Chronos-3", "Optic-88", "Echo-101"],
        titles: ["Naniten-Meister", "Kybernetiker", "Subraum-Logiker", "Quanten-Mechaniker", "Reaktor-Pfleger", "Kinetik-Adept", "System-Architekt", "Gleichstrom-Lotse"],
        origins: ["der Silizium-Schmiede", "dem Schaltkreis-Archipel", "den Titan-Minen", "den Daten-Gürteln", "den Quanten-Gießereien"],
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
        firstNames: ["Astraea", "Maya-Sol", "Solas", "Elyon", "Kaelen", "Lyra", "Seraph", "Zephyra", "Olynn", "Val-Marek", "Isolde", "Thalor-Sol", "Caelum", "Elysia", "Auriel", "Vesper", "Lumin"],
        titles: ["Gedanken-Diplomat", "Astromant", "Resonanz-Weber", "Seelen-Navigator", "Traum-Hüter", "Äther-Sänger", "Sphären-Wächter", "Harmonie-Lotse"],
        origins: ["den schwebenden Kristallsphären", "dem Äther-Konsens", "den Saphir-Tempeln", "den Ringwäldern", "den Astralen Säulen"],
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
        firstNames: ["Nautis", "Triton", "Pelagos", "Hydros", "Moros", "Cala", "Mael", "Vell", "Thalass", "Gorgon", "Nerios", "Glaukos", "Benthos", "Proteus", "Abysso", "Thalor", "Karkin", "Ozean-8", "Kraal-Zeth", "Scylla-Mor", "Dagon-7", "Pontos"],
        titles: ["Abyssal-Lotse", "Druckwellen-Architekt", "Kiemen-Navigator", "Tiefen-Echoforscher", "Hydro-Ingenieur", "Strömungs-Meister", "Thermen-Taucher", "Benthos-Führer"],
        origins: ["den Methan-Gräben", "den Abyssal-Schloten", "den Salzwasser-Kernen", "den Gezeiten-Riffen", "den Tiefsee-Vulkanen", "den Schwefel-Quellen"],
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
        firstNames: ["Pyrit-7", "Obsid-Prime", "Beryll-Rho", "Quarz-Matrix", "Granat-V", "Zirkon-9", "Silikat-Omega", "Basalt-K", "Andalus-3", "Topas-Delta", "Geod-12", "Monolith-4"],
        titles: ["Prismen-Harmoniker", "Kristall-Geologe", "Kern-Resonator", "Seismologe", "Gesteins-Adept", "Feldspat-Meister", "Tektonik-Lotse"],
        origins: ["den Obsidian-Stollen", "den Geoden-Schluchten", "den tektonischen Falten", "den Basalt-Hochebenen", "den Quarz-Kernen"],
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
        firstNames: ["Aiden", "Cassian", "Elena", "Tarek", "Marcus", "Kira", "Nora", "Lin", "Youssef", "Darius", "Sora", "Mateo", "Leona", "Silas", "Amara", "Viktor", "Zoe", "Felix", "Selene", "Ronan", "Chloe", "Kenji", "Talia", "Ezekiel", "Mira", "Anton", "Maya", "Julian", "Liam", "Iris", "Jonas", "Freja"],
        lastNames: ["Vance", "Thorne", "Kovacs", "Reyes", "Dubois", "Hansen", "Lindqvist", "Zhang", "Tanaka", "Moreau", "Al-Mansoor", "Petrov", "Becker", "Rossi", "Sterling", "Kowalski", "O'Neill", "Navarro", "Sinclair", "Vargas", "Hawthorne", "Castillo", "Müller", "Novak", "Richter", "Fontaine"],
        titles: ["Cmdr.", "Dr.", "Bio-Pionier", "Astro-Ingenieur", "Exobiologe", "Kolonie-Scout", "System-Navigator", "Feldarzt", "Sensoren-Offizier", "Orbit-Lotse"],
        origins: ["der Orbital-Station Alpha", "dem Kolonieschiff Exodus", "den Mars-Glaskuppeln", "den Mond-Außenposten", "der Venus-Wolkenstadt", "der Titan-Forschungsbasis"],
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
 * Procedurally generates an array of distinct, collision-free candidates for a planet.
 * Guarantees that no two beings in the party grid or local candidates share the same name.
 */
export function generateProceduralCandidates(seedHash: number, count: number = 2, bannedNames?: Set<string>): CrewMember[] {
    const candidates: CrewMember[] = [];
    const roles: ('pilot' | 'biologist' | 'engineer' | 'psychologist')[] = ['pilot', 'biologist', 'engineer', 'psychologist'];

    // Gather all existing crew names to guarantee zero duplicate names in the ship or candidate pool
    const usedNames = new Set<string>(bannedNames || []);
    if (typeof STATE !== 'undefined' && STATE.crew) {
        STATE.crew.forEach(c => usedNames.add(c.name));
    }

    for (let i = 0; i < count; i++) {
        let itemHash = (seedHash * 31 + i * 179 + 42) >>> 0;
        let chosenName = '';
        let chosenArch = SPECIES_ARCHETYPES[itemHash % SPECIES_ARCHETYPES.length];
        let origin = '';

        // Anti-collision loop: Try up to 30 permutations until a truly unique name is found
        for (let attempt = 0; attempt < 30; attempt++) {
            const currentHash = (itemHash + attempt * 7919) >>> 0;
            const arch = SPECIES_ARCHETYPES[(itemHash + attempt) % SPECIES_ARCHETYPES.length];
            chosenArch = arch;

            const firstName = arch.firstNames[(currentHash + i * 3) % arch.firstNames.length];
            const title = arch.titles[(currentHash + i * 5) % arch.titles.length];
            origin = arch.origins[(currentHash + i * 7) % arch.origins.length];

            let candidateName = '';
            if (arch.lastNames && arch.lastNames.length > 0) {
                const lastName = arch.lastNames[(currentHash + i * 11 + attempt * 17) % arch.lastNames.length];
                candidateName = `${title} ${firstName} ${lastName}`;
            } else {
                candidateName = `${title} ${firstName}`;
            }

            if (!usedNames.has(candidateName)) {
                chosenName = candidateName;
                itemHash = currentHash;
                break;
            }
        }

        // Fallback safety (virtually impossible to reach): add generational suffix if still colliding
        if (!chosenName || usedNames.has(chosenName)) {
            const fallbackSuffix = ['II', 'III', 'IV', 'V', 'Prime', 'Secundus'][i % 6];
            chosenName = `${chosenName || 'Pionier'} ${fallbackSuffix}`;
        }

        usedNames.add(chosenName);

        // Pick role (biased towards archetype's preferred roles)
        let role: 'pilot' | 'biologist' | 'engineer' | 'psychologist' = roles[(itemHash + i) % roles.length];
        if (chosenArch.preferredRoles && chosenArch.preferredRoles.length > 0 && (itemHash % 3 !== 0)) {
            role = chosenArch.preferredRoles[itemHash % chosenArch.preferredRoles.length];
        }
        const roleDef = ROLE_DEFINITIONS[role];

        // Pick trait
        const trait = chosenArch.traits[(itemHash + i) % chosenArch.traits.length];

        // Calculate lifespan
        const preset = LIFESPAN_PRESETS[chosenArch.speciesType];
        const lifespan = preset.base + ((itemHash % 100) / 100) * preset.variance;

        // Initial age (starts young: 5% - 25% of lifespan)
        const initialAge = lifespan * (0.05 + ((itemHash % 20) / 100));

        candidates.push({
            id: Date.now() + Math.floor(Math.random() * 1000000) + (i * 1000) + (itemHash % 999),
            name: chosenName,
            species: `${chosenArch.speciesName} (${origin})`,
            speciesType: chosenArch.speciesType,
            role: role,
            roleName: roleDef.roleName,
            roleIcon: roleDef.roleIcon,
            station: roleDef.station,
            stationName: roleDef.stationName,
            buffDesc: roleDef.buffDesc,
            perk: trait.desc,
            trait: trait,
            avatarIcon: chosenArch.avatarIcon,
            speciesColor: chosenArch.speciesColor,
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

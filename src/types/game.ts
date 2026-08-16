import * as THREE from 'three';

export type StarType = 'Yellow Sun' | 'Blue Giant' | 'Red Dwarf' | 'White Dwarf' | 'Black Hole';

export interface StarData {
    type: StarType;
    mass: number;
    color: string;
    colorCss?: string;
    size: number;
}

export type PlanetType = 'Rocky' | 'Gas Giant' | 'Habitable';
export type MoonType = 'Eismond' | 'Vulkanmond' | 'Kratermond';

export interface CrewMember {
    id: number;
    name: string;
    species: string;
    role: 'pilot' | 'biologist' | 'engineer' | 'psychologist' | 'cryptologist' | string;
    roleName: string;
    roleIcon?: string;
    buffDesc: string;
    perk?: string;
    stress: number;
    baseStressRate: number;
    illusionStability: number;
    status: string;
    thought: string;
}

export interface SpeciesData {
    hasSentient: boolean;
    name: string;
    population: number;
    candidates: CrewMember[];
}

export interface PlanetAttributes {
    atmos: string;
    temp: string;
    bio: string;
    res: string;
    species: SpeciesData | null;
}

export interface MoonData {
    name: string;
    type: MoonType;
    size: number;
    distance: number;
    speed: number;
    color: string;
    temp: string;
    atmos: string;
    bio: string;
    res: string;
}

export interface PlanetData {
    name: string;
    type: PlanetType;
    distance: number;
    size: number;
    color: string;
    atmos?: string;
    temp?: string;
    bio?: string;
    res?: string;
    species?: SpeciesData | null;
    moons?: MoonData[];
}

export interface StarSystem {
    id: number;
    name: string;
    x: number;
    z: number;
    star: StarData;
    planets: PlanetData[];
}

export interface UniverseData {
    name: string;
    systems: StarSystem[];
}

export interface GravitySource {
    mesh: THREE.Object3D;
    type: 'planet' | 'asteroid' | 'star';
    name: string;
    mass: number;
    radius: number;
    gravityRange: number;
    position: THREE.Vector3;
    isResource?: boolean;
    resourceType?: 'bio' | 'energy';
    isAbsorbed?: boolean;
    ringMesh?: THREE.Mesh | null;
}

export interface PlanetEntry {
    mesh: THREE.Group;
    bodyMesh: THREE.Mesh;
    cloudMesh?: THREE.Mesh | null;
    psioAuraMesh?: THREE.Mesh | null;
    source: GravitySource;
    ringMesh?: THREE.Mesh | null;
    angle: number;
    speed: number;
    distance: number;
    name: string;
    type: PlanetType | MoonType | string;
    size: number;
    color: string;
    colorCss: string;
    isMoon: boolean;
    parentPlanet?: PlanetEntry | null;
    scanned: boolean;
    attributes: PlanetAttributes;
}

export interface MutationItem {
    purchased: boolean;
    bioCost: number;
    siliconCost: number;
}

export interface CrewBuffs {
    thrust: number;
    bioGain: number;
    scanSpeed: number;
    repairRate: number;
    stressDampening: number;
    psionicBonus: number;
}

export interface GameState {
    // Player Stats
    health: number;
    maxHealth: number;
    bioEnergy: number;
    maxBioEnergy: number;
    mentalEnergy: number;
    maxMentalEnergy: number;
    telepathyActive: boolean;
    gameStarted: boolean;

    // Evolution Resources
    bioRes: number;
    siliconRes: number;

    // Sensor & Travel Limits
    psionicRange: number;
    warpRange: number;

    // Crew Management & Synergies
    maxCrewCapacity: number;
    crewSatietyTimer: number;
    crewDialogueTimer: number;
    crewBuffs: CrewBuffs;

    // Mutations
    mutations: {
        armor: MutationItem;
        o2: MutationItem;
        synapses: MutationItem;
        cocoon: MutationItem;
        hivemind: MutationItem;
        folddrive: MutationItem;
        translator: MutationItem;
    };

    // Physics
    playerPosition: THREE.Vector3;
    playerVelocity: THREE.Vector3;
    playerAcceleration: THREE.Vector3;
    thrustStrength: number;
    currentDrag: number;
    gConstant: number;
    collisionCooldown: number;
    keys: {
        w: boolean;
        s: boolean;
        a: boolean;
        d: boolean;
        Space: boolean;
    };

    // Quantum Universe
    universe: UniverseData | null;
    currentSystemId: number;

    // Scanner, Harvesting & Abduction
    nearestPlanet: PlanetEntry | null;
    lockedTarget: PlanetEntry | null;
    scanningPlanet: PlanetEntry | null;
    scanProgress: number;
    scannedPlanets: Record<string, boolean>;

    extractingPlanet: PlanetEntry | null;
    harvestProgress: number;

    abductActive: boolean;
    abductTarget: PlanetEntry | null;
    abductProgress: number;

    // Crew & Psych
    crew: CrewMember[];
    loneliness: number;

    // Active Simulation
    gravitySources: GravitySource[];
    asteroids: GravitySource[];
    playerGroup: THREE.Group | null;
}

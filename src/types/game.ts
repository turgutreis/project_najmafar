import * as THREE from 'three';

export type PlanetType = 'Habitable' | 'Gas Giant' | 'Rocky' | 'Desert' | 'Oceanic' | 'Volcanic' | 'Ice' | 'Vorläufer-Konstrukt' | 'Gefangener Stern' | 'Plasma-Wirbel' | 'Trümmerfeld' | 'Gezeiten-Trümmerfeld' | 'Toter Kern' | string;
export type MoonType = 'Eismond' | 'Vulkanmond' | 'Kratermond' | 'Gesteinsmond';
export type TechLevel = 'Primitive' | 'Industrial' | 'Spacefaring' | 'Hyper-Advanced';
export type FactionId = 'vega_collective' | 'olyndar_psion' | 'xenomilitary_ash' | 'free_traders' | 'aethelgard_guardians';

export interface FactionData {
    id: FactionId;
    name: string;
    shortName: string;
    emblem: string;
    color: string;
    colorCss: string;
    doctrine: string;
    description: string;
    specialTrait: string;
    baseDisposition: 'Pacifist' | 'Defensive' | 'Militaristic';
}

export interface QuantumWalkEra {
    eraName: string;
    event: string;
    paradoxDetail: string;
    culturalShift: string;
}

export interface QuantumCivState {
    qubitStateVector: number[];
    entanglementIndex: number;
    societalArchetype: string;
    paradoxFactor: number;
    historyEras: QuantumWalkEra[];
    factionId: FactionId;
    worshipsPlayer: boolean;
    quantumTechLevel: TechLevel;
    psionicAffinityScore: number;
    militaryDoctrine: 'Pacifist' | 'Defensive' | 'Militaristic' | 'Fanatic Zealot';
    quantumCollapseLog: string;
}

export interface StarData {
    type: string;
    color: string;
    size: number;
    mass: number;
    colorCss?: string;
}

export type SpeciesLifespanCategory = 'ephemeral' | 'mortal' | 'longlived' | 'ancient';

export interface CrewMember {
    id: number;
    name: string;
    species: string;
    speciesType?: SpeciesLifespanCategory;
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

    // Lifespan & Biological Aging System
    age: number; // Elapsed lifespan in seconds
    maxLifespan: number; // Max lifespan in seconds
    ageCategory?: 'vital' | 'mature' | 'senescent' | 'critical';
    rejuvenationCount?: number;
}

export interface SpeciesData {
    hasSentient: boolean;
    name: string;
    population: number;
    candidates: CrewMember[];
    techLevel?: TechLevel;
    defenseRating?: number;
    fleetDisposition?: 'Pacifist' | 'Defensive' | 'Militaristic';
    factionId?: FactionId;
    quantumCiv?: QuantumCivState | null;
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

export type SectorId = 'sector_outer_rim' | 'sector_mid_rim' | 'sector_core';

export interface SectorInfo {
    id: SectorId;
    name: string;
    description: string;
    act: 1 | 2 | 3;
    minRadius: number;
    maxRadius: number;
    color: string;
    hazardLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
}

export interface StarSystem {
    id: number;
    name: string;
    x: number;
    z: number;
    sectorId?: SectorId | string;
    sectorName?: string;
    anomalyType?: 'none' | 'flare_star' | 'dark_energy_rift' | 'pulsar' | 'ancient_beacon' | 'supermassive_black_hole' | string;
    isCoreAnchor?: boolean;
    star: StarData;
    planets: PlanetData[];
    asteroids?: any[];
}

export interface UniverseMetadata {
    generator: string;
    generatorMode: 'IBM_QPU' | 'LOCAL_SIMULATOR' | 'PSEUDO_MOCK' | string;
    backendName: string;
    jobId?: string | null;
    shots: number;
    qubits: number;
    generatedAt: string;
    systemCount: number;
    sectors: string[];
}

export interface UniverseData {
    name?: string;
    meta?: UniverseMetadata;
    systems: StarSystem[];
}

export interface GravitySource {
    mesh: THREE.Object3D;
    type: 'planet' | 'asteroid' | 'star' | 'ship_wreck';
    name: string;
    mass: number;
    radius: number;
    gravityRange: number;
    position: THREE.Vector3;
    isResource?: boolean;
    resourceType?: 'bio' | 'energy' | 'silicon';
    isAbsorbed?: boolean;
    rotSpeed?: { x: number; y: number; z: number };
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
    baseDistance?: number;
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

export interface FleetShip {
    id: number;
    mesh: THREE.Group;
    bodyMesh: THREE.Mesh;
    trailMesh?: THREE.Line | null;
    type: 'interceptor' | 'corvette';
    name: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    homePlanet: PlanetEntry;
    orbitRadius: number;
    orbitAngle: number;
    orbitSpeed: number;
    health: number;
    maxHealth: number;
    state: 'patrol' | 'intercept' | 'disabled' | 'stunned';
    stunTimer?: number;
    stunMaxDuration?: number;
    sparkTimer?: number;
    originalColor?: number;
    attackCooldown: number;
    alertTimer: number;
}

export interface FleetProjectile {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    damage: number;
    type: 'laser' | 'emp';
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
    isGameOver: boolean;
    systemsVisited: number;
    visitedSystemIds: number[];

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
    retroThrustStrength: number;
    turnSpeed: number;
    shipHeading: number;
    shipAngularVelocity: number;
    flightAssist: boolean;
    shipSpeed: number;
    progradeVector: THREE.Vector3;
    drag: number;
    brakeDrag: number;
    currentDrag: number;
    gConstant: number;
    collisionCooldown: number;
    keys: {
        w: boolean;
        s: boolean;
        a: boolean;
        d: boolean;
        Space: boolean;
        x: boolean;
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

    // Spacefaring Fleet System (Phase B)
    fleetShips: FleetShip[];
    fleetProjectiles: FleetProjectile[];
    bioDischargeCooldown: number;
    empCharging?: boolean;
    empChargeTimer?: number;

    // Faction Reputation & Diplomacy (Phase C/D)
    reputation: Record<FactionId, number>;
    activeDiplomacyPlanet: PlanetEntry | null;

    cameraHeight?: number;
    targetCameraHeight?: number;
    cameraLookTarget?: THREE.Vector3;
    isInPlanetOrbit?: boolean;
    orbitPlanet?: PlanetEntry | null;
    orbitZoomFactor?: number;
}

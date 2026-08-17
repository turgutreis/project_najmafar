import * as THREE from 'three';
import { GameState } from '../types/game';

export const STATE: GameState = {
    // Player Stats
    health: 100,
    maxHealth: 100,
    bioEnergy: 100,
    maxBioEnergy: 100,
    mentalEnergy: 100,
    maxMentalEnergy: 100,
    telepathyActive: false,
    gameStarted: false,
    isGameOver: false,
    systemsVisited: 1,

    // Evolution Resources
    bioRes: 0,
    siliconRes: 0,

    // Sensor & Travel Limits
    psionicRange: 75,
    warpRange: 90,

    // Crew Management & Synergies
    maxCrewCapacity: 2,
    crewSatietyTimer: 0,
    crewDialogueTimer: 15,
    crewBuffs: {
        thrust: 1.0,
        bioGain: 1.0,
        scanSpeed: 1.0,
        repairRate: 0,
        stressDampening: 1.0,
        psionicBonus: 0
    },

    // Mutations
    mutations: {
        armor: { purchased: false, bioCost: 180, siliconCost: 110 },
        o2: { purchased: false, bioCost: 140, siliconCost: 60 },
        synapses: { purchased: false, bioCost: 260, siliconCost: 160 },
        cocoon: { purchased: false, bioCost: 320, siliconCost: 140 },
        hivemind: { purchased: false, bioCost: 500, siliconCost: 320 },
        folddrive: { purchased: false, bioCost: 380, siliconCost: 420 },
        translator: { purchased: false, bioCost: 120, siliconCost: 80 }
    },

    // Physics
    playerPosition: new THREE.Vector3(0, 0, 65),
    playerVelocity: new THREE.Vector3(5, 0, 0),
    playerAcceleration: new THREE.Vector3(0, 0, 0),
    thrustStrength: 25.0,
    drag: 0.4,
    brakeDrag: 2.2,
    currentDrag: 0.4,
    gConstant: 15.0,
    collisionCooldown: 0,
    keys: {
        w: false,
        s: false,
        a: false,
        d: false,
        Space: false,
        x: false
    },

    // Quantum Universe
    universe: null,
    currentSystemId: 0,

    // Scanner, Harvesting & Abduction System
    nearestPlanet: null,
    lockedTarget: null,
    scanningPlanet: null,
    scanProgress: 0,
    scannedPlanets: {},

    extractingPlanet: null,
    harvestProgress: 0,

    abductActive: false,
    abductTarget: null,
    abductProgress: 0,

    // Crew & Psych
    crew: [],
    loneliness: 80,

    // Active Simulation
    gravitySources: [],
    asteroids: [],
    playerGroup: null,

    // Spacefaring Fleet System (Phase B)
    fleetShips: [],
    fleetProjectiles: [],
    bioDischargeCooldown: 0
};

export const activePlanets: any[] = [];

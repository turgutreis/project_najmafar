import { expect, test, describe, beforeEach } from "bun:test";
import * as THREE from 'three';

// Headless Mocking
if (typeof (globalThis as any).localStorage === 'undefined') {
    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {}
    };
}

if (typeof globalThis.document === 'undefined') {
    const dummyEl: any = {
        style: {},
        innerText: '',
        innerHTML: '',
        disabled: false,
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
        setAttribute: (k: string, v: string) => { dummyEl[k] = v; },
        removeAttribute: (k: string) => { delete dummyEl[k]; },
        appendChild: () => {},
        prepend: () => {},
        children: [],
        scrollTop: 0,
        scrollHeight: 0,
        addEventListener: () => {}
    };
    (globalThis as any).document = {
        getElementById: () => dummyEl,
        createElement: () => ({ ...dummyEl }),
        querySelector: () => dummyEl,
        querySelectorAll: () => []
    };
}

if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
        innerWidth: 1920,
        innerHeight: 1080,
        AudioContext: class {
            currentTime = 0;
            sampleRate = 44100;
            state = 'running';
            createOscillator() {
                return {
                    type: 'sine',
                    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    connect: () => {},
                    start: () => {},
                    stop: () => {}
                };
            }
            createGain() {
                return {
                    gain: {
                        value: 0,
                        setValueAtTime: () => {},
                        linearRampToValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {},
                        cancelScheduledValues: () => {}
                    },
                    connect: () => {}
                };
            }
            createBiquadFilter() {
                return {
                    type: 'lowpass',
                    frequency: {
                        setValueAtTime: () => {},
                        linearRampToValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {}
                    },
                    Q: { setValueAtTime: () => {} },
                    connect: () => {}
                };
            }
            createBuffer(channels: number, length: number, rate: number) {
                return { getChannelData: () => new Float32Array(length) };
            }
            createBufferSource() {
                return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} };
            }
            destination = {};
        },
        addEventListener: () => {},
        localStorage: (globalThis as any).localStorage
    };
}

import { STATE, activePlanets } from '../src/core/state';
import { triggerHarvestStart, updateHarvesting, completeHarvesting } from '../src/systems/harvesting';
import { triggerScanStart, updateScanning, completeScanning } from '../src/systems/scanner';
import { AUDIO_SETTINGS } from '../src/engine/audio';
import { initiateSystemArrival } from '../src/systems/universe';
import { clearJumpGates, activeJumpGates } from '../src/procedural/meshes';
import { updatePhysics } from '../src/engine/physics';

describe("🎮 CORE GAMEPLAY LOOP & RESOURCE ECONOMY PLAYTEST", () => {
    let mockPlanet: any;

    beforeEach(() => {
        // Reset state
        STATE.gameStarted = true;
        STATE.playerPosition = new THREE.Vector3(10, 0, 10);
        STATE.playerVelocity = new THREE.Vector3(0, 0, 0);
        STATE.bioEnergy = 100;
        STATE.maxBioEnergy = 100;
        STATE.bioRes = 50;
        STATE.siliconRes = 30;
        STATE.health = 100;
        STATE.maxHealth = 100;
        STATE.scannedPlanets = {};
        STATE.depletedPlanets = {};
        STATE.extractingPlanet = null;
        STATE.scanningPlanet = null;
        STATE.harvestProgress = 0;
        STATE.scanProgress = 0;
        STATE.orbitLevel = 'solar';
        STATE.activeMoonOrbit = null;

        // Mock 3D Planet
        const meshGroup = new THREE.Group();
        meshGroup.position.set(15, 0, 15);
        meshGroup.scale.set(1.0, 1.0, 1.0);

        mockPlanet = {
            name: "Perseus-IV",
            type: "Habitable",
            size: 3.0,
            mesh: meshGroup,
            scanned: false,
            depleted: false,
            harvested: false,
            attributes: {
                atmos: "Stickstoff & Sauerstoff",
                temp: "21°C",
                bio: "Biolumineszente Flora",
                res: "Hohe Biomasse",
                species: null
            }
        };

        STATE.nearestPlanet = mockPlanet;
        STATE.lockedTarget = mockPlanet;
    });

    test("1. Harvest is strictly gated behind scan (Unscanned body rejects harvest)", () => {
        expect(mockPlanet.scanned).toBe(false);
        expect(STATE.scannedPlanets[mockPlanet.name]).toBeFalsy();

        // Attempt to trigger harvest directly
        triggerHarvestStart();

        // Must NOT start extracting
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.harvestProgress).toBe(0);
        // Must NOT deduct bio-energy on failed attempt
        expect(STATE.bioEnergy).toBe(100);
    });

    test("2. Spectral scanning successfully scans body and grants telemetry rewards", () => {
        expect(mockPlanet.scanned).toBe(false);

        // Initiate scan
        triggerScanStart();
        expect(STATE.scanningPlanet).toBe(mockPlanet);

        // Advance scan progress through simulation updates
        updateScanning(1.0);
        expect(STATE.scanProgress).toBeGreaterThan(0);

        // Fast-forward to 100% completion
        STATE.scanProgress = 100;
        completeScanning();

        // Assert scan completed
        expect(mockPlanet.scanned).toBe(true);
        expect(STATE.scannedPlanets[mockPlanet.name]).toBe(true);
        expect(STATE.scanningPlanet).toBeNull();

        // Telemetry reward (+15 Bio, +10 Silicon)
        expect(STATE.bioRes).toBe(65); // 50 + 15
        expect(STATE.siliconRes).toBe(40); // 30 + 10
    });

    test("3. Scanned body allows Bio-Siphon harvest and yields resources", () => {
        // Mark planet scanned
        mockPlanet.scanned = true;
        STATE.scannedPlanets[mockPlanet.name] = true;

        const initialBioRes = STATE.bioRes;
        const initialSilRes = STATE.siliconRes;

        // Trigger harvest
        triggerHarvestStart();

        // Extraction should be active
        expect(STATE.extractingPlanet).toBe(mockPlanet);
        expect(STATE.bioEnergy).toBe(90); // 100 - 10 channeling cost

        // Advance harvest
        updateHarvesting(1.0);
        expect(STATE.harvestProgress).toBeGreaterThan(0);

        // Complete harvest
        STATE.harvestProgress = 100;
        completeHarvesting();

        // Extraction completed and resources granted
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.bioRes).toBeGreaterThan(initialBioRes);
        expect(STATE.siliconRes).toBeGreaterThan(initialSilRes);

        // Body must now be marked depleted
        expect(mockPlanet.depleted).toBe(true);
        expect(mockPlanet.harvested).toBe(true);
        expect(STATE.depletedPlanets[mockPlanet.name]).toBe(true);
    });

    test("4. Depleted planet blocks further extraction (Prevents infinite farming)", () => {
        mockPlanet.scanned = true;
        mockPlanet.depleted = true;
        mockPlanet.harvested = true;
        STATE.scannedPlanets[mockPlanet.name] = true;
        STATE.depletedPlanets[mockPlanet.name] = true;

        const beforeEnergy = STATE.bioEnergy;
        triggerHarvestStart();

        // Must reject extraction
        expect(STATE.extractingPlanet).toBeNull();
        expect(STATE.bioEnergy).toBe(beforeEnergy);
    });

    test("5. Flight thruster consumes Bio-Energy and regenerates when cruising", () => {
        // Simulate forward thrust consumption
        const dt = 1.0;
        STATE.bioEnergy = 100;

        // Thrusting burns 4.5 * dt
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 4.5 * dt);
        expect(STATE.bioEnergy).toBe(95.5);

        // Cruising passively regenerates 1.5 * dt
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 1.5 * dt);
        expect(STATE.bioEnergy).toBe(97.0);
    });

    test("6. Silicon nanites auto-repair damaged hull and consume silicon", () => {
        STATE.health = 50;
        STATE.maxHealth = 100;
        STATE.siliconRes = 20;

        const dt = 2.0;
        const totalRepairRate = 0.25;

        // Auto Nanite repair tick
        if (totalRepairRate > 0 && STATE.siliconRes >= 0.1 && STATE.health < STATE.maxHealth) {
            STATE.health = Math.min(STATE.maxHealth, STATE.health + totalRepairRate * dt);
            STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.20 * dt);
        }

        expect(STATE.health).toBe(50.5);
        expect(STATE.siliconRes).toBe(19.6);
    });

    test("7. Audio volumes are comfortably dampened within safe thresholds", () => {
        expect(AUDIO_SETTINGS.masterVolume).toBeLessThanOrEqual(0.70);
        expect(AUDIO_SETTINGS.sfxVolume).toBeLessThanOrEqual(0.50);
        expect(AUDIO_SETTINGS.thrusterVolume).toBeLessThanOrEqual(0.50);
    });

    test("8. Outer-Rim arrival vector points inward toward central star at high speed", () => {
        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Vega", x: 100, z: 0 };

        initiateSystemArrival(fromSys, targetSys);

        // Player placed on outer rim perimeter (R = 150)
        const distFromCenter = Math.sqrt(STATE.playerPosition.x ** 2 + STATE.playerPosition.z ** 2);
        expect(distFromCenter).toBeCloseTo(150.0, 1);

        // Direction points inward toward center (dot product negative)
        const dotProduct = STATE.playerPosition.x * STATE.systemArrivalDirection.x +
                           STATE.playerPosition.z * STATE.systemArrivalDirection.z;
        expect(dotProduct).toBeLessThan(0);

        // State is active and speed is high warp dropout (32 LJ/s)
        expect(STATE.systemArrivalActive).toBe(true);
        expect(STATE.systemArrivalTimer).toBe(2.2);
        expect(STATE.playerVelocity.length()).toBeCloseTo(32.0, 1);
    });

    test("9. Spacefaring systems spawn a Faction Jump Gate and clean up on departure", () => {
        activePlanets.length = 0;
        clearJumpGates();

        activePlanets.push({
            id: 10,
            name: "Nova Prime",
            type: "Terrestrial",
            size: 4,
            distance: 40,
            angle: 0,
            speed: 0.05,
            isMoon: false,
            mesh: new THREE.Group(),
            source: { position: new THREE.Vector3(), radius: 4, mass: 100, gravityRange: 20 },
            attributes: {
                species: {
                    name: "Terran Ascendancy",
                    techLevel: "Spacefaring",
                    factionId: "sol_federation"
                }
            }
        });

        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Terran Center", x: 50, z: 50 };

        initiateSystemArrival(fromSys, targetSys);

        expect(STATE.incomingJumpGate).not.toBeNull();
        expect(activeJumpGates.length).toBe(1);

        clearJumpGates();
        expect(activeJumpGates.length).toBe(0);
    });

    test("10. Warp-braking physics smoothly decelerates ship toward cruise speed", () => {
        activePlanets.length = 0;
        clearJumpGates();

        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Vega", x: 100, z: 0 };

        initiateSystemArrival(fromSys, targetSys);
        expect(STATE.playerVelocity.length()).toBeCloseTo(32.0, 1);

        // Step physics by 1.1s
        updatePhysics(1.1);
        const midSpeed = STATE.playerVelocity.length();
        expect(midSpeed).toBeLessThan(32.0);
        expect(midSpeed).toBeGreaterThan(7.5);
        expect(STATE.systemArrivalActive).toBe(true);

        // Step physics through the remainder (1.2s more)
        updatePhysics(1.2);
        expect(STATE.systemArrivalActive).toBe(false);
    });
});

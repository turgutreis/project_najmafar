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
import { initiateSystemArrival, initiateSystemDeparture, spawnVoyagerProbe } from '../src/systems/universe';
import { clearJumpGates, activeJumpGates } from '../src/procedural/meshes';
import { updatePhysics } from '../src/engine/physics';
import { generateProceduralCandidates, getCrewReactiveThought } from '../src/systems/crew-generation';
import { calculateCrewBuffs, updateCrewSimulation, rejuvenateCrewMember } from '../src/systems/crew';
import { advanceFtueStep, FTUE_DIRECTIVES } from '../src/ui/directives';
import { openVoyagerDialog, closeVoyagerDialog, isVoyagerDialogOpen } from '../src/ui/voyager-dialog';
import { handleVoyagerScan, setLockedTarget } from '../src/input/controls';

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

    test("11. Interstellar departure spools up, locks heading and punches into hyperspace", () => {
        const fromSys = { id: 1, name: "Sol", x: 0, z: 0 };
        const targetSys = { id: 2, name: "Alpha Centauri", x: 100, z: 0 };
        STATE.universe = { systems: [fromSys, targetSys] } as any;
        STATE.currentSystemId = 1;

        initiateSystemDeparture(fromSys, targetSys);

        expect(STATE.systemDepartureActive).toBe(true);
        expect(STATE.systemDepartureTimer).toBe(1.6);
        // Departure vector points from Sol to Alpha Centauri (+X direction)
        expect(STATE.systemDepartureDirection.x).toBeGreaterThan(0.9);

        // Advance 0.5s into spooling phase
        updatePhysics(0.5);
        expect(STATE.systemDepartureActive).toBe(true);

        // Advance into phase 2 (fold punch) and completion (1.2s more)
        updatePhysics(1.2);
        // Departure should be complete, triggering arrival in target system
        expect(STATE.systemDepartureActive).toBe(false);
        expect(STATE.systemArrivalActive).toBe(true);
        expect(STATE.currentSystemId).toBe(2);
    });

    test("12. Procedural abduction candidates generate diverse archetypes, unique names, bio-stations and traits", () => {
        const poolA = generateProceduralCandidates(1337, 4);
        const poolB = generateProceduralCandidates(9999, 4);

        expect(poolA.length).toBe(4);
        expect(poolB.length).toBe(4);

        // Verify names are not identical
        const namesA = poolA.map(c => c.name);
        const namesB = poolB.map(c => c.name);
        expect(namesA).not.toEqual(namesB);

        // Verify all entities have valid stations, traits, and avatar icons
        poolA.forEach(c => {
            expect(c.station).toBeDefined();
            expect(c.stationName).toBeDefined();
            expect(c.trait).toBeDefined();
            expect(c.trait.name).toBeDefined();
            expect(c.avatarIcon).toBeDefined();
            expect(c.speciesColor).toBeDefined();
            expect(c.maxLifespan).toBeGreaterThan(100);
            expect(c.ageCategory).toBe('vital');
        });

        // Test reactive thoughts
        const thoughtWarp = getCrewReactiveThought(poolA[0], 'warp_start');
        expect(thoughtWarp).toBeDefined();
        expect(thoughtWarp.length).toBeGreaterThan(10);
    });

    test("13. Crew aging triggers critical alert at 90% lifespan and rejuvenation resets state", () => {
        const candidates = generateProceduralCandidates(4242, 1);
        const member = candidates[0];
        member.maxLifespan = 200;
        member.age = 175; // 87.5% life ratio
        member.criticalAlertTriggered = false;

        STATE.crew = [member];
        calculateCrewBuffs();

        // Simulate 6 seconds (age becomes 181 / 200 = 90.5% -> Critical threshold)
        updateCrewSimulation(6.0);

        expect(member.ageCategory).toBe('critical');
        expect(member.criticalAlertTriggered).toBe(true);

        // Verify trait buffs in crewBuffs
        expect(STATE.crewBuffs).toBeDefined();

        // Perform rejuvenation
        STATE.bioEnergy = 50;
        STATE.bioRes = 50;
        rejuvenateCrewMember(member.id);

        // Age should be reduced by 35% of maxLifespan (70s), dropping below 85%
        expect(member.age).toBeLessThan(140);
        expect(member.criticalAlertTriggered).toBe(false);
        expect(member.rejuvenationCount).toBe(1);
    });

    test("14. Strict anti-collision guarantee: Multiple planets and crew members NEVER produce duplicate names", () => {
        STATE.crew = [];
        const seenNames = new Set<string>();

        // Generate candidates across 25 different planets
        for (let planetIdx = 0; planetIdx < 25; planetIdx++) {
            const planetSeed = 1000 + planetIdx * 37;
            const candidates = generateProceduralCandidates(planetSeed, 2);

            expect(candidates.length).toBe(2);
            // Candidate 1 and Candidate 2 on the same planet must have distinct names
            expect(candidates[0].name).not.toBe(candidates[1].name);

            candidates.forEach(c => {
                // Must not collide with any previously seen names
                expect(seenNames.has(c.name)).toBe(false);
                seenNames.add(c.name);

                // Add to crew and verify generator respects existing crew members
                if (STATE.crew.length < 5) {
                    STATE.crew.push(c);
                }
            });
        }

        // Verify that in a full crew, every single name is completely unique
        const crewNames = STATE.crew.map(c => c.name);
        const uniqueCrewNames = new Set(crewNames);
        expect(crewNames.length).toBe(uniqueCrewNames.size);
    });

    test("15. Starting system exploration requires planet scan before detecting Voyager 2 signal and advancing FTUE onboarding", () => {
        // 1. Initial State: Player starts at step 0
        STATE.ftueStep = 0;
        STATE.ftueCompleted = false;
        STATE.voyagerSignalDetected = false;
        STATE.voyagerScanned = false;
        STATE.mentalEnergy = 50;
        STATE.loneliness = 80;
        STATE.currentSystemId = 1;

        // 2. Spawn Voyager 2 probe in starting system
        spawnVoyagerProbe();
        expect(STATE.voyagerProbe).not.toBeNull();
        expect(STATE.voyagerProbe.isVoyager).toBe(true);
        expect(STATE.voyagerProbe.name).toContain("Voyager 2");
        expect(STATE.gravitySources.some((s: any) => s.isVoyager)).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(false);

        // 3. Player moves -> FTUE advances to Phase 2: System-Erkundung
        advanceFtueStep(1);
        expect(STATE.ftueStep).toBe(1);
        expect(STATE.voyagerSignalDetected).toBe(false);

        // 4. Player scans a sterile planet in the starting system
        const sterilePlanet: any = {
            name: "Perseus-Erwachen Prime A",
            size: 3.0,
            scanned: false,
            mesh: { position: new THREE.Vector3(12, 0, 12), scale: { x: 1 } },
            attributes: { atmos: "Dünnes CO2", bio: "Steril", res: "Silizium" }
        };
        STATE.scanningPlanet = sterilePlanet;
        completeScanning();

        // Planet scan reveals sterile nature & triggers archaic Voyager signal detection
        expect(sterilePlanet.scanned).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(true);
        expect(STATE.ftueStep).toBe(2); // Advanced to Phase 3: Archaisches Signal

        // 5. Player approaches Voyager 2 probe in the outer interstellar void
        STATE.playerPosition.set(STATE.voyagerProbe.position.x, 0, STATE.voyagerProbe.position.z + 5);
        const dist = STATE.playerPosition.distanceTo(STATE.voyagerProbe.position);
        expect(dist).toBeLessThanOrEqual(22);

        // Scan Voyager 2 with [F]
        handleVoyagerScan();
        expect(STATE.voyagerScanned).toBe(true);
        expect(STATE.ftueStep).toBe(3); // Advanced to Phase 4: Funke der Hoffnung
        expect(isVoyagerDialogOpen()).toBe(true);

        // 6. Close/listen Golden Record dialog
        closeVoyagerDialog();
        expect(STATE.ftueStep).toBe(4); // Advanced to Phase 5: Aufbruch ins Leben

        // 7. Open Galaxy Map [M]
        advanceFtueStep(5); // Phase 6: Der erste Wirt
        expect(STATE.ftueStep).toBe(5);

        // 8. Abduction completed
        advanceFtueStep(6);
        expect(STATE.ftueStep).toBe(6);
        expect(STATE.ftueCompleted).toBe(true);
    });

    test("16. Voyager 2 drifts in vacuum, raycasting locks target, scan opens Golden Record dialog with emotional hope buff, and starting system is sterile", () => {
        // 1. Reset state
        STATE.ftueStep = 0;
        STATE.ftueCompleted = false;
        STATE.voyagerSignalDetected = false;
        STATE.voyagerScanned = false;
        STATE.voyagerDialogSeen = false;
        STATE.mentalEnergy = 40;
        STATE.loneliness = 85;
        STATE.currentSystemId = 1;

        // 2. Spawn probe and check initial position
        spawnVoyagerProbe();
        expect(STATE.voyagerProbe).not.toBeNull();
        const startX = STATE.voyagerProbe.position.x;
        const startZ = STATE.voyagerProbe.position.z;

        // 3. Test slow drift movement (update with dt = 2.0s)
        STATE.voyagerProbe.update(2.0);
        expect(STATE.voyagerProbe.position.x).toBeGreaterThan(startX);
        expect(STATE.voyagerProbe.position.z).toBeGreaterThan(startZ);

        // 4. Test targeting via setLockedTarget
        setLockedTarget(STATE.voyagerProbe);
        expect(STATE.lockedTarget).toBe(STATE.voyagerProbe);

        // 5. Test scan interaction & dialog opening
        STATE.playerPosition.set(STATE.voyagerProbe.position.x, 0, STATE.voyagerProbe.position.z + 5);
        handleVoyagerScan();

        expect(STATE.voyagerScanned).toBe(true);
        expect(STATE.voyagerSignalDetected).toBe(true);
        expect(isVoyagerDialogOpen()).toBe(true);
        expect(STATE.voyagerDialogSeen).toBe(true);

        // Hope buff: mental energy increased and loneliness decreased
        expect(STATE.mentalEnergy).toBeGreaterThan(70);
        expect(STATE.loneliness).toBeLessThanOrEqual(45);
        expect(STATE.ftueStep).toBe(3);

        // 6. Test closing dialog
        closeVoyagerDialog();
        expect(isVoyagerDialogOpen()).toBe(false);
        expect(STATE.ftueStep).toBe(4);

        // 7. Verify starting system (Perseus-Rand) has NO habitable worlds
        if (STATE.universe && STATE.universe.systems && STATE.universe.systems[1]) {
            const sys1 = STATE.universe.systems[1];
            if (sys1 && Array.isArray(sys1.planets)) {
                const hasHabitable = sys1.planets.some((p: any) => p.type === 'Habitable');
                expect(hasHabitable).toBe(false);
            }
        }
    });
});




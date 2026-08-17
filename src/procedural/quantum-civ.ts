import { TechLevel, FactionId, QuantumCivState, QuantumWalkEra } from '../types/game';

// Complex Number Helper for Quantum State Vector
interface Complex {
    r: number; // Real component
    i: number; // Imaginary component
}

function cMul(a: Complex, b: Complex): Complex {
    return {
        r: a.r * b.r - a.i * b.i,
        i: a.r * b.i + a.i * b.r
    };
}

function cNormSq(a: Complex): number {
    return a.r * a.r + a.i * a.i;
}

// Pseudo-random deterministic seed float (0 to 1)
function lcg(seed: number): () => number {
    let s = Math.abs(seed) % 2147483647;
    if (s === 0) s = 1;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * 8-Qubit Simulated Quantum Processing Register (256 State Amplitudes)
 */
class QpuSimulator {
    private state: Complex[];
    private numQubits = 8;
    private numStates = 256; // 2^8

    constructor(random: () => number) {
        // Initialize in |00000000>
        this.state = new Array(this.numStates).fill(null).map(() => ({ r: 0, i: 0 }));
        this.state[0] = { r: 1, i: 0 };

        // 1. Put Qubits into Superposition via Hadamard Gates
        for (let q = 0; q < this.numQubits; q++) {
            this.applyHadamard(q);
        }

        // 2. Entangle Qubit Pairs via CNOT Gates (Bell State Entanglement Matrix)
        this.applyCNOT(0, 1); // Tech Level <--> Psionic Affinity
        this.applyCNOT(2, 3); // Social Matrix <--> Military Aggression
        this.applyCNOT(4, 5); // Biology/Cybernetics <--> Attitude to Player Bioship
        this.applyCNOT(6, 7); // Expansionism <--> Quantum Relics

        // 3. Apply Quantum Phase Shifts & Interference based on Star System Seed
        for (let q = 0; q < this.numQubits; q++) {
            const angle = random() * Math.PI * 2;
            this.applyPhaseShift(q, angle);
        }
    }

    private applyHadamard(targetQubit: number) {
        const bit = 1 << targetQubit;
        const invSqrt2 = 1 / Math.SQRT2;
        const newState = new Array(this.numStates);

        for (let i = 0; i < this.numStates; i++) {
            if ((i & bit) === 0) {
                const i0 = i;
                const i1 = i | bit;
                const a = this.state[i0];
                const b = this.state[i1];

                newState[i0] = {
                    r: (a.r + b.r) * invSqrt2,
                    i: (a.i + b.i) * invSqrt2
                };
                newState[i1] = {
                    r: (a.r - b.r) * invSqrt2,
                    i: (a.i - b.i) * invSqrt2
                };
            }
        }
        this.state = newState;
    }

    private applyCNOT(controlQubit: number, targetQubit: number) {
        const controlBit = 1 << controlQubit;
        const targetBit = 1 << targetQubit;
        const newState = [...this.state];

        for (let i = 0; i < this.numStates; i++) {
            if ((i & controlBit) !== 0 && (i & targetBit) === 0) {
                const i0 = i;
                const i1 = i | targetBit;
                // Swap amplitudes
                const temp = newState[i0];
                newState[i0] = newState[i1];
                newState[i1] = temp;
            }
        }
        this.state = newState;
    }

    private applyPhaseShift(qubit: number, theta: number) {
        const bit = 1 << qubit;
        const phase: Complex = { r: Math.cos(theta), i: Math.sin(theta) };

        for (let i = 0; i < this.numStates; i++) {
            if ((i & bit) !== 0) {
                this.state[i] = cMul(this.state[i], phase);
            }
        }
    }

    /**
     * Performs a Quantum Wavefunction Collapse Measurement on the 8 Qubits
     */
    public measureWavefunction(random: () => number): { stateIndex: number; bits: number[] } {
        // Calculate probability distribution P(x) = |psi(x)|^2
        const probabilities = this.state.map(cNormSq);
        const r = random();

        let cumulative = 0;
        let selectedState = 0;

        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i];
            if (r <= cumulative) {
                selectedState = i;
                break;
            }
        }

        const bits: number[] = [];
        for (let q = 0; q < this.numQubits; q++) {
            bits.push((selectedState >> q) & 1);
        }

        return { stateIndex: selectedState, bits };
    }
}

/**
 * 12-Step Discrete-Time Quantum Walk History Generator
 */
function generateQuantumWalkHistory(systemSeed: number, bits: number[]): QuantumWalkEra[] {
    const random = lcg(systemSeed + 999);

    const eraPool: { name: string; events: string[]; paradoxes: string[]; shifts: string }[] = [
        {
            name: "Epoche des Ersten Flüsterns",
            events: [
                "Erste biologische Synthese primitiver Nervenbündel im Ammoniak-Ozean.",
                "Entdeckung eines pulsierenden Monolithen aus gefrorenem Quanten-Licht.",
                "Spontane telepathische Resonanz der Ur-Sippen während einer planetaren Sonnenfinsternis."
            ],
            paradoxes: [
                "Ihre ältesten Schriften existieren in zwei diametral entgegengesetzten Bedeutungen gleichzeitig.",
                "Stammesriten basieren auf Gesängen, die vor der Entstehung ihrer Sprache aufgezeichnet wurden."
            ],
            shifts: "Kollektive Meditation etablierte sich als primäres Kommunikationsmittel."
        },
        {
            name: "Das Zeitalter der Dekohärenz",
            events: [
                "Bürgerkrieg zwischen Mechanisten und den Priestern der organischen Leere.",
                "Spaltung des Heimatplaneten durch planetare Gravitations-Kerne.",
                "Plötzlicher Stillstand aller siliziumbasierten Verbrennungsmotoren durch einen psionischen Puls."
            ],
            paradoxes: [
                "Historiker fanden Denkmäler für Siege in Schlachten, die laut Sternenkarten nie stattfanden.",
                "Die gesamte Kriegsflotte löste sich bei der Friedensunterzeichnung in bio-elektrischen Nebel auf."
            ],
            shifts: "Die Gesellschaft verbot isolierte Individualität und bildete telepathische Synapsen-Räte."
        },
        {
            name: "Die Ära des Faltungs-Tors",
            events: [
                "Durchbruch in der Raumzeit-Krümmung ohne mechanischen Fusionsantrieb.",
                "Erster physischer Kontakt mit einer Nomaden-Karawane des Konsortiums.",
                "Errichtung eines 400 Kilometer weiten Orbital-Habitats aus lebendem Chitin."
            ],
            paradoxes: [
                "Ihre Forscherschiffe kehrten 200 Jahre vor ihrem Starttermin unversehrt zurück.",
                "Ihre Navigatoren sehen die Zukunft der Galaxie als eine flüssige, organische Wand."
            ],
            shifts: "Verankerung der Lehre vom 'Kosmischen Wanderer' im planetaren Gesetz."
        }
    ];

    const eras: QuantumWalkEra[] = [];
    eraPool.forEach(pool => {
        const evIdx = Math.floor(random() * pool.events.length);
        const parIdx = Math.floor(random() * pool.paradoxes.length);

        eras.push({
            eraName: pool.name,
            event: pool.events[evIdx],
            paradoxDetail: pool.paradoxes[parIdx],
            culturalShift: pool.shifts
        });
    });

    return eras;
}

/**
 * Main Public Function: Generates or Collapses a Quantum Civilization
 */
export function collapseQuantumCivilization(systemId: number, planetIndex: number, seed: number): QuantumCivState {
    const random = lcg(seed * 7331 + systemId * 137 + planetIndex * 43);

    // 1. Simulate 8-Qubit Register & Measure
    const qpu = new QpuSimulator(random);
    const { stateIndex, bits } = qpu.measureWavefunction(random);

    // 2. Decode Entangled Qubit Pairs
    // Q0, Q1: Tech Level & Psionic Affinity
    const techCode = (bits[1] << 1) | bits[0];
    let techLevel: TechLevel = 'Primitive';
    let psionicAffinity = 25;
    if (techCode === 1) { techLevel = 'Industrial'; psionicAffinity = 45; }
    else if (techCode === 2) { techLevel = 'Spacefaring'; psionicAffinity = 75; }
    else if (techCode === 3) { techLevel = 'Hyper-Advanced'; psionicAffinity = 95; }

    // Q2, Q3: Societal Structure & Military Doctrine
    const socialCode = (bits[3] << 1) | bits[2];
    let archetype = "Symbiotische Bio-Kommune";
    let doctrine: 'Pacifist' | 'Defensive' | 'Militaristic' | 'Fanatic Zealot' = 'Defensive';
    let factionId: FactionId = 'free_traders';

    if (socialCode === 0) {
        archetype = "Telepathischer Synapsen-Schwarm";
        doctrine = 'Pacifist';
        factionId = 'olyndar_psion';
    } else if (socialCode === 1) {
        archetype = "Kybernetisches Nullpunkt-Kollektiv";
        doctrine = 'Defensive';
        factionId = 'vega_collective';
    } else if (socialCode === 2) {
        archetype = "Merkantile Gilden-Konföderation";
        doctrine = 'Pacifist';
        factionId = 'free_traders';
    } else {
        archetype = "Xenomilitärischer Kreuzzug";
        doctrine = 'Militaristic';
        factionId = 'xenomilitary_ash';
    }

    if (techLevel === 'Hyper-Advanced' && bits[6] === 1) {
        archetype = "Ewige Vorläufer-Wächter";
        doctrine = 'Defensive';
        factionId = 'aethelgard_guardians';
    }

    // Q4, Q5: Attitude to Player Bioship
    const worshipCode = (bits[5] << 1) | bits[4];
    const worshipsPlayer = worshipCode === 0 || factionId === 'olyndar_psion';

    // 3. Generate History via Quantum Walk
    const historyEras = generateQuantumWalkHistory(seed, bits);

    // 4. Calculate Quantum Entanglement Metrics
    const entanglementIndex = Math.round(55 + (stateIndex % 45));
    const paradoxFactor = Number(((bits[0] * 0.3 + bits[3] * 0.4 + bits[7] * 0.3) * 1.8 + 0.2).toFixed(2));

    const collapseLog = `|Ψ⟩ kollabiert zu Zustand #${stateIndex.toString(16).toUpperCase()} (${bits.join('')}₂) | Verschränkungsgrad: ${entanglementIndex}%`;

    return {
        qubitStateVector: bits,
        entanglementIndex,
        societalArchetype: archetype,
        paradoxFactor,
        historyEras,
        factionId,
        worshipsPlayer,
        quantumTechLevel: techLevel,
        psionicAffinityScore: psionicAffinity,
        militaryDoctrine: doctrine,
        quantumCollapseLog: collapseLog
    };
}

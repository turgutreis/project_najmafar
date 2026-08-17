import { STATE } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { getAudioContext } from '../engine/audio';

let scanOsc: OscillatorNode | null = null;
let scanGain: GainNode | null = null;

export function generatePlanetAttributes(p: any) {
    const hash = p.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

    let atmos: string, temp: string, bio: string, res: string, species: any;
    if (p.type === 'Habitable') {
        atmos = hash % 2 === 0 ? "Stickstoff & Sauerstoff (Klasse M)" : "Dichte Aerosole & Wasserdampf";
        temp = (15 + (hash % 15)) + "°C";
        bio = hash % 3 === 0 ? "Biolumineszierende Flora" : (hash % 3 === 1 ? "Mikrobielle Kolonien" : "Komplexes Ökosystem");
        res = "Reich an Biomasse, Kohlenstoff & O2";

        const candidatePool = [
            { name: "Capt. Alan Miller", species: "Mensch / Terraner", role: "pilot", roleName: "🧑‍✈️ Chef-Navigator", buffDesc: "+15% Schub & -15% Manöverkosten", baseStressRate: 0.30 },
            { name: "Dr. Elena Song", species: "Mensch / Terranerin", role: "biologist", roleName: "🔬 Xenobiologin", buffDesc: "+30% Bio-Ertrag & +25% Scan-Speed", baseStressRate: 0.25 },
            { name: "Ing. Viktor Petrov", species: "Mensch / Terraner", role: "engineer", roleName: "🔧 Chef-Ingenieur", buffDesc: "+0.6 HP/s Naniten-Reparatur", baseStressRate: 0.40 },
            { name: "Dr. Julian Vance", species: "Mensch / Terraner", role: "psychologist", roleName: "🧘 Neuro-Therapeut", buffDesc: "-40% Crew-Stressaufbau", baseStressRate: 0.15 },
            { name: "Lt. Kira Novak", species: "Mensch / Terranerin", role: "cryptologist", roleName: "📡 Quanten-Kryptologin", buffDesc: "+30 LJ Psio-Sensorhorizont", baseStressRate: 0.20 },
            { name: "Prof. T'Kora", species: "Vulkanoid", role: "biologist", roleName: "🔬 Bio-Analytikerin", buffDesc: "+30% Bio-Ertrag & +25% Scan-Speed", baseStressRate: 0.10 },
            { name: "Cyber-Adept Rex", species: "Cyborg-Pionier", role: "engineer", roleName: "🔧 Naniten-Meister", buffDesc: "+0.6 HP/s Naniten-Reparatur", baseStressRate: 0.20 },
            { name: "Gesandte Maya", species: "Empathin", role: "psychologist", roleName: "🧘 Gedanken-Diplomatin", buffDesc: "-40% Crew-Stressaufbau", baseStressRate: 0.12 }
        ];

        const c1 = candidatePool[hash % candidatePool.length];
        const c2 = candidatePool[(hash + 3) % candidatePool.length];
        const pool = [
            { ...c1, id: Date.now() + Math.random(), stress: 15, illusionStability: 100, status: "Friedlich", thought: "Arbeitet auf der Forschungsstation..." }
        ];
        if (hash % 2 === 0) {
            pool.push({ ...c2, id: Date.now() + Math.random() + 1, stress: 25, illusionStability: 100, status: "Friedlich", thought: "Führt Atmosphärenmessungen durch..." });
        }

        species = {
            hasSentient: true,
            name: pool[0].species.includes("Mensch") ? "Terranische Exploratoren" : `${pool[0].species}-Präsenz`,
            population: pool.length,
            candidates: pool
        };
    } else if (p.type === 'Gas Giant') {
        atmos = hash % 2 === 0 ? "Flüssiges Helium & Wasserstoff" : "Superdichtes Ammoniak & Methan";
        temp = (-120 - (hash % 60)) + "°C";
        bio = hash % 5 === 0 ? "Schwebende Plankton-Analoge" : "Keine Signaturen erfasst";
        res = "Extrem hoher Druck, Deuterium-Vorkommen";
        species = null;
    } else { // Rocky
        atmos = hash % 3 === 0 ? "Dünnes CO2-Vakuum" : (hash % 3 === 1 ? "Schwefeldioxid & Argon" : "Keine Atmosphäre (Vakuum)");
        temp = (hash % 2 === 0 ? "+" : "-") + (hash % 250) + "°C";
        bio = hash % 8 === 0 ? "Extremophile Flechten" : "Steril";
        res = "Reich an Silizium-Kristallen, Eisen & Schwermetallen";
        species = null;
    }

    return { atmos, temp, bio, res, species };
}

export function generateFallbackMoons(p: any) {
    const hash = p.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    let count = 0;
    if (p.type === 'Gas Giant') count = 1 + (hash % 3);
    else if (p.type === 'Habitable') count = hash % 3;
    else count = hash % 2;

    const moons = [];
    for (let i = 0; i < count; i++) {
        const mType = (p.type === 'Gas Giant' || (hash + i) % 3 === 0) ? "Eismond" : (((hash + i) % 3 === 1) ? "Vulkanmond" : "Kratermond");
        const mColor = mType === 'Eismond' ? "0x38bdf8" : (mType === 'Vulkanmond' ? "0xf97316" : "0x94a3b8");
        moons.push({
            name: `${p.name}-${String.fromCharCode(73 + i)}`,
            type: mType,
            size: 0.7 + ((hash + i) % 5) * 0.1,
            distance: p.size + 3.2 + (i * 2.5),
            speed: 0.9 + ((hash + i) % 6) * 0.15,
            color: mColor,
            temp: mType === 'Eismond' ? "-170°C" : (mType === 'Vulkanmond' ? "+220°C" : "-40°C"),
            atmos: mType === 'Eismond' ? "Subglazialer Wasserdampf" : (mType === 'Vulkanmond' ? "Schwefeldioxid-Ausgasungen" : "Vakuum"),
            bio: mType === 'Eismond' ? "Kryophile Mikroben" : (mType === 'Vulkanmond' ? "Schwefel-Synthetisierer" : "Steril"),
            res: mType === 'Eismond' ? "Reich an Deuterium-Eis" : (mType === 'Vulkanmond' ? "Geschmolzenes Titan & Silizium" : "Regolith & Schwermetalle")
        });
    }
    return moons;
}

export function triggerScanStart() {
    if (!STATE.gameStarted || STATE.scanningPlanet || STATE.extractingPlanet || !STATE.nearestPlanet) return;

    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    STATE.scanningPlanet = STATE.nearestPlanet;
    STATE.scanProgress = 0;

    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    const scanBtn = document.getElementById('start-scan-btn');
    if (scanBtn) scanBtn.setAttribute('disabled', 'true');

    startScanSound();
    addLogEntry("SYSTEM", `Spektral-Scan initiiert für: ${STATE.scanningPlanet.name}. Halte Position (Distanz < 20)...`);
}

export function updateScanning(dt: number) {
    if (!STATE.scanningPlanet) return;

    const dx = STATE.playerPosition.x - STATE.scanningPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.scanningPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 25) {
        cancelScanning("Signalverlust. Abstand überschritt Sicherheitsradius.");
        return;
    }

    const scanSpeedMult = (STATE.crewBuffs ? STATE.crewBuffs.scanSpeed : 1.0);
    STATE.scanProgress += dt * 35 * scanSpeedMult;

    const bar = document.getElementById('scan-progress-bar');
    const text = document.getElementById('scan-progress-text');
    if (bar) bar.style.width = `${STATE.scanProgress}%`;
    if (text) text.innerText = `${Math.round(STATE.scanProgress)}%`;

    if (STATE.scanProgress >= 100) {
        completeScanning();
    }
}

export function cancelScanning(reason: string) {
    stopScanSound();
    addLogEntry("SYSTEM", `Scan abgebrochen: ${reason}`);
    STATE.scanningPlanet = null;
    STATE.scanProgress = 0;
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

export function completeScanning() {
    stopScanSound();
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const planet = STATE.scanningPlanet;
    if (planet) {
        planet.scanned = true;
        STATE.scannedPlanets[planet.name] = true;

        STATE.bioRes += 15;
        STATE.siliconRes += 10;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 15);

        addLogEntry("SYSTEM", `Spektral-Scan von ${planet.name} abgeschlossen! Atmosphärendatenbank aktualisiert (+15 Bio | +10 Silizium).`);

        if (planet.attributes.species && planet.attributes.species.population > 0) {
            addLogEntry("SYSTEM", `PSIO-DETEKTION: Intelligentes Leben (${planet.attributes.species.name}) auf ${planet.name} entdeckt! Psionischer Transfer [F] bereit.`);
        }

        updateScannerUI(planet, 10);
    }

    STATE.scanningPlanet = null;
    STATE.scanProgress = 0;
}

export function startScanSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    scanOsc = ctx.createOscillator();
    scanGain = ctx.createGain();
    scanOsc.type = 'sawtooth';
    scanOsc.frequency.setValueAtTime(440, ctx.currentTime);
    scanOsc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 2.5);

    scanGain.gain.setValueAtTime(0, ctx.currentTime);
    scanGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);

    scanOsc.connect(scanGain);
    scanGain.connect(ctx.destination);
    scanOsc.start();
}

export function stopScanSound() {
    if (scanOsc) {
        const ctx = getAudioContext();
        if (ctx && scanGain) {
            scanGain.gain.cancelScheduledValues(ctx.currentTime);
            scanGain.gain.setValueAtTime(scanGain.gain.value, ctx.currentTime);
            scanGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            scanOsc.stop(ctx.currentTime + 0.12);
        } else {
            scanOsc.stop();
        }
        scanOsc = null;
        scanGain = null;
    }
}

export function updateScannerUI(planet: any, dist: number) {
    const nameEl = document.getElementById('nearest-planet-name');
    const distEl = document.getElementById('nearest-planet-distance');
    const scanBtn = document.getElementById('start-scan-btn') as HTMLButtonElement;
    const harvestBtn = document.getElementById('start-harvest-btn');
    const abductBtn = document.getElementById('start-abduct-btn');
    const resultsBox = document.getElementById('scan-results-box');
    const placeholderBox = document.getElementById('scan-placeholder-box');

    if (!planet) {
        if (nameEl) nameEl.innerText = "Keiner in Reichweite";
        if (distEl) distEl.innerText = "-";
        if (scanBtn) scanBtn.disabled = true;
        if (resultsBox) resultsBox.style.display = 'none';
        if (placeholderBox) placeholderBox.style.display = 'block';
        return;
    }

    if (nameEl) nameEl.innerText = `${planet.name} (${planet.isMoon ? 'Mond' : planet.type})`;
    if (distEl) {
        distEl.innerText = `${dist.toFixed(1)} ${dist < 20 ? '(In Sensorreichweite)' : '(Zu weit entfernt)'}`;
        distEl.style.color = dist < 20 ? '#10b981' : '#f59e0b';
    }

    const inRange = dist < 20;
    const isScanned = planet.scanned || STATE.scannedPlanets[planet.name];

    if (scanBtn) {
        scanBtn.disabled = !inRange || isScanned || (STATE.scanningPlanet !== null);
        if (isScanned) {
            scanBtn.innerText = "Oberflächenscan Abgeschlossen ✓";
        } else {
            scanBtn.innerText = inRange ? "Scan initiieren [F]" : "Zu weit entfernt (Ziel < 20 nötig)";
        }
    }

    if (isScanned) {
        if (placeholderBox) placeholderBox.style.display = 'none';
        if (resultsBox) resultsBox.style.display = 'block';

        const titleEl = document.getElementById('scan-planet-title');
        if (titleEl) titleEl.innerText = `Analyse: ${planet.name}`;

        const typeEl = document.getElementById('scan-planet-type');
        if (typeEl) typeEl.innerText = `${planet.type} (${planet.size}x)`;

        const tempEl = document.getElementById('scan-planet-temp');
        if (tempEl) tempEl.innerText = planet.attributes.temp;

        const bioEl = document.getElementById('scan-planet-bio');
        if (bioEl) bioEl.innerText = planet.attributes.bio;

        const atmosEl = document.getElementById('scan-planet-atmos');
        if (atmosEl) atmosEl.innerText = planet.attributes.atmos;

        const resEl = document.getElementById('scan-planet-resources');
        if (resEl) resEl.innerText = planet.attributes.res;

        const speciesRow = document.getElementById('scan-planet-species-row');
        const speciesEl = document.getElementById('scan-planet-species');
        const hasSentient = planet.attributes.species && planet.attributes.species.population > 0;

        if (speciesRow && speciesEl) {
            if (hasSentient) {
                speciesRow.style.display = 'flex';
                speciesEl.innerText = `${planet.attributes.species.name} (Pop: ${planet.attributes.species.population})`;
            } else {
                speciesRow.style.display = 'none';
            }
        }

        if (harvestBtn) {
            harvestBtn.style.display = (inRange && !STATE.extractingPlanet && !STATE.abductActive) ? 'block' : 'none';
        }

        if (abductBtn) {
            abductBtn.style.display = (inRange && hasSentient && !STATE.abductActive && !STATE.extractingPlanet) ? 'block' : 'none';
        }
    } else {
        if (resultsBox) resultsBox.style.display = 'none';
        if (placeholderBox) placeholderBox.style.display = 'block';
        if (harvestBtn) harvestBtn.style.display = 'none';
        if (abductBtn) abductBtn.style.display = 'none';
    }
}

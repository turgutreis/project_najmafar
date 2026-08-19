import { STATE } from '../core/state';
import { createAbductBeam, removeAbductBeam, updateAbductBeam } from '../procedural/meshes';
import { getAudioContext } from '../engine/audio';
import { addLogEntry } from '../ui/hud';
import { calculateCrewBuffs, renderCrewUI } from './crew';
import { updateScannerUI, generatePlanetAttributes } from './scanner';

let abductOsc: OscillatorNode | null = null;
let abductGain: GainNode | null = null;
let abductFilter: BiquadFilterNode | null = null;

export function triggerAbductStart() {
    if (!STATE.gameStarted || STATE.abductActive || STATE.scanningPlanet || STATE.extractingPlanet || !STATE.nearestPlanet) return;

    if (STATE.crew.length >= STATE.maxCrewCapacity) {
        addLogEntry("SYSTEM", `Psionischer Transfer blockiert: Kokon-Kapazität voll (${STATE.crew.length} / ${STATE.maxCrewCapacity})! Erweitere Kapazität im Evolutions-Deck.`);
        return;
    }

    const p = STATE.nearestPlanet;
    const meshScale = p.mesh ? p.mesh.scale.x : 1.0;
    const dx = STATE.playerPosition.x - p.mesh.position.x;
    const dz = STATE.playerPosition.z - p.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxStartDist = Math.max(28.0, (p.size || 3.0) * meshScale * 4.4);

    if (dist > maxStartDist) {
        addLogEntry("SYSTEM", `Zu weit entfernt für psionischen Traktorstrahl (Distanz: ${dist.toFixed(1)} / Max ${maxStartDist.toFixed(0)}).`);
        return;
    }

    // Ensure candidate pool exists for habitable planet
    if (!p.attributes.species || !p.attributes.species.candidates || p.attributes.species.candidates.length === 0) {
        const generated = generatePlanetAttributes(p);
        if (generated.species && generated.species.candidates && generated.species.candidates.length > 0) {
            p.attributes.species = generated.species;
        }
    }

    if (!p.attributes.species || !p.attributes.species.candidates || p.attributes.species.candidates.length === 0) {
        addLogEntry("SYSTEM", `Keine vernunftbegabten Individuen auf ${p.name} für psionische Entführung verfügbar.`);
        return;
    }

    STATE.abductActive = true;
    STATE.abductTarget = p;
    STATE.abductProgress = 0;

    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    createAbductBeam(STATE.playerPosition, p.mesh.position);
    startAbductSound();

    addLogEntry("SYSTEM", `PSIONISCHER TRAKTORSTRAHL AKTIVIERT. Fasse Bewusstsein auf ${p.name} ins Visier...`);
}

export function updateAbduction(dt: number) {
    if (!STATE.abductTarget) return;

    const meshScale = STATE.abductTarget.mesh ? STATE.abductTarget.mesh.scale.x : 1.0;
    const dx = STATE.playerPosition.x - STATE.abductTarget.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.abductTarget.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxHoldDist = Math.max(38.0, (STATE.abductTarget.size || 3.0) * meshScale * 5.0);

    if (dist > maxHoldDist) {
        cancelAbduction(`Ziel außer Reichweite (Distanz: ${dist.toFixed(1)} > ${maxHoldDist.toFixed(0)})`);
        return;
    }

    updateAbductBeam(STATE.playerPosition, STATE.abductTarget.mesh.position);

    STATE.abductProgress += dt * 45; // ~2.2s
    const bar = document.getElementById('abduct-progress-bar');
    const text = document.getElementById('abduct-progress-text');
    if (bar) bar.style.width = `${STATE.abductProgress}%`;
    if (text) text.innerText = `${Math.round(STATE.abductProgress)}%`;

    if (STATE.abductProgress >= 100) {
        completeAbduction();
    }
}

export function cancelAbduction(reason: string) {
    stopAbductSound();
    removeAbductBeam();
    addLogEntry("SYSTEM", `Entführung abgebrochen: ${reason}`);
    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.abductProgress = 0;
    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

export function completeAbduction() {
    stopAbductSound();
    removeAbductBeam();

    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const planet = STATE.abductTarget;
    if (planet) {
        if (!planet.attributes.species || !planet.attributes.species.candidates || planet.attributes.species.candidates.length === 0) {
            const gen = generatePlanetAttributes(planet);
            if (gen.species && gen.species.candidates && gen.species.candidates.length > 0) {
                planet.attributes.species = gen.species;
            }
        }

        if (planet.attributes.species && planet.attributes.species.candidates && planet.attributes.species.candidates.length > 0) {
            const candidate = planet.attributes.species.candidates.shift();
            if (candidate) {
                STATE.crew.push(candidate);
                STATE.crewSatietyTimer = 0;
                calculateCrewBuffs();

                addLogEntry("SYSTEM", `PSIONISCHE ASSIMILATION ERFOLGREICH: ${candidate.name} (${candidate.roleName || candidate.role}) in Kokon-Kammer transferiert.`);
                addLogEntry("CREW", `Traum-Matrix initialisiert. ${candidate.name} aktiviert Rolle: ${candidate.buffDesc}!`);

                renderCrewUI();
                if (STATE.nearestPlanet === planet) {
                    updateScannerUI(planet, 10);
                }
            }
        } else {
            addLogEntry("SYSTEM", `Transfer fehlgeschlagen: Kein psionischer Wirt auf ${planet.name} identifiziert.`);
        }
    }

    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.abductProgress = 0;
}

export function startAbductSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    abductOsc = ctx.createOscillator();
    abductGain = ctx.createGain();
    abductFilter = ctx.createBiquadFilter();

    abductOsc.type = 'triangle';
    abductOsc.frequency.setValueAtTime(330, ctx.currentTime);

    abductFilter.type = 'bandpass';
    abductFilter.frequency.setValueAtTime(440, ctx.currentTime);
    abductFilter.Q.setValueAtTime(3, ctx.currentTime);

    abductGain.gain.setValueAtTime(0, ctx.currentTime);
    abductGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.2);

    abductOsc.connect(abductFilter);
    abductFilter.connect(abductGain);
    abductGain.connect(ctx.destination);
    abductOsc.start();
}

export function stopAbductSound() {
    if (abductOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (abductGain && time) {
            abductGain.gain.cancelScheduledValues(time);
            abductGain.gain.setValueAtTime(abductGain.gain.value, time);
            abductGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            abductOsc.stop(time + 0.2);
        } else {
            abductOsc.stop();
        }
        abductOsc = null;
        abductGain = null;
        abductFilter = null;
    }
}

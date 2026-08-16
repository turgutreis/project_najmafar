import { STATE } from '../core/state';
import { createAbductBeam, removeAbductBeam, updateAbductBeam } from '../procedural/meshes';
import { getAudioContext } from '../engine/audio';
import { addLogEntry } from '../ui/hud';
import { calculateCrewBuffs, renderCrewUI } from './crew';
import { updateScannerUI } from './scanner';

let abductOsc: OscillatorNode | null = null;
let abductGain: GainNode | null = null;
let abductFilter: BiquadFilterNode | null = null;

export function triggerAbductStart() {
    if (!STATE.gameStarted || STATE.abductActive || STATE.scanningPlanet || STATE.extractingPlanet || !STATE.nearestPlanet) return;

    if (STATE.crew.length >= STATE.maxCrewCapacity) {
        addLogEntry("SYSTEM", `Psionischer Transfer blockiert: Kokon-Kapazität voll (${STATE.crew.length} / ${STATE.maxCrewCapacity})! Erweitere Kapazität im Evolutions-Deck.`);
        return;
    }

    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    const p = STATE.nearestPlanet;
    if (!p.attributes.species || p.attributes.species.population <= 0) {
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

    const dx = STATE.playerPosition.x - STATE.abductTarget.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.abductTarget.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 25) {
        cancelAbduction("Ziel außer Reichweite (> 25)");
        return;
    }

    updateAbductBeam(STATE.playerPosition, STATE.abductTarget.mesh.position);

    STATE.abductProgress += dt * 35; // ~2.8s
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
    if (planet && planet.attributes.species && planet.attributes.species.candidates.length > 0) {
        const candidate = planet.attributes.species.candidates.shift();
        planet.attributes.species.population = planet.attributes.species.candidates.length;

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

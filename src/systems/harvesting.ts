import { STATE } from '../core/state';
import { createHarvestBeam, removeHarvestBeam, updateHarvestBeam } from '../procedural/meshes';
import { getAudioContext } from '../engine/audio';
import { addLogEntry } from '../ui/hud';
import { updateMutationUI } from '../ui/deck';

let harvestOsc: OscillatorNode | null = null;
let harvestGain: GainNode | null = null;
let harvestFilter: BiquadFilterNode | null = null;

export function triggerHarvestStart() {
    if (!STATE.gameStarted || STATE.extractingPlanet || STATE.scanningPlanet || STATE.abductActive || !STATE.nearestPlanet) return;

    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    STATE.extractingPlanet = STATE.nearestPlanet;
    STATE.harvestProgress = 0;

    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    createHarvestBeam(STATE.playerPosition, STATE.nearestPlanet.mesh.position);
    startHarvestSound();

    addLogEntry("SYSTEM", `Bio-Siphon aktiviert. Extrahiere planetare Ressourcen von ${STATE.extractingPlanet.name}...`);
}

export function updateHarvesting(dt: number) {
    if (!STATE.extractingPlanet) return;

    const dx = STATE.playerPosition.x - STATE.extractingPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.extractingPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 25) {
        cancelHarvesting("Ziel außer Reichweite (> 25)");
        return;
    }

    updateHarvestBeam(STATE.playerPosition, STATE.extractingPlanet.mesh.position);

    STATE.harvestProgress += dt * 30; // 3.3s to harvest
    const bar = document.getElementById('harvest-progress-bar');
    const text = document.getElementById('harvest-progress-text');
    if (bar) bar.style.width = `${STATE.harvestProgress}%`;
    if (text) text.innerText = `${Math.round(STATE.harvestProgress)}%`;

    if (STATE.harvestProgress >= 100) {
        completeHarvesting();
    }
}

export function cancelHarvesting(reason: string) {
    stopHarvestSound();
    removeHarvestBeam();
    addLogEntry("SYSTEM", `Assimilation abgebrochen: ${reason}`);
    STATE.extractingPlanet = null;
    STATE.harvestProgress = 0;
    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

export function completeHarvesting() {
    stopHarvestSound();
    removeHarvestBeam();

    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const planet = STATE.extractingPlanet;
    if (planet) {
        const bioMult = (STATE.crewBuffs ? STATE.crewBuffs.bioGain : 1.0);
        const bioGain = Math.round((planet.type === 'Habitable' ? 60 : (planet.type === 'Gas Giant' ? 30 : 20)) * bioMult);
        const silGain = Math.round((planet.type === 'Rocky' || planet.isMoon ? 45 : 15) * bioMult);

        STATE.bioRes += bioGain;
        STATE.siliconRes += silGain;
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 35);
        STATE.health = Math.min(STATE.maxHealth, STATE.health + 20);

        addLogEntry("SYSTEM", `Assimilation von ${planet.name} abgeschlossen! +${bioGain} Biomasse | +${silGain} Silizium absorbiert.`);
        updateMutationUI();
    }

    STATE.extractingPlanet = null;
    STATE.harvestProgress = 0;
}

export function startHarvestSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    harvestOsc = ctx.createOscillator();
    harvestGain = ctx.createGain();
    harvestFilter = ctx.createBiquadFilter();

    harvestOsc.type = 'sawtooth';
    harvestOsc.frequency.setValueAtTime(110, ctx.currentTime);

    harvestFilter.type = 'lowpass';
    harvestFilter.frequency.setValueAtTime(400, ctx.currentTime);

    harvestGain.gain.setValueAtTime(0, ctx.currentTime);
    harvestGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);

    harvestOsc.connect(harvestFilter);
    harvestFilter.connect(harvestGain);
    harvestGain.connect(ctx.destination);
    harvestOsc.start();
}

export function stopHarvestSound() {
    if (harvestOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (harvestGain && time) {
            harvestGain.gain.cancelScheduledValues(time);
            harvestGain.gain.setValueAtTime(harvestGain.gain.value, time);
            harvestGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            harvestOsc.stop(time + 0.2);
        } else {
            harvestOsc.stop();
        }
        harvestOsc = null;
        harvestGain = null;
        harvestFilter = null;
    }
}

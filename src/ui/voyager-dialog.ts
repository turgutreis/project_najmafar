import { STATE } from '../core/state';
import { playGoldenRecordAudio, playLockOnSound } from '../engine/audio';
import { addLogEntry, updateHUDStats } from './hud';
import { toggleGalaxyMap } from '../systems/galaxy-map';
import { advanceFtueStep } from './directives';

let isDialogOpen = false;

export function isVoyagerDialogOpen(): boolean {
    return isDialogOpen;
}

export function openVoyagerDialog() {
    const modal = document.getElementById('voyager-dialog-modal');
    if (!modal) return;

    isDialogOpen = true;
    modal.style.display = 'flex';

    // Play golden record audio
    try {
        playGoldenRecordAudio();
    } catch (e) {
        console.warn("Could not play Golden Record audio immediately", e);
    }

    // Apply the emotional hope breakthrough once
    if (!STATE.voyagerDialogSeen) {
        STATE.voyagerDialogSeen = true;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 50);
        STATE.loneliness = Math.max(10, STATE.loneliness - 40);
        updateHUDStats();

        addLogEntry("SYSTEM", "PSIONISCHER DURCHBRUCH: Die Botschaft der Menschheit schenkt der Najmafar neue Hoffnung.");
        addLogEntry("CREW", "Gedanken-Resonanz: Die tiefe seelische Kälte weicht. Deine Lebensgeister erwachen!");
        addLogEntry("NAV", "Interstellare Vektoren kalibriert: Kurs auf habitable Biosphäre im Nachbarsystem freigeschaltet.");
    }
}

export function closeVoyagerDialog() {
    const modal = document.getElementById('voyager-dialog-modal');
    if (!modal) return;

    isDialogOpen = false;
    modal.style.display = 'none';
    advanceFtueStep(4);
}

export function initVoyagerDialogListeners() {
    const modal = document.getElementById('voyager-dialog-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeVoyagerDialog();
            }
        });
    }

    const closeBtn = document.getElementById('close-voyager-dialog-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeVoyagerDialog();
        });
    }

    const continueBtn = document.getElementById('voyager-continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeVoyagerDialog();
        });
    }

    const replayBtn = document.getElementById('voyager-replay-audio-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGoldenRecordAudio();
            addLogEntry("VOYAGER", "♫ 'Hello from the children of planet Earth...' – Analoge Aufnahme erneut abgespielt.");
        });
    }

    const mapBtn = document.getElementById('voyager-open-map-btn');
    if (mapBtn) {
        mapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeVoyagerDialog();
            toggleGalaxyMap();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!isDialogOpen) return;
        if (e.key === 'Escape' || e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            closeVoyagerDialog();
        }
    });
}

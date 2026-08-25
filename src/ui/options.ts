import { 
    AUDIO_SETTINGS, 
    setMasterVolume, 
    setMusicVolume, 
    setSfxVolume, 
    setThrusterVolume, 
    setSpatialAudio, 
    resetAudioSettings,
    QUANTUM_PLAYLIST,
    getCurrentTrack,
    getCurrentTrackIndex,
    selectTrackIndex,
    nextTrack,
    prevTrack
} from '../engine/audio';

let isOptionsOpen = false;

export function initOptionsUI() {
    const modal = document.getElementById('options-modal');
    const closeBtn = document.getElementById('options-close-btn');
    const saveBtn = document.getElementById('opt-save-btn');
    const resetBtn = document.getElementById('opt-reset-btn');
    const menuOptionsBtn = document.getElementById('menu-options-btn');
    const hudOptionsBtn = document.getElementById('hud-options-btn');

    // Sliders
    const masterSlider = document.getElementById('opt-master-slider') as HTMLInputElement | null;
    const musicSlider = document.getElementById('opt-music-slider') as HTMLInputElement | null;
    const sfxSlider = document.getElementById('opt-sfx-slider') as HTMLInputElement | null;
    const thrusterSlider = document.getElementById('opt-thruster-slider') as HTMLInputElement | null;
    const spatialChk = document.getElementById('opt-spatial-chk') as HTMLInputElement | null;

    // Track Navigation
    const prevTrackBtn = document.getElementById('opt-prev-track-btn');
    const nextTrackBtn = document.getElementById('opt-next-track-btn');

    // Open / Close events
    if (menuOptionsBtn) {
        menuOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOptionsModal();
        });
    }

    if (hudOptionsBtn) {
        hudOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOptionsModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeOptionsModal());
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => closeOptionsModal());
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetAudioSettings();
            syncUIWithAudioSettings();
        });
    }

    // Modal background click to close
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeOptionsModal();
            }
        });
    }

    // Slider Event Listeners
    if (masterSlider) {
        masterSlider.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value) / 100.0;
            setMasterVolume(val);
            updateLabel('opt-master-val', `${Math.round(val * 100)}%`);
        });
    }

    if (musicSlider) {
        musicSlider.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value) / 100.0;
            setMusicVolume(val);
            updateLabel('opt-music-val', `${Math.round(val * 100)}%`);
        });
    }

    if (sfxSlider) {
        sfxSlider.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value) / 100.0;
            setSfxVolume(val);
            updateLabel('opt-sfx-val', `${Math.round(val * 100)}%`);
        });
    }

    if (thrusterSlider) {
        thrusterSlider.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value) / 100.0;
            setThrusterVolume(val);
            updateLabel('opt-thruster-val', `${Math.round(val * 100)}%`);
        });
    }

    if (spatialChk) {
        spatialChk.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            setSpatialAudio(checked);
        });
    }

    if (prevTrackBtn) {
        prevTrackBtn.addEventListener('click', () => {
            const trk = prevTrack();
            updateTrackDisplay(trk);
        });
    }

    if (nextTrackBtn) {
        nextTrackBtn.addEventListener('click', () => {
            const trk = nextTrack();
            updateTrackDisplay(trk);
        });
    }

    syncUIWithAudioSettings();
}

function updateLabel(id: string, text: string) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function updateTrackDisplay(trk: any) {
    const nameEl = document.getElementById('opt-current-track-name');
    const artistEl = document.getElementById('opt-track-artist');
    if (nameEl) nameEl.innerText = trk.title;
    if (artistEl) artistEl.innerText = `${trk.artist} — ${trk.description}`;
}

export function syncUIWithAudioSettings() {
    const masterSlider = document.getElementById('opt-master-slider') as HTMLInputElement | null;
    const musicSlider = document.getElementById('opt-music-slider') as HTMLInputElement | null;
    const sfxSlider = document.getElementById('opt-sfx-slider') as HTMLInputElement | null;
    const thrusterSlider = document.getElementById('opt-thruster-slider') as HTMLInputElement | null;
    const spatialChk = document.getElementById('opt-spatial-chk') as HTMLInputElement | null;

    if (masterSlider) masterSlider.value = String(Math.round(AUDIO_SETTINGS.masterVolume * 100));
    if (musicSlider) musicSlider.value = String(Math.round(AUDIO_SETTINGS.musicVolume * 100));
    if (sfxSlider) sfxSlider.value = String(Math.round(AUDIO_SETTINGS.sfxVolume * 100));
    if (thrusterSlider) thrusterSlider.value = String(Math.round(AUDIO_SETTINGS.thrusterVolume * 100));
    if (spatialChk) spatialChk.checked = AUDIO_SETTINGS.spatialAudio;

    updateLabel('opt-master-val', `${Math.round(AUDIO_SETTINGS.masterVolume * 100)}%`);
    updateLabel('opt-music-val', `${Math.round(AUDIO_SETTINGS.musicVolume * 100)}%`);
    updateLabel('opt-sfx-val', `${Math.round(AUDIO_SETTINGS.sfxVolume * 100)}%`);
    updateLabel('opt-thruster-val', `${Math.round(AUDIO_SETTINGS.thrusterVolume * 100)}%`);

    const curTrack = getCurrentTrack();
    updateTrackDisplay(curTrack);
}

export function openOptionsModal() {
    const modal = document.getElementById('options-modal');
    if (modal) {
        syncUIWithAudioSettings();
        modal.style.display = 'flex';
        isOptionsOpen = true;
    }
}

export function closeOptionsModal() {
    const modal = document.getElementById('options-modal');
    if (modal) {
        modal.style.display = 'none';
        isOptionsOpen = false;
    }
}

export function isOptionsModalOpen(): boolean {
    return isOptionsOpen;
}

export function toggleOptionsModal() {
    if (isOptionsOpen) {
        closeOptionsModal();
    } else {
        openOptionsModal();
    }
}

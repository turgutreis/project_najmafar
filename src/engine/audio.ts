import * as THREE from 'three';
import { STATE } from '../core/state';

export let audioListener: THREE.AudioListener | null = null;
const audioLoader = new THREE.AudioLoader();

// Positional and non-positional audio objects
let shipThrusterSound: THREE.PositionalAudio | null = null;
let shipIgniteSound: THREE.PositionalAudio | null = null;
let shipRetroSound: THREE.PositionalAudio | null = null;
let scanStreamSound: THREE.Audio | null = null;
let scanCompleteSound: THREE.Audio | null = null;
let sonarSound: THREE.Audio | null = null;

let isThrustingPrev = false;
let isRetroPrev = false;
const loadedBuffers: { [key: string]: AudioBuffer } = {};

export function initThreeAudio(camera: THREE.Camera, playerGroup?: THREE.Group) {
    if (!audioListener) {
        audioListener = new THREE.AudioListener();
        camera.add(audioListener);
    }

    const sfxList = [
        { key: 'thruster', url: 'assets/sfx/ship_thruster_loop.wav' },
        { key: 'ignite', url: 'assets/sfx/ship_thrust_ignite.wav' },
        { key: 'retro', url: 'assets/sfx/ship_retro_brake.wav' },
        { key: 'scan_stream', url: 'assets/sfx/quantum_scan_stream.wav' },
        { key: 'scan_complete', url: 'assets/sfx/quantum_scan_complete.wav' },
        { key: 'sonar', url: 'assets/sfx/sonar_ping.wav' },
    ];

    sfxList.forEach(sfx => {
        audioLoader.load(sfx.url, (buffer) => {
            loadedBuffers[sfx.key] = buffer;
            setupAudioNode(sfx.key, buffer, playerGroup);
        }, undefined, (err) => {
            console.warn(`AudioLoader failed to load ${sfx.url}:`, err);
        });
    });
}

function setupAudioNode(key: string, buffer: AudioBuffer, playerGroup?: THREE.Group) {
    if (!audioListener) return;

    if (key === 'thruster') {
        shipThrusterSound = new THREE.PositionalAudio(audioListener);
        shipThrusterSound.setBuffer(buffer);
        shipThrusterSound.setLoop(true);
        shipThrusterSound.setVolume(0.0);
        shipThrusterSound.setRefDistance(18);
        shipThrusterSound.setMaxDistance(450);
        shipThrusterSound.setRolloffFactor(1.1);
        if (playerGroup) playerGroup.add(shipThrusterSound);
    } else if (key === 'ignite') {
        shipIgniteSound = new THREE.PositionalAudio(audioListener);
        shipIgniteSound.setBuffer(buffer);
        shipIgniteSound.setVolume(0.22);
        shipIgniteSound.setRefDistance(20);
        if (playerGroup) playerGroup.add(shipIgniteSound);
    } else if (key === 'retro') {
        shipRetroSound = new THREE.PositionalAudio(audioListener);
        shipRetroSound.setBuffer(buffer);
        shipRetroSound.setLoop(true);
        shipRetroSound.setVolume(0.0);
        shipRetroSound.setRefDistance(18);
        if (playerGroup) playerGroup.add(shipRetroSound);
    } else if (key === 'scan_stream') {
        scanStreamSound = new THREE.Audio(audioListener);
        scanStreamSound.setBuffer(buffer);
        scanStreamSound.setLoop(true);
        scanStreamSound.setVolume(0.0);
    } else if (key === 'scan_complete') {
        scanCompleteSound = new THREE.Audio(audioListener);
        scanCompleteSound.setBuffer(buffer);
        scanCompleteSound.setVolume(0.22);
    } else if (key === 'sonar') {
        sonarSound = new THREE.Audio(audioListener);
        sonarSound.setBuffer(buffer);
        sonarSound.setVolume(0.20);
    }
}

export function attachShipAudio(playerGroup: THREE.Group) {
    if (shipThrusterSound && !shipThrusterSound.parent) playerGroup.add(shipThrusterSound);
    if (shipIgniteSound && !shipIgniteSound.parent) playerGroup.add(shipIgniteSound);
    if (shipRetroSound && !shipRetroSound.parent) playerGroup.add(shipRetroSound);
}

let audioCtx: AudioContext | null = null;
let musicUserMuted = false;
let musicPlaying = false;

export function getAudioContext(): AudioContext | null {
    if (!audioCtx) {
        if (audioListener && audioListener.context) {
            audioCtx = audioListener.context;
        } else {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playBioHarvestSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.25);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.26);
}

export function playEmpChargeSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, ctx.currentTime);

    gain.gain.setValueAtTime(0.005, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.42);
}

export function playBioCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

export function playSiliconCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(550, ctx.currentTime);
    osc.frequency.setValueAtTime(740, ctx.currentTime + 0.07);
    osc.frequency.setValueAtTime(980, ctx.currentTime + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
}

export function playCrashSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.35);

    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    noise.start();
    noise.stop(ctx.currentTime + 0.4);
}

export function playLockOnSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(740, time);
    osc.frequency.exponentialRampToValueAtTime(1480, time + 0.12);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.18);
}

export function playSonarChime() {
    if (sonarSound && sonarSound.buffer) {
        if (sonarSound.isPlaying) sonarSound.stop();
        sonarSound.play();
        return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, time);
    osc.frequency.exponentialRampToValueAtTime(660, time + 0.25);
    osc.frequency.exponentialRampToValueAtTime(880, time + 0.5);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.75);
}

export function playExplosionSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(900, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(30, time + 1.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, time);
    subOsc.frequency.exponentialRampToValueAtTime(25, time + 1.3);

    subGain.gain.setValueAtTime(0.18, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    noise.start(time);
    subOsc.start(time);
    noise.stop(time + 1.5);
    subOsc.stop(time + 1.5);
}

// ----------------------------------------------------------------------------
// QUANTUM SCAN AUDIO (Three.js Audio & Real-Time Telemetry)
// ----------------------------------------------------------------------------

export function startQuantumScanSound() {
    if (scanStreamSound && scanStreamSound.buffer) {
        scanStreamSound.setPlaybackRate(0.95);
        scanStreamSound.setVolume(0.18);
        if (!scanStreamSound.isPlaying) scanStreamSound.play();
    }
}

export function updateQuantumScanSound(progressPct: number) {
    if (scanStreamSound && scanStreamSound.isPlaying) {
        const rate = 0.95 + (progressPct / 100.0) * 0.45;
        scanStreamSound.setPlaybackRate(rate);
        scanStreamSound.setVolume(0.18 + (progressPct / 100.0) * 0.08);
    }
}

export function stopQuantumScanSound(wasCompleted: boolean = false) {
    if (scanStreamSound && scanStreamSound.isPlaying) {
        scanStreamSound.stop();
    }
    if (wasCompleted && scanCompleteSound && scanCompleteSound.buffer) {
        if (scanCompleteSound.isPlaying) scanCompleteSound.stop();
        scanCompleteSound.play();
    }
}

// ----------------------------------------------------------------------------
// AUDIO SETTINGS & VOLUME CONTROLS (PERSISTED VIA LOCALSTORAGE)
// ----------------------------------------------------------------------------

export interface AudioSettings {
    masterVolume: number;    // 0.0 to 1.0 (default: 0.65)
    musicVolume: number;     // 0.0 to 1.0 (default: 0.45)
    sfxVolume: number;       // 0.0 to 1.0 (default: 0.45)
    thrusterVolume: number;  // 0.0 to 1.0 (default: 0.45)
    spatialAudio: boolean;   // default: true
}

export const AUDIO_SETTINGS: AudioSettings = {
    masterVolume: 0.65,
    musicVolume: 0.45,
    sfxVolume: 0.45,
    thrusterVolume: 0.45,
    spatialAudio: true
};

export function loadAudioSettings() {
    try {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('najmafar_audio_settings') : null;
        if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.masterVolume === 'number') AUDIO_SETTINGS.masterVolume = Math.max(0, Math.min(1, parsed.masterVolume));
            if (typeof parsed.musicVolume === 'number') AUDIO_SETTINGS.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
            if (typeof parsed.sfxVolume === 'number') AUDIO_SETTINGS.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
            if (typeof parsed.thrusterVolume === 'number') AUDIO_SETTINGS.thrusterVolume = Math.max(0, Math.min(1, parsed.thrusterVolume));
            if (typeof parsed.spatialAudio === 'boolean') AUDIO_SETTINGS.spatialAudio = parsed.spatialAudio;
        }
    } catch (e) {
        console.warn("Could not load audio settings from localStorage", e);
    }
    applyAudioSettings();
}

export function saveAudioSettings() {
    try {
        localStorage.setItem('najmafar_audio_settings', JSON.stringify(AUDIO_SETTINGS));
    } catch (e) {
        console.warn("Could not save audio settings to localStorage", e);
    }
}

export function applyAudioSettings() {
    if (bgMusic) {
        bgMusic.volume = AUDIO_SETTINGS.masterVolume * AUDIO_SETTINGS.musicVolume;
    }
}

export function setMasterVolume(val: number) {
    AUDIO_SETTINGS.masterVolume = Math.max(0, Math.min(1, val));
    applyAudioSettings();
    saveAudioSettings();
}

export function setMusicVolume(val: number) {
    AUDIO_SETTINGS.musicVolume = Math.max(0, Math.min(1, val));
    applyAudioSettings();
    saveAudioSettings();
}

export function setSfxVolume(val: number) {
    AUDIO_SETTINGS.sfxVolume = Math.max(0, Math.min(1, val));
    saveAudioSettings();
}

export function setThrusterVolume(val: number) {
    AUDIO_SETTINGS.thrusterVolume = Math.max(0, Math.min(1, val));
    saveAudioSettings();
}

export function setSpatialAudio(enabled: boolean) {
    AUDIO_SETTINGS.spatialAudio = enabled;
    saveAudioSettings();
}

export function resetAudioSettings() {
    AUDIO_SETTINGS.masterVolume = 0.80;
    AUDIO_SETTINGS.musicVolume = 0.50;
    AUDIO_SETTINGS.sfxVolume = 0.70;
    AUDIO_SETTINGS.thrusterVolume = 0.65;
    AUDIO_SETTINGS.spatialAudio = true;
    applyAudioSettings();
    saveAudioSettings();
}

// ----------------------------------------------------------------------------
// THREE.JS POSITIONAL LOCOMOTION & WARP PROPULSION ENGINE
// ----------------------------------------------------------------------------

export function setThrusterSound(active: boolean, speedRatio: number = 0.5, isRetro: boolean = false) {
    const normSpeed = Math.max(0.0, Math.min(1.0, speedRatio));
    const effectiveThrusterVol = AUDIO_SETTINGS.masterVolume * AUDIO_SETTINGS.sfxVolume * AUDIO_SETTINGS.thrusterVolume;

    if (active && effectiveThrusterVol > 0.001) {
        if (!isRetro) {
            // Forward Main Thrust
            if (!isThrustingPrev) {
                isThrustingPrev = true;
                // Visceral Ignition Punch!
                if (shipIgniteSound && shipIgniteSound.buffer) {
                    shipIgniteSound.setVolume(0.65 * AUDIO_SETTINGS.masterVolume * AUDIO_SETTINGS.sfxVolume);
                    if (shipIgniteSound.isPlaying) shipIgniteSound.stop();
                    shipIgniteSound.play();
                }
            }
            if (shipRetroSound && shipRetroSound.isPlaying) {
                shipRetroSound.stop();
            }
            if (shipThrusterSound && shipThrusterSound.buffer) {
                const targetRate = 0.72 + normSpeed * 0.75;
                const targetVol = (0.22 + normSpeed * 0.45) * effectiveThrusterVol;
                shipThrusterSound.setPlaybackRate(targetRate);
                shipThrusterSound.setVolume(targetVol);
                if (!shipThrusterSound.isPlaying) shipThrusterSound.play();
            }
        } else {
            // Retro-Braking Counter-Thrust
            isThrustingPrev = false;
            if (shipThrusterSound && shipThrusterSound.isPlaying) {
                shipThrusterSound.stop();
            }
            if (shipRetroSound && shipRetroSound.buffer) {
                const targetRate = 0.82 + normSpeed * 0.38;
                const targetVol = (0.30 + normSpeed * 0.35) * effectiveThrusterVol;
                shipRetroSound.setPlaybackRate(targetRate);
                shipRetroSound.setVolume(targetVol);
                if (!shipRetroSound.isPlaying) shipRetroSound.play();
            }
        }
    } else {
        isThrustingPrev = false;
        if (shipThrusterSound && shipThrusterSound.isPlaying) {
            shipThrusterSound.stop();
        }
        if (shipRetroSound && shipRetroSound.isPlaying) {
            shipRetroSound.stop();
        }
    }
}

export interface QuantumTrack {
    id: string;
    title: string;
    artist: string;
    src: string;
    description: string;
}

export const QUANTUM_PLAYLIST: QuantumTrack[] = [
    {
        id: 'void_theme',
        title: 'Pillars of the Void (Quantum Core)',
        artist: 'IBM Quantum & Qiskit OST',
        src: 'assets/music/najmafar_void_theme.wav',
        description: 'Atmosphärisches Quanten-Kernthema mit Bell-Zustand-Verschränkung'
    },
    {
        id: 'outer_rim',
        title: 'Outer Rim (Quantum Solitude)',
        artist: 'IBM Quantum & Qiskit OST',
        src: 'assets/music/outer_rim_solitude.wav',
        description: 'Meditative kosmische Weite und Quanten-Phasenshifts'
    },
    {
        id: 'psionic_resonance',
        title: 'Psionic Resonance (Entangled Worlds)',
        artist: 'IBM Quantum & Qiskit OST',
        src: 'assets/music/psionic_resonance.wav',
        description: 'Polyrhythmische Quanten-Harmonien fremder Zivilisationen'
    },
    {
        id: 'classic_space',
        title: 'Ur-Quan Space (Classic Nostalgia)',
        artist: 'The Ur-Quan Masters',
        src: 'assets/The Ur-Quan Masters - Space.mp3',
        description: 'Klassischer Synth-Space-Soundtrack'
    }
];

let currentTrackIdx = 0;
let bgMusic: HTMLAudioElement | null = null;

function initAudioTrack(idx: number) {
    if (typeof Audio === 'undefined') return;
    const track = QUANTUM_PLAYLIST[idx % QUANTUM_PLAYLIST.length];
    
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.src = '';
    }
    
    bgMusic = new Audio(track.src);
    bgMusic.loop = true;
    bgMusic.volume = AUDIO_SETTINGS.masterVolume * AUDIO_SETTINGS.musicVolume;
}

initAudioTrack(0);
loadAudioSettings();

export function getCurrentTrack(): QuantumTrack {
    return QUANTUM_PLAYLIST[currentTrackIdx % QUANTUM_PLAYLIST.length];
}

export function getCurrentTrackIndex(): number {
    return currentTrackIdx % QUANTUM_PLAYLIST.length;
}

export function selectTrackIndex(idx: number): QuantumTrack {
    currentTrackIdx = (idx + QUANTUM_PLAYLIST.length) % QUANTUM_PLAYLIST.length;
    const isPlaying = musicPlaying;
    initAudioTrack(currentTrackIdx);
    
    if (isPlaying && bgMusic) {
        bgMusic.play().catch(err => console.log("Track play blocked", err));
    }
    updateMusicButtonsUI();
    return getCurrentTrack();
}

export function nextTrack(): QuantumTrack {
    return selectTrackIndex(currentTrackIdx + 1);
}

export function prevTrack(): QuantumTrack {
    return selectTrackIndex(currentTrackIdx - 1);
}

export function toggleMusic(explicitState: boolean | null = null) {
    const shouldPlay = explicitState !== null ? explicitState : !musicPlaying;

    if (!bgMusic) {
        initAudioTrack(currentTrackIdx);
    }
    if (!bgMusic) return;

    if (shouldPlay) {
        musicUserMuted = false;
        bgMusic.volume = AUDIO_SETTINGS.masterVolume * AUDIO_SETTINGS.musicVolume;
        bgMusic.play()
            .then(() => {
                musicPlaying = true;
                updateMusicButtonsUI();
            })
            .catch(err => {
                console.log("Audio play blocked by browser. Click page to start.", err);
            });
    } else {
        musicUserMuted = true;
        bgMusic.pause();
        musicPlaying = false;
        updateMusicButtonsUI();
    }
}

export function isMusicPlaying(): boolean {
    return musicPlaying;
}

export function isMusicUserMuted(): boolean {
    return musicUserMuted;
}

export function updateMusicButtonsUI() {
    const musicBtn = document.getElementById('music-toggle-btn');
    const menuMusicBtn = document.getElementById('menu-music-toggle-btn');
    const currentTrack = getCurrentTrack();

    if (musicBtn) {
        if (musicPlaying) {
            musicBtn.classList.add('playing');
            musicBtn.innerText = "🎵";
            musicBtn.title = `Aktueller Track: ${currentTrack.title} (${currentTrack.artist}) — Klicken zum Wechseln`;
        } else {
            musicBtn.classList.remove('playing');
            musicBtn.innerText = "🔇";
            musicBtn.title = `Musik stummgeschaltet — Klicken zum Abspielen`;
        }
    }

    if (menuMusicBtn) {
        if (musicPlaying) {
            menuMusicBtn.classList.add('music-active');
            menuMusicBtn.classList.remove('music-muted');
            menuMusicBtn.innerText = `🔊 QPU-Musik: ${currentTrack.title}`;
        } else {
            menuMusicBtn.classList.add('music-muted');
            menuMusicBtn.classList.remove('music-active');
            menuMusicBtn.innerText = "🔇 Musik: Aus";
        }
    }
}

// ----------------------------------------------------------------------------
// INTERSTELLAR WARP DROPOUT & ARRIVAL SOUNDSCAPE
// ----------------------------------------------------------------------------

export function playWarpDropoutSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    // A. Soft Space-Time Displacement Resonance (Sub-Bass glide)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subFilter = ctx.createBiquadFilter();

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, time);
    subOsc.frequency.exponentialRampToValueAtTime(45, time + 0.9);

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(320, time);
    subFilter.frequency.exponentialRampToValueAtTime(80, time + 0.9);

    subGain.gain.setValueAtTime(0, time);
    subGain.gain.linearRampToValueAtTime(0.14, time + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.95);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.start(time);
    subOsc.stop(time + 1.0);

    // B. Soft Vacuum Displacement Whoosh
    const bufferSize = Math.floor(ctx.sampleRate * 0.8);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(350, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(90, time + 0.8);
    noiseFilter.Q.setValueAtTime(1.0, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.08, time + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(time);
    noise.stop(time + 0.9);
}

export function playSystemArrivalChime() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5 major triad
    notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + idx * 0.09);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, time);

        gain.gain.setValueAtTime(0, time + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.06, time + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.09 + 0.55);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time + idx * 0.09);
        osc.stop(time + idx * 0.09 + 0.6);
    });
}

export function playWarpSpoolSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    // Rising psionic warp spool-up hum (80 Hz -> 380 Hz)
    const spoolOsc = ctx.createOscillator();
    const spoolGain = ctx.createGain();
    const spoolFilter = ctx.createBiquadFilter();

    spoolOsc.type = 'sawtooth';
    spoolOsc.frequency.setValueAtTime(80, time);
    if (spoolOsc.frequency.exponentialRampToValueAtTime) {
        spoolOsc.frequency.exponentialRampToValueAtTime(380, time + 1.5);
    }

    spoolFilter.type = 'lowpass';
    spoolFilter.frequency.setValueAtTime(180, time);
    if (spoolFilter.frequency.exponentialRampToValueAtTime) {
        spoolFilter.frequency.exponentialRampToValueAtTime(750, time + 1.5);
    }
    spoolFilter.Q.setValueAtTime(2.5, time);

    spoolGain.gain.setValueAtTime(0, time);
    spoolGain.gain.linearRampToValueAtTime(0.12, time + 0.3);
    spoolGain.gain.linearRampToValueAtTime(0.18, time + 1.4);
    spoolGain.gain.exponentialRampToValueAtTime(0.001, time + 1.6);

    spoolOsc.connect(spoolFilter);
    spoolFilter.connect(spoolGain);
    spoolGain.connect(ctx.destination);

    spoolOsc.start(time);
    spoolOsc.stop(time + 1.65);

    // Sub-bass resonance underpinning
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, time);
    if (subOsc.frequency.exponentialRampToValueAtTime) {
        subOsc.frequency.exponentialRampToValueAtTime(120, time + 1.5);
    }
    subGain.gain.setValueAtTime(0, time);
    subGain.gain.linearRampToValueAtTime(0.13, time + 0.4);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.6);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.start(time);
    subOsc.stop(time + 1.65);
}

export function playWarpSnapSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    // High energy space-time puncture snap
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(480, time);
    if (snapOsc.frequency.exponentialRampToValueAtTime) {
        snapOsc.frequency.exponentialRampToValueAtTime(40, time + 0.28);
    }

    snapGain.gain.setValueAtTime(0.20, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);

    snapOsc.start(time);
    snapOsc.stop(time + 0.32);
}

let audioCtx: AudioContext | null = null;
let musicUserMuted = false;
let musicPlaying = false;
let musicOsc1: OscillatorNode | null = null;
let musicOsc2: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let musicInterval: any = null;

let thrusterOsc: OscillatorNode | null = null;
let thrusterGain: GainNode | null = null;
let thrusterFilter: BiquadFilterNode | null = null;
let isThrusterPlaying = false;

export function getAudioContext(): AudioContext | null {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
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

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
}

export function playEmpChargeSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.46);
}

export function playBioCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

export function playSiliconCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.07);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
}

export function playCrashSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.45);

    gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    noise.start();
    noise.stop(ctx.currentTime + 0.5);
}

export function playLockOnSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(1760, time + 0.12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
}

export function playSonarChime() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, time);
    osc.frequency.exponentialRampToValueAtTime(880, time + 0.3);
    osc.frequency.exponentialRampToValueAtTime(1174.66, time + 0.6);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.95);
}

export function playExplosionSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    // 1. White noise burst with lowpass filter sweep
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
    noiseGain.gain.setValueAtTime(0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // 2. Sub-bass rumble boom
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, time);
    subOsc.frequency.exponentialRampToValueAtTime(25, time + 1.3);

    subGain.gain.setValueAtTime(0.7, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    noise.start(time);
    subOsc.start(time);
    noise.stop(time + 1.5);
    subOsc.stop(time + 1.5);
}

// Quantum Scan Telemetry Audio Nodes
let qScanCarrier1: OscillatorNode | null = null;
let qScanCarrier2: OscillatorNode | null = null;
let qScanModulator: OscillatorNode | null = null;
let qScanModGain: GainNode | null = null;
let qScanGain: GainNode | null = null;
let qScanFilter: BiquadFilterNode | null = null;
let isQuantumScanning = false;

export function startQuantumScanSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (isQuantumScanning) return;
    isQuantumScanning = true;

    const t = ctx.currentTime;
    qScanCarrier1 = ctx.createOscillator();
    qScanCarrier2 = ctx.createOscillator();
    qScanModulator = ctx.createOscillator();
    qScanModGain = ctx.createGain();
    qScanGain = ctx.createGain();
    qScanFilter = ctx.createBiquadFilter();

    // Dual quantum carriers with microtonal frequency shift
    qScanCarrier1.type = 'sine';
    qScanCarrier1.frequency.setValueAtTime(1320, t); // E6

    qScanCarrier2.type = 'triangle';
    qScanCarrier2.frequency.setValueAtTime(1760, t); // A6

    // Quantum probability wave FM modulation (38 Hz quantum jitter)
    qScanModulator.type = 'sine';
    qScanModulator.frequency.setValueAtTime(38, t);
    qScanModGain.gain.setValueAtTime(140, t);
    qScanModulator.connect(qScanModGain);
    qScanModGain.connect(qScanCarrier1.frequency);

    // Resonant bandpass filter
    qScanFilter.type = 'bandpass';
    qScanFilter.frequency.setValueAtTime(1500, t);
    qScanFilter.Q.setValueAtTime(4.0, t);

    qScanGain.gain.setValueAtTime(0.0, t);
    qScanGain.gain.linearRampToValueAtTime(0.12, t + 0.1);

    qScanCarrier1.connect(qScanFilter);
    qScanCarrier2.connect(qScanFilter);
    qScanFilter.connect(qScanGain);
    qScanGain.connect(ctx.destination);

    qScanModulator.start(t);
    qScanCarrier1.start(t);
    qScanCarrier2.start(t);
}

export function updateQuantumScanSound(progressPct: number) {
    const ctx = getAudioContext();
    if (!ctx || !isQuantumScanning) return;

    const t = ctx.currentTime;
    const progress = Math.max(0.0, Math.min(1.0, progressPct / 100.0));

    // Pitch ascends as quantum entanglement telemetry resolves
    const f1 = 1320 + progress * 880; // 1320 -> 2200 Hz
    const f2 = 1760 + progress * 1174; // 1760 -> 2934 Hz
    const filterFreq = 1500 + progress * 1600;

    if (qScanCarrier1) qScanCarrier1.frequency.setTargetAtTime(f1, t, 0.05);
    if (qScanCarrier2) qScanCarrier2.frequency.setTargetAtTime(f2, t, 0.05);
    if (qScanFilter) qScanFilter.frequency.setTargetAtTime(filterFreq, t, 0.05);
    if (qScanModGain) qScanModGain.gain.setTargetAtTime(140 + progress * 200, t, 0.05);
}

export function stopQuantumScanSound(wasCompleted: boolean = false) {
    if (!isQuantumScanning) return;
    isQuantumScanning = false;

    const ctx = getAudioContext();
    if (ctx && qScanGain) {
        const t = ctx.currentTime;
        qScanGain.gain.cancelScheduledValues(t);
        qScanGain.gain.setValueAtTime(qScanGain.gain.value, t);
        qScanGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        if (qScanCarrier1) qScanCarrier1.stop(t + 0.1);
        if (qScanCarrier2) qScanCarrier2.stop(t + 0.1);
        if (qScanModulator) qScanModulator.stop(t + 0.1);
    }

    qScanCarrier1 = null;
    qScanCarrier2 = null;
    qScanModulator = null;
    qScanModGain = null;
    qScanFilter = null;
    qScanGain = null;

    if (wasCompleted) {
        playScanCompleteChime();
    }
}

export function playScanCompleteChime() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // Ascending Quantum Data Decode Chime (C6 -> E6 -> G6 -> C7)
    const notes = [1046.5, 1318.5, 1567.98, 2093.0];
    notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);

        gain.gain.setValueAtTime(0.0, t + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.18, t + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.48);
    });
}

// Biomechanical Locomotion Propulsion Engine
let thrusterSubOsc: OscillatorNode | null = null;
let thrusterIonOsc: OscillatorNode | null = null;
let thrusterGainNode: GainNode | null = null;
let thrusterFilterNode: BiquadFilterNode | null = null;
let isThrusterActive = false;

export function setThrusterSound(active: boolean, speedRatio: number = 0.5, isRetro: boolean = false) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const normSpeed = Math.max(0.0, Math.min(1.0, speedRatio));

    if (active) {
        if (!isThrusterActive) {
            isThrusterActive = true;
            thrusterSubOsc = ctx.createOscillator();
            thrusterIonOsc = ctx.createOscillator();
            thrusterGainNode = ctx.createGain();
            thrusterFilterNode = ctx.createBiquadFilter();

            // Layer 1: Sub-Bass Reactor Core (Sine drone)
            thrusterSubOsc.type = 'sine';
            thrusterSubOsc.frequency.setValueAtTime(isRetro ? 32 : 42, t);

            // Layer 2: Plasma Ion-Nozzle (Warm Triangle/Saw blend)
            thrusterIonOsc.type = isRetro ? 'sawtooth' : 'triangle';
            thrusterIonOsc.frequency.setValueAtTime(isRetro ? 75 : 95, t);

            thrusterFilterNode.type = 'lowpass';
            thrusterFilterNode.frequency.setValueAtTime(isRetro ? 140 : 180, t);
            thrusterFilterNode.Q.setValueAtTime(2.5, t);

            thrusterGainNode.gain.setValueAtTime(0.001, t);
            thrusterGainNode.gain.linearRampToValueAtTime(isRetro ? 0.10 : 0.12, t + 0.08);

            thrusterSubOsc.connect(thrusterFilterNode);
            thrusterIonOsc.connect(thrusterFilterNode);
            thrusterFilterNode.connect(thrusterGainNode);
            thrusterGainNode.connect(ctx.destination);

            thrusterSubOsc.start(t);
            thrusterIonOsc.start(t);
        } else {
            // Real-time speed & acceleration pitch scaling
            const targetSubFreq = isRetro ? (30 + normSpeed * 18) : (40 + normSpeed * 32);
            const targetIonFreq = isRetro ? (70 + normSpeed * 40) : (90 + normSpeed * 95);
            const targetFilterFreq = isRetro ? (130 + normSpeed * 80) : (160 + normSpeed * 220);
            const targetVol = (isRetro ? 0.10 : 0.12) + normSpeed * 0.06;

            if (thrusterSubOsc) thrusterSubOsc.frequency.setTargetAtTime(targetSubFreq, t, 0.08);
            if (thrusterIonOsc) thrusterIonOsc.frequency.setTargetAtTime(targetIonFreq, t, 0.08);
            if (thrusterFilterNode) thrusterFilterNode.frequency.setTargetAtTime(targetFilterFreq, t, 0.08);
            if (thrusterGainNode) thrusterGainNode.gain.setTargetAtTime(targetVol, t, 0.08);
        }
    } else if (!active && isThrusterActive) {
        isThrusterActive = false;
        if (thrusterGainNode && thrusterSubOsc && thrusterIonOsc) {
            thrusterGainNode.gain.cancelScheduledValues(t);
            thrusterGainNode.gain.setValueAtTime(thrusterGainNode.gain.value, t);
            thrusterGainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            thrusterSubOsc.stop(t + 0.18);
            thrusterIonOsc.stop(t + 0.18);
        }
        thrusterSubOsc = null;
        thrusterIonOsc = null;
        thrusterGainNode = null;
        thrusterFilterNode = null;
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
    bgMusic.volume = 0.40;
}

initAudioTrack(0);

export function getCurrentTrack(): QuantumTrack {
    return QUANTUM_PLAYLIST[currentTrackIdx % QUANTUM_PLAYLIST.length];
}

export function nextTrack() {
    currentTrackIdx = (currentTrackIdx + 1) % QUANTUM_PLAYLIST.length;
    const isPlaying = musicPlaying;
    initAudioTrack(currentTrackIdx);
    
    if (isPlaying && bgMusic) {
        bgMusic.play().catch(err => console.log("Next track play blocked", err));
    }
    updateMusicButtonsUI();
    
    const track = getCurrentTrack();
    return track;
}

export function toggleMusic(explicitState: boolean | null = null) {
    const shouldPlay = explicitState !== null ? explicitState : !musicPlaying;

    if (!bgMusic) {
        initAudioTrack(currentTrackIdx);
    }
    if (!bgMusic) return;

    if (shouldPlay) {
        musicUserMuted = false;
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
            musicBtn.title = `Aktueller Track: ${currentTrack.title} (${currentTrack.artist}) — Klicken zum Umschalten/Stummschalten`;
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

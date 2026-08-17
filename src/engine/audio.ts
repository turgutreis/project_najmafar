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

export function setThrusterSound(active: boolean) {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (active && !isThrusterPlaying) {
        isThrusterPlaying = true;
        thrusterOsc = ctx.createOscillator();
        thrusterGain = ctx.createGain();
        thrusterFilter = ctx.createBiquadFilter();

        thrusterOsc.type = 'sawtooth';
        thrusterOsc.frequency.setValueAtTime(45, ctx.currentTime);

        thrusterFilter.type = 'lowpass';
        thrusterFilter.frequency.setValueAtTime(120, ctx.currentTime);

        thrusterGain.gain.setValueAtTime(0.01, ctx.currentTime);
        thrusterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);

        thrusterOsc.connect(thrusterFilter);
        thrusterFilter.connect(thrusterGain);
        thrusterGain.connect(ctx.destination);

        thrusterOsc.start();
    } else if (!active && isThrusterPlaying) {
        isThrusterPlaying = false;
        if (thrusterGain && thrusterOsc) {
            const time = ctx.currentTime;
            thrusterGain.gain.cancelScheduledValues(time);
            thrusterGain.gain.setValueAtTime(thrusterGain.gain.value, time);
            thrusterGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            thrusterOsc.stop(time + 0.18);
        }
        thrusterOsc = null;
        thrusterGain = null;
        thrusterFilter = null;
    }
}

const bgMusic = typeof Audio !== 'undefined' ? new Audio('assets/The Ur-Quan Masters - Space.mp3') : null;
if (bgMusic) {
    bgMusic.loop = true;
    bgMusic.volume = 0.35;
}

export function toggleMusic(explicitState: boolean | null = null) {
    const shouldPlay = explicitState !== null ? explicitState : !musicPlaying;

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

    if (musicBtn) {
        if (musicPlaying) {
            musicBtn.classList.add('playing');
            musicBtn.innerText = "🔊 Musik: An (Star Control 2)";
        } else {
            musicBtn.classList.remove('playing');
            musicBtn.innerText = "🔇 Musik: Aus";
        }
    }

    if (menuMusicBtn) {
        if (musicPlaying) {
            menuMusicBtn.classList.add('music-active');
            menuMusicBtn.classList.remove('music-muted');
            menuMusicBtn.innerText = "🔊 Musik: An";
        } else {
            menuMusicBtn.classList.add('music-muted');
            menuMusicBtn.classList.remove('music-active');
            menuMusicBtn.innerText = "🔇 Musik: Aus";
        }
    }
}

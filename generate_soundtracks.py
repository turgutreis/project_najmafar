#!/usr/bin/env python3
"""
Project Najmafar: Pillars of The Void - Quantum Soundtrack Generator
Generates high-fidelity, distinct cosmic soundtracks using Qiskit quantum circuits,
Bell-state entanglement, and multi-oscillator additive/FM virtual analog synthesis.
"""

import os
import sys
import math
import wave
import argparse
import numpy as np

def n(name_or_midi):
    """Convert note name like 'D2', 'F#3', 'A1' or MIDI number to frequency in Hz."""
    if isinstance(name_or_midi, (int, float)):
        return 440.0 * (2.0 ** ((name_or_midi - 69.0) / 12.0))
    NOTES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 
             'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    name = name_or_midi.strip()
    octave = int(name[-1])
    key = name[:-1]
    midi = 12 + octave * 12 + NOTES[key]
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))

# -----------------------------------------------------------------------------
# DISTINCT MUSICAL PALETTES FOR EACH TRACK
# -----------------------------------------------------------------------------

# TRACK 1: Pillars of the Void (Majestic, Deep, Cinematic D-Minor / Aeolian)
CHORDS_VOID_THEME = [
    [n('D2'), n('A2'), n('D3'), n('F3'), n('A3'), n('C4')],      # Dm7 (Void Anchor)
    [n('Bb1'), n('F2'), n('Bb2'), n('D3'), n('F3'), n('A3')],    # Bbmaj7 (Majestic Expansion)
    [n('C2'), n('G2'), n('C3'), n('E3'), n('G3'), n('B3')],      # Cmaj7 (Starlight)
    [n('G1'), n('D2'), n('G2'), n('Bb2'), n('D3'), n('F3')],     # Gm7 (Gravitational Pull)
    [n('A1'), n('E2'), n('A2'), n('C#3'), n('E3'), n('G3')],     # A7 (Tension / Horizon)
    [n('D2'), n('A2'), n('E3'), n('F3'), n('A3'), n('D4')]       # Dsus2/m (Quantum Superposition)
]

# TRACK 2: Outer Rim (Cold, Glassy, Ethereal F#-Aeolian / E-Dorian)
CHORDS_OUTER_RIM = [
    [n('F#1'), n('C#2'), n('F#2'), n('A2'), n('C#3'), n('E3')],  # F#m7 (Deep Freeze)
    [n('D2'), n('A2'), n('D3'), n('F#3'), n('A3'), n('C#4')],    # Dmaj7 (Glass Rings)
    [n('E1'), n('B1'), n('E2'), n('G2'), n('B2'), n('D3')],      # Em7 (Sub-Zero Solitude)
    [n('B1'), n('F#2'), n('B2'), n('D3'), n('F#3'), n('A3')],    # Bm7 (Distant Horizon)
    [n('C#2'), n('G#2'), n('C#3'), n('E3'), n('G#3'), n('B3')]   # C#m7 (Vacuum Drift)
]

# TRACK 3: Psionic Resonance (Fast, Hypnotic, Alien A-Phrygian / Harmonic Minor)
CHORDS_PSIONIC = [
    [n('A1'), n('E2'), n('A2'), n('C3'), n('E3'), n('G3')],      # Am7 (Neural Core)
    [n('Bb1'), n('F2'), n('Bb2'), n('D3'), n('F3'), n('G#3')],   # Bbdim/maj7 (Alien Phrygian shift)
    [n('F1'), n('C2'), n('F2'), n('A2'), n('C3'), n('E3')],      # Fmaj7 (Synaptic Flow)
    [n('E1'), n('B1'), n('E2'), n('G#2'), n('B2'), n('D3')],     # E7 (Psionic Spike)
    [n('D2'), n('A2'), n('D3'), n('F3'), n('G#3'), n('B3')]      # Dm(maj7) (Mind Meld)
]


def run_quantum_circuit_score(track_style="void", num_steps=16, use_qpu=False, api_key=None):
    """
    Builds customized Quantum Circuits tailored to each track's mood and rhythm.
    """
    print(f"[{track_style.upper()}] Initialisiere Quanten-Komposition ({num_steps} Schritte)...", flush=True)

    try:
        import qiskit
        from qiskit import QuantumCircuit
    except ImportError:
        print("Qiskit nicht gefunden. Verwende stochastische Quanten-Simulation.", flush=True)
        return [{"b": format(i * 3, '04b'), "val": (i * 7) % 16} for i in range(num_steps)], {
            "mode": "FALLBACK_SIM", "backend": "stochastic_quantum_mock"
        }

    qc = QuantumCircuit(4, 4)
    
    # Custom Quantum Rotation Angles per Track Style
    if track_style == "void":
        qc.h(range(4))
        qc.cx(0, 1)
        qc.cx(1, 2)
        qc.cx(2, 3)
        for q in range(4):
            qc.ry(math.pi / 3.0 * (q + 1), q)
    elif track_style == "rim":
        # Sparse, high-entropy superposition
        qc.h(0)
        qc.h(2)
        qc.cx(0, 1)
        qc.cx(2, 3)
        for q in range(4):
            qc.rz(math.pi / 4.0 * (q + 1), q)
    else: # psionic
        # Rapidly entangled GHZ state for polyrhythms
        qc.h(0)
        qc.cx(0, 1)
        qc.cx(0, 2)
        qc.cx(0, 3)
        for q in range(4):
            qc.rx(math.pi / 2.5 * (q + 1), q)

    qc.measure(range(4), range(4))

    backend_name = "qiskit_simulator"
    if use_qpu:
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
            service = None
            if api_key:
                try:
                    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=api_key)
                except Exception:
                    try:
                        service = QiskitRuntimeService(channel="ibm_cloud", token=api_key)
                    except Exception:
                        service = QiskitRuntimeService(channel="ibm_quantum", token=api_key)
            else:
                try:
                    service = QiskitRuntimeService()
                except Exception:
                    pass

            if service:
                backend = service.least_busy(simulator=False, operational=True)
                backend_name = backend.name
                print(f"IBM Quantum QPU: {backend_name}. Reiche Job ein...", flush=True)
                from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
                pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
                transpiled_qc = pm.run(qc)
                sampler = SamplerV2(backend)
                job = sampler.run([transpiled_qc])
                result = job.result()[0]
                bitstrings = list(result.data.c.get_bitstrings())
            else:
                use_qpu = False
        except Exception as e:
            print(f"QPU-Verbindungsfehler ({e}). Weiche auf lokalen Simulator aus.", flush=True)
            use_qpu = False

    if not use_qpu:
        try:
            from qiskit.primitives import StatevectorSampler
            sampler = StatevectorSampler()
            job = sampler.run([qc], shots=num_steps * 12)
            pub_res = job.result()[0]
            bitstrings = list(pub_res.data.c.get_bitstrings())
        except Exception:
            bitstrings = [format((i * 13 + 5) % 16, '04b') for i in range(num_steps * 4)]

    score_events = []
    chords = CHORDS_VOID_THEME if track_style == "void" else (CHORDS_OUTER_RIM if track_style == "rim" else CHORDS_PSIONIC)
    
    for step in range(num_steps):
        b = bitstrings[step % len(bitstrings)]
        v0 = int(b[3], 2) if len(b) > 3 else 0
        v1 = int(b[2], 2) if len(b) > 2 else 0
        v2 = int(b[1], 2) if len(b) > 1 else 0
        v3 = int(b[0], 2) if len(b) > 0 else 0
        
        score_events.append({
            "chord_idx": (v0 * 2 + v1) % len(chords),
            "lead_idx": (v2 * 3 + v3 * 2 + v0) % 8,
            "filter_cutoff": 0.35 + 0.65 * ((v1 * 4 + v2 * 2 + v3) / 7.0),
            "pan": -0.65 + 1.3 * (int(b, 2) / 15.0),
            "bitstring": b
        })

    meta = {"mode": "IBM_QPU" if use_qpu else "QISKIT_SIMULATOR", "backend": backend_name}
    return score_events, meta


# -----------------------------------------------------------------------------
# HIGH-END SYNTHESIS ENGINE (CLEAN ANALOG & WAVETABLE - ZERO HARSH NOISE)
# -----------------------------------------------------------------------------

def synthesize_track(track_style, score_events, sample_rate=44100):
    """
    Renders pristine audio with distinct synth engines for each track.
    NO Gaussian white noise — only warm analog harmonics and lush reverb spaces.
    """
    chords_list = CHORDS_VOID_THEME if track_style == "void" else (CHORDS_OUTER_RIM if track_style == "rim" else CHORDS_PSIONIC)
    
    # Track-specific timing
    if track_style == "void":
        step_dur = 5.2   # Majestic, slow, cinematic (Hans Zimmer feel)
    elif track_style == "rim":
        step_dur = 6.4   # Ultra-slow, meditative, deep space solitude
    else: # psionic
        step_dur = 3.6   # Fast, hypnotic 16th-note quantum pulse

    total_steps = len(score_events)
    total_duration = total_steps * step_dur
    total_samples = int(sample_rate * total_duration)
    
    t = np.linspace(0, total_duration, total_samples, endpoint=False)
    
    left_chan = np.zeros(total_samples, dtype=np.float32)
    right_chan = np.zeros(total_samples, dtype=np.float32)
    
    print(f"Rendere {track_style.upper()} ({total_duration:.1f}s, {sample_rate}Hz 16-Bit Stereo)...", flush=True)

    for i, event in enumerate(score_events):
        start_t = i * step_dur
        end_t = start_t + step_dur + 3.0 # Long smooth crossfade overlap
        
        idx_start = int(start_t * sample_rate)
        idx_end = min(total_samples, int(end_t * sample_rate))
        step_len = idx_end - idx_start
        if step_len <= 0:
            continue
            
        t_sub = t[idx_start:idx_end] - start_t
        chord = chords_list[event["chord_idx"]]
        
        # Smooth organic envelope (No clicks)
        env = np.sin(np.pi * np.clip(t_sub / (step_dur + 2.5), 0.0, 1.0)) ** 1.6

        # ---------------------------------------------------------------------
        # 1. BASS FOUNDATION (Warm Moog Sub-Bass & Analog Drive)
        # ---------------------------------------------------------------------
        root_freq = chord[0]
        if track_style == "void":
            # Deep Moog Sub (Sine + Warm Triangle blend)
            sub = 0.40 * np.sin(2.0 * np.pi * (root_freq * 0.5) * t_sub)
            sub += 0.15 * np.sin(2.0 * np.pi * root_freq * t_sub)
        elif track_style == "rim":
            # Soft pure sine heartbeat drone
            sub = 0.32 * np.sin(2.0 * np.pi * (root_freq * 0.5) * t_sub)
        else: # psionic
            # Pulsing 8th-note sequenced bassline
            pulse_env = 0.5 + 0.5 * np.sin(2.0 * np.pi * 4.0 * t_sub)
            sub = 0.38 * np.sin(2.0 * np.pi * (root_freq * 0.5) * t_sub) * pulse_env

        # ---------------------------------------------------------------------
        # 2. HARMONIC PAD CLUSTER (Warm Chorus Detuned Stereo Pad)
        # ---------------------------------------------------------------------
        pad_l = np.zeros(step_len, dtype=np.float32)
        pad_r = np.zeros(step_len, dtype=np.float32)
        
        for p_idx, freq in enumerate(chord[:5]):
            detune = 0.42 * (1.0 + p_idx * 0.2) # Rich analog beating
            if track_style == "rim":
                # Glassy crystal organ (Pure sines with octave shimmer)
                w_l = np.sin(2.0 * np.pi * (freq - detune) * t_sub) + 0.25 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
                w_r = np.sin(2.0 * np.pi * (freq + detune) * t_sub) + 0.25 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
                pad_l += w_l * 0.09
                pad_r += w_r * 0.09
            elif track_style == "void":
                # Warm Blade Runner Synth Brass / Pad
                saw_l = np.sin(2.0 * np.pi * (freq - detune) * t_sub) + 0.35 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
                saw_r = np.sin(2.0 * np.pi * (freq + detune) * t_sub) + 0.35 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
                pad_l += saw_l * 0.11
                pad_r += saw_r * 0.11
            else: # psionic
                # Resonant alien formant pad
                formant = np.sin(2.0 * np.pi * (freq) * t_sub) * (1.0 + 0.5 * np.sin(2.0 * np.pi * 0.8 * t_sub))
                pad_l += formant * 0.10
                pad_r += formant * 0.10

        # ---------------------------------------------------------------------
        # 3. MELODIC ARPEGGIO & PSIONIC CRYSTALS (Voice 2)
        # ---------------------------------------------------------------------
        arp_l = np.zeros(step_len, dtype=np.float32)
        arp_r = np.zeros(step_len, dtype=np.float32)
        
        if track_style == "psionic":
            # Fast hypnotic 16th-note quantum arpeggiator!
            num_arp_notes = 8
            note_dur = step_dur / num_arp_notes
            for a_i in range(num_arp_notes):
                note_freq = chord[(event["lead_idx"] + a_i * 2) % len(chord)] * 2.0
                a_start = a_i * note_dur
                a_sub = t_sub - a_start
                a_mask = (t_sub >= a_start) & (t_sub < a_start + note_dur * 1.5)
                if np.any(a_mask):
                    a_env = np.exp(-12.0 * np.maximum(0.0, a_sub)) * a_mask
                    # Crisp sine + chime overtone
                    a_sig = (np.sin(2.0 * np.pi * note_freq * t_sub) + 0.3 * np.sin(2.0 * np.pi * note_freq * 3.0 * t_sub)) * a_env * 0.22
                    pan = np.sin(a_i * 1.2) * 0.75 # Wide ping-pong stereo panning
                    arp_l += a_sig * (0.5 - 0.5 * pan)
                    arp_r += a_sig * (0.5 + 0.5 * pan)
        elif track_style == "rim":
            # Slow crystalline bell chimes floating in vacuum
            chime_freq = chord[event["lead_idx"] % len(chord)] * 2.0
            c_env = np.exp(-1.8 * t_sub) # Long ringing decay
            c_sig = (np.sin(2.0 * np.pi * chime_freq * t_sub) + 0.4 * np.sin(2.0 * np.pi * chime_freq * 2.75 * t_sub)) * c_env * 0.20
            pan = event["pan"]
            arp_l += c_sig * (0.5 - 0.5 * pan)
            arp_r += c_sig * (0.5 + 0.5 * pan)
        else: # void theme
            # Soaring cinematic melodic lead
            lead_freq = chord[event["lead_idx"] % len(chord)] * 2.0
            l_env = np.sin(np.pi * np.clip(t_sub / (step_dur * 0.8), 0.0, 1.0)) ** 1.2
            l_sig = np.sin(2.0 * np.pi * lead_freq * t_sub) * l_env * 0.24
            arp_l += l_sig * 0.5
            arp_r += l_sig * 0.5

        # Mix step into global track
        step_out_l = (sub * 0.45 + pad_l + arp_l) * env
        step_out_r = (sub * 0.45 + pad_r + arp_r) * env
        
        left_chan[idx_start:idx_end] += step_out_l
        right_chan[idx_start:idx_end] += step_out_r

    # -------------------------------------------------------------------------
    # 4. LUSH STEREO CATHEDRAL REVERB & DELAY (No harsh noise!)
    # -------------------------------------------------------------------------
    delay_time = int(sample_rate * 0.38) # 380ms delay
    delay_l = np.zeros(total_samples, dtype=np.float32)
    delay_r = np.zeros(total_samples, dtype=np.float32)
    delay_l[delay_time:] = right_chan[:-delay_time] * 0.28
    delay_r[delay_time:] = left_chan[:-delay_time] * 0.28
    
    left_chan += delay_l
    right_chan += delay_r

    # -------------------------------------------------------------------------
    # 5. SEAMLESS LOOP CROSSFADE (Smooth 4.5s loop point)
    # -------------------------------------------------------------------------
    fade_samples = int(4.5 * sample_rate)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    
    left_chan[:fade_samples] = left_chan[:fade_samples] * fade_in + left_chan[-fade_samples:] * fade_out
    right_chan[:fade_samples] = right_chan[:fade_samples] * fade_in + right_chan[-fade_samples:] * fade_out
    
    final_len = total_samples - fade_samples
    left_final = left_chan[:final_len]
    right_final = right_chan[:final_len]

    # Master Normalization (-1.0 dBFS Peak Headroom)
    peak = max(np.max(np.abs(left_final)), np.max(np.abs(right_final)), 1e-6)
    target_peak = 0.88
    norm_factor = target_peak / peak
    
    left_final = np.clip(left_final * norm_factor, -0.98, 0.98)
    right_final = np.clip(right_final * norm_factor, -0.98, 0.98)

    # 16-Bit Stereo PCM
    left_pcm = (left_final * 32767.0).astype(np.int16)
    right_pcm = (right_final * 32767.0).astype(np.int16)
    
    stereo_interleaved = np.empty((final_len * 2,), dtype=np.int16)
    stereo_interleaved[0::2] = left_pcm
    stereo_interleaved[1::2] = right_pcm
    
    return stereo_interleaved.tobytes(), (final_len / sample_rate)


def save_wav(filename, pcm_bytes, sample_rate=44100):
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(2) # Stereo
        wf.setsampwidth(2) # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    print(f"✅ Gespeichert: {filename} ({len(pcm_bytes) / (1024*1024):.2f} MB)", flush=True)


# -----------------------------------------------------------------------------
# HIGH-FIDELITY SCI-FI & QUANTUM SFX SYNTHESIS
# -----------------------------------------------------------------------------

def synthesize_sfx_thruster_loop(sample_rate=44100, duration=6.0):
    """Deep, silky, humming biomechanical warp core / reactor rumble loop."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    # Fundamental Sub-Bass (42 Hz + 84 Hz)
    sub = 0.50 * np.sin(2.0 * np.pi * 42.0 * t) + 0.25 * np.sin(2.0 * np.pi * 84.0 * t)
    
    # Biomechanical Plasma Pulse (126 Hz & 168 Hz stereo detuned)
    detune = 0.35
    ion_l = 0.20 * np.sin(2.0 * np.pi * (126.0 - detune) * t) + 0.10 * np.sin(2.0 * np.pi * 168.0 * t)
    ion_r = 0.20 * np.sin(2.0 * np.pi * (126.0 + detune) * t) + 0.10 * np.sin(2.0 * np.pi * 168.0 * t)
    
    # Subtle LFO breathing
    lfo = 0.85 + 0.15 * np.sin(2.0 * np.pi * 1.5 * t)
    
    left = (sub * 0.6 + ion_l) * lfo
    right = (sub * 0.6 + ion_r) * lfo
    
    # Seamless 1.0s loop crossfade
    fade_samples = int(1.0 * sample_rate)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    left[:fade_samples] = left[:fade_samples] * fade_in + left[-fade_samples:] * fade_out
    right[:fade_samples] = right[:fade_samples] * fade_in + right[-fade_samples:] * fade_out
    
    final_len = total_samples - fade_samples
    left_f = left[:final_len]
    right_f = right[:final_len]
    
    peak = max(np.max(np.abs(left_f)), np.max(np.abs(right_f)), 1e-5)
    left_f = (left_f * (0.85 / peak) * 32767.0).astype(np.int16)
    right_f = (right_f * (0.85 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((final_len * 2,), dtype=np.int16)
    stereo[0::2] = left_f
    stereo[1::2] = right_f
    return stereo.tobytes()


def synthesize_sfx_thrust_ignite(sample_rate=44100, duration=0.65):
    """Visceral punch / bass-drop ignition when applying thrust."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    # Pitch drop 180 Hz -> 42 Hz
    freq = 42.0 + 138.0 * np.exp(-12.0 * t)
    phase = 2.0 * np.pi * np.cumsum(freq) / sample_rate
    
    env = np.exp(-5.5 * t) * np.sin(np.pi * np.clip(t / duration, 0.0, 1.0)) ** 0.5
    wave_sig = (np.sin(phase) + 0.4 * np.sin(phase * 2.0)) * env
    
    peak = max(np.max(np.abs(wave_sig)), 1e-5)
    sig_pcm = (wave_sig * (0.92 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((total_samples * 2,), dtype=np.int16)
    stereo[0::2] = sig_pcm
    stereo[1::2] = sig_pcm
    return stereo.tobytes()


def synthesize_sfx_retro_brake(sample_rate=44100, duration=3.5):
    """Decompression counter-thrust & reverse plasma roar."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    sub = 0.45 * np.sin(2.0 * np.pi * 36.0 * t)
    roar_l = 0.22 * np.sin(2.0 * np.pi * 72.0 * t) + 0.15 * np.sin(2.0 * np.pi * 110.0 * t)
    roar_r = 0.22 * np.sin(2.0 * np.pi * 73.0 * t) + 0.15 * np.sin(2.0 * np.pi * 109.0 * t)
    
    left = sub + roar_l
    right = sub + roar_r
    
    fade_samples = int(0.8 * sample_rate)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    left[:fade_samples] = left[:fade_samples] * fade_in + left[-fade_samples:] * fade_out
    right[:fade_samples] = right[:fade_samples] * fade_in + right[-fade_samples:] * fade_out
    
    final_len = total_samples - fade_samples
    left_f = left[:final_len]
    right_f = right[:final_len]
    
    peak = max(np.max(np.abs(left_f)), np.max(np.abs(right_f)), 1e-5)
    left_f = (left_f * (0.85 / peak) * 32767.0).astype(np.int16)
    right_f = (right_f * (0.85 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((final_len * 2,), dtype=np.int16)
    stereo[0::2] = left_f
    stereo[1::2] = right_f
    return stereo.tobytes()


def synthesize_sfx_scan_stream(sample_rate=44100, duration=4.0):
    """Holographic quantum telemetry scanning carrier stream."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    # 2-Carrier microtonal FM shimmer (1480 Hz & 2220 Hz modulated at 36 Hz)
    fm = 120.0 * np.sin(2.0 * np.pi * 36.0 * t)
    c1 = np.sin(2.0 * np.pi * 1480.0 * t + fm)
    c2 = np.sin(2.0 * np.pi * 2220.0 * t - fm)
    sub = 0.25 * np.sin(2.0 * np.pi * 370.0 * t)
    
    sig_l = (c1 * 0.4 + sub)
    sig_r = (c2 * 0.4 + sub)
    
    fade_samples = int(0.6 * sample_rate)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    sig_l[:fade_samples] = sig_l[:fade_samples] * fade_in + sig_l[-fade_samples:] * fade_out
    sig_r[:fade_samples] = sig_r[:fade_samples] * fade_in + sig_r[-fade_samples:] * fade_out
    
    final_len = total_samples - fade_samples
    left_f = sig_l[:final_len]
    right_f = sig_r[:final_len]
    
    peak = max(np.max(np.abs(left_f)), np.max(np.abs(right_f)), 1e-5)
    left_f = (left_f * (0.80 / peak) * 32767.0).astype(np.int16)
    right_f = (right_f * (0.80 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((final_len * 2,), dtype=np.int16)
    stereo[0::2] = left_f
    stereo[1::2] = right_f
    return stereo.tobytes()


def synthesize_sfx_scan_complete(sample_rate=44100, duration=1.8):
    """Crystalline ascending decode chime with lush reverb tail."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    notes = [1046.50, 1318.51, 1567.98, 2093.00] # C6, E6, G6, C7
    sig_l = np.zeros(total_samples, dtype=np.float32)
    sig_r = np.zeros(total_samples, dtype=np.float32)
    
    for idx, freq in enumerate(notes):
        start_t = idx * 0.075
        sub_t = np.maximum(0.0, t - start_t)
        mask = t >= start_t
        env = np.exp(-3.2 * sub_t) * mask
        
        tone = (np.sin(2.0 * np.pi * freq * sub_t) + 0.3 * np.sin(2.0 * np.pi * freq * 2.0 * sub_t)) * env * 0.25
        pan = -0.5 + idx * 0.33
        sig_l += tone * (0.5 - 0.5 * pan)
        sig_r += tone * (0.5 + 0.5 * pan)
        
    peak = max(np.max(np.abs(sig_l)), np.max(np.abs(sig_r)), 1e-5)
    left_f = (sig_l * (0.88 / peak) * 32767.0).astype(np.int16)
    right_f = (sig_r * (0.88 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((total_samples * 2,), dtype=np.int16)
    stereo[0::2] = left_f
    stereo[1::2] = right_f
    return stereo.tobytes()


def synthesize_sfx_sonar_ping(sample_rate=44100, duration=2.2):
    """Celestial psionic sonar wave."""
    total_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, total_samples, endpoint=False)
    
    env1 = np.exp(-2.5 * t)
    ping1 = np.sin(2.0 * np.pi * 587.33 * t) * env1 * 0.4
    ping2 = np.sin(2.0 * np.pi * 1174.66 * t) * np.exp(-4.5 * t) * 0.3
    sub = np.sin(2.0 * np.pi * 146.83 * t) * np.exp(-1.8 * t) * 0.35
    
    sig = ping1 + ping2 + sub
    peak = max(np.max(np.abs(sig)), 1e-5)
    sig_pcm = (sig * (0.88 / peak) * 32767.0).astype(np.int16)
    
    stereo = np.empty((total_samples * 2,), dtype=np.int16)
    stereo[0::2] = sig_pcm
    stereo[1::2] = sig_pcm
    return stereo.tobytes()


def main():
    parser = argparse.ArgumentParser(description="Najmafar Quantum Soundtrack & SFX Generator")
    parser.add_argument("--qpu", action="store_true", help="Use real IBM Quantum QPU backend")
    parser.add_argument("--api-key", type=str, default=None, help="IBM Quantum API Token")
    parser.add_argument("--music-outdir", type=str, default="assets/music", help="Output directory for music")
    parser.add_argument("--sfx-outdir", type=str, default="assets/sfx", help="Output directory for SFX")
    parser.add_argument("--sfx-only", action="store_true", help="Only render sound effects")
    args = parser.parse_args()

    print("==========================================================", flush=True)
    print("  🌌 NAJMAFAR: HIGH-FIDELITY QUANTUM AUDIO ENGINE        ", flush=True)
    print("==========================================================", flush=True)

    if not args.sfx_only:
        tracks = [
            {"style": "void", "file": "najmafar_void_theme.wav", "steps": 14, "title": "Pillars of the Void (Cinematic Core Theme)"},
            {"style": "rim", "file": "outer_rim_solitude.wav", "steps": 12, "title": "Outer Rim (Crystal Solitude Ambient)"},
            {"style": "psionic", "file": "psionic_resonance.wav", "steps": 16, "title": "Psionic Resonance (Fast 16th Arp Pulse)"}
        ]

        for trk in tracks:
            print(f"\n🎼 --- Generiere Track: {trk['title']} ---", flush=True)
            score_events, meta = run_quantum_circuit_score(track_style=trk["style"], num_steps=trk["steps"], use_qpu=args.qpu, api_key=args.api_key)
            pcm_data, dur = synthesize_track(trk["style"], score_events, sample_rate=44100)
            out_path = os.path.join(args.music_outdir, trk["file"])
            save_wav(out_path, pcm_data, sample_rate=44100)

    # Render High-Fidelity Sci-Fi & Quantum SFX Suite
    print("\n🔊 --- Generiere High-Fidelity Sci-Fi & Quantum SFX Suite ---", flush=True)
    sfx_items = [
        ("ship_thruster_loop.wav", synthesize_sfx_thruster_loop),
        ("ship_thrust_ignite.wav", synthesize_sfx_thrust_ignite),
        ("ship_retro_brake.wav", synthesize_sfx_retro_brake),
        ("quantum_scan_stream.wav", synthesize_sfx_scan_stream),
        ("quantum_scan_complete.wav", synthesize_sfx_scan_complete),
        ("sonar_ping.wav", synthesize_sfx_sonar_ping)
    ]

    for fname, func in sfx_items:
        pcm = func()
        out_p = os.path.join(args.sfx_outdir, fname)
        save_wav(out_p, pcm, sample_rate=44100)

    print("\n✨ Alle Soundtracks und Soundeffekte wurden erfolgreich gerendert!", flush=True)


if __name__ == "__main__":
    main()


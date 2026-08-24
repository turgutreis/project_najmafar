#!/usr/bin/env python3
"""
Project Najmafar: Pillars of The Void - Quantum Soundtrack Generator
Generates atmospheric, multi-voice cosmic ambient music using Qiskit quantum circuits,
Bell-state entanglement, and multi-oscillator additive/FM synthesis.
"""

import os
import sys
import math
import struct
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

# Modal Chord Palettes (Frequency lists in Hz)
CHORD_VOIDS = [
    [n('D2'), n('A2'), n('D3'), n('F3'), n('A3'), n('C4')],      # Dm7 (Void Anchor)
    [n('A1'), n('E2'), n('A2'), n('C3'), n('E3'), n('G3')],      # Am7 (Sub-Zero Cold)
    [n('F2'), n('C3'), n('F3'), n('A3'), n('C4'), n('E4')],      # Fmaj7 (Nebula Glow)
    [n('G2'), n('D3'), n('G3'), n('Bb3'), n('D4'), n('F4')],     # Gm7 (Gravitational Well)
    [n('D2'), n('A2'), n('E3'), n('F3'), n('A3'), n('D4')]       # Dsus2/m (Quantum Superposition)
]

def run_quantum_circuit_score(num_steps=32, use_qpu=False, api_key=None):
    """
    Builds a 4-qubit entangled quantum circuit to compose musical parameters:
    q0: Bass Root & Harmonic Progression
    q1: Pad Inversion & Filter Resonant Center
    q2: Lead Arpeggio Note Choice
    q3: Spatial Stereo Pan & Quantum Shimmer Pulse
    """
    print(f"Initialisiere Quanten-Kompositions-Schaltkreis ({num_steps} Zeit-Schritte)...", flush=True)
    
    try:
        import qiskit
        from qiskit import QuantumCircuit
        print(f"Qiskit v{qiskit.__version__} geladen.", flush=True)
    except ImportError:
        print("Qiskit nicht gefunden. Verwende stochastische Quanten-Simulation.", flush=True)
        return [{"q0": i % 5, "q1": (i*2) % 6, "q2": (i*3) % 8, "q3": (i*4) % 10} for i in range(num_steps)], {
            "mode": "FALLBACK_SIM", "backend": "stochastic_quantum_mock"
        }

    # 4-Qubit Circuit with parameterized Entanglement
    qc = QuantumCircuit(4, 4)
    # Hadamard Superposition
    qc.h(range(4))
    # Entangle Voices (Bell State Cascade: q0->q1->q2->q3)
    qc.cx(0, 1)
    qc.cx(1, 2)
    qc.cx(2, 3)
    qc.cx(3, 0)
    # Parameterized Phase Shifts
    for q in range(4):
        qc.ry(math.pi / 4.0 * (q + 1), q)
        qc.rz(math.pi / 3.0 * (q + 1), q)
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
                except Exception as e:
                    print(f"Kein Token übergeben und kein Standard-Account gefunden: {e}", flush=True)

            if service:
                backend = service.least_busy(simulator=False, operational=True)
                backend_name = backend.name
                print(f"IBM Quantum QPU ausgewählt: {backend_name}. Sende Kompositions-Job...", flush=True)
                from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
                pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
                transpiled_qc = pm.run(qc)
                sampler = SamplerV2(backend)
                job = sampler.run([transpiled_qc])
                print(f"Job übermittelt (ID: {job.job_id()}). Warte auf QPU-Berechnung...", flush=True)
                result = job.result()[0]
                bitstrings = list(result.data.c.get_bitstrings())
                print("Quanten-Messergebnisse von QPU empfangen!", flush=True)
            else:
                use_qpu = False
        except Exception as e:
            print(f"IBM QPU Verbindungsfehler ({e}). Weiche auf lokalen Simulator aus.", flush=True)
            use_qpu = False

    if not use_qpu:
        try:
            from qiskit_aer import AerSimulator
            sim = AerSimulator()
            result = sim.run(qc, shots=num_steps * 8).result()
            counts = result.get_counts()
            bitstrings = []
            for bstr, cnt in counts.items():
                bitstrings.extend([bstr] * cnt)
            np.random.shuffle(bitstrings)
        except Exception:
            # Basic transpile/run on standard BasicSimulator
            from qiskit.primitives import StatevectorSampler
            sampler = StatevectorSampler()
            job = sampler.run([qc], shots=num_steps * 8)
            pub_res = job.result()[0]
            bitstrings = list(pub_res.data.c.get_bitstrings())

    # Map bitstrings to score events
    score_events = []
    for step in range(num_steps):
        b = bitstrings[step % len(bitstrings)]
        # Parse 4-qubit binary string
        v0 = int(b[3], 2) if len(b) > 3 else 0
        v1 = int(b[2], 2) if len(b) > 2 else 0
        v2 = int(b[1], 2) if len(b) > 1 else 0
        v3 = int(b[0], 2) if len(b) > 0 else 0
        
        score_events.append({
            "chord_idx": (v0 * 2 + v1) % len(CHORD_VOIDS),
            "filter_mod": 0.4 + 0.6 * ((v1 * 4 + v2 * 2 + v3) / 7.0),
            "lead_note_idx": (v2 * 4 + v3 * 2 + v0) % 8,
            "pan": -0.6 + 1.2 * (int(b, 2) / 15.0),
            "bitstring": b
        })

    meta = {
        "mode": "IBM_QPU" if use_qpu else "QISKIT_SIMULATOR",
        "backend": backend_name,
        "steps": num_steps
    }
    return score_events, meta


def synthesize_ambient_track(score_events, sample_rate=44100, step_duration=4.0):
    """
    Renders an ethereal, multi-track quantum ambient soundtrack.
    Multi-layer sound design:
    - Layer 1: Sub-bass fundamental sine drone
    - Layer 2: Warm stereo chorus pad chords
    - Layer 3: Entangled crystalline quantum arpeggiator
    - Layer 4: Solar wind pink-noise sweep
    """
    total_steps = len(score_events)
    total_duration = total_steps * step_duration
    total_samples = int(sample_rate * total_duration)
    
    t = np.linspace(0, total_duration, total_samples, endpoint=False)
    
    left_channel = np.zeros(total_samples, dtype=np.float32)
    right_channel = np.zeros(total_samples, dtype=np.float32)
    
    print(f"Rendere Quanten-Audiospuren ({total_duration:.1f} Sekunden, {sample_rate} Hz Stereo)...", flush=True)

    for i, event in enumerate(score_events):
        start_t = i * step_duration
        end_t = start_t + step_duration + 2.5 # Crossfade overlap
        
        idx_start = int(start_t * sample_rate)
        idx_end = min(total_samples, int(end_t * sample_rate))
        step_len = idx_end - idx_start
        if step_len <= 0:
            continue
            
        t_sub = t[idx_start:idx_end] - start_t
        chord = CHORD_VOIDS[event["chord_idx"]]
        
        # Envelope: Smooth trapezoidal attack/decay
        env = np.sin(np.pi * np.clip(t_sub / (step_duration + 2.0), 0.0, 1.0)) ** 1.5
        
        # 1. Sub-Bass Fundamental (D1/A1 Drone)
        sub_freq = chord[0] * 0.5
        sub_wave = 0.35 * np.sin(2.0 * np.pi * sub_freq * t_sub)
        
        # 2. Warm Pad Layer (Additive 3-tone harmonic cluster with slow detuned beating)
        pad_wave_l = np.zeros(step_len, dtype=np.float32)
        pad_wave_r = np.zeros(step_len, dtype=np.float32)
        for freq in chord[:4]:
            detune = 0.35 # Hz beating
            # Left & Right slightly detuned for wide stereo space
            w_l = np.sin(2.0 * np.pi * (freq - detune) * t_sub) + 0.3 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
            w_r = np.sin(2.0 * np.pi * (freq + detune) * t_sub) + 0.3 * np.sin(2.0 * np.pi * (freq * 2.0) * t_sub)
            pad_wave_l += w_l * 0.12
            pad_wave_r += w_r * 0.12

        # 3. Entangled Quantum Arpeggio / Crystal Chime (Voice 2)
        arp_wave_l = np.zeros(step_len, dtype=np.float32)
        arp_wave_r = np.zeros(step_len, dtype=np.float32)
        
        arp_notes = [chord[event["lead_note_idx"] % len(chord)] * 2.0, chord[(event["lead_note_idx"] + 2) % len(chord)] * 2.0]
        for a_idx, a_freq in enumerate(arp_notes):
            a_sub_t = t_sub - (a_idx * (step_duration / 2.0))
            a_sub_t = np.maximum(0.0, a_sub_t)
            arp_env = np.exp(-3.5 * a_sub_t) * (t_sub >= (a_idx * (step_duration / 2.0)))
            
            # Triangle-like pure starlight harmonic
            sine_core = np.sin(2.0 * np.pi * a_freq * t_sub)
            sine_over = 0.25 * np.sin(2.0 * np.pi * (a_freq * 3.0) * t_sub)
            arp_sig = (sine_core + sine_over) * arp_env * 0.18
            
            pan = event["pan"]
            arp_wave_l += arp_sig * (0.5 - 0.5 * pan)
            arp_wave_r += arp_sig * (0.5 + 0.5 * pan)

        # Mix step channels
        step_l = (sub_wave * 0.5 + pad_wave_l + arp_wave_l) * env
        step_r = (sub_wave * 0.5 + pad_wave_r + arp_wave_r) * env
        
        left_channel[idx_start:idx_end] += step_l
        right_channel[idx_start:idx_end] += step_r

    # 4. Subtle Cosmic Solar Wind Texture (Soft Bandpassed Noise)
    noise = np.random.normal(0.0, 0.015, total_samples).astype(np.float32)
    # Slow LFO filter sweep
    lfo = 0.5 + 0.5 * np.sin(2.0 * np.pi * 0.04 * t)
    noise_swept = noise * lfo
    left_channel += noise_swept
    right_channel += noise_swept * np.roll(lfo, int(sample_rate * 2.0))

    # Seamless Loop Crossfade (Last 4 seconds crossfade with the beginning)
    fade_samples = int(4.0 * sample_rate)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    
    left_channel[:fade_samples] = left_channel[:fade_samples] * fade_in + left_channel[-fade_samples:] * fade_out
    right_channel[:fade_samples] = right_channel[:fade_samples] * fade_in + right_channel[-fade_samples:] * fade_out
    
    # Trim the crossfaded tail for seamless loop
    final_len = total_samples - fade_samples
    left_final = left_channel[:final_len]
    right_final = right_channel[:final_len]

    # Master Limiter & Normalization (-1.0 dBFS Peak)
    peak = max(np.max(np.abs(left_final)), np.max(np.abs(right_final)), 1e-6)
    target_peak = 0.88 # -1.1 dBFS headroom
    norm_factor = target_peak / peak
    
    left_final = np.clip(left_final * norm_factor, -0.98, 0.98)
    right_final = np.clip(right_final * norm_factor, -0.98, 0.98)

    # Interleave 16-bit PCM Stereo
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
    print(f"Soundtrack erfolgreich gespeichert: {filename} ({len(pcm_bytes) / (1024*1024):.2f} MB)", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Najmafar Quantum Soundtrack Generator")
    parser.add_argument("--qpu", action="store_true", help="Use real IBM Quantum QPU backend")
    parser.add_argument("--api-key", type=str, default=None, help="IBM Quantum API Token")
    parser.add_argument("--outdir", type=str, default="assets/music", help="Output directory for audio files")
    args = parser.parse_args()

    print("==========================================================", flush=True)
    print("  🌌 NAJMAFAR: QUANTUM SOUNDTRACK SYNTHESIS ENGINE  ", flush=True)
    print("==========================================================", flush=True)

    tracks = [
        {"name": "najmafar_void_theme.wav", "steps": 16, "step_dur": 4.5, "title": "Pillars of the Void (Quantum Core Theme)"},
        {"name": "outer_rim_solitude.wav", "steps": 14, "step_dur": 4.8, "title": "Outer Rim (Quantum Solitude)"},
        {"name": "psionic_resonance.wav", "steps": 16, "step_dur": 3.8, "title": "Psionic Resonance (Entangled Civilizations)"}
    ]

    for trk in tracks:
        print(f"\n--- Generiere: {trk['title']} ---", flush=True)
        score_events, meta = run_quantum_circuit_score(num_steps=trk["steps"], use_qpu=args.qpu, api_key=args.api_key)
        pcm_data, dur = synthesize_ambient_track(score_events, sample_rate=44100, step_duration=trk["step_dur"])
        out_path = os.path.join(args.outdir, trk["name"])
        save_wav(out_path, pcm_data, sample_rate=44100)

    print("\n✅ Alle Quanten-Soundtracks erfolgreich gerendert!", flush=True)


if __name__ == "__main__":
    main()

import os
import sys
import json
import math
import random
import argparse
from datetime import datetime, timezone

# Prefix & Suffix tables for procedural star naming
STAR_PREFIXES = [
    "Alpha", "Vega", "Sirius", "Kepler", "Orion", "Zeta", "Epsilon", "Proxima", "Nova", 
    "Gliese", "Antares", "Aldebaran", "Polaris", "Betelgeuse", "Rigel", "Castor", "Pollux", 
    "Capella", "Arcturus", "Canopus", "Altair", "Deneb", "Fomalhaut", "Regulus", "Spica",
    "Perseus", "Olyndar", "Aethelgard", "Cygnus", "Centaurus", "Aquila", "Cassiopeia", "Hydra"
]
STAR_SUFFIXES = [
    "Prime", "Major", "Minor", "B", "C", "D", "X", "IX", "Omega", "Theta", "Gamma", 
    "Sigma", "Tau", "Eridani", "Cygni", "Centauri", "Borealis", "Australis", "Null", 
    "Void", "Nexus", "V", "VI", "VII", "VIII", "Sanctum", "Horizon", "Abyss"
]

# Star classes characteristics
STAR_CLASSES = {
    "Yellow Sun": {"color": "0xf59e0b", "size": 12, "mass": 180},
    "Blue Giant": {"color": "0x3b82f6", "size": 16, "mass": 320},
    "Red Dwarf":  {"color": "0xef4444", "size": 8, "mass": 90},
    "White Dwarf": {"color": "0xf8fafc", "size": 5, "mass": 140},
    "Black Hole":  {"color": "0x7c3aed", "size": 9, "mass": 650}
}

STAR_SYSTEM_TEMPLATES = {
    "Yellow Sun": {
        "d_min": 18,
        "spacing": 1.45,
        "habitable_zone": (35, 65)
    },
    "Blue Giant": {
        "d_min": 26,
        "spacing": 1.40,
        "habitable_zone": (65, 110)
    },
    "Red Dwarf": {
        "d_min": 12,
        "spacing": 1.45,
        "habitable_zone": (15, 28)
    },
    "White Dwarf": {
        "d_min": 10,
        "spacing": 1.50,
        "habitable_zone": (12, 22)
    },
    "Black Hole": {
        "d_min": 20,
        "spacing": 1.55,
        "habitable_zone": (0, 0)
    }
}


class QuantumRandomStream:
    """Consumes bitstrings from a Qiskit circuit execution as a random number generator."""
    def __init__(self, bitstrings):
        self.bitstrings = bitstrings
        self.bit_index = 0
        self.string_index = 0
        self.bit_pool = "".join(bitstrings)
        
    def get_bits(self, count):
        if not self.bit_pool:
            return random.getrandbits(count)
            
        end = self.bit_index + count
        if end > len(self.bit_pool):
            self.bit_index = 0
            end = count
            
        chunk = self.bit_pool[self.bit_index:end]
        self.bit_index = end
        
        if not chunk:
            return random.getrandbits(count)
        return int(chunk, 2)

    def get_range(self, min_val, max_val):
        val = self.get_bits(12)
        ratio = val / 4095.0
        return min_val + ratio * (max_val - min_val)

    def choose(self, lst):
        if not lst:
            return None
        idx = self.get_bits(8) % len(lst)
        return lst[idx]


def generate_quantum_bits(api_key=None, use_qpu=False):
    print("Najmafar Quantum Generator: Initialisiere Quantenschaltkreis...", flush=True)
    
    shots = 16000
    qubits = 5
    gen_time = datetime.now(timezone.utc).isoformat()

    try:
        import qiskit
        from qiskit import QuantumCircuit
        print(f"Qiskit v{qiskit.__version__} erkannt.", flush=True)
    except ImportError:
        print("WARNUNG: Qiskit ist auf diesem System nicht installiert. Weiche auf Pseudo-Zufall aus.", flush=True)
        mock_strings = [format(random.randint(0, 31), '05b') for _ in range(shots)]
        meta = {
            "generator": "Project Najmafar Fallback Generator",
            "generatorMode": "PSEUDO_MOCK",
            "backendName": "python_random_fallback",
            "jobId": None,
            "shots": shots,
            "qubits": qubits,
            "generatedAt": gen_time,
            "sectors": ["sector_outer_rim", "sector_mid_rim", "sector_core"]
        }
        return QuantumRandomStream(mock_strings), meta

    qc = QuantumCircuit(qubits, qubits)
    qc.h(range(qubits))
    qc.measure(range(qubits), range(qubits))

    if use_qpu:
        print("Verbinde mit IBM Quantum Platform (Echtes QPU/Cloud-Gerät)...", flush=True)
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
            
            service = None
            if api_key:
                try:
                    service = QiskitRuntimeService(channel="ibm_quantum", token=api_key)
                except Exception:
                    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=api_key)
            else:
                try:
                    service = QiskitRuntimeService()
                except Exception as e:
                    print(f"Kein API-Token angegeben und kein gespeicherter IBM-Account gefunden: {e}", flush=True)

            if service:
                backend = service.least_busy(simulator=False, operational=True)
                backend_name = backend.name
                print(f"QPU ausgewählt: {backend_name}. Reiche Quanten-Job ein (Shots={shots})...", flush=True)
                
                from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
                pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
                transpiled_qc = pm.run(qc)
                
                sampler = SamplerV2(backend)
                job = sampler.run([(transpiled_qc)])
                job_id = job.job_id()
                print(f"Job erfolgreich eingereicht! Job-ID: {job_id}", flush=True)
                print(f"Status im IBM Quantum Dashboard sichtbar (Status: {job.status()}). Warte auf Berechnung...", flush=True)
                
                result = job.result()
                pub_result = result[0]
                bitstrings_raw = pub_result.data.c.get_bitstrings()
                bitstrings = list(bitstrings_raw)
                print("Quanten-Messergebnisse erfolgreich von IBM QPU empfangen!", flush=True)

                meta = {
                    "generator": "IBM Quantum Platform QPU Engine",
                    "generatorMode": "IBM_QPU",
                    "backendName": backend_name,
                    "jobId": job_id,
                    "shots": shots,
                    "qubits": qubits,
                    "generatedAt": gen_time,
                    "sectors": ["sector_outer_rim", "sector_mid_rim", "sector_core"]
                }
                return QuantumRandomStream(bitstrings), meta
            else:
                print("Weiche auf den lokalen Qiskit-Simulator aus...", flush=True)
                bitstrings = run_local_simulator(qc, shots)
                meta = {
                    "generator": "Local Qiskit Simulator Engine",
                    "generatorMode": "LOCAL_SIMULATOR",
                    "backendName": "basic_simulator",
                    "jobId": None,
                    "shots": shots,
                    "qubits": qubits,
                    "generatedAt": gen_time,
                    "sectors": ["sector_outer_rim", "sector_mid_rim", "sector_core"]
                }
                return QuantumRandomStream(bitstrings), meta
            
        except Exception as e:
            print(f"FEHLER bei IBM QPU-Verbindung: {str(e)}", flush=True)
            print("Weiche auf den lokalen Qiskit-Simulator aus...", flush=True)
            bitstrings = run_local_simulator(qc, shots)
            meta = {
                "generator": "Local Qiskit Simulator Engine (QPU Fallback)",
                "generatorMode": "LOCAL_SIMULATOR",
                "backendName": "basic_simulator",
                "jobId": None,
                "shots": shots,
                "qubits": qubits,
                "generatedAt": gen_time,
                "sectors": ["sector_outer_rim", "sector_mid_rim", "sector_core"]
            }
            return QuantumRandomStream(bitstrings), meta
    else:
        print("Führe Quantenschaltkreis auf lokalem Simulator aus (BasicProvider)...", flush=True)
        bitstrings = run_local_simulator(qc, shots)
        meta = {
            "generator": "Local Qiskit Simulator Engine",
            "generatorMode": "LOCAL_SIMULATOR",
            "backendName": "basic_simulator",
            "jobId": None,
            "shots": shots,
            "qubits": qubits,
            "generatedAt": gen_time,
            "sectors": ["sector_outer_rim", "sector_mid_rim", "sector_core"]
        }
        return QuantumRandomStream(bitstrings), meta


def run_local_simulator(qc, shots):
    try:
        from qiskit.providers.basic_provider import BasicProvider
        provider = BasicProvider()
        backend = provider.get_backend("basic_simulator")
        job = backend.run(qc, shots=shots)
        result = job.result()
        counts = result.get_counts()
        bitstrings = []
        for bitstr, freq in counts.items():
            bitstrings.extend([bitstr] * freq)
        random.shuffle(bitstrings)
        return bitstrings
    except Exception as e:
        print(f"Fehler bei lokalem Qiskit Simulator: {str(e)}. Weiche auf Pseudo-Zufall aus.", flush=True)
        return [format(random.randint(0, 31), '05b') for _ in range(shots)]


def build_galaxy(qrng, meta_info, count=1000):
    print(f"Generiere Galaxie mit {count} Sternensystemen in 3 Sektoren...", flush=True)
    systems = []
    
    arms = 4
    existing_coords = []
    
    for i in range(count):
        if i == 0:
            # Sagittarius A* (Supermassive Black Hole at Core Center)
            sys_name = "Sagittarius A* (Kern-Singularität)"
            x, z = 0.0, 0.0
            existing_coords.append((x, z))
            star_type = "Black Hole"
            sector_id = "sector_core"
            sector_name = "Galaktischer Kern (Sagittarius A*)"
            anomaly_type = "supermassive_black_hole"
            is_core_anchor = True

            # Custom Iconic Lore Objects for Sagittarius A* (No generic rocky planets!)
            planets = [
                {
                    "name": "Chronos-Anker (Vorläufer-Konstrukt)",
                    "type": "Vorläufer-Konstrukt",
                    "size": 3.6,
                    "distance": 34.0,
                    "color": "0x06b6d4",
                    "temp": "0 Kelvin (Zeit-Stasis)",
                    "atmos": "Psionisches Dunkle-Energie-Feld",
                    "bio": "Ruhendes Vorläufer-Gedächtnis (Dschinn-Urquell)",
                    "res": "Reine Dunkle Energie, Chrono-Partikel & Tachyonen-Kerne",
                    "species": {
                        "hasSentient": True,
                        "name": "Schlafendes Bewusstsein der Alten",
                        "population": 1,
                        "candidates": [
                            {
                                "name": "Ur-Dschinn Al-Mu'azzam",
                                "species": "Vorläufer-Entität",
                                "speciesType": "ancient",
                                "role": "cryptologist",
                                "roleName": "🌌 Kosmischer Zeitzeuge",
                                "buffDesc": "+80 Psionische Reichweite & Universum-Harmonisierung",
                                "baseStressRate": 0.05,
                                "age": 100,
                                "maxLifespan": 3600,
                                "ageCategory": "vital",
                                "rejuvenationCount": 0
                            }
                        ]
                    },
                    "moons": [
                        {
                            "name": "Tachyonen-Relais Alpha",
                            "type": "Vorläufer-Relais",
                            "size": 1.2,
                            "distance": 6.8,
                            "speed": 1.4,
                            "color": "0x00ff88",
                            "temp": "-270°C",
                            "atmos": "Quanten-Verschränkungsfeld",
                            "bio": "Kybernetisches Neuro-Geflecht",
                            "res": "Tachyonen-Kristalle & Naniten"
                        }
                    ]
                },
                {
                    "name": "S2-Stern (Gefangener Hyper-Riese)",
                    "type": "Gefangener Stern",
                    "size": 4.5,
                    "distance": 54.0,
                    "color": "0x38bdf8",
                    "temp": "32.000°C",
                    "atmos": "Reines Wasserstoff-Helium-Plasma",
                    "bio": "Steril",
                    "res": "Hochenergetisches Plasma & Gravitations-Echos",
                    "species": None,
                    "moons": []
                },
                {
                    "name": "Ereignis-Knoten Alpha (Akkretions-Wirbel)",
                    "type": "Plasma-Wirbel",
                    "size": 3.2,
                    "distance": 76.0,
                    "color": "0xec4899",
                    "temp": "1.400.000°C",
                    "atmos": "Gammastrahlung & relativistischer Synchrotron-Nebel",
                    "bio": "Steril",
                    "res": "Dunkle Materie & Antimaterie-Kerne",
                    "species": None,
                    "moons": []
                }
            ]

            asteroids = []
            for a_idx in range(16):
                a_dist = 24.0 + (a_idx * 4.5)
                a_angle = a_idx * (math.pi / 8)
                asteroids.append({
                    "x": round(a_dist * math.cos(a_angle), 2),
                    "z": round(a_dist * math.sin(a_angle), 2),
                    "type": "energy" if a_idx % 2 == 0 else "bio"
                })

            systems.append({
                "id": 0,
                "name": sys_name,
                "x": 0.0,
                "z": 0.0,
                "sectorId": sector_id,
                "sectorName": sector_name,
                "anomalyType": anomaly_type,
                "isCoreAnchor": is_core_anchor,
                "star": {
                    "type": "Black Hole",
                    "color": "0x7c3aed",
                    "size": 10,
                    "mass": 650
                },
                "planets": planets,
                "asteroids": asteroids
            })
            continue

        elif i == 1:
            sys_name = "Perseus-Erwachen Prime (Start)"
            x, z = 310.0, 160.0
            existing_coords.append((x, z))
            star_type = "Yellow Sun"
            sector_id = "sector_outer_rim"
            sector_name = "Perseus-Rand (Das Erwachen)"
            anomaly_type = "none"
            is_core_anchor = False
        else:
            arm = i % arms
            arm_offset = arm * (2.0 * math.pi / arms)
            
            progress = ((i + qrng.get_range(-0.3, 0.3)) / float(count)) ** 0.68
            progress = max(0.04, min(1.0, progress))
            
            arm_angle = progress * (4.2 * math.pi) + arm_offset
            arm_r = 18.0 + progress * 420.0
            
            dispersion = 10.0 + progress * 36.0
            scatter_dist = qrng.get_range(-dispersion, dispersion)
            scatter_angle = qrng.get_range(0, 2 * math.pi)
            
            x = round(arm_r * math.cos(arm_angle) + scatter_dist * math.cos(scatter_angle), 2)
            z = round(arm_r * math.sin(arm_angle) + scatter_dist * math.sin(scatter_angle), 2)
            
            attempts = 0
            while attempts < 25:
                too_close = False
                for ex, ez in existing_coords:
                    dx = x - ex
                    dz = z - ez
                    if dx * dx + dz * dz < 9.5 * 9.5:
                        too_close = True
                        break
                if not too_close:
                    break
                x = round(x + qrng.get_range(-14, 14), 2)
                z = round(z + qrng.get_range(-14, 14), 2)
                attempts += 1
                
            existing_coords.append((x, z))
            
            dist_from_core = math.sqrt(x * x + z * z)
            if dist_from_core <= 110.0:
                sector_id = "sector_core"
                sector_name = "Galaktischer Kern (Sagittarius A*)"
            elif dist_from_core <= 265.0:
                sector_id = "sector_mid_rim"
                sector_name = "Orion-Zyklus (Zivilisations-Gürtel)"
            else:
                sector_id = "sector_outer_rim"
                sector_name = "Perseus-Rand (Das Erwachen)"
                
            star_roll = qrng.get_bits(6)
            if sector_id == "sector_core":
                if star_roll < 20:
                    star_type = "White Dwarf"
                elif star_roll < 38:
                    star_type = "Blue Giant"
                elif star_roll < 52:
                    star_type = "Black Hole"
                else:
                    star_type = "Yellow Sun"
            else:
                if star_roll < 32:
                    star_type = "Yellow Sun"
                elif star_roll < 45:
                    star_type = "Blue Giant"
                elif star_roll < 55:
                    star_type = "Red Dwarf"
                elif star_roll < 61:
                    star_type = "White Dwarf"
                else:
                    star_type = "Black Hole"

            anomaly_roll = qrng.get_bits(5)
            if sector_id == "sector_mid_rim" and anomaly_roll < 4:
                anomaly_type = qrng.choose(["flare_star", "dark_energy_rift", "ancient_beacon"])
            elif sector_id == "sector_core" and anomaly_roll < 6:
                anomaly_type = qrng.choose(["pulsar", "dark_energy_rift", "ancient_beacon"])
            elif anomaly_roll == 0:
                anomaly_type = "ancient_beacon"
            else:
                anomaly_type = "none"

            prefix = qrng.choose(STAR_PREFIXES)
            suffix = qrng.choose(STAR_SUFFIXES)
            sys_name = f"{prefix} {suffix}"
            is_core_anchor = False
            
        star_cfg = STAR_CLASSES[star_type]
        
        # Planet generation
        if star_type == "Black Hole":
            # Black hole accretion debris objects (No generic rocky/habitable)
            planet_count = 2 + (qrng.get_bits(2) % 2)
            planets = []
            for p_idx in range(planet_count):
                p_dist = 28.0 + (p_idx * 26.0) + qrng.get_range(-3, 3)
                p_name = f"{sys_name} {chr(65 + p_idx)}"
                if p_idx == 0:
                    p_type = "Plasma-Wirbel"
                    p_size = qrng.get_range(2.8, 3.8)
                    p_color = "0xec4899"
                    p_temp = "850.000°C"
                    p_atmos = "Relativistisches Synchrotron-Plasma"
                    p_bio = "Steril"
                    p_res = "Dunkle Materie & Antimaterie-Fragmente"
                else:
                    p_type = "Gezeiten-Trümmerfeld"
                    p_size = qrng.get_range(2.0, 3.2)
                    p_color = "0x8b5cf6"
                    p_temp = "-260°C"
                    p_atmos = "Vakuum & Gravitations-Echos"
                    p_bio = "Steril"
                    p_res = "Verdichtetes Silizium & Schwermetalle"
                    
                planets.append({
                    "name": p_name,
                    "type": p_type,
                    "size": round(p_size, 2),
                    "distance": round(p_dist, 2),
                    "color": p_color,
                    "temp": p_temp,
                    "atmos": p_atmos,
                    "bio": p_bio,
                    "res": p_res,
                    "species": None,
                    "moons": []
                })
        else:
            planet_count = 1 + (qrng.get_bits(4) % 5)
            tpl = STAR_SYSTEM_TEMPLATES[star_type]
            hz_min, hz_max = tpl["habitable_zone"]
            
            planets = []
            for p_idx in range(planet_count):
                p_dist = tpl["d_min"] * (tpl["spacing"] ** (p_idx + 1)) + qrng.get_range(-2, 2)
                p_dist = max(p_dist, STAR_CLASSES[star_type]["size"] + 6.0)
                
                if hz_min <= p_dist <= hz_max and hz_min > 0:
                    type_roll = qrng.get_bits(3)
                    if type_roll < 5:
                        p_type = "Habitable"
                    else:
                        p_type = qrng.choose(["Rocky", "Gas Giant"])
                elif p_dist < hz_min or hz_min == 0:
                    p_type = "Rocky"
                else:
                    p_type = "Gas Giant" if qrng.get_bits(1) == 0 else "Ice"
                    
                p_name = f"{sys_name} {chr(65 + p_idx)}"
                
                if p_type == "Habitable":
                    p_size = qrng.get_range(2.8, 3.8)
                    p_color = qrng.choose(["0x22c55e", "0x0ea5e9", "0x14b8a6", "0x10b981"])
                    p_temp = f"{int(qrng.get_range(14, 28))}°C"
                    p_atmos = "O2 / N2 (Atembar)"
                    p_bio = "Reich an Biomasse & Flora"
                    p_res = "Kohlenstoff, Bio-Polymere & O2"
                    species = {
                        "hasSentient": True,
                        "name": f"Zivilisation von {p_name}",
                        "population": int(qrng.get_range(10, 800)) * 1000000,
                        "candidates": []
                    }
                elif p_type == "Gas Giant":
                    p_size = qrng.get_range(4.8, 7.5)
                    p_color = qrng.choose(["0xf97316", "0xec4899", "0x8b5cf6", "0xeab308"])
                    p_temp = f"{int(qrng.get_range(-140, -80))}°C"
                    p_atmos = "Wasserstoff & Helium-Plasma"
                    p_bio = "Atmosphärische Mikroorganismen"
                    p_res = "Deuterium & Siphon-Gase"
                    species = None
                elif p_type == "Rocky":
                    p_size = qrng.get_range(2.0, 3.2)
                    p_color = qrng.choose(["0xd97706", "0xb45309", "0x78716c", "0xef4444"])
                    p_temp = f"{int(qrng.get_range(120, 480))}°C"
                    p_atmos = "Dünnes CO2 / Schwefeldampf"
                    p_bio = "Steril"
                    p_res = "Silizium-Kristalle & Titan-Erze"
                    species = None
                else:
                    p_size = qrng.get_range(2.2, 3.5)
                    p_color = qrng.choose(["0x38bdf8", "0x06b6d4", "0xa5f3fc"])
                    p_temp = f"{int(qrng.get_range(-220, -120))}°C"
                    p_atmos = "Gefrorenes Methan & Stickstoff"
                    p_bio = "Kryo-Bakterien"
                    p_res = "Wassereis & flüssiges Methan"
                    species = None
                    
                moons = []
                if p_type == "Gas Giant":
                    moon_count = qrng.get_bits(2) % 4
                elif p_type == "Habitable":
                    moon_count = qrng.get_bits(2) % 3
                else:
                    moon_count = qrng.get_bits(1)
                    
                for m_idx in range(moon_count):
                    m_dist = round(p_size + 3.2 + (m_idx * 2.6) + qrng.get_range(-0.3, 0.3), 2)
                    m_speed = round(qrng.get_range(0.7, 1.6), 2)
                    m_size = round(qrng.get_range(0.6, 1.1), 2)
                    
                    m_roll = qrng.get_bits(2)
                    if p_type == "Gas Giant" or m_roll == 0:
                        m_type = "Eismond"
                        m_color = qrng.choose(["0x38bdf8", "0xe0f2fe", "0xa5f3fc"])
                        m_temp = f"{int(qrng.get_range(-210, -130))}°C"
                        m_atmos = "Subglazialer Wasserdampf (Geysire)"
                        m_bio = "Kryophile Mikroben"
                        m_res = "Deuterium-Eis & Ammoniak"
                    elif m_roll == 1:
                        m_type = "Vulkanmond"
                        m_color = qrng.choose(["0xf97316", "0xef4444", "0xd97706"])
                        m_temp = f"{int(qrng.get_range(120, 350))}°C"
                        m_atmos = "Schwefeldioxid-Ausgasungen"
                        m_bio = "Schwefel-Synthetisierer"
                        m_res = "Geschmolzenes Titan & Silizium"
                    else:
                        m_type = "Kratermond"
                        m_color = qrng.choose(["0x94a3b8", "0x64748b", "0xcbcfd6"])
                        m_temp = f"{int(qrng.get_range(-160, 110))}°C"
                        m_atmos = "Vakuum"
                        m_bio = "Steril"
                        m_res = "Regolith-Gestein & Nickel"
                        
                    m_name = f"{p_name}-{chr(73 + m_idx)}"
                    moons.append({
                        "name": m_name,
                        "type": m_type,
                        "size": m_size,
                        "distance": m_dist,
                        "speed": m_speed,
                        "color": m_color,
                        "temp": m_temp,
                        "atmos": m_atmos,
                        "bio": m_bio,
                        "res": m_res
                    })
                
                planets.append({
                    "name": p_name,
                    "type": p_type,
                    "size": round(p_size, 2),
                    "distance": round(p_dist, 2),
                    "color": p_color,
                    "temp": p_temp,
                    "atmos": p_atmos,
                    "bio": p_bio,
                    "res": p_res,
                    "species": species,
                    "moons": moons
                })
            
        asteroids = []
        tpl = STAR_SYSTEM_TEMPLATES[star_type]
        belt1_dist = tpl["d_min"] * (tpl["spacing"] ** 1.8)
        belt2_dist = tpl["d_min"] * (tpl["spacing"] ** 3.5)
        
        for a_idx in range(16):
            if qrng.get_bits(1) == 0:
                a_dist = belt1_dist + qrng.get_range(-3, 3)
            else:
                a_dist = belt2_dist + qrng.get_range(-6, 6)
                
            a_dist = max(a_dist, STAR_CLASSES[star_type]["size"] + 4.0)
            a_angle = qrng.get_range(0, 2 * math.pi)
            
            ax = a_dist * math.cos(a_angle)
            az = a_dist * math.sin(a_angle)
            is_organic = qrng.get_bits(1) == 0
            
            asteroids.append({
                "x": round(ax, 2),
                "z": round(az, 2),
                "type": "bio" if is_organic else "energy"
            })
            
        systems.append({
            "id": i,
            "name": sys_name,
            "x": round(x, 2),
            "z": round(z, 2),
            "sectorId": sector_id,
            "sectorName": sector_name,
            "anomalyType": anomaly_type,
            "isCoreAnchor": is_core_anchor,
            "star": {
                "type": star_type,
                "color": star_cfg["color"],
                "size": star_cfg["size"],
                "mass": star_cfg["mass"]
            },
            "planets": planets,
            "asteroids": asteroids
        })
        
    meta_info["systemCount"] = len(systems)
    return {
        "meta": meta_info,
        "systems": systems
    }


def main():
    parser = argparse.ArgumentParser(description="Project Najmafar Universe Generator")
    parser.add_argument("--count", dest="count", type=int, default=1000, help="Number of stellar systems to generate")
    parser.add_argument("--api-key", "--token", dest="api_key", type=str, default="", help="IBM Quantum API Key / Token")
    parser.add_argument("--qpu", "--use-qpu", dest="qpu", action="store_true", help="Use real IBM QPU instead of simulator")
    parser.add_argument("--force", dest="force", action="store_true", help="Force overwrite even if universe_data.json contains real IBM QPU data")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("IBM_QUANTUM_API_KEY", "") or os.environ.get("QISKIT_IBM_TOKEN", "")
    use_qpu = args.qpu
    
    # 1. Check existing universe file to protect real IBM QPU data
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "universe_data.json")
    is_existing_qpu = False
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                if existing_data.get("meta", {}).get("generatorMode") == "IBM_QPU":
                    is_existing_qpu = True
        except Exception:
            pass

    # If existing data is from a real IBM QPU and current run is not QPU and not forced:
    if is_existing_qpu and not use_qpu and not args.force:
        sim_output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "universe_data.sim.json")
        print(f"🔒 SCHUTZAKTIV: 'universe_data.json' enthält ein echtes IBM-QPU-Universum!", flush=True)
        print(f"Simulator-Ergebnisse werden separat in '{sim_output_path}' gespeichert, um die QPU-Daten nicht zu überschreiben.", flush=True)
        output_path = sim_output_path

    # 2. Fetch quantum random stream and provenance metadata
    qrng, meta_info = generate_quantum_bits(api_key, use_qpu)
    galaxy_data = build_galaxy(qrng, meta_info, count=args.count)
    
    # 3. Export to JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(galaxy_data, f, indent=2, ensure_ascii=False)
        
    print(f"Erfolg: {len(galaxy_data['systems'])} Sternensysteme [{meta_info['generatorMode']} - {meta_info['backendName']}] in '{output_path}' exportiert!", flush=True)


if __name__ == "__main__":
    main()

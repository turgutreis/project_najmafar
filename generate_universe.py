import os
import sys
import json
import math
import random
import argparse

# Prefix & Suffix tables for procedural star naming
STAR_PREFIXES = [
    "Alpha", "Vega", "Sirius", "Kepler", "Orion", "Zeta", "Epsilon", "Proxima", "Nova", 
    "Gliese", "Antares", "Aldebaran", "Polaris", "Betelgeuse", "Rigel", "Castor", "Pollux", 
    "Capella", "Arcturus", "Canopus", "Altair", "Deneb", "Fomalhaut", "Regulus", "Spica"
]
STAR_SUFFIXES = [
    "Prime", "Major", "Minor", "B", "C", "D", "X", "IX", "Omega", "Theta", "Gamma", 
    "Sigma", "Tau", "Eridani", "Cygni", "Centauri", "Borealis", "Australis", "Null", 
    "Void", "Nexus", "V", "VI", "VII", "VIII"
]

# Star classes characteristics
STAR_CLASSES = {
    "Yellow Sun": {"color": "0xf59e0b", "size": 12, "mass": 180},
    "Blue Giant": {"color": "0x3b82f6", "size": 16, "mass": 320},
    "Red Dwarf":  {"color": "0xef4444", "size": 8, "mass": 90},
    "White Dwarf": {"color": "0xf8fafc", "size": 5, "mass": 140},
    "Black Hole":  {"color": "0x7c3aed", "size": 7, "mass": 480}
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
        "d_min": 14,
        "spacing": 1.45,
        "habitable_zone": (0, 0) # Black holes have no habitable zone
    }
}


class QuantumRandomStream:
    """Consumes bitstrings from a Qiskit circuit execution as a random number generator."""
    def __init__(self, bitstrings):
        self.bitstrings = bitstrings
        self.bit_index = 0
        self.string_index = 0
        
        # Flatten all bitstrings into a single long string of bits
        self.bit_pool = "".join(bitstrings)
        
    def get_bits(self, count):
        """Extracts 'count' bits from the quantum stream and returns as an integer."""
        if not self.bit_pool:
            return random.randint(0, (1 << count) - 1)
            
        if self.bit_index + count > len(self.bit_pool):
            # Wrap around or recycle if stream runs dry
            self.bit_index = 0
            
        bits = self.bit_pool[self.bit_index : self.bit_index + count]
        self.bit_index += count
        return int(bits, 2)

    def get_float(self):
        """Returns a quantum random float between 0.0 and 1.0."""
        # Use 16 bits of precision
        bits = self.get_bits(16)
        return bits / 65535.0

    def get_range(self, min_val, max_val):
        """Returns a quantum random float in [min_val, max_val]."""
        return min_val + self.get_float() * (max_val - min_val)

    def choose(self, lst):
        """Chooses an item from a list using quantum bits."""
        if not lst:
            return None
        idx = self.get_bits(8) % len(lst)
        return lst[idx]


def generate_quantum_bits(api_key=None, use_qpu=False):
    """
    Builds and runs a 5-qubit Hadamard quantum circuit.
    Falls back to local simulation if no API key is set, or pseudorandom if Qiskit isn't installed.
    """
    print("Najmafar Quantum Generator: Initialisiere Quantenschaltkreis...", flush=True)
    
    try:
        import qiskit
        from qiskit import QuantumCircuit
        print(f"Qiskit v{qiskit.__version__} erkannt.", flush=True)
    except ImportError:
        print("WARNUNG: Qiskit ist auf diesem System nicht installiert. Weiche auf Pseudo-Zufall aus.", flush=True)
        # Generate 2000 mock 5-bit strings
        mock_strings = [format(random.randint(0, 31), '05b') for _ in range(2000)]
        return QuantumRandomStream(mock_strings)

    # 1. Build a 5-qubit circuit with Hadamard gates for max superposition
    qc = QuantumCircuit(5, 5)
    qc.h(range(5))
    qc.measure(range(5), range(5))
    
    shots = 2000
    bitstrings = []

    # 2. Check if we want to run on IBM Quantum Platform
    if api_key and use_qpu:
        print("Verbinde mit IBM Quantum Platform (Echtes QPU/Cloud-Gerät)...", flush=True)
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
            
            try:
                service = QiskitRuntimeService(channel="ibm_quantum_platform", token=api_key)
            except Exception:
                service = QiskitRuntimeService(channel="ibm_quantum", token=api_key)
            # Find the least busy backend (avoiding simulators to run on QPU)
            backend = service.least_busy(simulator=False, operational=True)
            print(f"QPU ausgewählt: {backend.name}. Reiche Quanten-Job ein (Shots={shots})...", flush=True)
            
            # Since March 2024, IBM QPUs require the circuit to be transpiled to their native gate set before execution
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
            pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
            transpiled_qc = pm.run(qc)
            
            sampler = SamplerV2(backend)
            job = sampler.run([(transpiled_qc)])
            print(f"Job eingereicht. Job-ID: {job.job_id()}. Warte auf Berechnung...", flush=True)
            
            result = job.result()
            pub_result = result[0]
            # V2 sampler bitstrings extraction
            bitstrings_raw = pub_result.data.c.get_bitstrings()
            bitstrings = list(bitstrings_raw)
            print("Quanten-Messergebnisse erfolgreich von IBM geladen!", flush=True)
            
        except Exception as e:
            print(f"FEHLER bei IBM QPU-Verbindung: {str(e)}", flush=True)
            print("Weiche auf den lokalen Qiskit-Simulator aus...", flush=True)
            bitstrings = run_local_simulator(qc, shots)
    else:
        # Use local simulator
        print("Führe Quantenschaltkreis auf lokalem Simulator aus (BasicProvider)...", flush=True)
        bitstrings = run_local_simulator(qc, shots)
        
    return QuantumRandomStream(bitstrings)


def run_local_simulator(qc, shots):
    """Runs the circuit locally using Qiskit's BasicProvider."""
    try:
        from qiskit.providers.basic_provider import BasicProvider
        provider = BasicProvider()
        backend = provider.get_backend("basic_simulator")
        job = backend.run(qc, shots=shots)
        result = job.result()
        # In BasicProvider, we get counts, but basic_simulator also supports memory
        # Wait, if basic_simulator doesn't support memory directly, we can unpack from counts
        counts = result.get_counts()
        bitstrings = []
        for bitstr, freq in counts.items():
            bitstrings.extend([bitstr] * freq)
        # Shuffle to restore quantum sequence order
        random.shuffle(bitstrings)
        return bitstrings
    except Exception as e:
        print(f"Fehler bei lokalem Qiskit Simulator: {str(e)}. Weiche auf Pseudo-Zufall aus.", flush=True)
        return [format(random.randint(0, 31), '05b') for _ in range(shots)]


def build_galaxy(qrng):
    """Procedurally generates a spiral galaxy of 100 stellar systems using quantum bits."""
    print("Generiere Galaxie mit 100 Sternensystemen...", flush=True)
    systems = []
    
    # We arrange the 100 systems in a 2-armed spiral galaxy!
    arms = 2
    for i in range(100):
        # 1. System Coordinates in spiral arms
        # Spiral parameters: angle theta, radius r
        theta = qrng.get_range(0, 4 * math.pi) # rotation angle
        # Arm choice (quantum choice)
        arm = qrng.get_bits(1) % arms
        arm_offset = arm * (2 * math.pi / arms)
        
        # Radius expands out with some randomness
        r = qrng.get_range(30, 250) + (i * 1.5)
        
        # Spiral math
        x = r * math.cos(theta + arm_offset) + qrng.get_range(-15, 15)
        z = r * math.sin(theta + arm_offset) + qrng.get_range(-15, 15)
        
        # 2. System naming
        prefix = qrng.choose(STAR_PREFIXES)
        suffix = qrng.choose(STAR_SUFFIXES)
        sys_name = f"{prefix} {suffix}"
        
        # Make the starting system (ID 0) Epsilon Prime at center coordinates for easy start
        if i == 0:
            sys_name = "Sol-Verbindung (Start)"
            x, z = 0.0, 0.0
            
        # 3. Star selection
        # Weighted roll using quantum bits
        star_roll = qrng.get_bits(6) # 0-63
        if star_roll < 32: # 50%
            star_type = "Yellow Sun"
        elif star_roll < 45: # 20%
            star_type = "Blue Giant"
        elif star_roll < 55: # 15%
            star_type = "Red Dwarf"
        elif star_roll < 61: # 10%
            star_type = "White Dwarf"
        else: # 5%
            star_type = "Black Hole"
            
        star_cfg = STAR_CLASSES[star_type]
        
        # 4. Planets generation (1 to 5 planets)
        planet_count = 1 + (qrng.get_bits(4) % 5)
        if star_type == "Black Hole":
            planet_count = 1 + (qrng.get_bits(2) % 3) # Black holes have fewer planets
            
        tpl = STAR_SYSTEM_TEMPLATES[star_type]
        hz_min, hz_max = tpl["habitable_zone"]
        
        planets = []
        for p_idx in range(planet_count):
            # Keplerian exponential spacing with quantum noise
            p_dist = tpl["d_min"] * (tpl["spacing"] ** (p_idx + 1)) + qrng.get_range(-2, 2)
            # Ensure planet is outside the star radius
            p_dist = max(p_dist, STAR_CLASSES[star_type]["size"] + 6.0)
            
            # Determine planet type based on distance and habitable zone
            if hz_min <= p_dist <= hz_max and hz_min > 0:
                type_roll = qrng.get_bits(3)
                if type_roll < 5: # 62.5% chance
                    p_type = "Habitable"
                else:
                    p_type = qrng.choose(["Rocky", "Gas Giant"])
            elif p_dist < hz_min or hz_min == 0:
                p_type = "Rocky" # Too close / hot
            else:
                p_type = "Gas Giant" # Too far / cold
                
            if p_type == "Rocky":
                p_size = qrng.get_range(1.2, 2.0)
                p_color = qrng.choose(["0x94a3b8", "0xfdba74", "0xca8a04", "0x64748b"])
                p_temp = f"{int(qrng.get_range(-200, 380))}°C"
                p_atmos = qrng.choose(["Keine Atmosphäre (Vakuum)", "Dünnes CO2-Vakuum", "Schwefeldioxid & Argon"])
                p_bio = qrng.choose(["Steril", "Extremophile Flechten"])
                p_res = qrng.choose(["Reich an Silizium-Kristallen, Eisen & Titan", "Wertlose Staubkruste, Spuren von Nickel", "Schwermetall-Flöz (Eisen & Nickel)"])
            elif p_type == "Gas Giant":
                p_size = qrng.get_range(3.5, 5.0)
                p_color = qrng.choose(["0xa855f7", "0x0ea5e9", "0xf43f5e", "0x6366f1"])
                p_temp = f"{int(qrng.get_range(-180, -90))}°C"
                p_atmos = qrng.choose(["Flüssiges Helium & Wasserstoff", "Superdichtes Ammoniak & Methan"])
                p_bio = qrng.choose(["Keine Signaturen erfasst", "Schwebende Plankton-Analoge"])
                p_res = qrng.choose(["Extrem hoher Druck, Deuterium-Vorkommen", "Heißes Helium-3-Vorkommen"])
            else: # Habitable
                p_size = qrng.get_range(2.0, 2.6)
                p_color = qrng.choose(["0x00ff88", "0x0d9488", "0x14b8a6"])
                p_temp = f"{int(qrng.get_range(8, 38))}°C"
                p_atmos = qrng.choose(["Stickstoff & Sauerstoff (Klasse M)", "Dichte Aerosole & Wasserdampf"])
                p_bio = qrng.choose(["Biolumineszierende Flora", "Mikrobielle Kolonien", "Komplexes Ökosystem"])
                p_res = qrng.choose(["Reich an Biomasse, Kohlenstoff & O2", "Uran-Akkretionen & Urzeitfarne"])
                
            p_name = f"{sys_name} {chr(97 + p_idx)}"
            
            planets.append({
                "name": p_name,
                "type": p_type,
                "size": round(p_size, 2),
                "distance": round(p_dist, 2),
                "color": p_color,
                "temp": p_temp,
                "atmos": p_atmos,
                "bio": p_bio,
                "res": p_res
            })
            
        # 5. Resource Asteroids (arranged in two structured concentric belts)
        asteroids = []
        # Belt 1 (Inner Belt): between inner orbits
        # Belt 2 (Outer Belt): Kuiper Belt at outer edge
        belt1_dist = tpl["d_min"] * (tpl["spacing"] ** 1.8)
        belt2_dist = tpl["d_min"] * (tpl["spacing"] ** 3.5)
        
        for a_idx in range(16): # 16 asteroids
            if qrng.get_bits(1) == 0:
                # Belt 1
                a_dist = belt1_dist + qrng.get_range(-3, 3)
            else:
                # Belt 2
                a_dist = belt2_dist + qrng.get_range(-6, 6)
                
            # Ensure safe distance from star
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
            "star": {
                "type": star_type,
                "color": star_cfg["color"],
                "size": star_cfg["size"],
                "mass": star_cfg["mass"]
            },
            "planets": planets,
            "asteroids": asteroids
        })
        
    return {"systems": systems}


def main():
    parser = argparse.ArgumentParser(description="Project Najmafar Universe Generator")
    parser.add_argument("--api-key", type=str, default="", help="IBM Quantum API Key")
    parser.add_argument("--qpu", action="store_true", help="Use real IBM QPU instead of simulator")
    args = parser.parse_args()

    # Fallback to env variable if arg is empty
    api_key = args.api_key or os.environ.get("IBM_QUANTUM_API_KEY", "")
    use_qpu = args.qpu
    
    # 1. Fetch quantum random stream
    qrng = generate_quantum_bits(api_key, use_qpu)
    
    # 2. Build galaxy
    galaxy_data = build_galaxy(qrng)
    
    # 3. Export to JSON
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "universe_data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(galaxy_data, f, indent=2, ensure_ascii=False)
        
    print(f"Erfolg: 100 Sternensysteme in '{output_path}' exportiert!", flush=True)


if __name__ == "__main__":
    main()

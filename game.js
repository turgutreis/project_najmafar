import * as THREE from 'three';

// --- GAME STATE ---
const STATE = {
    // Player Stats
    health: 100,
    maxHealth: 100,
    bioEnergy: 80,
    maxBioEnergy: 100,
    mentalEnergy: 90,
    maxMentalEnergy: 100,
    telepathyActive: false,
    gameStarted: false,

    // Evolution Resources
    bioRes: 0,
    siliconRes: 0,

    // Mutations
    mutations: {
        armor: { purchased: false, bioCost: 50, siliconCost: 30 },
        o2: { purchased: false, bioCost: 60, siliconCost: 40 },
        synapses: { purchased: false, bioCost: 40, siliconCost: 80 },
        translator: { purchased: false, bioCost: 80, siliconCost: 80 }
    },

    // Physics
    playerPosition: new THREE.Vector3(0, 0, 50),
    playerVelocity: new THREE.Vector3(0, 0, 0),

    // Quantum Universe
    universe: null,
    currentSystemId: 0,
    playerAcceleration: new THREE.Vector3(0, 0, 0),

    // Scanner System
    nearestPlanet: null,
    scanningPlanet: null,
    scanProgress: 0,
    scannedPlanets: {},
    playerMass: 1,
    drag: 0.4, // Base drag when thrusting
    brakeDrag: 2.2, // Retro-dampeners drag when coasting
    currentDrag: 0.4,
    thrustStrength: 25.0, // Responsive thrusters

    // Crew Simulation
    crew: [
        { id: 1, name: "Capt. Miller (Pilot)", role: "Pilot", stress: 25, status: "Arbeitet", baseStressRate: 0.4 },
        { id: 2, name: "Dr. Song (Biologin)", role: "Biologin", stress: 40, status: "Analysiert Gewebe", baseStressRate: 0.3 },
        { id: 3, name: "Ing. Petrov (Mechaniker)", role: "Mechaniker", stress: 75, status: "Wartung", baseStressRate: 0.6 }
    ],

    // Environment
    gravitySources: [],
    asteroids: [],

    // Controls
    keys: {
        w: false, a: false, s: false, d: false,
        ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
        Space: false
    },

    // Config
    gConstant: 15.0, // Decreased to allow escape from gravity wells
    collisionCooldown: 0
};

// --- AUDIO SYSTEM ---
const bgMusic = new Audio('assets/The Ur-Quan Masters - Space.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.35;
let musicPlaying = false;

// --- STORY SYSTEM ---
const STORY_LOGS = [
    { time: 6, sender: "Capt. Miller", text: "Das Ding lebt! Wir sind im Bauch eines Lovecraft-Monsters gefangen! Wo ist die Luft?" },
    { time: 24, sender: "Dr. Song", text: "Die Schiffswände atmen... Valeria, das Schiff absorbiert Weltraummaterie um sich zu heilen!" },
    { time: 48, sender: "Valeria", text: "Jamal, guck dir die Messgeräte an. Die kosmische Hintergrundstrahlung... Die Expansion verlangsamt sich!" },
    { time: 70, sender: "Jamal", text: "Das ist kein Fehler. Jemand macht eine kosmische Vollbremsung. Dieses Wesen... versucht es uns zu warnen?" },
    { time: 95, sender: "Capt. Miller", text: "Es sendet Gedankenwellen. Die Software übersetzt es als... Dschinn? Es ist einsam." }
];
let storyIndex = 0;
let playTime = 0;

function encryptText(text) {
    const alienGlyphs = "⏁⊑⟒⋔⍜⋏☿⏁⟒⍃⍜⌰⎍⌇⌇⊑⟟⌿⌇⏃⋏⎅⌇⏁⏃⍀⌇⏁⍀⟒☍⏁⊑⟒⌇⊑⟟⌿⟟⌇⏃⌰⟟⎎⟒";
    return text.split('').map(char => {
        if (char === ' ' || char === '"' || char === '\'' || char === ':' || char === '.' || char === ',' || char === '?' || char === '!' || char === '-' || char === '(' || char === ')') return char;
        return alienGlyphs[Math.floor(Math.random() * alienGlyphs.length)];
    }).join('');
}

function encryptCrewMessage(sender, text) {
    let outText = text;
    if (!STATE.mutations.translator.purchased) {
        outText = encryptText(text);
    }
    return `${sender}: "${outText}"`;
}

// --- INITIALIZE THREE.JS ---
let scene, camera, renderer;
let playerMesh, playerGlowMesh;
let tentacles = [];
let starfield;
let gravityCircles = [];
let activePlanets = [];
let scanVisualMesh = null;
let minimapCanvas = null;
let minimapCtx = null;
let trajectoryPoints;
const container = document.getElementById('canvas-container');

function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.003);

    // Camera (Top-down view with offset height)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 80, 0);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x030712);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa855f7, 2, 50);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Create World Objects
    createStarfield();
    createPlayerMesh();
    spawnPlanetsAndAsteroids();

    // Initialize Trajectory Line
    initTrajectory();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    setupControls();

    // Start Game Loop
    animate();

    // Log Init Message
    addLogEntry("SYSTEM", "Biomechanisches Feedback-System online. Nutze Gravitationsfelder zur Fortbewegung.");

    // Refresh mutation UI initial states
    updateMutationUI();

    // Load quantum galaxy map if exists
    checkUniverseData();
}

// --- CREATIVE PROCEDURAL MESHES ---

function createPlayerMesh() {
    // Organic spaceship group
    const playerGroup = new THREE.Group();

    // Core body (Elongated ellipsoid)
    const coreGeo = new THREE.SphereGeometry(2, 32, 16);
    coreGeo.scale(1.5, 0.8, 0.8); // Make it ship-shaped (longitudinal)

    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x111827,
        flatShading: true
    });

    playerMesh = new THREE.Mesh(coreGeo, coreMat);
    playerGroup.add(playerMesh);

    // Bioluminescent outer shield shell (semi-transparent glowing cage)
    const glowGeo = new THREE.SphereGeometry(2.4, 16, 16);
    glowGeo.scale(1.6, 0.9, 0.9);

    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });

    playerGlowMesh = new THREE.Mesh(glowGeo, glowMat);
    playerGroup.add(playerGlowMesh);

    // Add glowing core light inside
    const coreLight = new THREE.PointLight(0x00ff88, 3, 15);
    playerGroup.add(coreLight);

    // Bio-Tentacles (appendages that sway)
    const tentacleCount = 4;
    for (let i = 0; i < tentacleCount; i++) {
        const tentacleGroup = new THREE.Group();

        // Build tentacle out of segmented joints
        let lastSegment = tentacleGroup;
        const segmentCount = 6;
        const segments = [];

        for (let j = 0; j < segmentCount; j++) {
            const size = 0.4 * (1 - j / segmentCount);
            const segGeo = new THREE.SphereGeometry(size, 8, 8);
            const segMat = new THREE.MeshStandardMaterial({
                color: 0x059669,
                emissive: 0x047857,
                roughness: 0.2
            });
            const segment = new THREE.Mesh(segGeo, segMat);

            // Offset each segment backward
            segment.position.x = -0.7;
            lastSegment.add(segment);
            lastSegment = segment;
            segments.push(segment);
        }

        // Angle the tentacles outwards from the rear
        const angle = (i - (tentacleCount - 1) / 2) * 0.4;
        tentacleGroup.rotation.z = angle;
        tentacleGroup.position.set(-2, 0, Math.sin(angle) * 0.5);

        playerGroup.add(tentacleGroup);
        tentacles.push({
            root: tentacleGroup,
            segments: segments,
            phase: Math.random() * Math.PI * 2
        });
    }

    scene.add(playerGroup);

    // Store group reference
    STATE.playerGroup = playerGroup;
}

function createStarfield() {
    const starCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        // Distribute stars in a wide disc
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 300;

        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40; // thick disc
        positions[i * 3 + 2] = Math.sin(angle) * radius;

        // Custom organic colors (cyan, magenta, white)
        const rand = Math.random();
        if (rand < 0.3) {
            colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 0.9; // purple
        } else if (rand < 0.6) {
            colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 0.9; // cyan
        } else {
            colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0; // white
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });

    starfield = new THREE.Points(geometry, material);
    scene.add(starfield);
}

function spawnPlanetsAndAsteroids() {
    if (!STATE.universe) {
        // 1. Fallback Spawning large planets (Major gravity sources)
        const planetTypes = [
            { color: 0x3b82f6, size: 8, mass: 100, range: 45, name: "Wasser-Gas-Riese" },
            { color: 0xeab308, size: 10, mass: 150, range: 55, name: "Golderz-Akkretor" }
        ];

        const planetCoords = [
            { x: -50, z: -30 },
            { x: 60, z: 25 }
        ];

        planetTypes.forEach((p, idx) => {
            const coords = planetCoords[idx];
            const planetGroup = new THREE.Group();
            planetGroup.position.set(coords.x, 0, coords.z);

            // Core Sphere
            const geo = new THREE.SphereGeometry(p.size, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: p.color,
                roughness: 0.8,
                metalness: 0.2,
                flatShading: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            planetGroup.add(mesh);

            // Atmosphere/Glow
            const atmGeo = new THREE.SphereGeometry(p.size * 1.1, 16, 16);
            const atmMat = new THREE.MeshBasicMaterial({
                color: p.color,
                wireframe: true,
                transparent: true,
                opacity: 0.15
            });
            const atm = new THREE.Mesh(atmGeo, atmMat);
            planetGroup.add(atm);

            scene.add(planetGroup);

            // Save as gravity source
            const sourceObj = {
                mesh: planetGroup,
                type: 'planet',
                name: p.name,
                mass: p.mass,
                radius: p.size,
                gravityRange: p.range,
                position: new THREE.Vector3(coords.x, 0, coords.z)
            };
            STATE.gravitySources.push(sourceObj);

            // Create a visual indicator ring for the gravity well range
            const ring = createGravityRing(coords.x, coords.z, p.range, p.color);

            // Register for fallback orbits & scan
            const dist = Math.sqrt(coords.x * coords.x + coords.z * coords.z);
            const orbitSpeed = 0.2 / Math.sqrt(dist);
            const angle = Math.atan2(coords.z, coords.x);

            activePlanets.push({
                mesh: planetGroup,
                source: sourceObj,
                ringMesh: ring,
                angle: angle,
                speed: orbitSpeed,
                distance: dist,
                name: p.name,
                type: idx === 0 ? 'Gas Giant' : 'Rocky',
                size: p.size,
                color: p.color,
                scanned: false,
                attributes: generatePlanetAttributes({ name: p.name, type: idx === 0 ? 'Gas Giant' : 'Rocky' })
            });
        });

        // 2. Fallback Spawning smaller resource Asteroids
        const asteroidCount = 18;
        for (let i = 0; i < asteroidCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 25 + Math.random() * 60;
            const anchor = Math.random() > 0.5 ? planetCoords[0] : planetCoords[1];
            const x = anchor.x + Math.cos(angle) * dist;
            const z = anchor.z + Math.sin(angle) * dist;

            const size = 1.5 + Math.random() * 2;
            const geo = new THREE.DodecahedronGeometry(size, 1);
            const posAttr = geo.attributes.position;
            for (let j = 0; j < posAttr.count; j++) {
                const vx = posAttr.getX(j);
                const vy = posAttr.getY(j);
                const vz = posAttr.getZ(j);
                const scale = 1 + (Math.random() - 0.5) * 0.3;
                posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
            }
            geo.computeVertexNormals();

            const isOrganicResource = Math.random() > 0.4;
            const color = isOrganicResource ? 0x00ff88 : 0x06b6d4;

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.9,
                metalness: 0.8,
                emissive: isOrganicResource ? 0x003311 : 0x002233
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0, z);
            scene.add(mesh);

            const range = size * 3;
            const sourceObj = {
                mesh: mesh,
                type: 'asteroid',
                name: isOrganicResource ? "Organische Biosphäre" : "Silizium-Komet",
                mass: size * 4,
                radius: size,
                gravityRange: range,
                position: new THREE.Vector3(x, 0, z),
                isResource: true,
                resourceType: isOrganicResource ? 'bio' : 'energy',
                isAbsorbed: false,
                ringMesh: null
            };

            STATE.gravitySources.push(sourceObj);
            STATE.asteroids.push(sourceObj);
            sourceObj.ringMesh = createGravityRing(x, z, range, color, 0.05);
        }
        return;
    }

    // Active system generation from IBM Quantum data
    const activeSystem = STATE.universe.systems[STATE.currentSystemId];
    if (!activeSystem) {
        console.error("Najmafar: Active system not found! System ID:", STATE.currentSystemId);
        return;
    }

    // 1. Spawn central star
    const starData = activeSystem.star;
    if (starData.type !== "Black Hole") {
        const starGeo = new THREE.SphereGeometry(starData.size, 32, 32);
        const starMat = new THREE.MeshBasicMaterial({
            color: parseInt(starData.color),
            wireframe: false
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(0, 0, 0);
        scene.add(starMesh);

        const starLight = new THREE.PointLight(parseInt(starData.color), 3, 300, 0.4);
        starLight.position.set(0, 0, 0);
        scene.add(starLight);

        const starSource = {
            mesh: starMesh,
            light: starLight,
            type: 'star',
            name: `Stern (${starData.type})`,
            mass: starData.mass,
            radius: starData.size,
            gravityRange: starData.size * 3.5,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(starSource);
        createGravityRing(0, 0, starSource.gravityRange, parseInt(starData.color), 0.12);
    } else {
        // Black hole visual effect
        const bhGeo = new THREE.SphereGeometry(starData.size, 32, 32);
        const bhMat = new THREE.MeshBasicMaterial({
            color: 0x020617,
            wireframe: false
        });
        const bhMesh = new THREE.Mesh(bhGeo, bhMat);
        bhMesh.position.set(0, 0, 0);
        scene.add(bhMesh);

        // Accretion disk
        const diskGeo = new THREE.RingGeometry(starData.size * 1.2, starData.size * 2.2, 64);
        diskGeo.rotateX(Math.PI / 2);
        const diskMat = new THREE.MeshBasicMaterial({
            color: 0x7c3aed,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const diskMesh = new THREE.Mesh(diskGeo, diskMat);
        scene.add(diskMesh);

        const bhSource = {
            mesh: bhMesh,
            diskMesh: diskMesh,
            type: 'star',
            name: "Schwarzes Loch (Singularität)",
            mass: starData.mass,
            radius: starData.size,
            gravityRange: starData.size * 5.0,
            position: new THREE.Vector3(0, 0, 0)
        };
        STATE.gravitySources.push(bhSource);
        createGravityRing(0, 0, bhSource.gravityRange, 0x7c3aed, 0.2);
    }

    // 2. Spawn planets
    activeSystem.planets.forEach((p, idx) => {
        const angle = (idx * 1.4) + 0.3;
        const px = p.distance * Math.cos(angle);
        const pz = p.distance * Math.sin(angle);

        const planetGroup = new THREE.Group();
        planetGroup.position.set(px, 0, pz);

        const geo = new THREE.SphereGeometry(p.size, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: parseInt(p.color),
            roughness: p.type === 'Gas Giant' ? 0.4 : 0.8,
            metalness: p.type === 'Rocky' ? 0.3 : 0.1,
            flatShading: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        planetGroup.add(mesh);

        if (p.type === 'Habitable' || p.type === 'Gas Giant') {
            const atmGeo = new THREE.SphereGeometry(p.size * 1.15, 16, 16);
            const atmMat = new THREE.MeshBasicMaterial({
                color: parseInt(p.color),
                wireframe: true,
                transparent: true,
                opacity: p.type === 'Habitable' ? 0.22 : 0.12
            });
            const atm = new THREE.Mesh(atmGeo, atmMat);
            planetGroup.add(atm);
        }

        scene.add(planetGroup);

        const pMass = p.size * p.size * 4;
        const pRange = p.size * 4.5;

        const sourceObj = {
            mesh: planetGroup,
            type: 'planet',
            name: p.name,
            mass: pMass,
            radius: p.size,
            gravityRange: pRange,
            position: new THREE.Vector3(px, 0, pz)
        };
        STATE.gravitySources.push(sourceObj);

        const ring = createGravityRing(px, pz, pRange, parseInt(p.color), 0.08);

        // Save Kepler orbit specs & scan details
        const orbitSpeed = 0.2 / Math.sqrt(p.distance); // outer planets orbit slower!
        activePlanets.push({
            mesh: planetGroup,
            source: sourceObj,
            ringMesh: ring,
            angle: angle,
            speed: orbitSpeed,
            distance: p.distance,
            name: p.name,
            type: p.type,
            size: p.size,
            color: p.color,
            scanned: false,
            attributes: (p.temp && p.atmos) ? {
                atmos: p.atmos,
                temp: p.temp,
                bio: p.bio,
                res: p.res
            } : generatePlanetAttributes(p)
        });
    });

    // 3. Spawn asteroids
    activeSystem.asteroids.forEach((ast) => {
        const size = 1.2 + Math.random() * 1.2;
        const geo = new THREE.DodecahedronGeometry(size, 1);

        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
            const vx = posAttr.getX(j);
            const vy = posAttr.getY(j);
            const vz = posAttr.getZ(j);
            const scale = 1 + (Math.random() - 0.5) * 0.3;
            posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
        }
        geo.computeVertexNormals();

        const isOrganic = ast.type === 'bio';
        const color = isOrganic ? 0x00ff88 : 0x06b6d4;

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.8,
            emissive: isOrganic ? 0x003311 : 0x002233
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ast.x, 0, ast.z);
        scene.add(mesh);

        const range = size * 3;
        const sourceObj = {
            mesh: mesh,
            type: 'asteroid',
            name: isOrganic ? "Organische Biosphäre" : "Silizium-Komet",
            mass: size * 4,
            radius: size,
            gravityRange: range,
            position: new THREE.Vector3(ast.x, 0, ast.z),
            isResource: true,
            resourceType: isOrganic ? 'bio' : 'energy',
            isAbsorbed: false,
            ringMesh: null
        };

        STATE.gravitySources.push(sourceObj);
        STATE.asteroids.push(sourceObj);
        sourceObj.ringMesh = createGravityRing(ast.x, ast.z, range, color, 0.05);
    });
}

function createGravityRing(x, z, radius, color, baseOpacity = 0.12) {
    const segments = 64;
    const geometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, segments);
    geometry.rotateX(Math.PI / 2); // Make it horizontal

    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: baseOpacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(x, 0, z);
    scene.add(ring);

    gravityCircles.push({
        mesh: ring,
        pulseSpeed: 1 + Math.random() * 2,
        baseOpacity: baseOpacity
    });
    return ring;
}

// --- CONTROLS SYSTEM ---

function setupControls() {
    // Keyboard down
    window.addEventListener('keydown', (e) => {
        let key = e.key.toLowerCase();
        if (key === ' ' || e.code === 'Space') {
            toggleTelepathy();
            e.preventDefault();
        }
        if (key === 'm') {
            toggleGalaxyMap();
        }
        if (key === 'f') {
            triggerScanStart();
        }
        if (key === 'w' || e.key === 'ArrowUp') STATE.keys.w = true;
        if (key === 's' || e.key === 'ArrowDown') STATE.keys.s = true;
        if (key === 'a' || e.key === 'ArrowLeft') STATE.keys.a = true;
        if (key === 'd' || e.key === 'ArrowRight') STATE.keys.d = true;
    });

    // Keyboard up
    window.addEventListener('keyup', (e) => {
        let key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'ArrowUp') STATE.keys.w = false;
        if (key === 's' || e.key === 'ArrowDown') STATE.keys.s = false;
        if (key === 'a' || e.key === 'ArrowLeft') STATE.keys.a = false;
        if (key === 'd' || e.key === 'ArrowRight') STATE.keys.d = false;
    });

    // UI Button Click
    const btn = document.getElementById('telepathy-toggle-btn');
    if (btn) {
        btn.addEventListener('click', toggleTelepathy);
    }

    // Music Toggle Button
    const musicBtn = document.getElementById('music-toggle-btn');
    if (musicBtn) {
        musicBtn.addEventListener('click', toggleMusic);
    }

    // Auto-start music on first interaction (required by browsers)
    const startAudioOnInteraction = () => {
        if (!musicPlaying) {
            toggleMusic();
        }
        window.removeEventListener('click', startAudioOnInteraction);
        window.removeEventListener('keydown', startAudioOnInteraction);
    };
    window.addEventListener('click', startAudioOnInteraction);
    window.addEventListener('keydown', startAudioOnInteraction);

    // Mutation buttons listeners
    document.querySelectorAll('.mut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.mutation;
            buyMutation(type);
        });
    });
}

function buyMutation(type) {
    const mut = STATE.mutations[type];
    if (!mut || mut.purchased) return;

    if (STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost) {
        STATE.bioRes -= mut.bioCost;
        STATE.siliconRes -= mut.siliconCost;
        mut.purchased = true;

        // Apply Buffs
        if (type === 'armor') {
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Chitin-Hülle verhärtet. Kollisionsschaden um 50% reduziert.");
            const el = document.getElementById('svg-armor');
            if (el) el.style.display = 'block';
        } else if (type === 'o2') {
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Sauerstoff-Zelle gezüchtet. Crew-Stressaufbau um 50% gesenkt.");
            const el = document.getElementById('svg-o2');
            if (el) el.style.display = 'block';
        } else if (type === 'synapses') {
            STATE.maxMentalEnergy = 150;
            STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 50);
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Mentale Feldstärke erhöht. Max Feldstärke nun 150 & 2x Regeneration.");
            const el1 = document.getElementById('svg-synapses-1');
            const el2 = document.getElementById('svg-synapses-2');
            if (el1) el1.style.display = 'block';
            if (el2) el2.style.display = 'block';
        } else if (type === 'translator') {
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Dschinn-Übersetzungsknoten verankert. Funkverkehr übersetzt!");
            addLogEntry("CREW", "Dschinn-Agent: '...Konnektivität hergestellt. Übersetze menschlichen Datenstrom...'");
            const el = document.getElementById('svg-translator');
            if (el) el.style.display = 'block';

            // Decrypt initial crew log
            const initLog = document.getElementById('init-crew-log');
            if (initLog) {
                initLog.innerText = '[CREW] Capt. Miller: "Was zum... das ist kein Asteroid, das Ding lebt! Bekommen wir hier überhaupt Luft?!"';
            }
        }

        updateMutationUI();
    }
}

function updateMutationUI() {
    const subtitle = document.querySelector('.panel-subtitle');
    if (subtitle) {
        subtitle.innerHTML = `Evolution & Mutationen (<span class="cost-val bio">${STATE.bioRes}</span> B | <span class="cost-val silicon">${STATE.siliconRes}</span> S)`;
    }

    Object.keys(STATE.mutations).forEach(type => {
        const mut = STATE.mutations[type];
        const btn = document.querySelector(`.mut-btn[data-mutation="${type}"]`);
        if (!btn) return;

        if (mut.purchased) {
            btn.disabled = true;
            btn.className = "mut-btn purchased";
            btn.innerText = "Aktiv";
        } else {
            const canBuy = STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost;
            btn.disabled = !canBuy;
            if (canBuy) {
                btn.className = "mut-btn active-buy";
            } else {
                btn.className = "mut-btn";
            }
        }
    });
}

function toggleMusic() {
    const musicBtn = document.getElementById('music-toggle-btn');
    if (!musicPlaying) {
        bgMusic.play()
            .then(() => {
                musicPlaying = true;
                if (musicBtn) {
                    musicBtn.classList.add('playing');
                    musicBtn.innerText = "🔊 Musik: An (Star Control 2)";
                }
                addLogEntry("SYSTEM", "Hintergrundmusik aktiviert: Star Control 2 Space Theme.");
            })
            .catch(err => {
                console.log("Audio play blocked by browser. Click page to start.", err);
            });
    } else {
        bgMusic.pause();
        musicPlaying = false;
        if (musicBtn) {
            musicBtn.classList.remove('playing');
            musicBtn.innerText = "🔇 Musik: Aus";
        }
        addLogEntry("SYSTEM", "Hintergrundmusik pausiert.");
    }
}

function toggleTelepathy() {
    if (STATE.mentalEnergy <= 5 && !STATE.telepathyActive) {
        addLogEntry("SYSTEM", "Warnung: Zu wenig mentale Energie für telepathische Illusionen!");
        return;
    }

    STATE.telepathyActive = !STATE.telepathyActive;

    // Visual toggle
    const btn = document.getElementById('telepathy-toggle-btn');
    const overlay = document.getElementById('telepathic-overlay');

    if (STATE.telepathyActive) {
        if (btn) btn.classList.add('active');
        if (btn) btn.querySelector('.btn-text').innerText = "Illusion Deaktivieren";
        if (overlay) overlay.className = "active";
        addLogEntry("TELEPATHY", "Telepathische Überstrahlung initiiert. Crew-Stress nimmt ab. Mentale Feldstärke sinkt...");

        // Update cabin graphic
        document.getElementById('schematic-cabin').setAttribute('stroke', '#a855f7');
        document.getElementById('schematic-status').innerText = "Geist beruhigt";
        document.getElementById('schematic-status').setAttribute('fill', '#c084fc');
    } else {
        if (btn) btn.classList.remove('active');
        if (btn) btn.querySelector('.btn-text').innerText = "Telepathische Illusion aktivieren";
        if (overlay) overlay.className = "inactive";
        addLogEntry("TELEPATHY", "Telepathischer Kontakt abgebrochen. Crew registriert biologische Umgebung!");

        // Update cabin graphic
        document.getElementById('schematic-cabin').setAttribute('stroke', '#38bdf8');
        document.getElementById('schematic-status').innerText = "Druck stabil";
        document.getElementById('schematic-status').setAttribute('fill', '#38bdf8');
    }
}

// --- LOGGING ---
function addLogEntry(type, text) {
    const logBox = document.getElementById('log-box');
    if (!logBox) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type.toLowerCase()}`;

    const prefix = `[${type.toUpperCase()}]`;
    entry.innerText = `${prefix} ${text}`;

    logBox.appendChild(entry);

    // Auto-scroll
    logBox.scrollTop = logBox.scrollHeight;

    // Keep only last 15 logs
    while (logBox.children.length > 15) {
        logBox.removeChild(logBox.firstChild);
    }
}

// --- PHYSICS & LOGIC TICK ---

function updatePhysics(dt) {
    // A. Update planet orbits (Keplerian dynamics)
    activePlanets.forEach(p => {
        p.angle += dt * p.speed;
        const px = p.distance * Math.cos(p.angle);
        const pz = p.distance * Math.sin(p.angle);

        p.mesh.position.set(px, 0, pz);
        p.source.position.set(px, 0, pz);
        if (p.ringMesh) {
            p.ringMesh.position.set(px, 0, pz);
        }
    });

    // B. Calculate closest planet distance & update Scanner UI
    let minDist = Infinity;
    let closestPlanet = null;
    activePlanets.forEach(p => {
        const dx = STATE.playerPosition.x - p.mesh.position.x;
        const dz = STATE.playerPosition.z - p.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) {
            minDist = dist;
            closestPlanet = p;
        }
    });

    STATE.nearestPlanet = closestPlanet;
    updateScannerUI(closestPlanet, minDist);

    // C. Process active scan progress
    if (STATE.scanningPlanet) {
        const sdx = STATE.playerPosition.x - STATE.scanningPlanet.mesh.position.x;
        const sdz = STATE.playerPosition.z - STATE.scanningPlanet.mesh.position.z;
        const sdist = Math.sqrt(sdx * sdx + sdz * sdz);

        if (sdist > 20) {
            // Cancel scan (signal lost)
            stopScanSound();
            if (scanVisualMesh) {
                scene.remove(scanVisualMesh);
                scanVisualMesh = null;
            }
            addLogEntry("SYSTEM", `Scan abgebrochen: Signalverlust. Abstand zu ${STATE.scanningPlanet.name} überschritt Sicherheitsradius.`);
            STATE.scanningPlanet = null;
            STATE.scanProgress = 0;
            const progContainer = document.getElementById('scan-progress-container');
            if (progContainer) progContainer.style.display = 'none';
        } else {
            // Advance scan progress
            STATE.scanProgress += (dt / 3.0) * 100; // 3 seconds scan

            // Pulse the holographic scan mesh
            if (scanVisualMesh) {
                scanVisualMesh.position.copy(STATE.scanningPlanet.mesh.position);
                scanVisualMesh.rotation.y += dt * 1.6;
                scanVisualMesh.rotation.x += dt * 0.8;
                const pulse = 1.0 + Math.sin(Date.now() * 0.016) * 0.1;
                scanVisualMesh.scale.set(pulse, pulse, pulse);
            }

            // Modulate sweep sound pitch
            if (scanOsc && audioCtx) {
                scanOsc.frequency.setValueAtTime(220 + (STATE.scanProgress / 100) * 660, audioCtx.currentTime);
            }

            const progBar = document.getElementById('scan-progress-bar');
            const progTxt = document.getElementById('scan-progress-text');
            if (progBar) progBar.style.width = `${Math.min(100, STATE.scanProgress)}%`;
            if (progTxt) progTxt.innerText = `${Math.round(Math.min(100, STATE.scanProgress))}%`;

            if (STATE.scanProgress >= 100) {
                // Complete scan!
                STATE.scanningPlanet.scanned = true;
                STATE.scannedPlanets[STATE.scanningPlanet.name] = true;

                stopScanSound();
                if (scanVisualMesh) {
                    scene.remove(scanVisualMesh);
                    scanVisualMesh = null;
                }

                addLogEntry("SYSTEM", `Scan von ${STATE.scanningPlanet.name} erfolgreich abgeschlossen. Daten entschlüsselt.`);

                // Show results in UI
                const placeholder = document.getElementById('scan-placeholder-box');
                const results = document.getElementById('scan-results-box');
                if (placeholder) placeholder.style.display = 'none';
                if (results) {
                    results.style.display = 'flex';
                    document.getElementById('scan-planet-title').innerText = STATE.scanningPlanet.name;
                    document.getElementById('scan-planet-type').innerText = STATE.scanningPlanet.type;
                    document.getElementById('scan-planet-temp').innerText = STATE.scanningPlanet.attributes.temp;
                    document.getElementById('scan-planet-bio').innerText = STATE.scanningPlanet.attributes.bio;
                    document.getElementById('scan-planet-atmos').innerText = STATE.scanningPlanet.attributes.atmos;
                    document.getElementById('scan-planet-resources').innerText = STATE.scanningPlanet.attributes.res;
                }

                // Triggert story progress chatlog occasionally!
                if (Math.random() > 0.3) {
                    addLogEntry("CREW", encryptCrewMessage("Dr. Song", `Unsere Sensorfrequenzen wurden überlagert... Da misst jemand die Kruste von ${STATE.scanningPlanet.name}! Ist das eine tektonische Sonde?!`));
                }

                STATE.scanningPlanet = null;
                STATE.scanProgress = 0;
                const progContainer = document.getElementById('scan-progress-container');
                if (progContainer) progContainer.style.display = 'none';
            }
        }
    }

    STATE.playerAcceleration.set(0, 0, 0);

    // 1. Apply Player Thrusters (WASD / Arrows)
    let isMoving = false;
    let inputDir = new THREE.Vector3(0, 0, 0);

    if (STATE.keys.w) { inputDir.z = -1; isMoving = true; }
    if (STATE.keys.s) { inputDir.z = 1; isMoving = true; }
    if (STATE.keys.a) { inputDir.x = -1; isMoving = true; }
    if (STATE.keys.d) { inputDir.x = 1; isMoving = true; }

    if (isMoving && STATE.bioEnergy > 0) {
        inputDir.normalize();
        STATE.playerAcceleration.addScaledVector(inputDir, STATE.thrustStrength);

        // Expend bio-energy when using thrust (balanced: mid-point 1.2 * dt)
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 1.2 * dt);

        // Rotate ship group towards movement direction smoothly
        const targetAngle = Math.atan2(inputDir.x, inputDir.z);
        STATE.playerGroup.rotation.y = THREE.MathUtils.lerp(STATE.playerGroup.rotation.y, targetAngle, 0.1);

        // Emit particles or stretch mesh slightly when accelerating
        playerMesh.scale.x = 1.7; // Elongate a bit

        STATE.currentDrag = STATE.drag; // Coasting drag

        // Play thruster sound
        setThrusterSound(true);
    } else {
        playerMesh.scale.x = THREE.MathUtils.lerp(playerMesh.scale.x, 1.5, 0.1);

        STATE.currentDrag = STATE.brakeDrag; // Retro-dampening active

        // Stop thruster sound
        setThrusterSound(false);
    }

    // 2. Apply Gravitation from planets & asteroids (N-Körper-Physik)
    let closestSource = null;
    let minSourceDist = Infinity;

    STATE.gravitySources.forEach((source) => {
        if (source.isAbsorbed) return;

        const direction = new THREE.Vector3().subVectors(source.position, STATE.playerPosition);
        const distance = direction.length();

        // Check if inside gravity range
        if (distance < source.gravityRange) {
            // Keep track of the closest one for logs/visual connections
            if (distance < minSourceDist) {
                minSourceDist = distance;
                closestSource = source;
            }

            // Normal gravity formula (simplified F = G * m1 * m2 / r^2)
            // Clamp distance to avoid division by zero and extreme force when overlapping
            const clampedDist = Math.max(distance, source.radius * 1.2);
            const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);

            direction.normalize();
            STATE.playerAcceleration.addScaledVector(direction, forceStrength);
        }
    });

    // Log feedback for gravitational attraction
    if (closestSource && minSourceDist < closestSource.gravityRange * 0.7) {
        if (Math.random() < 0.005) { // Occasional log entry to not flood it
            addLogEntry("SYSTEM", `Erfasse Orbit-Attraktion von Himmelskörper: ${closestSource.name}.`);
        }
    }

    // 3. Integrate Equations of Motion (Standard Euler with exponential decay)
    STATE.playerVelocity.addScaledVector(STATE.playerAcceleration, dt);
    STATE.playerVelocity.multiplyScalar(Math.exp(-STATE.currentDrag * dt)); // Stable frame-rate independent drag
    STATE.playerPosition.addScaledVector(STATE.playerVelocity, dt);

    // Apply limits to boundary just in case
    const maxBound = 180;
    if (STATE.playerPosition.x > maxBound) { STATE.playerPosition.x = -maxBound; }
    if (STATE.playerPosition.x < -maxBound) { STATE.playerPosition.x = maxBound; }
    if (STATE.playerPosition.z > maxBound) { STATE.playerPosition.z = -maxBound; }
    if (STATE.playerPosition.z < -maxBound) { STATE.playerPosition.z = maxBound; }

    // Sync mesh position
    STATE.playerGroup.position.copy(STATE.playerPosition);

    // Camera follows player smoothly
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, STATE.playerPosition.x, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, STATE.playerPosition.z, 0.05);
    camera.position.y = 80; // Keep camera height fixed
}

function updateCollisions(dt) {
    if (STATE.collisionCooldown > 0) {
        STATE.collisionCooldown = Math.max(0, STATE.collisionCooldown - dt);
    }

    STATE.gravitySources.forEach((source) => {
        if (source.isAbsorbed) return;

        const distance = STATE.playerPosition.distanceTo(source.position);
        const colDistance = source.radius + 1.8; // Player radius is roughly 1.8

        if (distance < colDistance) {
            if (source.type === 'asteroid' && source.isResource) {
                // ABSORPTION PROCESS
                source.isAbsorbed = true;

                // Trigger visual scale-down inside the rendering loop by keeping track of the mesh
                // For now, let's shrink the mesh immediately
                gsapShrink(source.mesh);

                // Resource gains (balanced: increased yields + resources)
                if (source.resourceType === 'bio') {
                    STATE.health = Math.min(STATE.maxHealth, STATE.health + 30);
                    STATE.bioRes += 25;
                    addLogEntry("SYSTEM", `Organischer Asteroid absorbiert. +25 Bio-Biomasse gewonnen. Zellkern repariert (+30 Kernintegrität).`);
                    if (Math.random() > 0.5) {
                        addLogEntry("CREW", encryptCrewMessage("Dr. Song", "Die Biomasse verschlingt den Stein... Meine Messgeräte flippen aus!"));
                    }
                    playBioCollectSound(); // Squishy sound effect
                } else {
                    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 50);
                    STATE.siliconRes += 25;
                    addLogEntry("SYSTEM", `Silizium-Komet absorbiert. +25 Silizium-Energie gewonnen. Bio-Energie aufgeladen (+50% Energie).`);
                    if (Math.random() > 0.5) {
                        addLogEntry("CREW", encryptCrewMessage("Ing. Petrov", "Wir haben gerade Tonnen an Rohstoffen verschluckt. Wo fließt das alles hin?!"));
                    }
                    playSiliconCollectSound(); // Crystalline chime sound effect
                }
                updateMutationUI();
                respawnAsteroid(source); // Trigger asteroid respawn!
            } else if (source.type === 'planet') {
                // Bounce direction (away from planet center)
                const bounceDir = new THREE.Vector3().subVectors(STATE.playerPosition, source.position).normalize();

                // 1. Force position correction: snap to surface immediately to prevent glitching inside
                STATE.playerPosition.copy(source.position).addScaledVector(bounceDir, colDistance + 0.15);
                STATE.playerGroup.position.copy(STATE.playerPosition);

                // 2. Reflect velocity
                const dot = STATE.playerVelocity.dot(bounceDir);
                if (dot < 0) {
                    STATE.playerVelocity.reflect(bounceDir).multiplyScalar(0.4); // 40% rebound velocity
                }

                // 3. Trigger damage and logs only on cooldown
                if (STATE.collisionCooldown === 0) {
                    STATE.collisionCooldown = 1.0; // 1 second damage cooldown

                    // Hull damage (Chitin armor reduces damage by 50%)
                    const damage = STATE.mutations.armor.purchased ? 10 : 20;
                    STATE.health = Math.max(0, STATE.health - damage);

                    playCrashSound(); // Heavy crash sound effect

                    // Skyrocket crew stress (balanced: mid-point 15)
                    STATE.crew.forEach(c => c.stress = Math.min(100, c.stress + 15));

                    if (STATE.mutations.armor.purchased) {
                        addLogEntry("SYSTEM", `Kollision mit ${source.name}! Chitin-Panzerung dämpft Aufprall.`);
                    } else {
                        addLogEntry("SYSTEM", `WARNUNG: Harte Kollision mit ${source.name}!`);
                    }
                    addLogEntry("CREW", encryptCrewMessage("Capt. Miller", "Wir stürzen ab! Das ganze verdammte Schiff bebt!"));
                }
            }
        }
    });
}

function gsapShrink(mesh) {
    // Simple procedural shrink animation over 15 frames
    let scale = 1.0;
    function shrinkStep() {
        if (scale > 0.05) {
            scale -= 0.08;
            mesh.scale.set(scale, scale, scale);
            requestAnimationFrame(shrinkStep);
        } else {
            scene.remove(mesh);
        }
    }
    shrinkStep();
}

function respawnAsteroid(sourceObj) {
    // Respawn after 4 seconds at a new position
    setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 65;

        // Dynamically anchor to existing gravity centers in system (suns or planets)
        const centers = STATE.gravitySources.filter(s => s.type === 'planet' || s.type === 'star');
        const anchor = (centers.length > 0) ? centers[Math.floor(Math.random() * centers.length)].position : { x: 0, z: 0 };
        const x = anchor.x + Math.cos(angle) * dist;
        const z = anchor.z + Math.sin(angle) * dist;

        sourceObj.position.set(x, 0, z);
        sourceObj.isAbsorbed = false;

        // Recreate the irregular geometry
        const size = 1.5 + Math.random() * 2;
        const geo = new THREE.DodecahedronGeometry(size, 1);
        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
            const vx = posAttr.getX(j);
            const vy = posAttr.getY(j);
            const vz = posAttr.getZ(j);
            const scale = 1 + (Math.random() - 0.5) * 0.3;
            posAttr.setXYZ(j, vx * scale, vy * scale, vz * scale);
        }
        geo.computeVertexNormals();

        const isOrganic = Math.random() > 0.4;
        const color = isOrganic ? 0x00ff88 : 0x06b6d4;

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.8,
            emissive: isOrganic ? 0x003311 : 0x002233
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0, z);
        mesh.scale.set(0, 0, 0); // start small
        scene.add(mesh);

        // Grow scale animation
        let currentScale = 0;
        function growStep() {
            if (currentScale < 1.0) {
                currentScale += 0.05;
                mesh.scale.set(currentScale, currentScale, currentScale);
                requestAnimationFrame(growStep);
            }
        }
        growStep();

        // Update references
        sourceObj.mesh = mesh;
        sourceObj.radius = size;
        sourceObj.name = isOrganic ? "Organische Biosphäre" : "Silizium-Komet";
        sourceObj.resourceType = isOrganic ? 'bio' : 'energy';
        sourceObj.mass = size * 4;
        sourceObj.gravityRange = size * 3;

        // Move the visual gravity ring as well!
        if (sourceObj.ringMesh) {
            sourceObj.ringMesh.position.set(x, 0, z);
            // Update gravity ring size and color
            sourceObj.ringMesh.scale.set(sourceObj.gravityRange / (size * 3), 1, sourceObj.gravityRange / (size * 3));
            sourceObj.ringMesh.material.color.setHex(color);
        }

        addLogEntry("SYSTEM", `Kosmisches Phänomen erfasst: Neuer Himmelskörper ${sourceObj.name} kondensiert.`);
    }, 4000);
}

function updateCrewSimulation(dt) {
    // 1. Stress rates calculations
    let totalStress = 0;

    // General modifiers (balanced: mid-point)
    let speed = STATE.playerVelocity.length();
    let speedStressModifier = speed > 10.0 ? 0.8 : 0;
    let criticalEnergyModifier = STATE.bioEnergy < 25 ? 1.2 : 0;

    STATE.crew.forEach((c) => {
        if (STATE.telepathyActive && STATE.mentalEnergy > 0) {
            // Telepathy decreases stress
            c.stress = Math.max(0, c.stress - 6.0 * dt);
            c.status = "Gasgelullt";
        } else {
            // Normal stress behavior (balanced: mid-point 0.7x factor)
            let growth = (c.baseStressRate + speedStressModifier + criticalEnergyModifier) * 0.7 * dt;
            if (STATE.mutations.o2.purchased) {
                growth *= 0.5; // O2 chamber halves stress buildup
            }
            c.stress = Math.min(100, c.stress + growth);

            if (c.stress > 70) {
                c.status = "Panik";
            } else {
                c.status = c.role === "Pilot" ? "Versucht zu steuern" : (c.role === "Biologin" ? "Nimmt Proben" : "Repariert Triebwerk");
            }
        }
        totalStress += c.stress;
    });

    const avgStress = totalStress / STATE.crew.length;

    // 2. Mental energy drain/regen
    if (STATE.telepathyActive) {
        // Balanced: telepathy drain speed mid-point 6
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 6 * dt);
        if (STATE.mentalEnergy === 0) {
            toggleTelepathy(); // Force deactivate
            addLogEntry("SYSTEM", "Mentale Reserven erschöpft! Telepathische Illusion bricht zusammen.");
            addLogEntry("CREW", encryptCrewMessage("Ing. Petrov", "Warte... die Wände haben gerade geatmet! Das ist kein Holz, das ist Fleisch!"));
        }
    } else {
        // Slow regeneration (balanced: synapses is 8 * dt, normal is 4 * dt)
        const regenSpeed = STATE.mutations.synapses.purchased ? 8 * dt : 4 * dt;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + regenSpeed);
    }

    // 3. Crew Sabotage at high stress
    STATE.crew.forEach((c) => {
        if (c.stress >= 95) {
            // Highly stressed crew damages the ship core out of desperation/sabotage!
            STATE.health = Math.max(0, STATE.health - 1.5 * dt);
            if (Math.random() < 0.003) {
                addLogEntry("CREW", encryptCrewMessage(c.name, "Ich muss dieses Ding aufschneiden! Wir müssen hier raus! (Zellkern erleidet Schaden)"));
            }
        }
    });

    // 4. Update UI Bars and Texts
    document.getElementById('core-health-bar').style.width = `${STATE.health}%`;
    document.getElementById('core-health-text').innerText = `${Math.round(STATE.health)}%`;

    // Danger color shift for core health
    if (STATE.health < 30) {
        document.getElementById('core-health-bar').className = "progress-bar health danger";
    } else {
        document.getElementById('core-health-bar').className = "progress-bar health";
    }

    document.getElementById('bio-energy-bar').style.width = `${STATE.bioEnergy}%`;
    document.getElementById('bio-energy-text').innerText = `${Math.round(STATE.bioEnergy)}%`;

    document.getElementById('telepathy-energy-bar').style.width = `${(STATE.mentalEnergy / STATE.maxMentalEnergy) * 100}%`;
    document.getElementById('telepathy-energy-text').innerText = `${Math.round(STATE.mentalEnergy)}/${STATE.maxMentalEnergy}`;

    // Update individual crew status in HTML
    STATE.crew.forEach((c, idx) => {
        const crewDiv = document.getElementById(`crew-${c.id}`);
        if (crewDiv) {
            // Status label
            const statusLabel = crewDiv.querySelector('.crew-status');
            statusLabel.innerText = c.status;
            statusLabel.className = 'crew-status';
            if (c.status === 'Panik') {
                statusLabel.classList.add('action-panic');
            } else if (c.status === 'Gasgelullt') {
                statusLabel.classList.add('action-calm');
            } else {
                statusLabel.classList.add('action-working');
            }

            // Stress Bar width & text
            const bar = crewDiv.querySelector('.stress-bar');
            bar.style.width = `${c.stress}%`;

            // Stress color depending on urgency
            if (c.stress > 70) {
                bar.style.backgroundColor = '#ef4444'; // Red
            } else if (c.stress > 40) {
                bar.style.backgroundColor = '#f59e0b'; // Amber
            } else {
                bar.style.backgroundColor = '#10b981'; // Green
            }

            crewDiv.querySelector('.stress-percentage').innerText = `${Math.round(c.stress)}%`;
        }
    });

    // Passive decay of bioEnergy over time (balanced: mid-point 0.18 * dt)
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 0.18 * dt);

    // Core damages if no energy left
    if (STATE.bioEnergy <= 0) {
        STATE.health = Math.max(0, STATE.health - 2 * dt);
        if (Math.random() < 0.005) {
            addLogEntry("SYSTEM", "Kritischer Nahrungsmangel. Organismus verhungert (-2 Kernintegrität).");
        }
    }
}

// --- RENDER & ANIMATION LOOP ---

let lastTime = 0;

function animate(time) {
    if (time === undefined) {
        requestAnimationFrame(animate);
        return;
    }
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.1); // Clamp dt to prevent massive jumps
    lastTime = time;

    // Slowly rotate background starfield (keeps running behind menu)
    if (starfield) {
        starfield.rotation.y += dt * 0.005;
    }

    // Render frame (keeps running behind menu)
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    // Draw 2D Navigation Minimap
    drawMinimap();

    if (!STATE.gameStarted) {
        requestAnimationFrame(animate);
        return;
    }

    // Story Progression Tick
    playTime += dt;
    if (storyIndex < STORY_LOGS.length && playTime >= STORY_LOGS[storyIndex].time) {
        const logObj = STORY_LOGS[storyIndex];
        storyIndex++;
        addLogEntry("CREW", encryptCrewMessage(logObj.sender, logObj.text));
    }

    // Update Trajectory Line
    updateTrajectory();

    // 1. Physics & Simulation updates
    updatePhysics(dt);
    updateCollisions(dt);
    updateCrewSimulation(dt);

    // 2. Visual Polish & Animations
    // Pulsate the glowing shell of player
    if (playerGlowMesh) {
        const pulse = 1.0 + Math.sin(time * 0.005) * 0.12;
        playerGlowMesh.scale.set(pulse * 1.6, pulse * 0.9, pulse * 0.9);

        // Color shift: Purple when telepathy active, green when normal, red when dying
        if (STATE.health < 30) {
            playerGlowMesh.material.color.setHex(0xf43f5e); // Red
        } else if (STATE.telepathyActive) {
            playerGlowMesh.material.color.setHex(0xa855f7); // Purple
        } else {
            playerGlowMesh.material.color.setHex(0x00ff88); // Green glow
        }
    }

    // Swaying bio-tentacles
    tentacles.forEach((t) => {
        t.phase += dt * (5 + STATE.playerVelocity.length() * 15);
        let currentParentRotation = 0;

        t.segments.forEach((seg, idx) => {
            // Progressive sway effect along the joint chain
            const sway = Math.sin(t.phase + idx * 0.6) * 0.15;
            seg.rotation.z = sway;
        });
    });

    // Rotate planets slightly
    STATE.gravitySources.forEach((source) => {
        if (source.type === 'planet') {
            source.mesh.rotation.y += dt * 0.05;
        } else if (source.type === 'asteroid' && !source.isAbsorbed) {
            source.mesh.rotation.x += dt * 0.1;
            source.mesh.rotation.y += dt * 0.08;
        }
    });

    // Pulse gravity indicators opacity
    gravityCircles.forEach((circle, idx) => {
        const osc = Math.sin(time * 0.002 * circle.pulseSpeed) * 0.03;
        circle.mesh.material.opacity = circle.baseOpacity + osc;
    });

    requestAnimationFrame(animate);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function initTrajectory() {
    const count = 100;
    const trajGeo = new THREE.BufferGeometry();
    const trajPos = new Float32Array(count * 3);
    const trajColors = new Float32Array(count * 3);

    const baseColor = new THREE.Color(0x38bdf8);
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const c = baseColor.clone().multiplyScalar(1 - t * 0.95);
        trajColors[i * 3] = c.r;
        trajColors[i * 3 + 1] = c.g;
        trajColors[i * 3 + 2] = c.b;
    }

    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPos, 3));
    trajGeo.setAttribute('color', new THREE.BufferAttribute(trajColors, 3));

    const trajMat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    trajectoryPoints = new THREE.Points(trajGeo, trajMat);
    scene.add(trajectoryPoints);
}

function updateTrajectory() {
    if (!trajectoryPoints || !STATE.playerGroup) return;

    const count = 100;
    const posAttr = trajectoryPoints.geometry.attributes.position;
    const colorAttr = trajectoryPoints.geometry.attributes.color;
    const positions = posAttr.array;
    const colors = colorAttr.array;

    // Copy current state
    const predPos = STATE.playerPosition.clone();
    const predVel = STATE.playerVelocity.clone();
    const predAcc = new THREE.Vector3(0, 0, 0);

    // Check input acceleration
    let isMoving = false;
    const inputDir = new THREE.Vector3(0, 0, 0);
    if (STATE.keys.w) { inputDir.z = -1; isMoving = true; }
    if (STATE.keys.s) { inputDir.z = 1; isMoving = true; }
    if (STATE.keys.a) { inputDir.x = -1; isMoving = true; }
    if (STATE.keys.d) { inputDir.x = 1; isMoving = true; }

    let thrustAcc = new THREE.Vector3(0, 0, 0);
    if (isMoving && STATE.bioEnergy > 0) {
        inputDir.normalize();
        thrustAcc.addScaledVector(inputDir, STATE.thrustStrength);
    }

    // Base color based on state (purple if telepathy active, cyan if normal)
    const baseColor = STATE.telepathyActive ? new THREE.Color(0xa855f7) : new THREE.Color(0x38bdf8);

    const stepDt = 0.04; // 40ms simulation steps

    for (let i = 0; i < count; i++) {
        predAcc.copy(thrustAcc);

        // Apply gravity from all sources
        STATE.gravitySources.forEach((source) => {
            if (source.isAbsorbed) return;

            const direction = new THREE.Vector3().subVectors(source.position, predPos);
            const distance = direction.length();

            if (distance < source.gravityRange) {
                const clampedDist = Math.max(distance, source.radius * 1.1);
                const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);
                direction.normalize();
                predAcc.addScaledVector(direction, forceStrength);
            }
        });

        // Integrate equations of motion
        predVel.addScaledVector(predAcc, stepDt);
        predVel.multiplyScalar(Math.exp(-STATE.currentDrag * stepDt));
        predPos.addScaledVector(predVel, stepDt);

        // Store point
        positions[i * 3] = predPos.x;
        positions[i * 3 + 1] = 0; // keep it flat on y = 0
        positions[i * 3 + 2] = predPos.z;

        // Fade colors
        const t = i / count;
        const c = baseColor.clone().multiplyScalar(1 - t * 0.95);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
}

// --- PROCEDURAL AUDIO EFFECTS (WEB AUDIO API) ---
let audioCtx = null;
let thrusterSound = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function initThrusterSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 65; // low rumble

    osc2.type = 'triangle';
    osc2.frequency.value = 45;

    // Modulate frequency slightly for engine rumble character
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 8; // 8Hz modulation
    lfoGain.gain.value = 10;

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    filter.type = 'lowpass';
    filter.frequency.value = 110;

    gainNode.gain.value = 0; // start silent

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    lfo.start();

    thrusterSound = {
        gainNode: gainNode,
        osc1: osc1,
        osc2: osc2,
        lfo: lfo,
        active: false
    };
}

function setThrusterSound(isPlaying) {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!thrusterSound) {
        initThrusterSound();
    }

    if (thrusterSound) {
        const targetVol = isPlaying ? 0.22 : 0;
        thrusterSound.gainNode.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.08);
        thrusterSound.active = isPlaying;
    }
}

function playBioCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.3);

    filter.type = 'lowpass';
    filter.Q.value = 8; // high resonance for squishy bubble sound
    filter.frequency.setValueAtTime(180, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
}

function playSiliconCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;

    // Play a beautiful dual-tone chime arpeggio
    const playTone = (freq, delay, duration) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + delay);

        gainNode.gain.setValueAtTime(0, time + delay);
        gainNode.gain.linearRampToValueAtTime(0.15, time + delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + delay + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time + delay);
        osc.stop(time + delay + duration);
    };

    playTone(660, 0, 0.25);
    playTone(990, 0.07, 0.3);
}

function playCrashSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.5);

    // Generate noise buffer on the fly for crash texture
    const bufferSize = ctx.sampleRate * 0.4; // 0.4 seconds
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

async function checkUniverseData() {
    try {
        const res = await fetch('universe_data.json');
        if (res.ok) {
            const data = await res.json();
            STATE.universe = data;

            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerText = "Organismus erwachen lassen";
            }
            const status = document.getElementById('generation-status');
            if (status) {
                status.innerText = "Galaxie geladen (100 Sternensysteme)";
                status.style.color = "#10b981";
            }
        }
    } catch (e) {
        console.log("Najmafar: No universe data loaded yet. Generation required.");
    }
}

function clearActiveSystem() {
    STATE.gravitySources.forEach(source => {
        if (source.mesh) scene.remove(source.mesh);
        if (source.light) scene.remove(source.light);
        if (source.diskMesh) scene.remove(source.diskMesh);
    });

    gravityCircles.forEach(circle => {
        if (circle.mesh) scene.remove(circle.mesh);
    });

    // Clear scan visuals if active during warp
    stopScanSound();
    if (scanVisualMesh) {
        scene.remove(scanVisualMesh);
        scanVisualMesh = null;
    }
    STATE.scanningPlanet = null;
    STATE.scanProgress = 0;
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    STATE.gravitySources = [];
    STATE.asteroids = [];
    gravityCircles = [];
    activePlanets = [];
}

// --- MINIMAP RADAR DRAW LOGIC ---
function drawMinimap() {
    if (!minimapCanvas || !minimapCtx || !STATE.gameStarted) return;

    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2 - 4; // safety margin

    // 1. Clear background
    minimapCtx.fillStyle = "rgba(10, 15, 30, 0.4)";
    minimapCtx.clearRect(0, 0, width, height);

    // 2. Draw circular grid rings
    minimapCtx.strokeStyle = "rgba(6, 182, 212, 0.15)";
    minimapCtx.lineWidth = 1;

    // Ring 1 (Inner)
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Ring 2 (Middle)
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Ring 3 (Outer border)
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Horizontal & Vertical Crosshairs
    minimapCtx.strokeStyle = "rgba(6, 182, 212, 0.08)";
    minimapCtx.beginPath();
    minimapCtx.moveTo(cx - radius, cy);
    minimapCtx.lineTo(cx + radius, cy);
    minimapCtx.moveTo(cx, cy - radius);
    minimapCtx.lineTo(cx, cy + radius);
    minimapCtx.stroke();

    // World space range mapping (edge of radar is 180 units)
    const range = 180;

    // 3. Draw Central Star (0, 0 in world coordinates)
    const sdx = 0 - STATE.playerPosition.x;
    const sdz = 0 - STATE.playerPosition.z;
    const sdist = Math.sqrt(sdx * sdx + sdz * sdz);

    if (sdist < range) {
        const scx = cx + (sdx / range) * radius;
        const scy = cy + (sdz / range) * radius;
        const starPulse = 6 + Math.sin(Date.now() * 0.008) * 1.5;

        let starColor = "#f59e0b"; // Yellow default
        if (STATE.universe && STATE.universe[STATE.currentSystemId]) {
            const sys = STATE.universe[STATE.currentSystemId];
            if (sys.star && sys.star.color) {
                starColor = sys.star.color.replace("0x", "#");
            }
        }

        minimapCtx.fillStyle = starColor;
        minimapCtx.beginPath();
        minimapCtx.arc(scx, scy, starPulse, 0, Math.PI * 2);
        minimapCtx.fill();

        minimapCtx.strokeStyle = starColor + "28";
        minimapCtx.beginPath();
        minimapCtx.arc(scx, scy, starPulse * 1.5, 0, Math.PI * 2);
        minimapCtx.stroke();
    }

    // 4. Draw Planets
    activePlanets.forEach(p => {
        const pdx = p.mesh.position.x - STATE.playerPosition.x;
        const pdz = p.mesh.position.z - STATE.playerPosition.z;
        const pdist = Math.sqrt(pdx * pdx + pdz * pdz);

        if (pdist < range) {
            const pcx = cx + (pdx / range) * radius;
            const pcy = cy + (pdz / range) * radius;
            const pColorStr = p.color.replace("0x", "#");

            minimapCtx.fillStyle = pColorStr;
            minimapCtx.beginPath();
            minimapCtx.arc(pcx, pcy, 4.5, 0, Math.PI * 2);
            minimapCtx.fill();

            // Draw scanned indicator halo
            if (p.scanned || STATE.scannedPlanets[p.name]) {
                minimapCtx.strokeStyle = "rgba(0, 255, 136, 0.4)";
                minimapCtx.lineWidth = 1;
                minimapCtx.beginPath();
                minimapCtx.arc(pcx, pcy, 8, 0, Math.PI * 2);
                minimapCtx.stroke();
            }
        }
    });

    // 5. Draw Asteroids (Active resources)
    STATE.asteroids.forEach(ast => {
        if (ast.harvested) return;

        const adx = ast.mesh.position.x - STATE.playerPosition.x;
        const adz = ast.mesh.position.z - STATE.playerPosition.z;
        const adist = Math.sqrt(adx * adx + adz * adz);

        if (adist < range) {
            const acx = cx + (adx / range) * radius;
            const acy = cy + (adz / range) * radius;

            minimapCtx.fillStyle = ast.type === 'bio' ? "rgba(0, 255, 136, 0.7)" : "rgba(56, 189, 248, 0.7)";
            minimapCtx.beginPath();
            minimapCtx.arc(acx, acy, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });

    // 6. Draw Player (Centered direction vector)
    minimapCtx.save();
    minimapCtx.translate(cx, cy);

    let rotation = 0;
    if (STATE.playerGroup) {
        rotation = -STATE.playerGroup.rotation.y;
    }
    minimapCtx.rotate(rotation);

    // Green arrow triangle
    minimapCtx.fillStyle = "#00ff88";
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -6);
    minimapCtx.lineTo(-4, 5);
    minimapCtx.lineTo(4, 5);
    minimapCtx.closePath();
    minimapCtx.fill();

    minimapCtx.strokeStyle = "rgba(0, 255, 136, 0.25)";
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.arc(0, 0, 9 + Math.sin(Date.now() * 0.01) * 1.5, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.restore();
}

// --- SCANNING SYSTEM HELPERS ---
function generatePlanetAttributes(p) {
    const hash = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    let atmos, temp, bio, res;
    if (p.type === 'Habitable') {
        atmos = hash % 2 === 0 ? "Stickstoff & Sauerstoff (Klasse M)" : "Dichte Aerosole & Wasserdampf";
        temp = (15 + (hash % 15)) + "°C";
        bio = hash % 3 === 0 ? "Biolumineszierende Flora" : (hash % 3 === 1 ? "Mikrobielle Kolonien" : "Komplexes Ökosystem");
        res = "Reich an Biomasse, Kohlenstoff & O2";
    } else if (p.type === 'Gas Giant') {
        atmos = hash % 2 === 0 ? "Flüssiges Helium & Wasserstoff" : "Superdichtes Ammoniak & Methan";
        temp = (-120 - (hash % 60)) + "°C";
        bio = hash % 5 === 0 ? "Schwebende Plankton-Analoge" : "Keine Signaturen erfasst";
        res = "Extrem hoher Druck, Deuterium-Vorkommen";
    } else { // Rocky
        atmos = hash % 3 === 0 ? "Dünnes CO2-Vakuum" : (hash % 3 === 1 ? "Schwefeldioxid & Argon" : "Keine Atmosphäre (Vakuum)");
        temp = (hash % 2 === 0 ? "+" : "-") + (hash % 250) + "°C";
        bio = hash % 8 === 0 ? "Extremophile Flechten" : "Steril";
        res = "Reich an Silizium-Kristallen, Eisen & Schwermetallen";
    }

    return { atmos, temp, bio, res };
}

function updateScannerUI(closest, dist) {
    const nameSpan = document.getElementById('nearest-planet-name');
    const distSpan = document.getElementById('nearest-planet-distance');
    const scanBtn = document.getElementById('start-scan-btn');
    const placeholder = document.getElementById('scan-placeholder-box');
    const results = document.getElementById('scan-results-box');

    if (!closest) {
        if (nameSpan) nameSpan.innerText = "Keiner";
        if (distSpan) distSpan.innerText = "-";
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerText = "Scan initiieren [F]";
        }
        if (placeholder && !STATE.scanningPlanet) placeholder.style.display = 'block';
        if (results && !STATE.scanningPlanet) results.style.display = 'none';
        return;
    }

    if (nameSpan) nameSpan.innerText = closest.name;
    if (distSpan) distSpan.innerText = dist.toFixed(1);

    if (dist < 20) {
        if (STATE.scanningPlanet) {
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerText = "Scanne...";
            }
        } else if (closest.scanned || STATE.scannedPlanets[closest.name]) {
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerText = "Bereits gescannt";
            }
            if (placeholder) placeholder.style.display = 'none';
            if (results) {
                results.style.display = 'flex';
                document.getElementById('scan-planet-title').innerText = closest.name;
                document.getElementById('scan-planet-type').innerText = closest.type;
                document.getElementById('scan-planet-temp').innerText = closest.attributes.temp;
                document.getElementById('scan-planet-bio').innerText = closest.attributes.bio;
                document.getElementById('scan-planet-atmos').innerText = closest.attributes.atmos;
                document.getElementById('scan-planet-resources').innerText = closest.attributes.res;
            }
        } else {
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerText = "Scan initiieren [F]";
            }
            if (placeholder) placeholder.style.display = 'block';
            if (results) results.style.display = 'none';
        }
    } else {
        if (STATE.scanningPlanet) {
            // we are scanning, don't change UI here (let the distance cancel trigger handle it)
        } else {
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerText = "Außer Reichweite";
            }
            if (placeholder) placeholder.style.display = 'block';
            if (results) results.style.display = 'none';
        }
    }
}

function triggerScanStart() {
    if (!STATE.gameStarted || STATE.scanningPlanet || !STATE.nearestPlanet) return;

    // Check range
    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    // Check if already scanned
    if (STATE.nearestPlanet.scanned || STATE.scannedPlanets[STATE.nearestPlanet.name]) return;

    // Start scan!
    STATE.scanningPlanet = STATE.nearestPlanet;
    STATE.scanProgress = 0;

    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    // Create scan visual holographic mesh
    const size = STATE.scanningPlanet.size;
    const scanVisualGeo = new THREE.SphereGeometry(size * 1.25, 24, 24);
    const scanVisualMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
    });
    scanVisualMesh = new THREE.Mesh(scanVisualGeo, scanVisualMat);
    scanVisualMesh.position.copy(STATE.scanningPlanet.mesh.position);
    scene.add(scanVisualMesh);

    startScanSound();

    addLogEntry("SYSTEM", `Oberflächen-Spektrometer gestartet. Halte Orbit um ${STATE.scanningPlanet.name}...`);
}

let scanOsc = null;
let scanGain = null;

function startScanSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    scanOsc = ctx.createOscillator();
    scanGain = ctx.createGain();

    scanOsc.type = 'sine';
    scanOsc.frequency.setValueAtTime(220, ctx.currentTime);

    scanGain.gain.setValueAtTime(0, ctx.currentTime);
    scanGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1); // fade in

    scanOsc.connect(scanGain);
    scanGain.connect(ctx.destination);
    scanOsc.start();
}

function stopScanSound() {
    if (scanOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (scanGain && time) {
            scanGain.gain.cancelScheduledValues(time);
            scanGain.gain.setValueAtTime(scanGain.gain.value, time);
            scanGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15); // fade out
            scanOsc.stop(time + 0.2);
        } else {
            scanOsc.stop();
        }
        scanOsc = null;
        scanGain = null;
    }
}

let mapOpen = false;
let selectedSystem = null;

function toggleGalaxyMap() {
    if (!STATE.gameStarted) return;

    const mapOverlay = document.getElementById('galaxy-map-overlay');
    if (!mapOverlay) return;

    mapOpen = !mapOpen;
    if (mapOpen) {
        mapOverlay.style.display = 'flex';
        renderGalaxyMap();
    } else {
        mapOverlay.style.display = 'none';
    }
}

function renderGalaxyMap() {
    const canvas = document.getElementById('galaxy-map-canvas');
    if (!canvas || !STATE.universe) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const systems = STATE.universe.systems;
    let maxDist = 0;
    systems.forEach(sys => {
        const dist = Math.sqrt(sys.x * sys.x + sys.z * sys.z);
        if (dist > maxDist) maxDist = dist;
    });
    const scale = Math.min(width, height) / (maxDist * 2.2 || 1);

    if (!selectedSystem) {
        selectedSystem = systems.find(s => s.id === STATE.currentSystemId) || systems[0];
        updateSystemDetails(selectedSystem);
    }

    let hoverSystem = null;

    function drawMap(mouseX = -1, mouseY = -1) {
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
        ctx.beginPath();
        ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
        ctx.stroke();

        ctx.fillStyle = 'rgba(168, 85, 247, 0.01)';
        for (let i = 0; i < 400; i++) {
            const theta = (i / 400) * 4 * Math.PI;
            const r = 20 + (i / 400) * maxDist * scale;
            const x1 = centerX + r * Math.cos(theta);
            const y1 = centerY + r * Math.sin(theta);
            ctx.beginPath();
            ctx.arc(x1, y1, 12, 0, Math.PI * 2);
            ctx.fill();

            const x2 = centerX + r * Math.cos(theta + Math.PI);
            const y2 = centerY + r * Math.sin(theta + Math.PI);
            ctx.beginPath();
            ctx.arc(x2, y2, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        const currentSys = systems.find(s => s.id === STATE.currentSystemId);
        if (currentSys) {
            const curScreenX = centerX + currentSys.x * scale;
            const curScreenY = centerY + currentSys.z * scale;

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, 14 + Math.sin(Date.now() * 0.005) * 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        hoverSystem = null;

        systems.forEach(sys => {
            const screenX = centerX + sys.x * scale;
            const screenY = centerY + sys.z * scale;

            const dx = mouseX - screenX;
            const dy = mouseY - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const isSelected = selectedSystem && selectedSystem.id === sys.id;
            const isActive = STATE.currentSystemId === sys.id;

            let baseSize = 4;
            if (isActive) baseSize = 5.5;
            if (isSelected) baseSize = 6.5;

            if (dist < 10) {
                hoverSystem = sys;
                baseSize += 2.5;
            }

            let starColor = '#f59e0b';
            if (sys.star.type === 'Blue Giant') starColor = '#3b82f6';
            if (sys.star.type === 'Red Dwarf') starColor = '#ef4444';
            if (sys.star.type === 'White Dwarf') starColor = '#cbd5e1';
            if (sys.star.type === 'Black Hole') starColor = '#8b5cf6';

            if (isSelected) {
                ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (isActive) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = starColor;
            ctx.beginPath();
            ctx.arc(screenX, screenY, baseSize, 0, Math.PI * 2);
            ctx.fill();

            if (isSelected || isActive || sys.id % 12 === 0 || dist < 10) {
                ctx.fillStyle = isSelected ? '#c084fc' : (isActive ? '#38bdf8' : '#475569');
                ctx.font = 'bold 8.5px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(sys.name, screenX, screenY - baseSize - 5);
            }
        });

        if (hoverSystem) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
            ctx.lineWidth = 1;

            const tooltipX = mouseX + 15;
            const tooltipY = mouseY - 15;
            const text = `${hoverSystem.name} (${hoverSystem.star.type})`;

            ctx.font = '9.5px Orbitron, sans-serif';
            const textWidth = ctx.measureText(text).width;

            ctx.beginPath();
            ctx.roundRect(tooltipX, tooltipY - 18, textWidth + 20, 24, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(text, tooltipX + 10, tooltipY - 2);
        }
    }

    canvas.onmousemove = (e) => {
        const mRect = canvas.getBoundingClientRect();
        const mx = e.clientX - mRect.left;
        const my = e.clientY - mRect.top;
        drawMap(mx, my);
    };

    canvas.onclick = () => {
        if (hoverSystem) {
            selectedSystem = hoverSystem;
            updateSystemDetails(selectedSystem);
            drawMap();
            playSiliconCollectSound(); // small sound feedback on click!
        }
    };

    drawMap();
}

function updateSystemDetails(sys) {
    const placeholder = document.getElementById('detail-system-placeholder');
    const statsPanel = document.getElementById('detail-system-stats');

    if (!sys) {
        if (placeholder) placeholder.style.display = 'flex';
        if (statsPanel) statsPanel.style.display = 'none';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (statsPanel) statsPanel.style.display = 'flex';

    document.getElementById('detail-system-name').innerText = sys.name;
    document.getElementById('val-coord-x').innerText = sys.x;
    document.getElementById('val-coord-z').innerText = sys.z;
    document.getElementById('val-star-type').innerText = sys.star.type;
    document.getElementById('val-star-mass').innerText = sys.star.mass + " SM";
    document.getElementById('val-planet-count').innerText = sys.planets.length;

    const list = document.getElementById('val-planets-list');
    if (list) {
        list.innerHTML = "";
        sys.planets.forEach(p => {
            const li = document.createElement('li');

            let pColor = '#94a3b8';
            if (p.type === 'Gas Giant') pColor = '#c084fc';
            if (p.type === 'Habitable') pColor = '#10b981';

            li.innerHTML = `
                <span>
                    <span class="planet-indicator-dot" style="background-color: ${pColor};"></span>
                    ${p.name}
                </span>
                <span style="color: #64748b; font-size: 0.65rem;">${p.type} (${p.size}x)</span>
            `;
            list.appendChild(li);
        });
    }

    const warpBtn = document.getElementById('warp-btn');
    if (warpBtn) {
        if (sys.id === STATE.currentSystemId) {
            warpBtn.disabled = true;
            warpBtn.innerText = "Etablierter Standort";
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else {
            warpBtn.disabled = false;
            warpBtn.innerText = "Quantenfeld falten (WARP)";
            warpBtn.style.opacity = "1";
            warpBtn.style.pointerEvents = "auto";
        }
    }
}

function warpToSystem(systemId) {
    const warpOverlay = document.getElementById('warp-overlay');
    if (warpOverlay) {
        warpOverlay.style.display = 'flex';
        warpOverlay.style.opacity = '1';
    }

    // Stop engine rumble during warp
    setThrusterSound(false);
    // Play heavy warp crash/rumble audio feedback
    playCrashSound();

    setTimeout(() => {
        STATE.currentSystemId = systemId;
        const activeSystem = STATE.universe.systems[systemId];

        // Clear current and spawn new
        clearActiveSystem();
        spawnPlanetsAndAsteroids();

        // Reset player
        STATE.playerPosition.set(0, 0, 50);
        STATE.playerVelocity.set(0, 0, 0);
        if (STATE.playerGroup) {
            STATE.playerGroup.position.set(0, 0, 50);
        }

        addLogEntry("SYSTEM", `Hypersprung abgeschlossen. Raumfaltung um ${activeSystem.name} stabilisiert.`);

        // Close panels
        if (warpOverlay) {
            warpOverlay.style.display = 'none';
        }
        toggleGalaxyMap();
    }, 2000);
}

// Start
initThree();

// Menu Button Interactions
document.getElementById('start-game-btn').addEventListener('click', () => {
    STATE.gameStarted = true;
    document.body.classList.add('game-started');

    // Clear initial system and load system 0 (which has Epsilon Prime)
    if (STATE.universe) {
        clearActiveSystem();
        spawnPlanetsAndAsteroids();
        STATE.playerPosition.set(0, 0, 50);
        STATE.playerVelocity.set(0, 0, 0);
        if (STATE.playerGroup) {
            STATE.playerGroup.position.set(0, 0, 50);
        }
    }

    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        mainMenu.style.opacity = '0';
        mainMenu.style.pointerEvents = 'none';
        setTimeout(() => {
            mainMenu.style.display = 'none';
        }, 800);
    }

    if (!musicPlaying) {
        toggleMusic();
    }
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        // 1. If "How to Play" tutorial modal is open, close it
        const howToPlay = document.getElementById('how-to-play-modal');
        if (howToPlay && howToPlay.style.display === 'flex') {
            howToPlay.style.display = 'none';
            return;
        }
        
        // 2. If Galaxy Map is open, close it
        if (mapOpen) {
            toggleGalaxyMap();
            return;
        }
        
        const mainMenu = document.getElementById('main-menu');
        if (!mainMenu) return;
        
        const runningInElectron = typeof window.api !== 'undefined';
        
        if (STATE.gameStarted) {
            // Game is active: toggle main menu overlay (Pause / Resume)
            const isMenuVisible = mainMenu.style.display === 'flex' && mainMenu.style.opacity !== '0';
            if (isMenuVisible) {
                // Resume game: hide menu
                mainMenu.style.opacity = '0';
                mainMenu.style.pointerEvents = 'none';
                setTimeout(() => {
                    mainMenu.style.display = 'none';
                }, 800);
            } else {
                // Pause game: show menu
                mainMenu.style.display = 'flex';
                // Force layout reflow to make transition animation work
                mainMenu.offsetHeight;
                mainMenu.style.opacity = '1';
                mainMenu.style.pointerEvents = 'auto';
            }
        } else {
            // We are on the initial title screen (game not started yet)
            // If running in Electron, close the app immediately
            if (runningInElectron) {
                window.api.closeApp();
            }
        }
    }
});

document.getElementById('how-to-play-btn').addEventListener('click', () => {
    document.getElementById('how-to-play-modal').style.display = 'flex';
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('how-to-play-modal').style.display = 'none';
});

// Galaxy Map HUD Buttons wiring
const mapBtn = document.getElementById('galaxy-map-btn');
if (mapBtn) {
    mapBtn.addEventListener('click', toggleGalaxyMap);
}
const closeMapBtn = document.getElementById('close-map-btn');
if (closeMapBtn) {
    closeMapBtn.addEventListener('click', toggleGalaxyMap);
}
const warpBtn = document.getElementById('warp-btn');
if (warpBtn) {
    warpBtn.addEventListener('click', () => {
        if (selectedSystem) {
            warpToSystem(selectedSystem.id);
        }
    });
}

// Scan button click wiring
const startScanBtn = document.getElementById('start-scan-btn');
if (startScanBtn) {
    startScanBtn.addEventListener('click', triggerScanStart);
}

// Quantum Universe Generator triggers
const generateBtn = document.getElementById('generate-btn');
if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
        const keyInput = document.getElementById('ibm-key-input');
        const qpuChk = document.getElementById('use-qpu-chk');
        const statusDiv = document.getElementById('generation-status');

        const apiKey = keyInput ? keyInput.value.trim() : "";
        const useQpu = qpuChk ? qpuChk.checked : false;

        if (statusDiv) {
            statusDiv.innerText = "Lade Quantenschaltkreis... Bitte warten...";
            statusDiv.style.color = "#a855f7";
        }
        generateBtn.disabled = true;

        // Electron check
        const runningInElectron = typeof window.api !== 'undefined';
        if (runningInElectron) {
            try {
                const res = await window.api.generateUniverse(apiKey, useQpu);
                if (res.success) {
                    if (statusDiv) {
                        statusDiv.innerText = "Galaxie generiert! Najmafar erwacht.";
                        statusDiv.style.color = "#10b981";
                    }
                    await checkUniverseData();
                } else {
                    if (statusDiv) {
                        statusDiv.innerText = "Fehler: " + res.error;
                        statusDiv.style.color = "#ef4444";
                    }
                    generateBtn.disabled = false;
                }
            } catch (e) {
                if (statusDiv) {
                    statusDiv.innerText = "Fehler: " + e.message;
                    statusDiv.style.color = "#ef4444";
                }
                generateBtn.disabled = false;
            }
        } else {
            if (statusDiv) {
                statusDiv.innerText = "Quantum-Generierung benötigt Electron Desktop Client!";
                statusDiv.style.color = "#f59e0b";
            }
            generateBtn.disabled = false;
        }
    });
}

// Electron exit wiring
const runningInElectron = typeof window.api !== 'undefined';
if (runningInElectron) {
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.style.display = 'block';
        exitBtn.addEventListener('click', () => {
            window.api.closeApp();
        });
    }
}

// --- INITIALIZE MINIMAP AND UI DECKS ---
minimapCanvas = document.getElementById('minimap-canvas');
if (minimapCanvas) {
    minimapCtx = minimapCanvas.getContext('2d');
}

// Left Deck Collapse / Expand Listener
const leftCollapseBtn = document.getElementById('left-collapse-btn');
const leftDeckPanel = document.getElementById('left-deck-panel');
if (leftCollapseBtn && leftDeckPanel) {
    leftCollapseBtn.addEventListener('click', () => {
        leftDeckPanel.classList.toggle('collapsed');
        if (leftDeckPanel.classList.contains('collapsed')) {
            leftCollapseBtn.innerText = '›';
            leftCollapseBtn.title = 'Sensoren ausklappen';
        } else {
            leftCollapseBtn.innerText = '‹';
            leftCollapseBtn.title = 'Sensoren einklappen';
        }
    });
}

// Right Deck Collapse / Expand Listener
const rightCollapseBtn = document.getElementById('right-collapse-btn');
const rightDeckPanel = document.getElementById('right-deck-panel');
if (rightCollapseBtn && rightDeckPanel) {
    rightCollapseBtn.addEventListener('click', () => {
        rightDeckPanel.classList.toggle('collapsed');
        if (rightDeckPanel.classList.contains('collapsed')) {
            rightCollapseBtn.innerText = '‹';
            rightCollapseBtn.title = 'Status-Deck ausklappen';
        } else {
            rightCollapseBtn.innerText = '›';
            rightCollapseBtn.title = 'Status-Deck einklappen';
        }
    });
}

// Right Deck Tab Switching
const tabButtons = document.querySelectorAll('#right-deck-tabs .tab-btn');
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        // Reset active classes
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle containers
        const crewContent = document.getElementById('tab-content-crew');
        const evoContent = document.getElementById('tab-content-evolution');

        if (targetTab === 'crew') {
            if (crewContent) crewContent.classList.add('active');
            if (evoContent) evoContent.classList.remove('active');
        } else if (targetTab === 'evolution') {
            if (crewContent) crewContent.classList.remove('active');
            if (evoContent) evoContent.classList.add('active');
        }
    });
});

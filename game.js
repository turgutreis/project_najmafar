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

    // Sensor & Travel Limits (Fog of War & Jump Ranges)
    psionicRange: 75, // Base telepathic detection range in Lightyears
    warpRange: 90,    // Base warp folding range in Lightyears

    // Crew Management & Synergies
    maxCrewCapacity: 2,
    crewSatietyTimer: 0,
    crewDialogueTimer: 18,
    crewBuffs: {
        thrust: 1.0,
        bioGain: 1.0,
        scanSpeed: 1.0,
        repairRate: 0,
        stressDampening: 1.0,
        psionicBonus: 0
    },

    // Mutations
    mutations: {
        armor: { purchased: false, bioCost: 50, siliconCost: 30 },
        o2: { purchased: false, bioCost: 60, siliconCost: 40 },
        synapses: { purchased: false, bioCost: 40, siliconCost: 80 },
        cocoon: { purchased: false, bioCost: 50, siliconCost: 40 },
        hivemind: { purchased: false, bioCost: 80, siliconCost: 70 },
        folddrive: { purchased: false, bioCost: 90, siliconCost: 70 },
        translator: { purchased: false, bioCost: 80, siliconCost: 80 }
    },

    // Physics
    playerPosition: new THREE.Vector3(0, 0, 50),
    playerVelocity: new THREE.Vector3(0, 0, 0),

    // Quantum Universe
    universe: null,
    currentSystemId: 0,
    playerAcceleration: new THREE.Vector3(0, 0, 0),

    // Scanner, Harvesting & Abduction System
    nearestPlanet: null,
    lockedTarget: null, // Manually selected target via 3D Raycasting or Gamepad
    scanningPlanet: null,
    scanProgress: 0,
    scannedPlanets: {},
    extractingPlanet: null,
    extractProgress: 0,
    harvestedPlanets: {},
    abductActive: false,
    abductProgress: 0,
    abductTarget: null,
    playerMass: 1,
    drag: 0.4, // Base drag when thrusting
    brakeDrag: 2.2, // Retro-dampeners drag when coasting
    currentDrag: 0.4,
    thrustStrength: 25.0, // Responsive thrusters

    // Psionic Loneliness & Mental Coherence
    loneliness: 85, // Starts lonely (0-100%)

    // Psionic Dream Matrix (Starts with 0 Crew!)
    crew: [],

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
let musicUserMuted = false;

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
let harvestBeamMesh = null;
let abductBeamMesh = null;
let sonarWaveMesh = null;
let sonarTimer = 0;
let harvestOsc = null, harvestGain = null, harvestFilter = null;
let abductOsc = null, abductGain = null, abductFilter = null;
let minimapCanvas = null;
let minimapCtx = null;
let trajectoryPoints;
const container = document.getElementById('canvas-container');

// --- OPTIMIZED CACHED VECTORS & STRUCTS (ZERO GC PRESSURE) ---
const _predPos = new THREE.Vector3();
const _predVel = new THREE.Vector3();
const _predAcc = new THREE.Vector3();
const _thrustAcc = new THREE.Vector3();
const _inputDir = new THREE.Vector3();
const _gravityDir = new THREE.Vector3();
const _bounceDir = new THREE.Vector3();

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

    // Setup Target Raycasting & Reticle
    setupTargetRaycasting();

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

// =========================================================================
// --- PROCEDURAL TEXTURE & BUMP ENGINE (0 MB ASSETS, UNLIMITED DETAIL) ---
// =========================================================================

function pseudoNoise(x, y, seed = 1) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x, y, seed = 1) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = pseudoNoise(i, j, seed);
    const n10 = pseudoNoise(i + 1, j, seed);
    const n01 = pseudoNoise(i, j + 1, seed);
    const n11 = pseudoNoise(i + 1, j + 1, seed);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
}

function fbm(x, y, octaves, seed = 1) {
    let val = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let o = 0; o < octaves; o++) {
        val += smoothNoise(x * freq, y * freq, seed + o * 13.37) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    return val;
}

function hexToRgb(hex) {
    let num = typeof hex === 'string' ? parseInt(hex.replace("0x", ""), 16) : hex;
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// 1. Habitable Planet Textures (Oceans, Continents, Coastlines, Mountains, Polar Caps)
function createHabitableTextures(colorHex, seed = 42) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d');
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const rgb = hexToRgb(colorHex);

    for (let y = 0; y < h; y++) {
        const lat = Math.abs(y - h / 2) / (h / 2);
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const nx = (x / w) * 5.0;
            const ny = (y / h) * 3.0;

            const n = fbm(nx, ny, 4, seed);

            let r, g, b, bumpVal;

            if (lat > 0.82 + n * 0.12) {
                // Polar Ice Caps
                r = 230 + Math.floor(n * 25);
                g = 245 + Math.floor(n * 10);
                b = 255;
                bumpVal = 40;
            } else if (n < 0.47) {
                // Deep Ocean & Shallow Shelf
                const oceanDepth = n / 0.47;
                if (oceanDepth < 0.8) {
                    r = 8; g = 50 + Math.floor(oceanDepth * 40); b = 140 + Math.floor(oceanDepth * 80);
                } else {
                    // Shallow Cyan Coral Reef
                    r = 10; g = 160 + Math.floor((oceanDepth - 0.8) * 300); b = 210;
                }
                bumpVal = 0;
            } else if (n < 0.51) {
                // Golden Coastline / Beach
                r = 210; g = 180; b = 110;
                bumpVal = 15;
            } else if (n < 0.72) {
                // Alien Biosphere / Continents (modulated by planet's base color)
                const vegT = (n - 0.51) / 0.21;
                r = Math.floor(rgb.r * 0.3 + (1 - vegT) * 20);
                g = Math.floor(rgb.g * 0.9 + vegT * 40);
                b = Math.floor(rgb.b * 0.4 + vegT * 20);
                bumpVal = 60 + Math.floor(vegT * 60);
            } else {
                // Mountain Peaks & Snow Ridges
                const mountainT = (n - 0.72) / 0.28;
                r = 140 + Math.floor(mountainT * 100);
                g = 145 + Math.floor(mountainT * 95);
                b = 160 + Math.floor(mountainT * 95);
                bumpVal = 140 + Math.floor(mountainT * 115);
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }

    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const map = new THREE.CanvasTexture(colCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    return { map, bumpMap };
}

// 2. Gas Giant Textures (Atmospheric Bands, Storm Swirls, Great Oval Spot)
function createGasGiantTextures(colorHex, seed = 77) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const base = hexToRgb(colorHex);
    const stormX = (Math.abs(seed) % 100) / 100 * w * 0.6 + w * 0.2;
    const stormY = h * 0.58;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const nx = (x / w) * 6.0;
            const ny = (y / h) * 8.0;

            const turb = fbm(nx, ny * 0.5, 3, seed);
            const band = Math.sin(y * 0.35 + turb * 4.0);

            // Distance to atmospheric Great Storm
            const sDist = Math.hypot((x - stormX) / 1.8, y - stormY);

            let r, g, b;
            if (sDist < 12) {
                // Great Storm Eye
                const swirl = Math.sin(sDist * 0.6 + Math.atan2(y - stormY, x - stormX) * 3);
                r = Math.min(255, base.r * 1.6 + swirl * 40);
                g = Math.min(255, base.g * 0.8 + swirl * 20);
                b = Math.min(255, base.b * 1.5 + swirl * 30);
            } else {
                const bandWeight = (band + 1) * 0.5;
                r = Math.floor(base.r * (0.4 + bandWeight * 0.7) + turb * 35);
                g = Math.floor(base.g * (0.4 + bandWeight * 0.7) + turb * 35);
                b = Math.floor(base.b * (0.4 + bandWeight * 0.7) + turb * 35);
            }

            data[idx] = Math.min(255, Math.max(0, r));
            data[idx + 1] = Math.min(255, Math.max(0, g));
            data[idx + 2] = Math.min(255, Math.max(0, b));
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    return { map, bumpMap: null };
}

// 3. Rocky Planet / Moon Textures (Crater Impact Basins, Regolith Fissures)
function createRockyTextures(colorHex, seed = 99) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d');
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const base = hexToRgb(colorHex);

    const craters = [];
    for (let c = 0; c < 12; c++) {
        craters.push({
            x: ((Math.abs(seed) * (c + 1) * 37) % w),
            y: ((Math.abs(seed) * (c + 1) * 61) % h),
            radius: 4 + (c % 5) * 3
        });
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 6.0, (y / h) * 4.0, 4, seed);

            let bumpVal = Math.floor(n * 160);
            let r = Math.floor(base.r * (0.6 + n * 0.5));
            let g = Math.floor(base.g * (0.6 + n * 0.5));
            let b = Math.floor(base.b * (0.6 + n * 0.5));

            // Crater impacts
            for (let c = 0; c < craters.length; c++) {
                const cr = craters[c];
                const d = Math.hypot(x - cr.x, y - cr.y);
                if (d < cr.radius) {
                    const ratio = d / cr.radius;
                    if (ratio < 0.7) {
                        r = Math.floor(r * 0.6);
                        g = Math.floor(g * 0.6);
                        b = Math.floor(b * 0.6);
                        bumpVal = Math.max(0, bumpVal - 60);
                    } else {
                        r = Math.min(255, r + 40);
                        g = Math.min(255, g + 40);
                        b = Math.min(255, b + 40);
                        bumpVal = Math.min(255, bumpVal + 70);
                    }
                }
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas)
    };
}

// 4. Ice Moon Textures (Europa-style Cryo-Cracks, Subglacial Fractures)
function createIceMoonTextures(colorHex, seed = 123) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d');
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 8.0, (y / h) * 6.0, 3, seed);
            const crack1 = Math.abs(Math.sin(x * 0.15 + n * 3.0 + y * 0.08));
            const crack2 = Math.abs(Math.sin(y * 0.2 - x * 0.1 + n * 2.5));
            const isCrack = crack1 < 0.1 || crack2 < 0.08;

            let r, g, b, bumpVal;
            if (isCrack) {
                r = 180 + Math.floor(n * 30);
                g = 100 + Math.floor(n * 20);
                b = 80;
                bumpVal = 180;
            } else {
                r = 210 + Math.floor(n * 40);
                g = 235 + Math.floor(n * 20);
                b = 255;
                bumpVal = 60 + Math.floor(n * 50);
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas)
    };
}

// 5. Volcanic Moon Textures (Sulfur Plains & Glowing Magma Emissive Calderas)
function createVolcanicMoonTextures(colorHex, seed = 321) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d');
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const emCanvas = document.createElement('canvas');
    emCanvas.width = w; emCanvas.height = h;
    const emCtx = emCanvas.getContext('2d');
    const emImg = emCtx.createImageData(w, h);
    const emData = emImg.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 6.0, (y / h) * 4.0, 4, seed);
            const magma = Math.abs(Math.sin(x * 0.12 + y * 0.15 + n * 4.0));
            const isMagma = magma < 0.12;

            let r, g, b, emR, emG, emB, bumpVal;
            if (isMagma) {
                r = 255; g = 110; b = 10;
                emR = 255; emG = 90; emB = 0;
                bumpVal = 20;
            } else if (n > 0.6) {
                r = 230; g = 190; b = 25;
                emR = 0; emG = 0; emB = 0;
                bumpVal = 130;
            } else {
                r = 60 + Math.floor(n * 40);
                g = 40 + Math.floor(n * 30);
                b = 30 + Math.floor(n * 20);
                emR = 0; emG = 0; emB = 0;
                bumpVal = 80;
            }

            colData[idx] = r; colData[idx + 1] = g; colData[idx + 2] = b; colData[idx + 3] = 255;
            emData[idx] = emR; emData[idx + 1] = emG; emData[idx + 2] = emB; emData[idx + 3] = 255;
            bumpData[idx] = bumpVal; bumpData[idx + 1] = bumpVal; bumpData[idx + 2] = bumpVal; bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);
    emCtx.putImageData(emImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas),
        emissiveMap: new THREE.CanvasTexture(emCanvas)
    };
}

// 6. Solar Plasma Texture (Turbulent Granulation)
function createStarTexture(colorHex, seed = 555) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const base = hexToRgb(colorHex);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 10.0, (y / h) * 6.0, 3, seed);
            const flare = (n - 0.5) * 60;

            data[idx] = Math.min(255, Math.max(0, base.r + flare + 40));
            data[idx + 1] = Math.min(255, Math.max(0, base.g + flare + 20));
            data[idx + 2] = Math.min(255, Math.max(0, base.b + flare));
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return { map: new THREE.CanvasTexture(canvas) };
}

// 7. Dynamic Transparent Cloud Texture (Habitable Atmosphere)
function createCloudTexture(seed = 888) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 6.0, (y / h) * 4.0, 4, seed);

            if (n > 0.54) {
                const alpha = Math.min(240, Math.floor((n - 0.54) * 550));
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                data[idx + 3] = alpha;
            } else {
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 0;
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
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
        const starSeed = STATE.currentSystemId * 1337 + 42;
        const starTex = createStarTexture(starData.color, starSeed);

        const starGeo = new THREE.SphereGeometry(starData.size, 32, 32);
        const starMat = new THREE.MeshStandardMaterial({
            map: starTex.map,
            emissive: parseInt(starData.color),
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.1
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(0, 0, 0);
        scene.add(starMesh);

        const starLight = new THREE.PointLight(parseInt(starData.color), 3, 300, 0.4);
        starLight.position.set(0, 0, 0);
        scene.add(starLight);

        starData.colorCss = starData.color.replace("0x", "#");

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

        const seed = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx * 77;
        let pTex;
        if (p.type === 'Habitable') {
            pTex = createHabitableTextures(p.color, seed);
        } else if (p.type === 'Gas Giant') {
            pTex = createGasGiantTextures(p.color, seed);
        } else {
            pTex = createRockyTextures(p.color, seed);
        }

        const geo = new THREE.SphereGeometry(p.size, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            map: pTex.map,
            bumpMap: pTex.bumpMap || null,
            bumpScale: p.type === 'Habitable' ? 0.08 : (p.type === 'Rocky' ? 0.14 : 0),
            roughness: p.type === 'Gas Giant' ? 0.25 : (p.type === 'Habitable' ? 0.6 : 0.85),
            metalness: p.type === 'Gas Giant' ? 0.05 : 0.15,
            flatShading: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        planetGroup.add(mesh);

        let cloudMesh = null;
        if (p.type === 'Habitable') {
            // Dynamic cloud shell
            const cloudTex = createCloudTexture(seed + 999);
            const cloudGeo = new THREE.SphereGeometry(p.size * 1.025, 32, 32);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTex,
                transparent: true,
                opacity: 0.65,
                blending: THREE.NormalBlending,
                roughness: 1.0
            });
            cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            planetGroup.add(cloudMesh);
        }

        // Atmosphere glow halo
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

        // 3D Psionic Beacon Aura for sentient / habitable worlds
        let psioAuraMesh = null;
        if (p.type === 'Habitable' || (p.attributes && p.attributes.species && p.attributes.species.population > 0)) {
            const auraGeo = new THREE.RingGeometry(p.size * 1.4, p.size * 1.7, 48);
            auraGeo.rotateX(Math.PI / 2);
            const auraMat = new THREE.MeshBasicMaterial({
                color: 0xd946ef,
                transparent: true,
                opacity: 0.65,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            psioAuraMesh = new THREE.Mesh(auraGeo, auraMat);
            planetGroup.add(psioAuraMesh);
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

        // Save Kepler orbit specs & scan details (Calm, majestic planetary orbit speed)
        const orbitSpeed = 0.045 / Math.sqrt(p.distance);
        const pColorCss = p.color.replace("0x", "#");
        const generated = generatePlanetAttributes(p);
        
        let finalSpecies = p.species || generated.species;
        if (p.type === 'Habitable') {
            if (!finalSpecies || !finalSpecies.candidates || finalSpecies.candidates.length === 0) {
                finalSpecies = generated.species;
            }
        }

        const planetEntry = {
            mesh: planetGroup,
            bodyMesh: mesh,
            cloudMesh: cloudMesh,
            psioAuraMesh: psioAuraMesh,
            source: sourceObj,
            ringMesh: ring,
            angle: angle,
            speed: orbitSpeed,
            distance: p.distance,
            name: p.name,
            type: p.type,
            size: p.size,
            color: p.color,
            colorCss: pColorCss,
            isMoon: false,
            scanned: false,
            attributes: {
                atmos: p.atmos || generated.atmos,
                temp: p.temp || generated.temp,
                bio: p.bio || generated.bio,
                res: p.res || generated.res,
                species: finalSpecies
            }
        };
        activePlanets.push(planetEntry);

        // Spawn Moons (Natural Satellites) for this planet (Calm, graceful moon orbit speed)
        const moonsList = p.moons || generateFallbackMoons(p);
        moonsList.forEach((m, m_idx) => {
            const moonAngle = (m_idx * 2.2) + (idx * 0.7) + 0.5;
            const mx = px + m.distance * Math.cos(moonAngle);
            const mz = pz + m.distance * Math.sin(moonAngle);

            const mSeed = m.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + m_idx * 133;
            let mTex;
            if (m.type === 'Eismond') {
                mTex = createIceMoonTextures(m.color, mSeed);
            } else if (m.type === 'Vulkanmond') {
                mTex = createVolcanicMoonTextures(m.color, mSeed);
            } else {
                mTex = createRockyTextures(m.color, mSeed);
            }

            const mGeo = new THREE.SphereGeometry(m.size, 24, 24);
            const mMat = new THREE.MeshStandardMaterial({
                map: mTex.map,
                bumpMap: mTex.bumpMap || null,
                bumpScale: m.type === 'Eismond' ? 0.06 : 0.12,
                emissive: m.type === 'Vulkanmond' ? 0xff3300 : 0x000000,
                emissiveMap: mTex.emissiveMap || null,
                emissiveIntensity: m.type === 'Vulkanmond' ? 1.2 : 0,
                roughness: m.type === 'Eismond' ? 0.35 : 0.85,
                metalness: m.type === 'Vulkanmond' ? 0.3 : 0.1,
                flatShading: false
            });
            const moonMesh = new THREE.Mesh(mGeo, mMat);
            moonMesh.position.set(mx, 0, mz);
            scene.add(moonMesh);

            // Orbit line around parent planet
            const moonOrbitRing = createGravityRing(px, pz, m.distance, 0x38bdf8, 0.05);

            const mMass = m.size * m.size * 2.5;
            const mRange = m.size * 3.5;

            const moonSource = {
                mesh: moonMesh,
                type: 'planet',
                subType: 'moon',
                name: m.name,
                mass: mMass,
                radius: m.size,
                gravityRange: mRange,
                position: new THREE.Vector3(mx, 0, mz)
            };
            STATE.gravitySources.push(moonSource);

            const moonOrbitSpeed = m.speed ? m.speed * 0.14 : (0.12 + m_idx * 0.03);

            activePlanets.push({
                mesh: moonMesh,
                bodyMesh: moonMesh,
                source: moonSource,
                ringMesh: moonOrbitRing,
                parentPlanet: planetEntry,
                isMoon: true,
                angle: moonAngle,
                speed: moonOrbitSpeed,
                distance: m.distance,
                name: m.name,
                type: m.type,
                size: m.size,
                color: m.color,
                colorCss: m.color.replace("0x", "#"),
                scanned: false,
                attributes: (m.temp && m.atmos) ? {
                    atmos: m.atmos,
                    temp: m.temp,
                    bio: m.bio,
                    res: m.res
                } : generateMoonAttributes(m)
            });
        });
    });

    // 3. Spawn asteroids (Realistic cosmic debris & fragment scaling)
    activeSystem.asteroids.forEach((ast) => {
        const size = 0.4 + Math.random() * 0.45;
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
        if (key === 'q') {
            triggerPsionicSonar();
        }
        if (key === 't') {
            cycleTarget(1);
        }
        if (key === 'x') {
            clearLockedTarget();
        }
        if (key === 'f') {
            if (STATE.nearestPlanet) {
                const isScanned = STATE.nearestPlanet.scanned || STATE.scannedPlanets[STATE.nearestPlanet.name];
                if (isScanned && STATE.nearestPlanet.attributes.species && STATE.nearestPlanet.attributes.species.population > 0) {
                    triggerAbductStart();
                } else {
                    triggerScanStart();
                }
            }
        }
        if (key === 'e') {
            triggerHarvestStart();
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

    // Music Toggle Buttons (HUD & Main Menu)
    const musicBtn = document.getElementById('music-toggle-btn');
    if (musicBtn) {
        musicBtn.addEventListener('click', () => toggleMusic());
    }

    const menuMusicBtn = document.getElementById('menu-music-toggle-btn');
    if (menuMusicBtn) {
        menuMusicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });
    }

    // Auto-start music on first interaction (only if not explicitly muted by user)
    const startAudioOnInteraction = () => {
        if (!musicPlaying && !musicUserMuted) {
            toggleMusic(true);
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
            calculateCrewBuffs();
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Synapsen-Netzwerk integriert. Max Mentalkraft nun 150 & Gedanken-Reichweite auf 140 LJ erweitert!");
            const el1 = document.getElementById('svg-synapses-1');
            const el2 = document.getElementById('svg-synapses-2');
            if (el1) el1.style.display = 'block';
            if (el2) el2.style.display = 'block';
        } else if (type === 'cocoon') {
            STATE.maxCrewCapacity = 4;
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Neuronales Kokon-Gewebe gewachsen. Crew-Kapazität auf 4 erweitert & Stressschocks gedämpft!");
            renderCrewUI();
        } else if (type === 'hivemind') {
            STATE.maxCrewCapacity = 6;
            calculateCrewBuffs();
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Symbiotische Synapsen-Kammer vollendet. Max 6 Besatzung & +20% auf alle Spezialisten-Buffs!");
            renderCrewUI();
        } else if (type === 'folddrive') {
            STATE.warpRange = 160; // Expand warp jump reach
            addLogEntry("SYSTEM", "MUTATION ERFOLGREICH: Raumzeit-Faltungsmembran gewachsen. Warp-Reichweite auf 160 LJ vergrößert (-30% Energiekosten)!");
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

function toggleMusic(explicitState = null) {
    const shouldPlay = explicitState !== null ? explicitState : !musicPlaying;

    if (shouldPlay) {
        musicUserMuted = false;
        bgMusic.play()
            .then(() => {
                musicPlaying = true;
                updateMusicButtonsUI();
                addLogEntry("SYSTEM", "Hintergrundmusik aktiviert: Star Control 2 Space Theme.");
            })
            .catch(err => {
                console.log("Audio play blocked by browser. Click page to start.", err);
            });
    } else {
        musicUserMuted = true;
        bgMusic.pause();
        musicPlaying = false;
        updateMusicButtonsUI();
        addLogEntry("SYSTEM", "Hintergrundmusik pausiert.");
    }
}

function updateMusicButtonsUI() {
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
    // A. Update celestial orbits (Planets around star, Moons around parent planet)
    // 1. First update parent planets
    activePlanets.forEach(p => {
        if (!p.isMoon) {
            p.angle += dt * p.speed;
            const px = p.distance * Math.cos(p.angle);
            const pz = p.distance * Math.sin(p.angle);

            p.mesh.position.set(px, 0, pz);
            p.source.position.set(px, 0, pz);
            if (p.ringMesh) {
                p.ringMesh.position.set(px, 0, pz);
            }

            // Planet and clouds axial rotation (Relaxed, smooth speed)
            if (p.bodyMesh) {
                p.bodyMesh.rotation.y += (p.isGasGiant ? 0.06 : 0.035) * dt;
            }
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += 0.05 * dt;
            }
            // Pulse 3D Psionic Aura ring
            if (p.psioAuraMesh) {
                const aPulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.15;
                p.psioAuraMesh.scale.set(aPulse, aPulse, aPulse);
            }
        }
    });

    // 2. Then update moons orbiting around their parent planets
    activePlanets.forEach(m => {
        if (m.isMoon && m.parentPlanet) {
            m.angle += dt * m.speed;
            const parentPos = m.parentPlanet.mesh.position;
            const mx = parentPos.x + m.distance * Math.cos(m.angle);
            const mz = parentPos.z + m.distance * Math.sin(m.angle);

            m.mesh.position.set(mx, 0, mz);
            m.source.position.set(mx, 0, mz);
            if (m.ringMesh) {
                m.ringMesh.position.copy(parentPos);
            }

            // Moon axial rotation (Calm rotation)
            if (m.bodyMesh) {
                m.bodyMesh.rotation.y += 0.05 * dt;
            }
        }
    });

    // Gamepad / Steam Deck Input Polling
    pollGamepadControls(dt);

    // Update 3D Target Reticle
    if (STATE.lockedTarget && STATE.lockedTarget.mesh) {
        if (!targetReticleGroup) createTargetReticle();
        targetReticleGroup.visible = true;
        targetReticleGroup.position.copy(STATE.lockedTarget.mesh.position);
        
        const scale = (STATE.lockedTarget.size || 2.5) * 1.5;
        const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.08;
        targetReticleGroup.scale.set(scale * pulse, scale * pulse, scale * pulse);

        if (targetReticleGroup.children[0]) targetReticleGroup.children[0].rotation.z += dt * 1.2;
        if (targetReticleGroup.children[1]) targetReticleGroup.children[1].rotation.z -= dt * 0.8;
    } else {
        if (targetReticleGroup) targetReticleGroup.visible = false;
    }

    // B. Calculate closest or locked planet distance & update Scanner UI
    let targetPlanet = null;
    let targetDist = Infinity;

    if (STATE.lockedTarget && STATE.lockedTarget.mesh) {
        targetPlanet = STATE.lockedTarget;
        const dx = STATE.playerPosition.x - targetPlanet.mesh.position.x;
        const dz = STATE.playerPosition.z - targetPlanet.mesh.position.z;
        targetDist = Math.sqrt(dx * dx + dz * dz);
    } else {
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
        targetPlanet = closestPlanet;
        targetDist = minDist;
    }

    STATE.nearestPlanet = targetPlanet;
    updateScannerUI(targetPlanet, targetDist);

    // Update Psionic Compass (Points toward locked target if set, or closest sentient planet)
    const compassHud = document.getElementById('psionic-compass-hud');
    if (compassHud) {
        const targetBody = STATE.lockedTarget || activePlanets.find(p => p.attributes && p.attributes.species && p.attributes.species.population > 0);
        if (targetBody) {
            compassHud.style.display = 'flex';
            const cdx = targetBody.mesh.position.x - STATE.playerPosition.x;
            const cdz = targetBody.mesh.position.z - STATE.playerPosition.z;
            const cdist = Math.sqrt(cdx * cdx + cdz * cdz);

            const angle = Math.atan2(cdz, cdx) - Math.PI / 2;

            const nameEl = document.getElementById('compass-planet-name');
            const distEl = document.getElementById('compass-distance-text');
            const needleEl = document.getElementById('compass-arrow-needle');

            if (nameEl) {
                const specTag = (targetBody.attributes && targetBody.attributes.species) ? ` (${targetBody.attributes.species.name})` : '';
                nameEl.innerText = `${targetBody.name}${specTag}`;
            }
            if (distEl) distEl.innerText = `Distanz: ${cdist.toFixed(0)} Einheiten`;
            if (needleEl) needleEl.style.transform = `rotate(${angle * (180 / Math.PI)}deg)`;
        } else {
            compassHud.style.display = 'none';
        }
    }

    // Animate Sonar Wave expansion
    if (sonarWaveMesh && sonarTimer > 0) {
        sonarTimer -= dt;
        const progress = 1.0 - (sonarTimer / 1.0);
        const currentScale = 1.0 + progress * 150.0;
        sonarWaveMesh.scale.set(currentScale, currentScale, currentScale);
        sonarWaveMesh.material.opacity = Math.max(0, 0.9 * (1.0 - progress));

        if (sonarTimer <= 0) {
            scene.remove(sonarWaveMesh);
            if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
            if (sonarWaveMesh.material) sonarWaveMesh.material.dispose();
            sonarWaveMesh = null;
        }
    }

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

                // Check sentient species presence and notify player
                if (STATE.scanningPlanet.attributes && STATE.scanningPlanet.attributes.species && STATE.scanningPlanet.attributes.species.population > 0) {
                    const spec = STATE.scanningPlanet.attributes.species;
                    addLogEntry("SYSTEM", `PSIONISCHER BEFUND: ${spec.name} (${spec.population} Wesen) auf ${STATE.scanningPlanet.name} erfasst! [F] zum Entführen drücken.`);
                }

                // Trigger update scanner UI
                const dx = STATE.playerPosition.x - STATE.scanningPlanet.mesh.position.x;
                const dz = STATE.playerPosition.z - STATE.scanningPlanet.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                updateScannerUI(STATE.scanningPlanet, dist);

                STATE.scanningPlanet = null;
                STATE.scanProgress = 0;
                const progContainer = document.getElementById('scan-progress-container');
                if (progContainer) progContainer.style.display = 'none';
            }
        }
    }

    // --- ACTIVE HARVESTING UPDATE LOOP ---
    if (STATE.extractingPlanet) {
        const hdx = STATE.playerPosition.x - STATE.extractingPlanet.mesh.position.x;
        const hdz = STATE.playerPosition.z - STATE.extractingPlanet.mesh.position.z;
        const hdist = Math.sqrt(hdx * hdx + hdz * hdz);

        if (hdist > 22) {
            // Cancel harvest (lost connection)
            stopHarvestSound();
            removeHarvestBeam();
            addLogEntry("SYSTEM", `Assimilation abgebrochen: Verbindung verloren. Abstand zu ${STATE.extractingPlanet.name} überschritt Sicherheitsradius.`);
            STATE.extractingPlanet = null;
            STATE.extractProgress = 0;
            const hprogContainer = document.getElementById('harvest-progress-container');
            if (hprogContainer) hprogContainer.style.display = 'none';
        } else {
            // Advance harvest progress
            STATE.extractProgress += (dt / 3.0) * 100; // 3 seconds extraction

            // Update beam position between ship and planet
            updateHarvestBeam(STATE.playerPosition, STATE.extractingPlanet.mesh.position);

            // Modulate harvest sound filter
            if (harvestFilter && audioCtx) {
                harvestFilter.frequency.setValueAtTime(180 + (STATE.extractProgress / 100) * 450 + Math.sin(Date.now() * 0.02) * 60, audioCtx.currentTime);
            }

            const hprogBar = document.getElementById('harvest-progress-bar');
            const hprogTxt = document.getElementById('harvest-progress-text');
            if (hprogBar) hprogBar.style.width = `${Math.min(100, STATE.extractProgress)}%`;
            if (hprogTxt) hprogTxt.innerText = `${Math.round(Math.min(100, STATE.extractProgress))}%`;

            if (STATE.extractProgress >= 100) {
                // Complete harvest!
                stopHarvestSound();
                removeHarvestBeam();

                const p = STATE.extractingPlanet;
                p.harvested = true;
                STATE.harvestedPlanets[p.name] = true;

                // Award resources according to planet or moon type
                if (p.isMoon) {
                    if (p.type === 'Eismond') {
                        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 50);
                        STATE.siliconRes += 35;
                        STATE.bioRes += 10;
                        addLogEntry("SYSTEM", `Kryo-Eis von Mond ${p.name} assimiliert. +50% Treibstoff & +35 Silizium.`);
                        if (Math.random() > 0.3) {
                            addLogEntry("CREW", encryptCrewMessage("Dr. Song", `Geysire brechen aus der Eiskruste von ${p.name}... Deuterium-Schichten werden abgesaugt!`));
                        }
                    } else if (p.type === 'Vulkanmond') {
                        STATE.siliconRes += 60;
                        STATE.bioRes += 25;
                        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 15);
                        addLogEntry("SYSTEM", `Vulkanische Schlote von Mond ${p.name} angezapft. +60 Silizium & +25 Biomasse.`);
                        if (Math.random() > 0.3) {
                            addLogEntry("CREW", encryptCrewMessage("Ing. Petrov", `Schmelzflüssiges Titan strömt aus den Vulkanen von ${p.name} in unsere Außenhülle!`));
                        }
                    } else { // Kratermond
                        STATE.siliconRes += 55;
                        STATE.bioRes += 20;
                        addLogEntry("SYSTEM", `Regolith-Kruste von Mond ${p.name} abgebaut. +55 Silizium & +20 Biomasse.`);
                        if (Math.random() > 0.3) {
                            addLogEntry("CREW", encryptCrewMessage("Capt. Miller", `Der Asteroidenstaub auf ${p.name} wurde von den Tentakeln komplett absorbiert.`));
                        }
                    }
                } else if (p.type === 'Habitable') {
                    STATE.bioRes += 70;
                    STATE.health = Math.min(STATE.maxHealth, STATE.health + 40);
                    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 25);
                    addLogEntry("SYSTEM", `Biosphäre von ${p.name} assimiliert. +70 Biomasse gewonnen, Zellkern repariert (+40 HP).`);
                    if (Math.random() > 0.3) {
                        addLogEntry("CREW", encryptCrewMessage("Capt. Miller", `Sensoren melden gewaltige organische Schockwellen auf ${p.name}... Die Biosphäre wurde assimiliert!`));
                    }
                } else if (p.type === 'Gas Giant') {
                    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 60);
                    STATE.siliconRes += 35;
                    STATE.bioRes += 10;
                    addLogEntry("SYSTEM", `Gasatmosphäre von ${p.name} abgesaugt. +60% Bio-Energie Treibstoff & +35 Silizium.`);
                    if (Math.random() > 0.3) {
                        addLogEntry("CREW", encryptCrewMessage("Dr. Song", `Atmosphärischer Druck fällt rapide... Wir haben flüssiges Deuterium aus ${p.name} absorbiert!`));
                    }
                } else { // Rocky
                    STATE.siliconRes += 75;
                    STATE.bioRes += 15;
                    STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 20);
                    addLogEntry("SYSTEM", `Lithosphäre von ${p.name} abgebaut. +75 Silizium-Kristalle & +15 Biomasse gewonnen.`);
                    if (Math.random() > 0.3) {
                        addLogEntry("CREW", encryptCrewMessage("Ing. Petrov", `Die Kruste von ${p.name} wurde aufgebrochen... Siliziumadern fließen in unsere Membranen!`));
                    }
                }

                playBioCollectSound();
                updateMutationUI();
                updateScannerUI(p, hdist);

                STATE.extractingPlanet = null;
                STATE.extractProgress = 0;
                const hprogContainer = document.getElementById('harvest-progress-container');
                if (hprogContainer) hprogContainer.style.display = 'none';
            }
        }
    }

    // --- ACTIVE ABDUCTION UPDATE LOOP ---
    if (STATE.abductActive && STATE.abductTarget) {
        const adx = STATE.playerPosition.x - STATE.abductTarget.mesh.position.x;
        const adz = STATE.playerPosition.z - STATE.abductTarget.mesh.position.z;
        const adist = Math.sqrt(adx * adx + adz * adz);

        if (adist > 22) {
            cancelAbduction("Psionische Verbindung abgerissen: Schiff driftete aus dem Orbit!");
        } else {
            STATE.abductProgress += (dt / 2.8) * 100; // 2.8s abduction
            updateAbductBeam(STATE.playerPosition, STATE.abductTarget.mesh.position);

            const aProgBar = document.getElementById('abduct-progress-bar');
            const aProgTxt = document.getElementById('abduct-progress-text');
            if (aProgBar) aProgBar.style.width = `${Math.min(100, STATE.abductProgress)}%`;
            if (aProgTxt) aProgTxt.innerText = `${Math.round(Math.min(100, STATE.abductProgress))}%`;

            if (STATE.abductProgress >= 100) {
                completeAbduction();
            }
        }
    }

    STATE.playerAcceleration.set(0, 0, 0);

    // 1. Apply Player Thrusters (WASD / Arrows)
    let isMoving = false;
    _inputDir.set(0, 0, 0);

    if (STATE.keys.w) { _inputDir.z = -1; isMoving = true; }
    if (STATE.keys.s) { _inputDir.z = 1; isMoving = true; }
    if (STATE.keys.a) { _inputDir.x = -1; isMoving = true; }
    if (STATE.keys.d) { _inputDir.x = 1; isMoving = true; }

    if (isMoving && STATE.bioEnergy > 0) {
        _inputDir.normalize();
        STATE.playerAcceleration.addScaledVector(_inputDir, STATE.thrustStrength);

        // Expend bio-energy when using thrust (balanced: 1.45 * dt for engaging survival)
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 1.45 * dt);

        // Rotate ship group towards movement direction smoothly
        const targetAngle = Math.atan2(_inputDir.x, _inputDir.z);
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

    // 2. Apply Gravitation from planets & asteroids (N-Körper-Physik) (ZERO ALLOCATION)
    let closestSource = null;
    let minSourceDist = Infinity;
    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let s = 0; s < sourceCount; s++) {
        const source = sources[s];
        if (source.isAbsorbed) continue;

        const dx = source.position.x - STATE.playerPosition.x;
        const dz = source.position.z - STATE.playerPosition.z;
        const distSq = dx * dx + dz * dz;
        const rangeSq = source.gravityRange * source.gravityRange;

        if (distSq < rangeSq && distSq > 0.01) {
            const distance = Math.sqrt(distSq);
            if (distance < minSourceDist) {
                minSourceDist = distance;
                closestSource = source;
            }

            const clampedDist = Math.max(distance, source.radius * 1.2);
            const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);
            const invDist = 1 / distance;

            STATE.playerAcceleration.x += dx * invDist * forceStrength;
            STATE.playerAcceleration.z += dz * invDist * forceStrength;
        }
    }

    // 3. Stellar Radiation / Black Hole Event Horizon Hazard
    const starSource = STATE.gravitySources.find(s => s.type === 'star');
    if (starSource) {
        const sdistSq = STATE.playerPosition.x * STATE.playerPosition.x + STATE.playerPosition.z * STATE.playerPosition.z;
        const radiationRadius = starSource.radius * 2.4;
        if (sdistSq < radiationRadius * radiationRadius) {
            const distance = Math.sqrt(sdistSq);
            const radRatio = 1 - (distance / radiationRadius);
            const burnDamage = (3.5 + radRatio * 7.0) * dt;
            STATE.health = Math.max(0, STATE.health - burnDamage);
            STATE.crew.forEach(c => c.stress = Math.min(100, c.stress + (3.0 + radRatio * 5.0) * dt));
            if (Math.random() < 0.012) {
                addLogEntry("SYSTEM", `⚠️ THERMISCHE WARNUNG: Sonnennähe zu ${starSource.name}! Zellmembranen kochen (+Strahlungsschaden).`);
                addLogEntry("CREW", encryptCrewMessage("Dr. Song", "Die Hitzeschilde glühen! Wir verbrennen lebendig, wenn wir nicht sofort abdrehen!"));
            }
        }
    }

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
                _bounceDir.subVectors(STATE.playerPosition, source.position).normalize();

                // 1. Force position correction: snap to surface immediately to prevent glitching inside
                STATE.playerPosition.copy(source.position).addScaledVector(_bounceDir, colDistance + 0.15);
                STATE.playerGroup.position.copy(STATE.playerPosition);

                // 2. Reflect velocity
                const dot = STATE.playerVelocity.dot(_bounceDir);
                if (dot < 0) {
                    STATE.playerVelocity.reflect(_bounceDir).multiplyScalar(0.4); // 40% rebound velocity
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

        // Recreate the irregular geometry (Realistic debris scaling)
        const size = 0.4 + Math.random() * 0.45;
        sourceObj.radius = size;
        sourceObj.gravityRange = size * 3;
        sourceObj.mass = size * 4;

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
    // 1. Loneliness & Existential Solitude
    if (STATE.crew.length === 0) {
        // Loneliness builds up when no minds are in the matrix
        STATE.loneliness = Math.min(100, STATE.loneliness + 1.2 * dt);
        if (STATE.loneliness > 75) {
            // Neural depression: slight bio-energy decay & hull distress
            STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 0.35 * dt);
            STATE.health = Math.max(15, STATE.health - 0.15 * dt);
        }
    } else {
        // Imprisoned minds soothe the ship's loneliness
        STATE.loneliness = Math.max(0, STATE.loneliness - 2.8 * dt * STATE.crew.length);
    }

    // 2. Individual Dream Matrix & Illusion Stability Loop
    let totalStress = 0;
    let speed = STATE.playerVelocity.length();
    let speedStressModifier = speed > 10.0 ? 0.6 : 0;
    let criticalEnergyModifier = STATE.bioEnergy < 25 ? 1.0 : 0;

    STATE.crew.forEach((c) => {
        // Illusion stability decays slowly as minds probe their surroundings
        const decayRate = (0.35 + c.stress * 0.006) * dt;
        c.illusionStability = Math.max(0, c.illusionStability - decayRate);

        if (STATE.telepathyActive && STATE.mentalEnergy > 0) {
            // Telepathy actively mends the dream matrix and calms the subject
            c.stress = Math.max(0, c.stress - 7.5 * dt);
            c.illusionStability = Math.min(100, c.illusionStability + 8.0 * dt);
            c.status = "Traum-Trance";
            c.thought = "Fühlt eine warme, beruhigende Welle... 'Alles ist friedlich.'";
        } else {
            // Natural stress growth based on illusion stability
            if (c.illusionStability < 35) {
                // Cracks in reality: High stress spike!
                c.stress = Math.min(100, c.stress + (4.5 + speedStressModifier) * dt);
                c.status = "Panik";
                c.thought = "Verzweifelt: 'Die Wände pulsieren... das ist keine Station!'";
            } else if (c.illusionStability < 65) {
                // Suspicion rising
                c.stress = Math.min(100, c.stress + (1.2 + speedStressModifier) * dt);
                c.status = "Misstrauisch";
                c.thought = "Stutzt: 'Höre ich ein Atmen in den Lüftungsschächten?'";
            } else {
                // Peaceful dream illusion
                c.stress = Math.max(0, c.stress - 2.0 * dt);
                c.status = "Arbeitet";
                c.thought = "Konzentriert: 'Sternenkartierung verläuft nach Plan.'";
            }
        }
        totalStress += c.stress;

        // Symbiotic Perks from calm minds
        if (c.illusionStability >= 50) {
            if (c.role.includes("Mechaniker") || c.role.includes("Ingenieur")) {
                STATE.health = Math.min(STATE.maxHealth, STATE.health + 0.25 * dt);
            } else if (c.role.includes("Biologin")) {
                STATE.bioRes += 0.1 * dt;
            } else if (c.role.includes("Empath") || c.species.includes("Psioniker")) {
                STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 1.5 * dt);
            }
        }

        // Panic Sabotage at extreme stress
        if (c.stress >= 85) {
            STATE.health = Math.max(0, STATE.health - 1.8 * dt);
            if (Math.random() < 0.004) {
                addLogEntry("CREW", `MATRIX-ALARM: ${c.name} greift in Panik die organische Zellwand an! (Zellschaden)`);
            }
        }
    });

    // 3. Mental energy drain/regen
    if (STATE.telepathyActive) {
        STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 6 * dt);
        if (STATE.mentalEnergy === 0) {
            toggleTelepathy();
            addLogEntry("SYSTEM", "Mentale Reserven erschöpft! Telepathische Traum-Matrix flackert.");
        }
    } else {
        const regenSpeed = STATE.mutations.synapses.purchased ? 8 * dt : 4 * dt;
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + regenSpeed);
    }

    // 4. Update UI Bars
    document.getElementById('core-health-bar').style.width = `${STATE.health}%`;
    document.getElementById('core-health-text').innerText = `${Math.round(STATE.health)}%`;

    if (STATE.health < 30) {
        document.getElementById('core-health-bar').className = "progress-bar health danger";
    } else {
        document.getElementById('core-health-bar').className = "progress-bar health";
    }

    document.getElementById('bio-energy-bar').style.width = `${STATE.bioEnergy}%`;
    document.getElementById('bio-energy-text').innerText = `${Math.round(STATE.bioEnergy)}%`;

    document.getElementById('telepathy-energy-bar').style.width = `${(STATE.mentalEnergy / STATE.maxMentalEnergy) * 100}%`;
    document.getElementById('telepathy-energy-text').innerText = `${Math.round(STATE.mentalEnergy)}/${STATE.maxMentalEnergy}`;

    // Passive Engineer Repair (Consumes tiny silicon to restore organic hull)
    if (STATE.crewBuffs && STATE.crewBuffs.repairRate > 0 && STATE.siliconRes >= 0.05 && STATE.health < STATE.maxHealth) {
        STATE.health = Math.min(STATE.maxHealth, STATE.health + STATE.crewBuffs.repairRate * dt);
        STATE.siliconRes = Math.max(0, STATE.siliconRes - 0.04 * dt);
    }

    // Dynamic Loneliness & Satiety Decay System
    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;
    const totalCrew = STATE.crew.length;

    let targetLoneliness = 100;
    let isHarmony = false;

    if (totalCrew === 0) {
        targetLoneliness = 100;
    } else if (totalCrew === 1) {
        STATE.crewSatietyTimer += dt;
        // Over 90 seconds, loneliness slowly drifts from 40% up to 65% (needs companion/diversity)
        const decay = Math.min(25, (STATE.crewSatietyTimer / 90) * 25);
        targetLoneliness = 40 + decay;
    } else if (uniqueRoles === 2) {
        targetLoneliness = 25;
    } else if (uniqueRoles >= 3) {
        targetLoneliness = 5;
        isHarmony = true;
    }

    if (STATE.loneliness < targetLoneliness) {
        STATE.loneliness = Math.min(targetLoneliness, STATE.loneliness + 4 * dt);
    } else if (STATE.loneliness > targetLoneliness) {
        STATE.loneliness = Math.max(targetLoneliness, STATE.loneliness - 8 * dt);
    }

    // Kosmische Harmonie bonus: +15% energy & mental regen
    if (isHarmony) {
        STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + 0.5 * dt);
        STATE.bioEnergy = Math.min(STATE.maxBioEnergy, STATE.bioEnergy + 0.3 * dt);
    }

    // Multi-Crew Periodic Interactive Dialogue
    STATE.crewDialogueTimer -= dt;
    if (STATE.crewDialogueTimer <= 0 && STATE.crew.length >= 2) {
        STATE.crewDialogueTimer = 20 + Math.random() * 8;
        triggerMultiCrewDialogue();
    }

    // Loneliness Bar update
    const loneBar = document.getElementById('loneliness-bar');
    const loneTxt = document.getElementById('loneliness-text');
    if (loneBar) loneBar.style.width = `${STATE.loneliness}%`;
    if (loneTxt) {
        let loneState = "Verzweiflung";
        if (isHarmony) loneState = "💫 Kosmische Harmonie";
        else if (STATE.loneliness < 25) loneState = "Geborgen";
        else if (STATE.loneliness < 50) loneState = "Stabil";
        else if (STATE.loneliness < 75) loneState = "Eintönig";
        loneTxt.innerText = `${Math.round(STATE.loneliness)}% (${loneState})`;
    }

    // Passive decay of bioEnergy over time
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 0.40 * dt);

    // Core damages if no energy left
    if (STATE.bioEnergy <= 0) {
        STATE.health = Math.max(0, STATE.health - 2 * dt);
        if (Math.random() < 0.005) {
            addLogEntry("SYSTEM", "Kritischer Nahrungsmangel. Organismus verhungert (-2 Kernintegrität).");
        }
    }

    // Render Matrix / Crew Deck
    renderCrewUI();
}

function renderCrewUI() {
    const container = document.getElementById('crew-list-container');
    const badge = document.getElementById('crew-count-badge');
    const capText = document.getElementById('crew-capacity-text');
    const synTitle = document.getElementById('crew-synergy-title');
    const synDesc = document.getElementById('crew-synergy-desc');
    const synBanner = document.getElementById('crew-synergy-banner');

    if (badge) badge.innerText = STATE.crew.length;
    if (capText) capText.innerText = `${STATE.crew.length} / ${STATE.maxCrewCapacity}`;

    const uniqueRoles = new Set(STATE.crew.map(c => c.role)).size;
    const totalCrew = STATE.crew.length;

    if (synBanner && synTitle && synDesc) {
        if (totalCrew === 0) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = "🌌 Kosmische Einsamkeit";
            synDesc.innerText = "Keine Geister an Bord. Das Wesen sehnt sich nach Gedanken-Resonanz.";
        } else if (totalCrew === 1) {
            if (STATE.crewSatietyTimer > 45) {
                synBanner.className = 'crew-synergy-banner satiety-decay';
                synTitle.innerText = "⏳ Geistige Sättigung (Eintönigkeit)";
                synDesc.innerText = "Alle Gedanken des Individuums erforscht. Das Wesen verlangt nach neuen Perspektiven!";
            } else {
                synBanner.className = 'crew-synergy-banner';
                synTitle.innerText = "🌱 Erste Gedanken-Resonanz";
                synDesc.innerText = "1 Geist an Bord. Erweitere das Kollektiv für stärkere Synergien.";
            }
        } else if (uniqueRoles === 2) {
            synBanner.className = 'crew-synergy-banner';
            synTitle.innerText = "✨ Duale Resonanz";
            synDesc.innerText = "2 Rollen im Einklang. Einsamkeit stabil, passive Buffs verstärkt.";
        } else if (uniqueRoles >= 3) {
            synBanner.className = 'crew-synergy-banner harmony';
            synTitle.innerText = "💫 Kosmische Harmonie";
            synDesc.innerText = "Diverses Kollektiv aktiv! Einsamkeit auf 0% & +15% Bio/Mental-Regeneration!";
        }
    }

    if (!container) return;

    if (STATE.crew.length === 0) {
        container.innerHTML = `
            <div class="matrix-empty-card">
                <span class="highlight">Keine Vernunftbegabten Wesen</span>
                Die psionische Traum-Matrix ist leer. Das Schiff leidet unter existenzieller kosmischer Einsamkeit.<br><br>
                <em>Scanne habitable Planeten nach intelligentem Leben und starte eine psionische Entführung [F]!</em>
            </div>
        `;
        return;
    }

    let html = '';
    STATE.crew.forEach(c => {
        let cardClass = 'crew-member';
        if (c.illusionStability < 35 || c.stress > 70) cardClass += ' panic';
        else if (c.illusionStability < 65 || c.stress > 45) cardClass += ' suspicious';

        html += `
            <div class="${cardClass}">
                <div class="crew-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="crew-name" style="font-weight: 700; color: #f8fafc; font-size: 0.8rem;">${c.name}</span>
                    <span class="crew-role-badge">${c.roleIcon || '👤'} ${c.roleName || c.role}</span>
                </div>
                <div class="crew-buff-tag">⚡ ${c.buffDesc || c.perk}</div>
                
                <div class="stability-container">
                    <span class="stability-label">Traum-Stabilität:</span>
                    <div class="stability-bar-bg">
                        <div class="stability-bar" style="width: ${c.illusionStability}%;"></div>
                    </div>
                    <span style="color: #a855f7; font-size: 0.68rem; font-weight: 700;">${Math.round(c.illusionStability)}%</span>
                </div>

                <div class="stress-container" style="display: flex; align-items: center; gap: 6px;">
                    <span class="stress-label" style="width: 90px; font-size: 0.68rem; color: #94a3b8;">Stress:</span>
                    <div class="stress-bar-bg" style="flex: 1; height: 5px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
                        <div class="stress-bar" style="width: ${c.stress}%; height: 100%; background: ${c.stress > 70 ? '#ef4444' : '#f59e0b'};"></div>
                    </div>
                    <span class="stress-percentage" style="font-size: 0.68rem;">${Math.round(c.stress)}%</span>
                </div>

                <div class="thought-whisper ${c.illusionStability < 35 ? 'terrified' : ''}">
                    💭 "${c.thought}"
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- CREW BUFFS & MULTI-CREW DIALOGUE SYSTEM ---

function calculateCrewBuffs() {
    let thrustMult = 1.0;
    let bioMult = 1.0;
    let scanMult = 1.0;
    let repair = 0;
    let stressDamp = 1.0;
    let psioBonus = 0;

    const hiveBonus = STATE.mutations.hivemind && STATE.mutations.hivemind.purchased ? 1.2 : 1.0;

    STATE.crew.forEach(c => {
        if (c.role === 'pilot') thrustMult += 0.15 * hiveBonus;
        if (c.role === 'biologist') {
            bioMult += 0.30 * hiveBonus;
            scanMult += 0.25 * hiveBonus;
        }
        if (c.role === 'engineer') repair += 0.6 * hiveBonus;
        if (c.role === 'psychologist') stressDamp *= (1.0 - 0.40 * hiveBonus);
        if (c.role === 'cryptologist') psioBonus += 30 * hiveBonus;
    });

    STATE.crewBuffs = {
        thrust: thrustMult,
        bioGain: bioMult,
        scanSpeed: scanMult,
        repairRate: repair,
        stressDampening: stressDamp,
        psionicBonus: Math.round(psioBonus)
    };

    const basePsio = STATE.mutations.synapses && STATE.mutations.synapses.purchased ? 140 : 75;
    STATE.psionicRange = basePsio + STATE.crewBuffs.psionicBonus;
}

const crewDialogueBank = {
    pilot_engineer: [
        { lineA: 'Miller: "Petrov, diese biomolekularen Trägheitsdämpfer... das Schiff richtet die Schubvektoren aus, bevor ich überhaupt lenke."', lineB: 'Petrov: "Die Naniten im Chitin leiten unsere Gedanken direkt weiter. Das ist kein Raumschiff, das ist ein lebendes Cockpit."' },
        { lineA: 'Miller: "Wie sieht die Hüllenintegrität aus, wenn wir durch Asteroidengürtel tauchen?"', lineB: 'Petrov: "Silizium-Naniten schließen Risse im Flug. Solange wir Mineralien aufnehmen, hält die organische Panzerung stand."' }
    ],
    biologist_psychologist: [
        { lineA: 'Dr. Song: "Die Traum-Matrix synchronisiert unsere neuronalen REM-Phasen. Es absorbiert nicht unsere Körper, sondern unsere Gefühle."', lineB: 'Dr. Vance: "Ein psionischer Stoffwechsel. Solange wir Gelassenheit und Zuversicht ausstrahlen, ernährt sich die Entität von Harmonie statt Verzweiflung."' },
        { lineA: 'Dr. Song: "Die Biolumineszenz an den Synapsen-Wänden pulsiert im Takt unseres Herzschlags."', lineB: 'Dr. Vance: "Ein biologischer Resonanzraum. Wir halten das Wesen am Leben – und es beschützt uns vor der tödlichen Kälte des Alls."' }
    ],
    cryptologist_pilot: [
        { lineA: 'Novak: "Ich fange schwache Tachyonen-Echos aus dem nächsten Sternensystem auf. Psio-Sensorhorizont erweitert."', lineB: 'Miller: "Kurs ist korrigiert, Novak. Bringen wir uns in den nächsten planetaren Orbit."' }
    ],
    engineer_biologist: [
        { lineA: 'Petrov: "Dr. Song, die organischen Leitungen um die Faltungsmembran regenerieren erstaunlich schnell."', lineB: 'Dr. Song: "Es ist ein symbiotisches Ökosystem. Jede Ressource, die wir assimilieren, stärkt die Zellwände des Schiffes."' }
    ],
    general: [
        { lineA: 'Crew-Funk: "Die Traum-Matrix flüstert Erinnerungen an Sternensysteme, die Lichtjahre entfernt liegen..."', lineB: 'Crew-Funk: "Wir reisen durch das Herz einer Galaxie, die kein Mensch zuvor erblickt hat."' }
    ]
};

function triggerMultiCrewDialogue() {
    if (STATE.crew.length < 2) return;

    const hasTranslator = STATE.mutations.translator && STATE.mutations.translator.purchased;

    const c1 = STATE.crew[Math.floor(Math.random() * STATE.crew.length)];
    const others = STATE.crew.filter(c => c !== c1);
    const c2 = others[Math.floor(Math.random() * others.length)];

    let pairKey = `${c1.role}_${c2.role}`;
    let revPairKey = `${c2.role}_${c1.role}`;
    let dialogues = crewDialogueBank[pairKey] || crewDialogueBank[revPairKey] || crewDialogueBank.general;

    const dialog = dialogues[Math.floor(Math.random() * dialogues.length)];

    const name1 = c1.name.split(' ')[1] || c1.name;
    const name2 = c2.name.split(' ')[1] || c2.name;

    if (hasTranslator) {
        addLogEntry("CREW", dialog.lineA.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name1));
        setTimeout(() => {
            addLogEntry("CREW", dialog.lineB.replace("Miller", name1).replace("Petrov", name2).replace("Dr. Song", c1.name).replace("Dr. Vance", c2.name).replace("Novak", name2));
        }, 3200);
    } else {
        addLogEntry("CREW", `[Verschlüsselter Datenstrom zwischen ${c1.name} & ${c2.name}... Dschinn-Übersetzer benötigt!]`);
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

    const count = 60;
    const posAttr = trajectoryPoints.geometry.attributes.position;
    const colorAttr = trajectoryPoints.geometry.attributes.color;
    const positions = posAttr.array;
    const colors = colorAttr.array;

    // Copy current state into pre-allocated vectors (ZERO ALLOCATION)
    _predPos.copy(STATE.playerPosition);
    _predVel.copy(STATE.playerVelocity);
    _predAcc.set(0, 0, 0);

    // Check input acceleration
    let isMoving = false;
    _inputDir.set(0, 0, 0);
    if (STATE.keys.w) { _inputDir.z = -1; isMoving = true; }
    if (STATE.keys.s) { _inputDir.z = 1; isMoving = true; }
    if (STATE.keys.a) { _inputDir.x = -1; isMoving = true; }
    if (STATE.keys.d) { _inputDir.x = 1; isMoving = true; }

    _thrustAcc.set(0, 0, 0);
    if (isMoving && STATE.bioEnergy > 0) {
        _inputDir.normalize();
        _thrustAcc.addScaledVector(_inputDir, STATE.thrustStrength);
    }

    // Base RGB values (purple if telepathy active, cyan if normal)
    const baseR = STATE.telepathyActive ? 0.659 : 0.22;
    const baseG = STATE.telepathyActive ? 0.333 : 0.741;
    const baseB = STATE.telepathyActive ? 0.969 : 0.973;

    const stepDt = 0.04; // 40ms simulation steps
    const sources = STATE.gravitySources;
    const sourceCount = sources.length;

    for (let i = 0; i < count; i++) {
        _predAcc.copy(_thrustAcc);

        // Apply gravity from celestial sources (Fast scalar math)
        for (let s = 0; s < sourceCount; s++) {
            const source = sources[s];
            if (source.isAbsorbed) continue;

            const dx = source.position.x - _predPos.x;
            const dz = source.position.z - _predPos.z;
            const distSq = dx * dx + dz * dz;
            const rangeSq = source.gravityRange * source.gravityRange;

            if (distSq < rangeSq && distSq > 0.01) {
                const distance = Math.sqrt(distSq);
                const clampedDist = Math.max(distance, source.radius * 1.1);
                const forceStrength = (STATE.gConstant * source.mass) / (clampedDist * clampedDist);
                const invDist = 1 / distance;
                _predAcc.x += dx * invDist * forceStrength;
                _predAcc.z += dz * invDist * forceStrength;
            }
        }

        // Integrate equations of motion
        _predVel.x += _predAcc.x * stepDt;
        _predVel.z += _predAcc.z * stepDt;
        const dragFactor = Math.exp(-STATE.currentDrag * stepDt);
        _predVel.x *= dragFactor;
        _predVel.z *= dragFactor;
        _predPos.x += _predVel.x * stepDt;
        _predPos.z += _predVel.z * stepDt;

        // Store point
        positions[i * 3] = _predPos.x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = _predPos.z;

        // Fade colors inline without memory allocations
        const t = i / count;
        const fade = (1 - t * 0.95);
        colors[i * 3] = baseR * fade;
        colors[i * 3 + 1] = baseG * fade;
        colors[i * 3 + 2] = baseB * fade;
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

// =========================================================================
// --- PHASE 17: 3D MOUSE RAYCASTING & GAMEPAD / STEAM DECK CONTROLS ---
// =========================================================================

let targetReticleGroup = null;
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

function createTargetReticle() {
    if (targetReticleGroup) return;
    targetReticleGroup = new THREE.Group();

    // 1. Inner spinning dashed targeting ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.4, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    targetReticleGroup.add(ringMesh);

    // 2. Outer corner brackets
    const boxGeo = new THREE.RingGeometry(1.55, 1.7, 4);
    boxGeo.rotateX(Math.PI / 2);
    boxGeo.rotateY(Math.PI / 4);
    const boxMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    targetReticleGroup.add(boxMesh);

    targetReticleGroup.visible = false;
    scene.add(targetReticleGroup);
}

function setupTargetRaycasting() {
    createTargetReticle();

    let pointerDownPos = { x: 0, y: 0 };
    window.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) return;

        if (e.target.closest('#hud-container') || e.target.closest('#galaxy-map-overlay') || e.target.closest('#main-menu') || e.target.closest('#how-to-play-modal')) {
            return;
        }

        if (!STATE.gameStarted || !renderer || !camera) return;

        mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouseVec, camera);

        const targetMeshes = [];
        activePlanets.forEach(p => {
            if (p.bodyMesh) targetMeshes.push(p.bodyMesh);
            if (p.mesh && p.mesh !== p.bodyMesh) targetMeshes.push(p.mesh);
        });

        const intersects = raycaster.intersectObjects(targetMeshes, true);
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const target = activePlanets.find(p => p.bodyMesh === hitObject || p.mesh === hitObject || (p.mesh && p.mesh.children && p.mesh.children.includes(hitObject)));
            if (target) {
                setLockedTarget(target);
                return;
            }
        }

        if (STATE.lockedTarget) {
            clearLockedTarget();
        }
    });

    const unlockBtn = document.getElementById('unlock-target-btn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearLockedTarget();
        });
    }
}

function setLockedTarget(target) {
    if (!target) return;
    STATE.lockedTarget = target;
    playLockOnSound();
    const typeLabel = target.isMoon ? `Mond (${target.type})` : target.type;
    addLogEntry("SYSTEM", `🎯 ZIEL MANUELL FIXIERT: ${target.name} [${typeLabel}]. Scanner ausgerichtet.`);
    updateTargetLockBadgeUI();
}

function clearLockedTarget() {
    if (STATE.lockedTarget) {
        addLogEntry("SYSTEM", `Ziel fixierung aufgehoben. Automatischer Distanz-Sensor aktiv.`);
    }
    STATE.lockedTarget = null;
    updateTargetLockBadgeUI();
}

function cycleTarget(direction = 1) {
    if (!activePlanets || activePlanets.length === 0) return;

    const sorted = [...activePlanets].sort((a, b) => {
        const da = a.mesh.position.distanceTo(STATE.playerPosition);
        const db = b.mesh.position.distanceTo(STATE.playerPosition);
        return da - db;
    });

    if (!STATE.lockedTarget) {
        setLockedTarget(sorted[0]);
    } else {
        const curIdx = sorted.findIndex(p => p.name === STATE.lockedTarget.name);
        let nextIdx = (curIdx + direction + sorted.length) % sorted.length;
        setLockedTarget(sorted[nextIdx]);
    }
}

function updateTargetLockBadgeUI() {
    const badge = document.getElementById('target-lock-badge');
    const label = document.getElementById('target-label-text');
    if (badge) {
        badge.style.display = STATE.lockedTarget ? 'flex' : 'none';
    }
    if (label) {
        label.innerText = STATE.lockedTarget ? 'Fixiertes Ziel:' : 'Nächster Planet:';
    }
}

function playLockOnSound() {
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

// --- GAMEPAD & STEAM DECK API HANDLER ---
let prevGpButtons = [];

window.addEventListener("gamepadconnected", (e) => {
    addLogEntry("SYSTEM", `🎮 GAMEPAD VERBUNDEN: ${e.gamepad.id} erkannt.`);
});

window.addEventListener("gamepaddisconnected", () => {
    addLogEntry("SYSTEM", `Gamepad getrennt.`);
});

function pollGamepadControls(dt) {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
            gp = gamepads[i];
            break;
        }
    }
    if (!gp) return;

    // 1. Left Analog Stick (Axes 0 = X, Axes 1 = Y)
    const deadzone = 0.15;
    let stickX = gp.axes[0] || 0;
    let stickY = gp.axes[1] || 0;
    if (Math.abs(stickX) < deadzone) stickX = 0;
    if (Math.abs(stickY) < deadzone) stickY = 0;

    // D-Pad buttons fallback
    if (gp.buttons[12] && gp.buttons[12].pressed) stickY = -1.0;
    if (gp.buttons[13] && gp.buttons[13].pressed) stickY = 1.0;
    if (gp.buttons[14] && gp.buttons[14].pressed) stickX = -1.0;
    if (gp.buttons[15] && gp.buttons[15].pressed) stickX = 1.0;

    // Process user movement keys
    _inputDir.set(0, 0, 0);
    if (STATE.keys.w) _inputDir.z -= 1;
    if (STATE.keys.s) _inputDir.z += 1;
    if (STATE.keys.a) _inputDir.x -= 1;
    if (STATE.keys.d) _inputDir.x += 1;

    const isThrusting = _inputDir.lengthSq() > 0 || Math.abs(stickX) > 0 || Math.abs(stickY) > 0;
    if (isThrusting) {
        if (_inputDir.lengthSq() === 0) {
            _inputDir.set(stickX, 0, stickY);
        }
        _inputDir.normalize();

        const thrustMult = (STATE.crewBuffs ? STATE.crewBuffs.thrust : 1.0);
        const thrust = STATE.thrustStrength * thrustMult * dt;
        STATE.playerVelocity.x += _inputDir.x * thrust;
        STATE.playerVelocity.z += _inputDir.z * thrust;

        // Drain Bio-Energy when moving (Pilot role provides -15% fuel efficiency)
        const fuelCostMult = STATE.crew.some(c => c.role === 'pilot') ? 0.85 : 1.0;
        STATE.bioEnergy = Math.max(0, STATE.bioEnergy - 0.08 * fuelCostMult * dt);

        if (STATE.playerGroup) {
            const angle = Math.atan2(_inputDir.x, _inputDir.z);
            STATE.playerGroup.rotation.y = angle;
        }

        setThrusterSound(true);
        if (typeof spawnEngineParticle === 'function') {
            spawnEngineParticle();
        }
    }

    // 2. Left Trigger (Button 6) = Hold Telepathic Calming Field
    const ltPressed = (gp.buttons[6] && gp.buttons[6].pressed) || (gp.buttons[6] && gp.buttons[6].value > 0.3);
    if (ltPressed && !STATE.telepathyActive) {
        toggleTelepathy();
    } else if (!ltPressed && STATE.telepathyActive && !STATE.keys.Space) {
        toggleTelepathy();
    }

    // 3. Edge-triggered Buttons
    function isPressedEdge(btnIdx) {
        const btn = gp.buttons[btnIdx];
        const isDown = btn ? (btn.pressed || btn.value > 0.5) : false;
        const wasDown = prevGpButtons[btnIdx] || false;
        return isDown && !wasDown;
    }

    // Button A (0): Scan / Abduct
    if (isPressedEdge(0)) {
        if (STATE.nearestPlanet) {
            const isScanned = STATE.nearestPlanet.scanned || STATE.scannedPlanets[STATE.nearestPlanet.name];
            if (isScanned && STATE.nearestPlanet.attributes.species && STATE.nearestPlanet.attributes.species.population > 0) {
                triggerAbductStart();
            } else {
                triggerScanStart();
            }
        }
    }

    // Button X (2): Harvest / Assimilate
    if (isPressedEdge(2)) {
        triggerHarvestStart();
    }

    // Button Y (3): Psionic Sonar Call
    if (isPressedEdge(3)) {
        triggerPsionicSonar();
    }

    // Button B (1): Unlock target or close modal
    if (isPressedEdge(1)) {
        if (mapOpen) {
            toggleGalaxyMap();
        } else if (STATE.lockedTarget) {
            clearLockedTarget();
        }
    }

    // Bumpers LB (4) & RB (5): Cycle Target
    if (isPressedEdge(4)) cycleTarget(-1);
    if (isPressedEdge(5)) cycleTarget(1);

    // Select / View (8): Toggle Galaxy Map
    if (isPressedEdge(8)) toggleGalaxyMap();

    // Start / Menu (9): Toggle Main Menu / Pause
    if (isPressedEdge(9)) {
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu && STATE.gameStarted) {
            mainMenu.classList.toggle('menu-hidden');
        }
    }

    prevGpButtons = gp.buttons.map(b => b ? (b.pressed || b.value > 0.5) : false);
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

function disposeHierarchy(obj) {
    if (!obj) return;
    if (obj.children) {
        while (obj.children.length > 0) {
            disposeHierarchy(obj.children[0]);
            obj.remove(obj.children[0]);
        }
    }
    if (obj.geometry) {
        obj.geometry.dispose();
    }
    if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(mat => {
            if (mat.map) mat.map.dispose();
            if (mat.bumpMap) mat.bumpMap.dispose();
            if (mat.emissiveMap) mat.emissiveMap.dispose();
            if (mat.normalMap) mat.normalMap.dispose();
            mat.dispose();
        });
    }
}

function clearActiveSystem() {
    if (targetReticleGroup) {
        targetReticleGroup.visible = false;
    }
    STATE.lockedTarget = null;
    updateTargetLockBadgeUI();

    STATE.gravitySources.forEach(source => {
        if (source.mesh) {
            scene.remove(source.mesh);
            disposeHierarchy(source.mesh);
        }
        if (source.light) scene.remove(source.light);
        if (source.diskMesh) {
            scene.remove(source.diskMesh);
            disposeHierarchy(source.diskMesh);
        }
    });

    gravityCircles.forEach(circle => {
        if (circle.mesh) {
            scene.remove(circle.mesh);
            disposeHierarchy(circle.mesh);
        }
    });

    activePlanets.forEach(p => {
        if (p.mesh) {
            scene.remove(p.mesh);
            disposeHierarchy(p.mesh);
        }
        if (p.ringMesh) {
            scene.remove(p.ringMesh);
            disposeHierarchy(p.ringMesh);
        }
    });

    // Clear scan visuals if active during warp
    stopScanSound();
    if (scanVisualMesh) {
        scene.remove(scanVisualMesh);
        disposeHierarchy(scanVisualMesh);
        scanVisualMesh = null;
    }
    STATE.scanningPlanet = null;
    STATE.scanProgress = 0;
    const progContainer = document.getElementById('scan-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    // Clear harvest visuals if active during warp
    stopHarvestSound();
    removeHarvestBeam();
    STATE.extractingPlanet = null;
    STATE.extractProgress = 0;
    const harvestProgContainer = document.getElementById('harvest-progress-container');
    if (harvestProgContainer) harvestProgContainer.style.display = 'none';

    STATE.gravitySources = [];
    STATE.asteroids = [];
    gravityCircles = [];
    activePlanets = [];
}

// --- MINIMAP RADAR DRAW LOGIC (HIGH-PERFORMANCE) ---
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
    const invRangeRadius = radius / range;
    const rangeSq = range * range;

    // 3. Draw Central Star (0, 0 in world coordinates)
    const sdx = -STATE.playerPosition.x;
    const sdz = -STATE.playerPosition.z;
    const sdistSq = sdx * sdx + sdz * sdz;

    if (sdistSq < rangeSq) {
        const scx = cx + sdx * invRangeRadius;
        const scy = cy + sdz * invRangeRadius;
        const starPulse = 6 + Math.sin(Date.now() * 0.008) * 1.5;

        let starColor = "#f59e0b"; // Yellow default
        if (STATE.universe && STATE.universe.systems && STATE.universe.systems[STATE.currentSystemId]) {
            const sys = STATE.universe.systems[STATE.currentSystemId];
            if (sys.star && sys.star.colorCss) {
                starColor = sys.star.colorCss;
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

    // 4. Draw Celestial Bodies (Planets and Moons)
    const planCount = activePlanets.length;
    for (let i = 0; i < planCount; i++) {
        const p = activePlanets[i];
        const pdx = p.mesh.position.x - STATE.playerPosition.x;
        const pdz = p.mesh.position.z - STATE.playerPosition.z;
        const pdistSq = pdx * pdx + pdz * pdz;

        if (pdistSq < rangeSq) {
            const pcx = cx + pdx * invRangeRadius;
            const pcy = cy + pdz * invRangeRadius;
            const dotSize = p.isMoon ? 2.5 : 4.5;
            const haloSize = p.isMoon ? 5.0 : 8.0;

            minimapCtx.fillStyle = p.colorCss || "#38bdf8";
            minimapCtx.beginPath();
            minimapCtx.arc(pcx, pcy, dotSize, 0, Math.PI * 2);
            minimapCtx.fill();

            // Draw scanned / harvested indicator halo
            if (p.harvested || STATE.harvestedPlanets[p.name]) {
                minimapCtx.strokeStyle = "rgba(148, 163, 184, 0.35)"; // Dim slate
                minimapCtx.lineWidth = 1;
                minimapCtx.beginPath();
                minimapCtx.arc(pcx, pcy, haloSize, 0, Math.PI * 2);
                minimapCtx.stroke();
            } else if (p.scanned || STATE.scannedPlanets[p.name]) {
                minimapCtx.strokeStyle = "rgba(0, 255, 136, 0.6)"; // Bright green
                minimapCtx.lineWidth = 1;
                minimapCtx.beginPath();
                minimapCtx.arc(pcx, pcy, haloSize, 0, Math.PI * 2);
                minimapCtx.stroke();
            }

            // Draw Psionic Thought Beacon Waves if sentient life exists on this world!
            if (p.attributes && p.attributes.species && p.attributes.species.population > 0) {
                const pulseProg = (Date.now() % 1600) / 1600;
                const pulseR = haloSize + pulseProg * 14;
                const alpha = (1 - pulseProg) * 0.85;
                minimapCtx.strokeStyle = `rgba(217, 70, 239, ${alpha})`;
                minimapCtx.lineWidth = 1.5;
                minimapCtx.beginPath();
                minimapCtx.arc(pcx, pcy, pulseR, 0, Math.PI * 2);
                minimapCtx.stroke();
            }
        }
    }

    // 5. Draw Asteroids (Active resources)
    const astCount = STATE.asteroids.length;
    for (let i = 0; i < astCount; i++) {
        const ast = STATE.asteroids[i];
        if (ast.harvested) continue;

        const adx = ast.mesh.position.x - STATE.playerPosition.x;
        const adz = ast.mesh.position.z - STATE.playerPosition.z;
        const adistSq = adx * adx + adz * adz;

        if (adistSq < rangeSq) {
            const acx = cx + adx * invRangeRadius;
            const acy = cy + adz * invRangeRadius;

            minimapCtx.fillStyle = ast.type === 'bio' ? "rgba(0, 255, 136, 0.7)" : "rgba(56, 189, 248, 0.7)";
            minimapCtx.beginPath();
            minimapCtx.arc(acx, acy, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    }

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

    let atmos, temp, bio, res, species;
    if (p.type === 'Habitable') {
        atmos = hash % 2 === 0 ? "Stickstoff & Sauerstoff (Klasse M)" : "Dichte Aerosole & Wasserdampf";
        temp = (15 + (hash % 15)) + "°C";
        bio = hash % 3 === 0 ? "Biolumineszierende Flora" : (hash % 3 === 1 ? "Mikrobielle Kolonien" : "Komplexes Ökosystem");
        res = "Reich an Biomasse, Kohlenstoff & O2";

        // Sentient species candidates pool for abduction with distinct specialist roles
        const candidatePool = [
            { name: "Capt. Alan Miller", species: "Mensch / Terraner", role: "pilot", roleName: "🧑‍✈️ Chef-Navigator", buffDesc: "+15% Schub & -15% Manöverkosten", baseStressRate: 0.30 },
            { name: "Dr. Elena Song", species: "Mensch / Terranerin", role: "biologist", roleName: "🔬 Xenobiologin", buffDesc: "+30% Bio-Ertrag & +25% Scan-Speed", baseStressRate: 0.25 },
            { name: "Ing. Viktor Petrov", species: "Mensch / Terraner", role: "engineer", roleName: "🔧 Chef-Ingenieur", buffDesc: "+0.6 HP/s Naniten-Reparatur", baseStressRate: 0.40 },
            { name: "Dr. Julian Vance", species: "Mensch / Terraner", role: "psychologist", roleName: "🧘 Neuro-Therapeut", buffDesc: "-40% Crew-Stressaufbau", baseStressRate: 0.15 },
            { name: "Lt. Kira Novak", species: "Mensch / Terranerin", role: "cryptologist", roleName: "📡 Quanten-Kryptologin", buffDesc: "+30 LJ Psio-Sensorhorizont", baseStressRate: 0.20 },
            { name: "Prof. T'Kora", species: "Vulkanoid", role: "biologist", roleName: "🔬 Bio-Analytikerin", buffDesc: "+30% Bio-Ertrag & +25% Scan-Speed", baseStressRate: 0.10 },
            { name: "Cyber-Adept Rex", species: "Cyborg-Pionier", role: "engineer", roleName: "🔧 Naniten-Meister", buffDesc: "+0.6 HP/s Naniten-Reparatur", baseStressRate: 0.20 },
            { name: "Gesandte Maya", species: "Empathin", role: "psychologist", roleName: "🧘 Gedanken-Diplomatin", buffDesc: "-40% Crew-Stressaufbau", baseStressRate: 0.12 }
        ];

        const c1 = candidatePool[hash % candidatePool.length];
        const c2 = candidatePool[(hash + 3) % candidatePool.length];
        const pool = [
            { ...c1, id: Date.now() + Math.random(), stress: 15, illusionStability: 100, status: "Friedlich", thought: "Arbeitet auf der Forschungsstation..." }
        ];
        if (hash % 2 === 0) {
            pool.push({ ...c2, id: Date.now() + Math.random() + 1, stress: 25, illusionStability: 100, status: "Friedlich", thought: "Führt Atmosphärenmessungen durch..." });
        }

        species = {
            hasSentient: true,
            name: pool[0].species.includes("Mensch") ? "Terranische Exploratoren" : `${pool[0].species}-Präsenz`,
            population: pool.length,
            candidates: pool
        };
    } else if (p.type === 'Gas Giant') {
        atmos = hash % 2 === 0 ? "Flüssiges Helium & Wasserstoff" : "Superdichtes Ammoniak & Methan";
        temp = (-120 - (hash % 60)) + "°C";
        bio = hash % 5 === 0 ? "Schwebende Plankton-Analoge" : "Keine Signaturen erfasst";
        res = "Extrem hoher Druck, Deuterium-Vorkommen";
        species = null;
    } else { // Rocky
        atmos = hash % 3 === 0 ? "Dünnes CO2-Vakuum" : (hash % 3 === 1 ? "Schwefeldioxid & Argon" : "Keine Atmosphäre (Vakuum)");
        temp = (hash % 2 === 0 ? "+" : "-") + (hash % 250) + "°C";
        bio = hash % 8 === 0 ? "Extremophile Flechten" : "Steril";
        res = "Reich an Silizium-Kristallen, Eisen & Schwermetallen";
        species = null;
    }

    return { atmos, temp, bio, res, species };
}

function generateFallbackMoons(p) {
    const hash = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let count = 0;
    if (p.type === 'Gas Giant') count = 1 + (hash % 3);
    else if (p.type === 'Habitable') count = hash % 3;
    else count = hash % 2;

    const moons = [];
    for (let i = 0; i < count; i++) {
        const mType = (p.type === 'Gas Giant' || (hash + i) % 3 === 0) ? "Eismond" : (((hash + i) % 3 === 1) ? "Vulkanmond" : "Kratermond");
        const mColor = mType === 'Eismond' ? "0x38bdf8" : (mType === 'Vulkanmond' ? "0xf97316" : "0x94a3b8");
        moons.push({
            name: `${p.name}-${String.fromCharCode(73 + i)}`,
            type: mType,
            size: 0.7 + ((hash + i) % 5) * 0.1,
            distance: p.size + 3.2 + (i * 2.5),
            speed: 0.9 + ((hash + i) % 6) * 0.15,
            color: mColor,
            temp: mType === 'Eismond' ? "-170°C" : (mType === 'Vulkanmond' ? "+220°C" : "-40°C"),
            atmos: mType === 'Eismond' ? "Subglazialer Wasserdampf" : (mType === 'Vulkanmond' ? "Schwefeldioxid-Ausgasungen" : "Vakuum"),
            bio: mType === 'Eismond' ? "Kryophile Mikroben" : (mType === 'Vulkanmond' ? "Schwefel-Synthetisierer" : "Steril"),
            res: mType === 'Eismond' ? "Reich an Deuterium-Eis" : (mType === 'Vulkanmond' ? "Geschmolzenes Titan & Silizium" : "Regolith & Schwermetalle")
        });
    }
    return moons;
}

function generateMoonAttributes(m) {
    if (m.type === 'Eismond') {
        return {
            atmos: "Subglazialer Wasserdampf (Geysire)",
            temp: "-175°C",
            bio: "Kryophile Mikroben",
            res: "Reich an Deuterium-Eis & gefrorenem Ammoniak"
        };
    } else if (m.type === 'Vulkanmond') {
        return {
            atmos: "Schwefeldioxid-Ausgasungen",
            temp: "+240°C",
            bio: "Schwefel-Synthetisierer",
            res: "Geschmolzenes Titan, Schwefel & Silizium"
        };
    } else {
        return {
            atmos: "Vakuum (Keine Atmosphäre)",
            temp: "-80°C",
            bio: "Steril",
            res: "Regolith-Gestein, Nickel & Schwermetalle"
        };
    }
}

function updateScannerUI(closest, dist) {
    const nameSpan = document.getElementById('nearest-planet-name');
    const distSpan = document.getElementById('nearest-planet-distance');
    const scanBtn = document.getElementById('start-scan-btn');
    const placeholder = document.getElementById('scan-placeholder-box');
    const results = document.getElementById('scan-results-box');
    const harvestBtn = document.getElementById('start-harvest-btn');
    const abductBtn = document.getElementById('start-abduct-btn');
    const statusBadge = document.getElementById('scan-planet-status');
    const speciesRow = document.getElementById('scan-planet-species-row');
    const speciesSpan = document.getElementById('scan-planet-species');

    if (!closest) {
        if (nameSpan) nameSpan.innerText = "Keiner";
        if (distSpan) distSpan.innerText = "-";
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerText = "Scan initiieren [F]";
        }
        if (harvestBtn) harvestBtn.disabled = true;
        if (abductBtn) abductBtn.style.display = 'none';
        if (speciesRow) speciesRow.style.display = 'none';
        if (placeholder && !STATE.scanningPlanet && !STATE.extractingPlanet && !STATE.abductActive) placeholder.style.display = 'block';
        if (results && !STATE.scanningPlanet && !STATE.extractingPlanet && !STATE.abductActive) results.style.display = 'none';
        return;
    }

    if (nameSpan) nameSpan.innerText = closest.name;
    if (distSpan) distSpan.innerText = dist.toFixed(1);

    const isScanned = closest.scanned || STATE.scannedPlanets[closest.name];
    const isHarvested = closest.harvested || STATE.harvestedPlanets[closest.name];

    if (dist < 20) {
        if (STATE.scanningPlanet) {
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerText = "Scanne...";
            }
        } else if (isScanned) {
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
            // let distance trigger handle cancel
        } else if (isScanned) {
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
                scanBtn.disabled = true;
                scanBtn.innerText = "Außer Reichweite";
            }
            if (placeholder) placeholder.style.display = 'block';
            if (results) results.style.display = 'none';
        }
    }

    // Update harvest & abduction buttons if results are visible
    if (results && isScanned) {
        if (statusBadge) {
            if (isHarvested) {
                statusBadge.innerText = "Erschöpft / Depletiert";
                statusBadge.className = "planet-badge badge-depleted";
            } else if (STATE.extractingPlanet) {
                statusBadge.innerText = "Assimilierung aktiv...";
                statusBadge.className = "planet-badge badge-ready";
            } else {
                statusBadge.innerText = "Bereit zur Assimilation";
                statusBadge.className = "planet-badge badge-ready";
            }
        }

        if (harvestBtn) {
            if (isHarvested) {
                harvestBtn.disabled = true;
                harvestBtn.innerText = "Ressourcen erschöpft";
            } else if (STATE.extractingPlanet) {
                harvestBtn.disabled = true;
                harvestBtn.innerText = "Assimiere...";
            } else if (dist < 20) {
                harvestBtn.disabled = false;
                harvestBtn.innerText = "🌿 Ressourcen assimilieren [E]";
            } else {
                harvestBtn.disabled = true;
                harvestBtn.innerText = "Außer Reichweite";
            }
        }

        // Abduction button & species display
        if (closest.attributes && closest.attributes.species && closest.attributes.species.population > 0) {
            if (speciesRow) {
                speciesRow.style.display = 'flex';
                speciesSpan.innerHTML = `<strong style="color: #d946ef;">${closest.attributes.species.name}</strong> (${closest.attributes.species.population} Wesen)`;
            }
            if (abductBtn) {
                abductBtn.style.display = 'block';
                if (STATE.abductActive) {
                    abductBtn.disabled = true;
                    abductBtn.innerText = "Entführung aktiv...";
                } else if (dist < 20) {
                    abductBtn.disabled = false;
                    abductBtn.innerText = `🛸 Psionisch Entführen [F] (${closest.attributes.species.population} verfügbar)`;
                } else {
                    abductBtn.disabled = true;
                    abductBtn.innerText = "Außer Reichweite";
                }
            }
        } else {
            if (speciesRow) speciesRow.style.display = 'none';
            if (abductBtn) abductBtn.style.display = 'none';
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

// --- HARVESTING SYSTEM HELPERS ---
function triggerHarvestStart() {
    if (!STATE.gameStarted || STATE.extractingPlanet || STATE.scanningPlanet || !STATE.nearestPlanet) return;

    // Check range
    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    // Must be scanned first!
    if (!STATE.nearestPlanet.scanned && !STATE.scannedPlanets[STATE.nearestPlanet.name]) {
        addLogEntry("SYSTEM", `Planet muss vor der Assimilation erst vollständig gescannt werden [F].`);
        return;
    }

    // Must not be already harvested!
    if (STATE.nearestPlanet.harvested || STATE.harvestedPlanets[STATE.nearestPlanet.name]) {
        addLogEntry("SYSTEM", `Ressourcen von ${STATE.nearestPlanet.name} sind bereits vollständig erschöpft.`);
        return;
    }

    // Start extraction!
    STATE.extractingPlanet = STATE.nearestPlanet;
    STATE.extractProgress = 0;

    const progContainer = document.getElementById('harvest-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    createHarvestBeam(STATE.playerPosition, STATE.nearestPlanet.mesh.position);
    startHarvestSound();

    addLogEntry("SYSTEM", `Bio-Siphon aktiviert. Extrahiere planetare Ressourcen von ${STATE.extractingPlanet.name}...`);
}

// --- ABDUCTION SYSTEM HELPERS ---
function triggerAbductStart() {
    if (!STATE.gameStarted || STATE.abductActive || STATE.scanningPlanet || STATE.extractingPlanet || !STATE.nearestPlanet) return;

    // Check capacity limit
    if (STATE.crew.length >= STATE.maxCrewCapacity) {
        addLogEntry("SYSTEM", `Psionischer Transfer blockiert: Kokon-Kapazität voll (${STATE.crew.length} / ${STATE.maxCrewCapacity})! Erweitere Kapazität im Evolutions-Deck.`);
        return;
    }

    // Check range
    const dx = STATE.playerPosition.x - STATE.nearestPlanet.mesh.position.x;
    const dz = STATE.playerPosition.z - STATE.nearestPlanet.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= 20) return;

    const p = STATE.nearestPlanet;
    if (!p.attributes.species || p.attributes.species.population <= 0) {
        addLogEntry("SYSTEM", `Keine vernunftbegabten Individuen auf ${p.name} für psionische Entführung verfügbar.`);
        return;
    }

    STATE.abductActive = true;
    STATE.abductTarget = p;
    STATE.abductProgress = 0;

    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'block';

    createAbductBeam(STATE.playerPosition, p.mesh.position);
    startAbductSound();

    addLogEntry("SYSTEM", `PSIONISCHER TRAKTORSTRAHL AKTIVIERT. Fasse Bewusstsein auf ${p.name} ins Visier...`);
}

function createAbductBeam(startPos, targetPos) {
    if (abductBeamMesh) {
        scene.remove(abductBeamMesh);
        abductBeamMesh.geometry.dispose();
        abductBeamMesh.material.dispose();
    }

    const points = [startPos.clone(), targetPos.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xd946ef,
        linewidth: 3,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    abductBeamMesh = new THREE.Line(geometry, material);
    scene.add(abductBeamMesh);
}

function updateAbductBeam(startPos, targetPos) {
    if (!abductBeamMesh) return;
    const positions = abductBeamMesh.geometry.attributes.position.array;
    positions[0] = startPos.x;
    positions[1] = startPos.y;
    positions[2] = startPos.z;
    positions[3] = targetPos.x;
    positions[4] = targetPos.y;
    positions[5] = targetPos.z;
    abductBeamMesh.geometry.attributes.position.needsUpdate = true;
    abductBeamMesh.material.opacity = 0.6 + Math.sin(Date.now() * 0.03) * 0.35;
}

function removeAbductBeam() {
    if (abductBeamMesh) {
        scene.remove(abductBeamMesh);
        abductBeamMesh.geometry.dispose();
        abductBeamMesh.material.dispose();
        abductBeamMesh = null;
    }
}

function startAbductSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    abductOsc = ctx.createOscillator();
    abductGain = ctx.createGain();
    abductFilter = ctx.createBiquadFilter();

    abductOsc.type = 'triangle';
    abductOsc.frequency.setValueAtTime(330, ctx.currentTime);

    abductFilter.type = 'bandpass';
    abductFilter.frequency.setValueAtTime(440, ctx.currentTime);
    abductFilter.Q.setValueAtTime(3, ctx.currentTime);

    abductGain.gain.setValueAtTime(0, ctx.currentTime);
    abductGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.2);

    abductOsc.connect(abductFilter);
    abductFilter.connect(abductGain);
    abductGain.connect(ctx.destination);
    abductOsc.start();
}

function stopAbductSound() {
    if (abductOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (abductGain && time) {
            abductGain.gain.cancelScheduledValues(time);
            abductGain.gain.setValueAtTime(abductGain.gain.value, time);
            abductGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            abductOsc.stop(time + 0.2);
        } else {
            abductOsc.stop();
        }
        abductOsc = null;
        abductGain = null;
        abductFilter = null;
    }
}

function cancelAbduction(reason) {
    stopAbductSound();
    removeAbductBeam();
    addLogEntry("SYSTEM", `Entführung abgebrochen: ${reason}`);
    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.abductProgress = 0;
    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'none';
}

function completeAbduction() {
    stopAbductSound();
    removeAbductBeam();

    const progContainer = document.getElementById('abduct-progress-container');
    if (progContainer) progContainer.style.display = 'none';

    const planet = STATE.abductTarget;
    if (planet && planet.attributes.species && planet.attributes.species.candidates.length > 0) {
        const candidate = planet.attributes.species.candidates.shift();
        planet.attributes.species.population = planet.attributes.species.candidates.length;

        STATE.crew.push(candidate);
        STATE.crewSatietyTimer = 0; // Fresh mind resets satiety timer!
        calculateCrewBuffs();

        addLogEntry("SYSTEM", `PSIONISCHE ASSIMILATION ERFOLGREICH: ${candidate.name} (${candidate.roleName || candidate.role}) in Kokon-Kammer transferiert.`);
        addLogEntry("CREW", `Traum-Matrix initialisiert. ${candidate.name} aktiviert Rolle: ${candidate.buffDesc}!`);

        renderCrewUI();
        if (STATE.nearestPlanet === planet) {
            updateScannerUI(planet, 10);
        }
    }

    STATE.abductActive = false;
    STATE.abductTarget = null;
    STATE.abductProgress = 0;
}

function startHarvestSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    harvestOsc = ctx.createOscillator();
    harvestGain = ctx.createGain();
    harvestFilter = ctx.createBiquadFilter();

    harvestOsc.type = 'sawtooth';
    harvestOsc.frequency.setValueAtTime(110, ctx.currentTime);

    harvestFilter.type = 'lowpass';
    harvestFilter.frequency.setValueAtTime(250, ctx.currentTime);

    harvestGain.gain.setValueAtTime(0, ctx.currentTime);
    harvestGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.15);

    harvestOsc.connect(harvestFilter);
    harvestFilter.connect(harvestGain);
    harvestGain.connect(ctx.destination);
    harvestOsc.start();
}

function stopHarvestSound() {
    if (harvestOsc) {
        const ctx = getAudioContext();
        const time = ctx ? ctx.currentTime : 0;
        if (harvestGain && time) {
            harvestGain.gain.cancelScheduledValues(time);
            harvestGain.gain.setValueAtTime(harvestGain.gain.value, time);
            harvestGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            harvestOsc.stop(time + 0.2);
        } else {
            harvestOsc.stop();
        }
        harvestOsc = null;
        harvestGain = null;
        harvestFilter = null;
    }
}

function createHarvestBeam(startPos, endPos) {
    if (harvestBeamMesh) {
        scene.remove(harvestBeamMesh);
        harvestBeamMesh = null;
    }

    const material = new THREE.LineBasicMaterial({
        color: 0x10b981,
        linewidth: 3,
        transparent: true,
        opacity: 0.85
    });

    const points = [startPos.clone(), endPos.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    harvestBeamMesh = new THREE.Line(geometry, material);
    scene.add(harvestBeamMesh);
}

function updateHarvestBeam(startPos, endPos) {
    if (!harvestBeamMesh) return;
    const positions = harvestBeamMesh.geometry.attributes.position.array;
    positions[0] = startPos.x;
    positions[1] = startPos.y;
    positions[2] = startPos.z;
    positions[3] = endPos.x;
    positions[4] = endPos.y;
    positions[5] = endPos.z;
    harvestBeamMesh.geometry.attributes.position.needsUpdate = true;
}

function removeHarvestBeam() {
    if (harvestBeamMesh) {
        scene.remove(harvestBeamMesh);
        if (harvestBeamMesh.geometry) harvestBeamMesh.geometry.dispose();
        if (harvestBeamMesh.material) harvestBeamMesh.material.dispose();
        harvestBeamMesh = null;
    }
}

let mapOpen = false;
let selectedSystem = null;
let mapAnimFrameId = null;
let filterLifeOnly = false;
let mapMouseX = -1, mapMouseY = -1;
let mapZoom = 1.0;
let mapPanX = 0, mapPanY = 0;
let isDraggingMap = false;
let dragStartX = 0, dragStartY = 0;

function toggleGalaxyMap() {
    if (!STATE.gameStarted) return;

    const mapOverlay = document.getElementById('galaxy-map-overlay');
    if (!mapOverlay) return;

    mapOpen = !mapOpen;
    if (mapOpen) {
        mapOverlay.style.display = 'flex';
        renderGalaxyMap();
        startGalaxyMapLoop();
    } else {
        mapOverlay.style.display = 'none';
        stopGalaxyMapLoop();
    }
}

function startGalaxyMapLoop() {
    stopGalaxyMapLoop();
    function mapLoop() {
        if (!mapOpen) return;
        drawGalaxyMap(mapMouseX, mapMouseY);
        mapAnimFrameId = requestAnimationFrame(mapLoop);
    }
    mapAnimFrameId = requestAnimationFrame(mapLoop);
}

function stopGalaxyMapLoop() {
    if (mapAnimFrameId) {
        cancelAnimationFrame(mapAnimFrameId);
        mapAnimFrameId = null;
    }
}

let drawGalaxyMap = () => {};

function renderGalaxyMap() {
    const canvas = document.getElementById('galaxy-map-canvas');
    if (!canvas || !STATE.universe) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;

    const systems = STATE.universe.systems;
    let maxDist = 0;
    systems.forEach(sys => {
        const dist = Math.sqrt(sys.x * sys.x + sys.z * sys.z);
        if (dist > maxDist) maxDist = dist;
    });
    const baseScale = Math.min(width, height) / (maxDist * 2.3 || 1);

    if (!selectedSystem) {
        selectedSystem = systems.find(s => s.id === STATE.currentSystemId) || systems[0];
    }
    updateSystemDetails(selectedSystem);
    populateQuickBeaconsList();

    let hoverSystem = null;

    drawGalaxyMap = function(mouseX = -1, mouseY = -1) {
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        const currentScale = baseScale * mapZoom;
        const centerX = width / 2 + mapPanX;
        const centerY = height / 2 + mapPanY;

        // Grid lines with pan/zoom
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        const gridSize = 40 * mapZoom;
        const startX = (centerX % gridSize);
        const startY = (centerY % gridSize);
        for (let x = startX; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = startY; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Center Axis
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
        ctx.beginPath();
        ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
        ctx.stroke();

        // Galactic Center Core Glow
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50 * currentScale);
        coreGrad.addColorStop(0, 'rgba(168, 85, 247, 0.15)');
        coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50 * currentScale, 0, Math.PI * 2);
        ctx.fill();

        // Current system indicator halo & Range Circles
        const currentSys = systems.find(s => s.id === STATE.currentSystemId) || systems[0];
        if (currentSys) {
            const curScreenX = centerX + currentSys.x * currentScale;
            const curScreenY = centerY + currentSys.z * currentScale;

            // Draw Warp Range Circle (Cyan dashed)
            const warpRadiusScreen = STATE.warpRange * currentScale;
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, warpRadiusScreen, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Psionic Detection Circle (Magenta dotted)
            const psioRadiusScreen = STATE.psionicRange * currentScale;
            ctx.strokeStyle = 'rgba(217, 70, 239, 0.35)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, psioRadiusScreen, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pulsing current ship beacon
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(curScreenX, curScreenY, 14 * Math.min(1.5, Math.max(0.7, mapZoom)) + Math.sin(Date.now() * 0.006) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        hoverSystem = null;

        // Render all stars with Smart Level-of-Detail (LOD) & Limited Sensor Detection
        systems.forEach(sys => {
            const screenX = centerX + sys.x * currentScale;
            const screenY = centerY + sys.z * currentScale;

            // Cull stars outside canvas viewport
            if (screenX < -30 || screenX > width + 30 || screenY < -30 || screenY > height + 30) {
                return;
            }

            const dxFromCur = sys.x - currentSys.x;
            const dzFromCur = sys.z - currentSys.z;
            const distFromCur = Math.sqrt(dxFromCur * dxFromCur + dzFromCur * dzFromCur);

            const inWarpRange = distFromCur <= STATE.warpRange;
            const inPsionicRange = distFromCur <= STATE.psionicRange;

            const dx = mouseX - screenX;
            const dy = mouseY - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const isSelected = selectedSystem && selectedSystem.id === sys.id;
            const isActive = STATE.currentSystemId === sys.id;
            const hasSentient = sys.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));

            // Only show thought beacon if sentient life exists AND is within the Psionic Sensor Range!
            const showLifeBeacon = hasSentient && inPsionicRange;

            if (filterLifeOnly && !showLifeBeacon && !isActive && !isSelected) {
                ctx.globalAlpha = 0.08;
            } else if (!inWarpRange && !isActive && !isSelected) {
                ctx.globalAlpha = 0.45; // Dim out-of-range stars
            } else {
                ctx.globalAlpha = 1.0;
            }

            let baseSize = 2.8 * Math.min(1.6, Math.max(0.7, mapZoom));
            if (isActive) baseSize = 4.8;
            if (isSelected) baseSize = 6.0;

            if (dist < 10) {
                hoverSystem = sys;
                baseSize += 2.5;
            }

            // --- PSIONIC THOUGHT BEACON (Only if within Psionic Range!) ---
            if (showLifeBeacon) {
                const glowR = (baseSize + 14) * Math.min(1.4, Math.max(0.8, mapZoom));
                const glowGrad = ctx.createRadialGradient(screenX, screenY, baseSize, screenX, screenY, glowR);
                glowGrad.addColorStop(0, 'rgba(217, 70, 239, 0.45)');
                glowGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.15)');
                glowGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
                ctx.fill();

                const timeSec = (Date.now() % 2400) / 2400;
                for (let w = 0; w < 2; w++) {
                    const waveProg = (timeSec + w * 0.5) % 1.0;
                    const waveR = baseSize + 2 + waveProg * 14 * Math.min(1.4, Math.max(0.8, mapZoom));
                    const waveAlpha = (1.0 - waveProg) * 0.85;
                    ctx.strokeStyle = `rgba(217, 70, 239, ${waveAlpha})`;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, waveR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.fillStyle = '#f472b6';
                ctx.font = 'bold 8px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧠', screenX, screenY + baseSize + 9);
            }

            let starColor = '#f59e0b';
            if (sys.star.type === 'Blue Giant') starColor = '#3b82f6';
            if (sys.star.type === 'Red Dwarf') starColor = '#ef4444';
            if (sys.star.type === 'White Dwarf') starColor = '#cbd5e1';
            if (sys.star.type === 'Black Hole') starColor = '#8b5cf6';

            if (isSelected) {
                ctx.fillStyle = inWarpRange ? 'rgba(168, 85, 247, 0.4)' : 'rgba(239, 68, 68, 0.3)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = inWarpRange ? '#e879f9' : '#f87171';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (isActive) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, baseSize + 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = starColor;
            ctx.beginPath();
            ctx.arc(screenX, screenY, baseSize, 0, Math.PI * 2);
            ctx.fill();

            // Smart LOD Labeling: Only show labels if selected, active, hovered, or when zoomed in!
            const shouldShowLabel = isSelected || isActive || dist < 10 || (mapZoom > 2.0) || (showLifeBeacon && mapZoom > 1.2);
            if (shouldShowLabel) {
                ctx.fillStyle = isSelected ? (inWarpRange ? '#e879f9' : '#f87171') : (isActive ? '#38bdf8' : (showLifeBeacon ? '#f8fafc' : '#94a3b8'));
                ctx.font = isSelected ? 'bold 9px Orbitron, sans-serif' : '8px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(sys.name, screenX, screenY - baseSize - 4);
            }
        });

        ctx.globalAlpha = 1.0;

        // Hover tooltip
        if (hoverSystem) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
            ctx.strokeStyle = 'rgba(217, 70, 239, 0.6)';
            ctx.lineWidth = 1.5;

            const tooltipX = mouseX + 15;
            const tooltipY = mouseY - 15;
            const hasSentient = hoverSystem.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
            const text = `${hoverSystem.name} (${hoverSystem.star.type}) ${hasSentient ? '🧠 Leben' : ''}`;

            ctx.font = '9.5px Orbitron, sans-serif';
            const textWidth = ctx.measureText(text).width;

            ctx.beginPath();
            ctx.roundRect(tooltipX, tooltipY - 18, textWidth + 20, 24, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(text, tooltipX + 10, tooltipY - 2);
        }
    };

    // --- INTERACTIVE ZOOM & PAN CONTROLS ---
    canvas.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.min(5.0, Math.max(0.6, mapZoom * zoomFactor));
        mapZoom = newZoom;
    };

    canvas.onmousedown = (e) => {
        isDraggingMap = true;
        dragStartX = e.clientX - mapPanX;
        dragStartY = e.clientY - mapPanY;
    };

    window.addEventListener('mouseup', () => {
        isDraggingMap = false;
    });

    canvas.onmousemove = (e) => {
        const mRect = canvas.getBoundingClientRect();
        mapMouseX = e.clientX - mRect.left;
        mapMouseY = e.clientY - mRect.top;

        if (isDraggingMap) {
            mapPanX = e.clientX - dragStartX;
            mapPanY = e.clientY - dragStartY;
        }
    };

    canvas.ondblclick = () => {
        mapZoom = 1.0;
        mapPanX = 0;
        mapPanY = 0;
    };

    canvas.onmouseleave = () => {
        mapMouseX = -1;
        mapMouseY = -1;
    };

    canvas.onclick = (e) => {
        if (hoverSystem) {
            selectedSystem = hoverSystem;
            updateSystemDetails(selectedSystem);
            populateQuickBeaconsList();
            playSiliconCollectSound();
        }
    };
}

function populateQuickBeaconsList() {
    const listEl = document.getElementById('psionic-beacons-quick-list');
    if (!listEl || !STATE.universe) return;

    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];

    const livingSystems = STATE.universe.systems
        .map(s => {
            const dx = s.x - currentSys.x;
            const dz = s.z - currentSys.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            return { system: s, dist: dist };
        })
        .filter(entry => {
            const hasSentient = entry.system.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
            return hasSentient && entry.dist <= STATE.psionicRange;
        })
        .sort((a, b) => a.dist - b.dist);
    
    if (livingSystems.length === 0) {
        listEl.innerHTML = `<li style="font-size: 0.72rem; color: #64748b; padding: 6px; text-align: center;">Keine Gedanken-Echos im Sensorradius (${STATE.psionicRange} LJ) geortet.<br><span style="color: #a855f7; font-size: 0.65rem;">Reise näher heran oder erweitere Synapsen!</span></li>`;
        return;
    }

    let html = '';
    livingSystems.forEach(entry => {
        const sys = entry.system;
        const habPlanet = sys.planets.find(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
        let specName = "Habitables Ökosystem";
        if (habPlanet && habPlanet.species && habPlanet.species.name) {
            specName = habPlanet.species.name;
        }
        const isSel = selectedSystem && selectedSystem.id === sys.id;
        const inWarp = entry.dist <= STATE.warpRange;
        
        html += `
            <li class="beacon-quick-item ${isSel ? 'active-item' : ''}" data-sys-id="${sys.id}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="beacon-sys-name">✨ ${sys.name}</span>
                    <span style="font-size: 0.65rem; color: ${inWarp ? '#38bdf8' : '#f87171'};">${entry.dist.toFixed(0)} LJ</span>
                </div>
                <span class="beacon-species-tag">${specName}</span>
            </li>
        `;
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.beacon-quick-item').forEach(item => {
        item.addEventListener('click', () => {
            const sysId = parseInt(item.getAttribute('data-sys-id'));
            const target = STATE.universe.systems.find(s => s.id === sysId);
            if (target) {
                selectedSystem = target;
                updateSystemDetails(selectedSystem);
                populateQuickBeaconsList();
                playSiliconCollectSound();
            }
        });
    });
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

    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];
    const dx = sys.x - currentSys.x;
    const dz = sys.z - currentSys.z;
    const distFromCur = Math.sqrt(dx * dx + dz * dz);
    const inWarpRange = distFromCur <= STATE.warpRange;
    const inPsionicRange = distFromCur <= STATE.psionicRange;

    document.getElementById('detail-system-name').innerText = sys.name;
    document.getElementById('val-coord-x').innerText = sys.x;
    document.getElementById('val-coord-z').innerText = sys.z;
    document.getElementById('val-star-type').innerText = sys.star.type;
    document.getElementById('val-star-mass').innerText = sys.star.mass + " SM";
    document.getElementById('val-planet-count').innerText = sys.planets.length;

    // Update Psionic Resonance details
    const hasSentient = sys.planets.some(p => p.type === 'Habitable' || (p.species && p.species.hasSentient));
    const resRow = document.getElementById('detail-psionic-resonance');
    if (resRow) {
        if (hasSentient && inPsionicRange) {
            resRow.innerHTML = `<span style="color: #d946ef; font-weight: bold;">📶 Starke neuronale Resonanz</span> <span style="color: #cbd5e1; font-size: 0.65rem;">(Intelligentes Leben, ${distFromCur.toFixed(0)} LJ)</span>`;
        } else if (hasSentient && !inPsionicRange) {
            resRow.innerHTML = `<span style="color: #64748b; font-size: 0.72rem;">❓ Außerhalb Psio-Horizont (${distFromCur.toFixed(0)} / ${STATE.psionicRange} LJ)</span>`;
        } else {
            resRow.innerHTML = `<span style="color: #64748b; font-size: 0.72rem;">✖️ Keine Gedanken-Echos (Stille)</span>`;
        }
    }

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

    const costMult = STATE.mutations.folddrive && STATE.mutations.folddrive.purchased ? 0.7 : 1.0;
    const warpCost = Math.round((15 + distFromCur * 0.15) * costMult);

    const warpBtn = document.getElementById('warp-btn');
    if (warpBtn) {
        if (sys.id === STATE.currentSystemId) {
            warpBtn.disabled = true;
            warpBtn.innerText = "Etablierter Standort";
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else if (!inWarpRange) {
            warpBtn.disabled = true;
            warpBtn.innerText = `❌ Zu weit entfernt (${distFromCur.toFixed(0)} / Max ${STATE.warpRange} LJ)`;
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else if (STATE.bioEnergy < warpCost) {
            warpBtn.disabled = true;
            warpBtn.innerText = `⚡ Zu wenig Bio-Energie (${warpCost}% nötig)`;
            warpBtn.style.opacity = "0.5";
            warpBtn.style.pointerEvents = "none";
        } else {
            warpBtn.disabled = false;
            warpBtn.innerText = `🌀 Quantenfeld falten (${distFromCur.toFixed(0)} LJ | -${warpCost}% Energie)`;
            warpBtn.style.opacity = "1";
            warpBtn.style.pointerEvents = "auto";
        }
    }
}

function warpToSystem(systemId) {
    if (!STATE.universe) return;
    const currentSys = STATE.universe.systems.find(s => s.id === STATE.currentSystemId) || STATE.universe.systems[0];
    const targetSys = STATE.universe.systems.find(s => s.id === systemId);
    if (!targetSys) return;

    const dx = targetSys.x - currentSys.x;
    const dz = targetSys.z - currentSys.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > STATE.warpRange) {
        addLogEntry("SYSTEM", `Hypersprung abgebrochen: Distanz zu ${targetSys.name} (${dist.toFixed(0)} LJ) überschreitet maximale Faltungsreichweite (${STATE.warpRange} LJ)!`);
        return;
    }

    const costMult = STATE.mutations.folddrive && STATE.mutations.folddrive.purchased ? 0.7 : 1.0;
    const warpCost = Math.round((15 + dist * 0.15) * costMult);

    if (STATE.bioEnergy < warpCost) {
        addLogEntry("SYSTEM", `Hypersprung abgebrochen: Nicht genügend Bio-Energie (${warpCost}% benötigt, aktuell ${Math.round(STATE.bioEnergy)}%)!`);
        return;
    }

    // Deduct calculated Warp Bio-Energy cost
    STATE.bioEnergy = Math.max(0, STATE.bioEnergy - warpCost);

    const warpOverlay = document.getElementById('warp-overlay');
    if (warpOverlay) {
        warpOverlay.style.display = 'flex';
        warpOverlay.style.opacity = '1';
    }

    // Stop engine rumble during warp
    setThrusterSound(false);
    // Play heavy warp crash/rumble audio feedback
    playCrashSound();

    // Fast 600ms hyperspace jump
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

        addLogEntry("SYSTEM", `Hypersprung abgeschlossen. Raumfaltung um ${activeSystem.name} (${dist.toFixed(0)} LJ, -${warpCost}% Energie) stabilisiert.`);

        // Close panels
        if (warpOverlay) {
            warpOverlay.style.display = 'none';
        }
        toggleGalaxyMap();
    }, 600);
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
        mainMenu.classList.add('menu-hidden');
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
            mainMenu.classList.toggle('menu-hidden');
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

const mapFilterBtn = document.getElementById('map-filter-life-btn');
if (mapFilterBtn) {
    mapFilterBtn.addEventListener('click', () => {
        filterLifeOnly = !filterLifeOnly;
        if (filterLifeOnly) {
            mapFilterBtn.classList.add('active');
            mapFilterBtn.innerText = "🔮 Gedanken-Echo Filter: AN";
        } else {
            mapFilterBtn.classList.remove('active');
            mapFilterBtn.innerText = "🔮 Gedanken-Echo Filter: AUS";
        }
    });
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

// Harvest button click wiring
const startHarvestBtn = document.getElementById('start-harvest-btn');
if (startHarvestBtn) {
    startHarvestBtn.addEventListener('click', triggerHarvestStart);
}

const startAbductBtn = document.getElementById('start-abduct-btn');
if (startAbductBtn) {
    startAbductBtn.addEventListener('click', triggerAbductStart);
}

const sonarBtn = document.getElementById('psionic-sonar-btn');
if (sonarBtn) {
    sonarBtn.addEventListener('click', triggerPsionicSonar);
}

// --- PSIONIC SONAR HELPERS ---
function triggerPsionicSonar() {
    if (!STATE.gameStarted) return;
    if (STATE.mentalEnergy < 15) {
        addLogEntry("SYSTEM", "Zu wenig Mentalkraft für psionischen Sonar-Ruf (15% benötigt)!");
        return;
    }

    STATE.mentalEnergy = Math.max(0, STATE.mentalEnergy - 15);

    // Create expanding 3D ring wave
    if (sonarWaveMesh) {
        scene.remove(sonarWaveMesh);
        if (sonarWaveMesh.geometry) sonarWaveMesh.geometry.dispose();
        if (sonarWaveMesh.material) sonarWaveMesh.material.dispose();
    }

    const ringGeo = new THREE.RingGeometry(1, 4, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    sonarWaveMesh = new THREE.Mesh(ringGeo, ringMat);
    sonarWaveMesh.position.copy(STATE.playerPosition);
    scene.add(sonarWaveMesh);

    sonarTimer = 1.0;

    playSonarChime();

    // Check if any planet has sentient minds
    const sentientPlanets = activePlanets.filter(p => p.attributes && p.attributes.species && p.attributes.species.population > 0);
    if (sentientPlanets.length > 0) {
        const names = sentientPlanets.map(p => `${p.name} (${p.attributes.species.name})`).join(", ");
        addLogEntry("SYSTEM", `PSIONISCHER RUF: Mentales Resonanz-Echo empfangen von: ${names}! Kompass aktiv.`);
    } else {
        addLogEntry("SYSTEM", "PSIONISCHER RUF: Keine Gedanken-Signaturen in diesem System (Kosmische Stille).");
    }
}

function playSonarChime() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, time); // D5
    osc.frequency.exponentialRampToValueAtTime(880, time + 0.3); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, time + 0.6); // D6

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.95);
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

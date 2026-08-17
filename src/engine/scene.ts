import * as THREE from 'three';

export let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
export let renderer: THREE.WebGLRenderer;
export let starfield: THREE.Points;

export function initScene(container?: HTMLElement) {
    const target = container || document.getElementById('canvas-container') || document.body;

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
    target.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa855f7, 2, 50);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Create World Starfield
    createStarfield();

    // Event Listener
    window.addEventListener('resize', onWindowResize);
}

export function createStarfield() {
    const starCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        // Distribute stars in a wide deep background disc far below the game plane (Y = 0)
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 380;

        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = -120 - Math.random() * 80; // Deep background layer below Y=0
        positions[i * 3 + 2] = Math.sin(angle) * radius;

        // Custom organic colors (purple, cyan, gold, white)
        const rand = Math.random();
        if (rand < 0.25) {
            colors[i * 3] = 0.65; colors[i * 3 + 1] = 0.25; colors[i * 3 + 2] = 0.95; // purple
        } else if (rand < 0.55) {
            colors[i * 3] = 0.25; colors[i * 3 + 1] = 0.82; colors[i * 3 + 2] = 0.98; // cyan
        } else if (rand < 0.75) {
            colors[i * 3] = 0.98; colors[i * 3 + 1] = 0.80; colors[i * 3 + 2] = 0.15; // gold
        } else {
            colors[i * 3] = 0.95; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; // white
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.75,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });

    starfield = new THREE.Points(geometry, material);
    scene.add(starfield);
}

export function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

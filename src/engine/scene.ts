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
        // Spherical distribution
        const radius = 100 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100; // Flat disk shape
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

        // Subtle sci-fi star colors (Cyan, Magenta, Gold, White)
        const randColor = Math.random();
        if (randColor > 0.8) {
            colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.27; colors[i * 3 + 2] = 0.94; // Magenta
        } else if (randColor > 0.5) {
            colors[i * 3] = 0.22; colors[i * 3 + 1] = 0.74; colors[i * 3 + 2] = 0.97; // Cyan
        } else if (randColor > 0.3) {
            colors[i * 3] = 0.98; colors[i * 3 + 1] = 0.80; colors[i * 3 + 2] = 0.08; // Gold
        } else {
            colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; // White-Blue
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.85,
        vertexColors: true,
        transparent: true,
        opacity: 0.85
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

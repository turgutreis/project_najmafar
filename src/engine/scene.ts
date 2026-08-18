import * as THREE from 'three';
import { resizePostProcessing } from './postprocessing';
import { createRealisticStarfield, CosmicBackgroundController } from './starfield';

export let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
export let renderer: THREE.WebGLRenderer;
export let starfieldController: CosmicBackgroundController | null = null;

export function initScene(container?: HTMLElement) {
    const target = container || document.getElementById('canvas-container') || document.body;

    // Scene (Clear, deep cosmic void - no milky fog)
    scene = new THREE.Scene();

    // Camera (Top-down view with offset height)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 65, 0);
    camera.lookAt(0, 0, 0);

    // Renderer with ACES Filmic Tone Mapping for crisp contrast
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x010308, 1.0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    target.appendChild(renderer.domElement);

    // Ambient Light (Subtle, atmospheric deep-space base illumination)
    const ambientLight = new THREE.AmbientLight(0x060c18, 0.18);
    scene.add(ambientLight);

    // Create Realistic Multi-Layered Astronomical Starfield (No donut holes!)
    starfieldController = createRealisticStarfield();
    scene.add(starfieldController.group);

    // Event Listener
    window.addEventListener('resize', onWindowResize);
}

export function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizePostProcessing(window.innerWidth, window.innerHeight);
}

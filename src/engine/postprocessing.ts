import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { scene, camera, renderer } from './scene';

export let composer: EffectComposer | null = null;
export let bloomPass: UnrealBloomPass | null = null;

export function initPostProcessing() {
    if (!renderer || !scene || !camera) return;

    // 1. Create Effect Composer with full window render resolution
    composer = new EffectComposer(renderer);

    // 2. Base Scene Render Pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 3. Cinematic Unreal Bloom Pass
    // Resolution, Strength, Radius, Threshold
    const bloomResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    bloomPass = new UnrealBloomPass(
        bloomResolution,
        0.85,  // Bloom strength (subtle, lush sci-fi glow)
        0.45,  // Bloom radius
        0.65   // Luminance threshold (only stars, bio-glows, shields, and lasers glow!)
    );
    composer.addPass(bloomPass);

    // 4. Output Pass for tone mapping & color correction
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

export function resizePostProcessing(width: number, height: number) {
    if (composer) {
        composer.setSize(width, height);
    }
    if (bloomPass) {
        bloomPass.resolution.set(width, height);
    }
}

export function renderPostProcessing() {
    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

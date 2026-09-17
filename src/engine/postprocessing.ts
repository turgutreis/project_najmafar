import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { scene, camera, renderer } from './scene';
import { STATE } from '../core/state';
import { alienShipController } from '../procedural/meshes';

export let composer: EffectComposer | null = null;
export let bloomPass: UnrealBloomPass | null = null;
export let distortionPass: ShaderPass | null = null;

export const SpacetimeDistortionShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uTime: { value: 0.0 },
        uWarpBubblePos: { value: new THREE.Vector2(0.5, 0.5) },
        uWarpIntensity: { value: 0.0 },
        uRippleCount: { value: 0 },
        uRipples: {
            value: [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0)
            ]
        }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform vec2 uWarpBubblePos;
        uniform float uWarpIntensity;
        uniform int uRippleCount;
        uniform vec3 uRipples[8];
        varying vec2 vUv;

        void main() {
            vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
            vec2 uv = vUv;
            vec2 totalOffset = vec2(0.0);

            // 1. Spacetime Warp Bubble surrounding the accelerating bio-ship
            if (uWarpIntensity > 0.001) {
                vec2 dVec = (uv - uWarpBubblePos) * aspect;
                float d = length(dVec);
                float bubbleRadius = 0.095;
                if (d < bubbleRadius * 2.8 && d > 0.0005) {
                    float normD = d / bubbleRadius;
                    // Gravitational lensing curve (Einstein ring space curvature)
                    float lensForce = sin(normD * 3.14159) * exp(-normD * 1.1) * 0.032 * uWarpIntensity;
                    totalOffset += (dVec / d) * lensForce / aspect;
                }
            }

            // 2. Expanding Spacetime Gravitational Pulse Waves (Ripples in spacetime metric)
            for (int i = 0; i < 8; i++) {
                if (i >= uRippleCount) break;
                vec3 r = uRipples[i]; // r.x, r.y = screen center, r.z = screen radius
                if (r.z <= 0.001) continue;

                vec2 dVec = (uv - r.xy) * aspect;
                float dist = length(dVec);
                float diff = dist - r.z;
                float waveWidth = 0.048; // Breadth of gravitational shockwave band

                if (abs(diff) < waveWidth && dist > 0.0005) {
                    float waveProgress = clamp(r.z / 0.42, 0.0, 1.0);
                    float strength = (1.0 - waveProgress); // Attenuates as wave disperses
                    float waveShape = sin(diff / waveWidth * 3.14159);
                    
                    // General-relativistic radial refraction displacement
                    float displaceMag = waveShape * strength * 0.042;
                    totalOffset += (dVec / dist) * displaceMag / aspect;
                }
            }

            // 3. Chromatic Gravitational Lensing (Prism Splitting in curved spacetime)
            float offsetLen = length(totalOffset);
            if (offsetLen > 0.0001) {
                float rCol = texture2D(tDiffuse, uv + totalOffset * 1.35).r;
                float gCol = texture2D(tDiffuse, uv + totalOffset).g;
                float bCol = texture2D(tDiffuse, uv + totalOffset * 0.65).b;
                float aCol = texture2D(tDiffuse, uv).a;

                // Bioluminescent caustic gleam along wave crests
                float causticIntensity = smoothstep(0.012, 0.038, offsetLen);
                vec3 caustic = vec3(0.02, 0.22, 0.28) * causticIntensity;

                gl_FragColor = vec4(rCol + caustic.r, gCol + caustic.g, bCol + caustic.b, aCol);
            } else {
                gl_FragColor = texture2D(tDiffuse, uv);
            }
        }
    `
};

export function initPostProcessing() {
    if (!renderer || !scene || !camera) return;

    // 1. Create Effect Composer with full window render resolution
    composer = new EffectComposer(renderer);

    // 2. Base Scene Render Pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 3. Spacetime Gravitational Distortion Pass (Refracts scene behind warp waves & ship)
    const distortionResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    SpacetimeDistortionShader.uniforms.uResolution.value.copy(distortionResolution);
    distortionPass = new ShaderPass(SpacetimeDistortionShader);
    composer.addPass(distortionPass);

    // 4. Cinematic Selective Unreal Bloom Pass
    const bloomResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    bloomPass = new UnrealBloomPass(
        bloomResolution,
        0.55,  // Bloom strength
        0.28,  // Bloom radius
        0.88   // Luminance threshold
    );
    composer.addPass(bloomPass);

    // 5. Output Pass for tone mapping & color correction
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
    if (distortionPass && distortionPass.uniforms.uResolution) {
        distortionPass.uniforms.uResolution.value.set(width, height);
    }
}

let lastDistortionTime = performance.now();

export function updateSpacetimeDistortion() {
    if (!distortionPass || !camera) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - lastDistortionTime) * 0.001);
    lastDistortionTime = now;

    const uniforms = distortionPass.uniforms;
    uniforms.uTime.value += dt;

    if (typeof window !== 'undefined' && window.innerWidth) {
        uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    // A. Ship Warp Bubble in screen space
    if (STATE.playerPosition) {
        const shipScreen = STATE.playerPosition.clone().project(camera);
        // Convert from [-1, 1] NDC to [0, 1] UV
        const uvX = (shipScreen.x + 1.0) * 0.5;
        const uvY = (shipScreen.y + 1.0) * 0.5;
        uniforms.uWarpBubblePos.value.set(uvX, uvY);

        const isThrusting = Boolean(STATE.isThrusting || (STATE.keys && STATE.keys.w));
        const targetWarp = isThrusting ? 1.0 : 0.0;
        uniforms.uWarpIntensity.value = THREE.MathUtils.lerp(
            uniforms.uWarpIntensity.value,
            targetWarp,
            Math.min(1.0, dt * 9.0)
        );
    }

    // B. Active Spacetime Gravitational Pulse Shockwaves
    if (alienShipController && typeof alienShipController.getRipples === 'function') {
        const ripples = alienShipController.getRipples();
        const count = Math.min(ripples.length, 8);
        uniforms.uRippleCount.value = count;

        const camHeight = Math.max(20.0, camera.position.y || 65.0);

        for (let i = 0; i < count; i++) {
            const r = ripples[i];
            const screenPos = r.position.clone().project(camera);
            const rX = (screenPos.x + 1.0) * 0.5;
            const rY = (screenPos.y + 1.0) * 0.5;

            // Project 3D radius to screen UV radius based on camera perspective
            const screenRadius = (r.worldRadius / camHeight) * 0.72;
            uniforms.uRipples.value[i].set(rX, rY, screenRadius);
        }
    } else {
        uniforms.uRippleCount.value = 0;
    }
}

export function renderPostProcessing() {
    if (composer) {
        updateSpacetimeDistortion();
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

import * as THREE from 'three';

// 1. Natural Soft Solar Corona Halo Shader (Spherical Billboard)
const naturalHaloVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const naturalHaloFragmentShader = `
uniform vec3 starColor;
uniform float time;
varying vec2 vUv;

void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0; // 0.0 at center, 1.0 at edge
    if (dist > 1.0) discard;

    float angle = atan(p.y, p.x);
    
    // Very subtle micro-pulsations in the corona
    float microRays = sin(angle * 12.0 + time * 0.4) * 0.08 + sin(angle * 20.0 - time * 0.2) * 0.05;
    
    // Soft exponential falloff (astronomical inverse-square style)
    float falloff = pow(max(0.0, 1.0 - dist), 3.2);
    float coreGlow = pow(max(0.0, 1.0 - dist), 6.0) * 1.5;
    
    float alpha = (falloff * (0.6 + microRays) + coreGlow) * 0.75;
    vec3 color = starColor * (1.1 + microRays * 0.5);
    
    gl_FragColor = vec4(color, alpha);
}
`;

// 2. Subtle, Delicate Optical Lens Flare (Compact & Elegant)
const subtleFlareVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const subtleFlareFragmentShader = `
uniform vec3 flareColor;
varying vec2 vUv;

void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0;
    if (dist > 1.0) discard;

    // Cross diffraction spikes (very thin & delicate)
    float dx = abs(p.x) * 2.0;
    float dy = abs(p.y) * 2.0;
    
    float spikeH = pow(max(0.0, 1.0 - dy), 24.0) * pow(max(0.0, 1.0 - dx), 1.8);
    float spikeV = pow(max(0.0, 1.0 - dx), 24.0) * pow(max(0.0, 1.0 - dy), 1.8);
    
    float centerGlint = pow(max(0.0, 1.0 - dist), 4.0);
    
    float alpha = (spikeH * 0.4 + spikeV * 0.4 + centerGlint * 0.5) * 0.6;
    gl_FragColor = vec4(flareColor * 1.3, alpha);
}
`;

export interface SunRaysController {
    group: THREE.Group;
    update: (dt: number, camera: THREE.Camera) => void;
    dispose: () => void;
}

export function createSunRays(starRadius: number, hexColor: number): SunRaysController {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const color = new THREE.Color(hexColor);

    // 1. Soft Natural Corona Halo (Faces camera, compact radius: 2.8x of star)
    const haloRadius = starRadius * 2.8;
    const haloGeo = new THREE.PlaneGeometry(haloRadius * 2, haloRadius * 2);
    const haloMat = new THREE.ShaderMaterial({
        vertexShader: naturalHaloVertexShader,
        fragmentShader: naturalHaloFragmentShader,
        uniforms: {
            starColor: { value: color },
            time: { value: 0.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    group.add(haloMesh);

    // 2. Subtle Micro-Lens Glint (Compact radius: 3.5x of star)
    const flareRadius = starRadius * 3.5;
    const flareGeo = new THREE.PlaneGeometry(flareRadius * 2, flareRadius * 2);
    const flareMat = new THREE.ShaderMaterial({
        vertexShader: subtleFlareVertexShader,
        fragmentShader: subtleFlareFragmentShader,
        uniforms: {
            flareColor: { value: color }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    group.add(flareMesh);

    let totalTime = 0;

    return {
        group,
        update: (dt: number, camera: THREE.Camera) => {
            totalTime += dt;
            haloMat.uniforms.time.value = totalTime;

            // Halo and subtle flare smoothly face camera without warping or blinding the screen
            if (camera) {
                haloMesh.quaternion.copy(camera.quaternion);
                flareMesh.quaternion.copy(camera.quaternion);
            }
        },
        dispose: () => {
            haloGeo.dispose();
            haloMat.dispose();
            flareGeo.dispose();
            flareMat.dispose();
        }
    };
}

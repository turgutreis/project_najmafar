import * as THREE from 'three';

const coronaVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const coronaFragmentShader = `
uniform vec3 starColor;
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

// Simplex/Perlin-inspired procedural noise function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    // Dynamic swirling noise coordinates
    vec2 uvCoord = vUv * 6.0;
    float n1 = noise(uvCoord + vec2(time * 0.25, time * 0.15));
    float n2 = noise(uvCoord * 2.0 - vec2(time * 0.35, time * 0.2));
    float plasma = (n1 + n2 * 0.5) / 1.5;

    // Outer rim glow with Fresnel
    float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), 2.2);
    float alpha = fresnel * (0.6 + plasma * 0.65);

    vec3 finalGlow = starColor * (1.2 + plasma * 0.8);
    gl_FragColor = vec4(finalGlow, alpha);
}
`;

export function createSunCoronaMesh(starRadius: number, hexColor: number): { mesh: THREE.Mesh; update: (dt: number) => void } {
    const color = new THREE.Color(hexColor);

    const coronaGeo = new THREE.SphereGeometry(starRadius * 1.35, 32, 32);
    const coronaMat = new THREE.ShaderMaterial({
        vertexShader: coronaVertexShader,
        fragmentShader: coronaFragmentShader,
        uniforms: {
            starColor: { value: color },
            time: { value: 0.0 }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });

    const mesh = new THREE.Mesh(coronaGeo, coronaMat);

    return {
        mesh,
        update: (dt: number) => {
            coronaMat.uniforms.time.value += dt;
        }
    };
}

import * as THREE from 'three';

const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const atmosphereFragmentShader = `
uniform vec3 glowColor;
uniform float intensityMultiplier;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    float fresnel = 1.0 - max(dot(vViewDir, vNormal), 0.0);
    float glow = pow(fresnel, 2.8) * intensityMultiplier;
    gl_FragColor = vec4(glowColor, glow);
}
`;

export function createAtmosphereMesh(planetRadius: number, hexColor: number, intensity = 1.4): THREE.Mesh {
    const color = new THREE.Color(hexColor);

    const atmosphereGeo = new THREE.SphereGeometry(planetRadius * 1.14, 32, 32);
    const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            glowColor: { value: color },
            intensityMultiplier: { value: intensity }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });

    return new THREE.Mesh(atmosphereGeo, atmosphereMat);
}

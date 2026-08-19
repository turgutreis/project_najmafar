import * as THREE from 'three';

const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
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
varying vec3 vWorldPosition;

void main() {
    // 1. Soft Fresnel limb darkening / atmospheric rim
    float dotNV = dot(vViewDir, vNormal);
    float fresnel = 1.0 - max(dotNV, 0.0);
    float glow = pow(fresnel, 3.2) * intensityMultiplier;

    // 2. Solar illumination direction (Sun at origin 0,0,0)
    vec3 lightDir = normalize(-vWorldPosition);
    vec3 worldNormal = normalize(vWorldPosition);
    float sunDot = dot(worldNormal, lightDir);
    float dayFactor = clamp(sunDot * 0.75 + 0.35, 0.18, 1.0);

    // 3. Twilight Rayleigh tint at day/night terminator line
    vec3 twilightColor = mix(vec3(0.95, 0.58, 0.32), glowColor, clamp(sunDot * 3.2 + 0.5, 0.0, 1.0));

    gl_FragColor = vec4(twilightColor, glow * dayFactor * 0.95);
}
`;

export function createAtmosphereMesh(planetRadius: number, hexColor: number, intensity = 1.25): THREE.Mesh {
    const color = new THREE.Color(hexColor);

    const atmosphereGeo = new THREE.SphereGeometry(planetRadius * 1.045, 36, 36);
    const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            glowColor: { value: color },
            intensityMultiplier: { value: intensity }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false
    });

    return new THREE.Mesh(atmosphereGeo, atmosphereMat);
}

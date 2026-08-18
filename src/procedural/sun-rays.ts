import * as THREE from 'three';

const sunRayVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const sunRayFragmentShader = `
uniform vec3 rayColor;
uniform float time;
varying vec2 vUv;

void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0;
    if (dist > 1.0) discard;

    float angle = atan(p.y, p.x);
    
    // Multi-frequency radial ray beams
    float ray1 = sin(angle * 8.0 + time * 0.35);
    float ray2 = sin(angle * 14.0 - time * 0.25);
    float ray3 = sin(angle * 22.0 + time * 0.5);
    
    float combinedRays = max(0.0, (ray1 * 0.5 + ray2 * 0.35 + ray3 * 0.25) + 0.35);
    
    // Radial soft falloff from core to outer tip
    float radialFalloff = pow(max(0.0, 1.0 - dist), 1.6);
    
    // Core glow intensity
    float coreGlow = pow(max(0.0, 1.0 - dist), 4.0) * 1.8;
    
    float alpha = (combinedRays * radialFalloff * 0.75 + coreGlow) * 0.85;
    vec3 finalColor = rayColor * (1.2 + combinedRays * 0.6);
    
    gl_FragColor = vec4(finalColor, alpha);
}
`;

const anamorphicStreakVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const anamorphicStreakFragmentShader = `
uniform vec3 flareColor;
varying vec2 vUv;

void main() {
    // Horizontal thin anamorphic beam
    float dx = abs(vUv.x - 0.5) * 2.0;
    float dy = abs(vUv.y - 0.5) * 2.0;

    // Sharp horizontal beam with soft gradient edges
    float beam = pow(max(0.0, 1.0 - dy), 14.0) * pow(max(0.0, 1.0 - dx), 1.2);
    
    // Central bright lens flare glare
    float centerGlare = pow(max(0.0, 1.0 - length(vUv - vec2(0.5)) * 2.0), 3.0) * 0.8;

    float alpha = (beam * 0.95 + centerGlare);
    gl_FragColor = vec4(flareColor * 1.5, alpha * 0.9);
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

    // 1. Giant Volumetric Radial Sun Beams (Disc on the orbital game plane)
    const beamRadius = starRadius * 9.5;
    const rayGeo = new THREE.PlaneGeometry(beamRadius * 2, beamRadius * 2);
    const rayMat = new THREE.ShaderMaterial({
        vertexShader: sunRayVertexShader,
        fragmentShader: sunRayFragmentShader,
        uniforms: {
            rayColor: { value: color },
            time: { value: 0.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // Horizontal ray plane on game plane (XZ)
    const horizontalRayPlane = new THREE.Mesh(rayGeo, rayMat);
    horizontalRayPlane.rotation.x = Math.PI / 2;
    group.add(horizontalRayPlane);

    // Secondary vertical ray plane (XY) for rich 3D volumetric depth
    const verticalRayPlane = new THREE.Mesh(rayGeo, rayMat.clone());
    group.add(verticalRayPlane);

    // 2. Cinematic Anamorphic Horizontal Lens Flare Streak (Always faces camera)
    const streakWidth = starRadius * 16.0;
    const streakHeight = starRadius * 2.2;
    const streakGeo = new THREE.PlaneGeometry(streakWidth, streakHeight);
    const streakMat = new THREE.ShaderMaterial({
        vertexShader: anamorphicStreakVertexShader,
        fragmentShader: anamorphicStreakFragmentShader,
        uniforms: {
            flareColor: { value: color }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const streakMesh = new THREE.Mesh(streakGeo, streakMat);
    group.add(streakMesh);

    // 3. 4-Point Star Diffraction Cross Flare
    const crossGeo = new THREE.PlaneGeometry(starRadius * 7.5, starRadius * 7.5);
    const crossMat = new THREE.ShaderMaterial({
        vertexShader: anamorphicStreakVertexShader,
        fragmentShader: anamorphicStreakFragmentShader,
        uniforms: {
            flareColor: { value: new THREE.Color(0xffffff) }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const crossMesh1 = new THREE.Mesh(crossGeo, crossMat);
    const crossMesh2 = new THREE.Mesh(crossGeo, crossMat);
    crossMesh2.rotation.z = Math.PI / 4;
    group.add(crossMesh1);
    group.add(crossMesh2);

    let totalTime = 0;

    return {
        group,
        update: (dt: number, camera: THREE.Camera) => {
            totalTime += dt;
            rayMat.uniforms.time.value = totalTime;
            (verticalRayPlane.material as THREE.ShaderMaterial).uniforms.time.value = totalTime * 0.85;

            // Rotate the ray beams slowly around the star for dynamic alive light shafts
            horizontalRayPlane.rotation.z += dt * 0.04;
            verticalRayPlane.rotation.z -= dt * 0.03;

            // Orient the lens flares directly toward the camera
            if (camera) {
                streakMesh.quaternion.copy(camera.quaternion);
                crossMesh1.quaternion.copy(camera.quaternion);
                crossMesh2.quaternion.copy(camera.quaternion);
            }
        },
        dispose: () => {
            rayGeo.dispose();
            rayMat.dispose();
            streakGeo.dispose();
            streakMat.dispose();
            crossGeo.dispose();
            crossMat.dispose();
        }
    };
}

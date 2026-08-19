import * as THREE from 'three';

export function createPlanetaryRings(planetRadius: number, hexColor: number, seed = 42): THREE.Mesh {
    const innerRadius = planetRadius * 1.45;
    const outerRadius = planetRadius * 2.85;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(hexColor);
    const grad = ctx.createLinearGradient(0, 0, 256, 0);

    // Inner transparent boundary
    grad.addColorStop(0.0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.08, `rgba(${Math.round(baseColor.r * 200)}, ${Math.round(baseColor.g * 220)}, ${Math.round(baseColor.b * 240)}, 0.45)`);
    grad.addColorStop(0.35, `rgba(${Math.round(baseColor.r * 255)}, ${Math.round(baseColor.g * 255)}, ${Math.round(baseColor.b * 255)}, 0.85)`);
    // Cassini Division gap
    grad.addColorStop(0.52, 'rgba(0,0,0,0.05)');
    grad.addColorStop(0.58, 'rgba(0,0,0,0.1)');
    // Outer B-Ring
    grad.addColorStop(0.68, `rgba(${Math.round(baseColor.r * 220)}, ${Math.round(baseColor.g * 240)}, ${Math.round(baseColor.b * 255)}, 0.7)`);
    grad.addColorStop(0.92, `rgba(${Math.round(baseColor.r * 180)}, ${Math.round(baseColor.g * 200)}, ${Math.round(baseColor.b * 220)}, 0.3)`);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);

    const ringTexture = new THREE.CanvasTexture(canvas);
    ringTexture.wrapS = THREE.ClampToEdgeWrapping;
    ringTexture.wrapT = THREE.ClampToEdgeWrapping;

    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    ringGeometry.rotateX(Math.PI / 2);

    // Reproject UVs radially so the 1D gradient runs from inner to outer radius
    const pos = ringGeometry.attributes.position;
    const uvs = ringGeometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        const u = (r - innerRadius) / (outerRadius - innerRadius);
        uvs.setXY(i, u, 0.5);
    }
    uvs.needsUpdate = true;

    const ringMaterial = new THREE.MeshStandardMaterial({
        map: ringTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        roughness: 0.8,
        metalness: 0.2,
        depthWrite: false
    });

    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    // Subtle natural axial tilt
    ringMesh.rotation.z = (((seed % 15) + 12) * Math.PI) / 180;
    ringMesh.rotation.x = (((seed % 9) - 4) * Math.PI) / 180;

    return ringMesh;
}

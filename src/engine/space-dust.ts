import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene } from './scene';

let dustPoints: THREE.Points | null = null;
let dustGeo: THREE.BufferGeometry | null = null;
const DUST_COUNT = 90;
const DUST_BOUNDS = 90;

export function initSpaceDust() {
    if (dustPoints) return;

    dustGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(DUST_COUNT * 3);
    const colors = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * DUST_BOUNDS * 2;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_BOUNDS * 2;

        const r = 0.4 + Math.random() * 0.3;
        const g = 0.7 + Math.random() * 0.2;
        const b = 0.9 + Math.random() * 0.1;

        colors[i * 3 + 0] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.4)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);

    const dustTex = new THREE.CanvasTexture(canvas);

    const dustMat = new THREE.PointsMaterial({
        size: 0.85,
        vertexColors: true,
        map: dustTex,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);
}

export function updateSpaceDust(dt: number) {
    if (!dustPoints || !dustGeo) return;

    const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    const px = STATE.playerPosition.x;
    const pz = STATE.playerPosition.z;

    for (let i = 0; i < DUST_COUNT; i++) {
        let x = posArray[i * 3 + 0];
        let z = posArray[i * 3 + 2];

        // Wrap particles continuously relative to player drift
        if (x - px > DUST_BOUNDS) posArray[i * 3 + 0] -= DUST_BOUNDS * 2;
        if (x - px < -DUST_BOUNDS) posArray[i * 3 + 0] += DUST_BOUNDS * 2;
        if (z - pz > DUST_BOUNDS) posArray[i * 3 + 2] -= DUST_BOUNDS * 2;
        if (z - pz < -DUST_BOUNDS) posArray[i * 3 + 2] += DUST_BOUNDS * 2;
    }

    posAttr.needsUpdate = true;
}

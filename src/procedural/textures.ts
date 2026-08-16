import * as THREE from 'three';

export function createPlanetTextures(baseColorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(baseColorHex));
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, 512, 256);

    const continentCount = 6 + (seed % 6);
    for (let c = 0; c < continentCount; c++) {
        const cx = ((seed * (c + 1) * 73) % 512);
        const cy = 40 + ((seed * (c + 1) * 37) % 176);
        const rad = 25 + ((seed * (c + 1) * 19) % 55);

        const continentGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const landColor = baseColor.clone().offsetHSL(0.08, -0.2, -0.15);
        continentGrad.addColorStop(0, `#${landColor.getHexString()}`);
        continentGrad.addColorStop(0.7, `#${landColor.offsetHSL(0, 0, -0.1).getHexString()}`);
        continentGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = continentGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        if (cx - rad < 0) {
            ctx.beginPath();
            ctx.arc(cx + 512, cy, rad, 0, Math.PI * 2);
            ctx.fill();
        } else if (cx + rad > 512) {
            ctx.beginPath();
            ctx.arc(cx - 512, cy, rad, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 512;
    cloudCanvas.height = 256;
    const cloudCtx = cloudCanvas.getContext('2d')!;

    for (let b = 0; b < 10; b++) {
        const y = 30 + b * 20 + Math.sin(b * 1.5) * 8;
        cloudCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        cloudCtx.beginPath();
        cloudCtx.ellipse(256, y, 260, 6 + (b % 4), (seed % 10) * 0.02, 0, Math.PI * 2);
        cloudCtx.fill();
    }

    const map = new THREE.CanvasTexture(canvas);
    const cloudMap = new THREE.CanvasTexture(cloudCanvas);

    return { map, cloudMap };
}

export function createGasGiantTextures(baseColorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(baseColorHex));
    const bandCount = 20;
    const bandHeight = 256 / bandCount;

    for (let i = 0; i < bandCount; i++) {
        const bandColor = baseColor.clone().offsetHSL(
            Math.sin(i * 0.5 + seed) * 0.1,
            (Math.cos(i * 0.8) * 0.2),
            (Math.sin(i * 1.2) * 0.25)
        );
        ctx.fillStyle = `#${bandColor.getHexString()}`;
        ctx.fillRect(0, i * bandHeight, 512, bandHeight + 1);

        if (i % 3 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(0, i * bandHeight, 512, bandHeight * 0.4);
        }
    }

    const stormX = (seed * 83) % 400 + 50;
    const stormY = 80 + (seed * 47) % 100;
    const stormGrad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, 28);
    stormGrad.addColorStop(0, '#ffffff');
    stormGrad.addColorStop(0.5, `#${baseColor.clone().offsetHSL(0.2, 0.4, 0.2).getHexString()}`);
    stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stormGrad;
    ctx.beginPath();
    ctx.ellipse(stormX, stormY, 28, 14, 0.1, 0, Math.PI * 2);
    ctx.fill();

    return { map: new THREE.CanvasTexture(canvas) };
}

export function createIceMoonTextures(baseColorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(baseColorHex));
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.6)';
    ctx.lineWidth = 1.2;
    for (let c = 0; c < 8; c++) {
        ctx.beginPath();
        const startX = (seed * (c + 1) * 31) % 256;
        const startY = (seed * (c + 1) * 17) % 128;
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + 40 + Math.sin(c) * 20, startY + 30 + Math.cos(c) * 20);
        ctx.stroke();
    }

    return { map: new THREE.CanvasTexture(canvas) };
}

export function createVolcanicMoonTextures(baseColorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(baseColorHex));
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, 256, 128);

    for (let v = 0; v < 6; v++) {
        const vx = (seed * (v + 1) * 43) % 256;
        const vy = (seed * (v + 1) * 29) % 128;
        const grad = ctx.createRadialGradient(vx, vy, 0, vx, vy, 12);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.4, '#ef4444');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(vx, vy, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    return { map: new THREE.CanvasTexture(canvas) };
}

export function createCraterMoonTextures(baseColorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(baseColorHex));
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, 256, 128);

    for (let cr = 0; cr < 14; cr++) {
        const cx = (seed * (cr + 1) * 37) % 256;
        const cy = (seed * (cr + 1) * 23) % 128;
        const crad = 3 + (cr % 6);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, crad, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fill();
    }

    return { map: new THREE.CanvasTexture(canvas) };
}

export function createStarTexture(colorHex: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseColor = new THREE.Color(parseInt(colorHex));
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, 512, 256);

    for (let f = 0; f < 18; f++) {
        const fx = (seed * (f + 1) * 41) % 512;
        const fy = (seed * (f + 1) * 29) % 256;
        const rad = 20 + ((seed * (f + 1)) % 40);

        const flareGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
        flareGrad.addColorStop(0, '#ffffff');
        flareGrad.addColorStop(0.3, `#${baseColor.clone().offsetHSL(0.05, 0.2, 0.2).getHexString()}`);
        flareGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, rad, 0, Math.PI * 2);
        ctx.fill();
    }

    return { map: new THREE.CanvasTexture(canvas) };
}

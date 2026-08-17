import * as THREE from 'three';

function pseudoNoise(x: number, y: number, seed = 1) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed = 1) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = pseudoNoise(i, j, seed);
    const n10 = pseudoNoise(i + 1, j, seed);
    const n01 = pseudoNoise(i, j + 1, seed);
    const n11 = pseudoNoise(i + 1, j + 1, seed);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
}

function fbm(x: number, y: number, octaves: number, seed = 1) {
    let val = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let o = 0; o < octaves; o++) {
        val += smoothNoise(x * freq, y * freq, seed + o * 13.37) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    return val;
}

function hexToRgb(hex: string | number) {
    let num = typeof hex === 'string' ? parseInt(hex.replace("0x", ""), 16) : hex;
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// 1. Habitable Planet Textures (Oceans, Continents, Coastlines, Mountains, Polar Caps)
export function createHabitableTextures(colorHex: string | number, seed = 42) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d')!;
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const rgb = hexToRgb(colorHex);

    for (let y = 0; y < h; y++) {
        const lat = Math.abs(y - h / 2) / (h / 2);
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const nx = (x / w) * 5.0;
            const ny = (y / h) * 3.0;

            const n = fbm(nx, ny, 4, seed);

            let r, g, b, bumpVal;

            if (lat > 0.82 + n * 0.12) {
                // Polar Ice Caps
                r = 230 + Math.floor(n * 25);
                g = 245 + Math.floor(n * 10);
                b = 255;
                bumpVal = 40;
            } else if (n < 0.47) {
                // Deep Ocean & Shallow Shelf
                const oceanDepth = n / 0.47;
                if (oceanDepth < 0.8) {
                    r = 8; g = 50 + Math.floor(oceanDepth * 40); b = 140 + Math.floor(oceanDepth * 80);
                } else {
                    // Shallow Cyan Coral Reef
                    r = 10; g = 160 + Math.floor((oceanDepth - 0.8) * 300); b = 210;
                }
                bumpVal = 0;
            } else if (n < 0.51) {
                // Golden Coastline / Beach
                r = 210; g = 180; b = 110;
                bumpVal = 15;
            } else if (n < 0.72) {
                // Alien Biosphere / Continents
                const vegT = (n - 0.51) / 0.21;
                r = Math.floor(rgb.r * 0.3 + (1 - vegT) * 20);
                g = Math.floor(rgb.g * 0.9 + vegT * 40);
                b = Math.floor(rgb.b * 0.4 + vegT * 20);
                bumpVal = 60 + Math.floor(vegT * 60);
            } else {
                // Mountain Peaks & Snow Ridges
                const mountainT = (n - 0.72) / 0.28;
                r = 140 + Math.floor(mountainT * 100);
                g = 145 + Math.floor(mountainT * 95);
                b = 160 + Math.floor(mountainT * 95);
                bumpVal = 140 + Math.floor(mountainT * 115);
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }

    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const map = new THREE.CanvasTexture(colCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    return { map, bumpMap };
}

// 2. Gas Giant Textures (Atmospheric Bands, Storm Swirls, Great Oval Spot)
export function createGasGiantTextures(colorHex: string | number, seed = 77) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const base = hexToRgb(colorHex);
    const stormX = (Math.abs(seed) % 100) / 100 * w * 0.6 + w * 0.2;
    const stormY = h * 0.58;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const nx = (x / w) * 6.0;
            const ny = (y / h) * 8.0;

            const turb = fbm(nx, ny * 0.5, 3, seed);
            const band = Math.sin(y * 0.35 + turb * 4.0);

            // Distance to atmospheric Great Storm
            const sDist = Math.hypot((x - stormX) / 1.8, y - stormY);

            let r, g, b;
            if (sDist < 12) {
                // Great Storm Eye
                const swirl = Math.sin(sDist * 0.6 + Math.atan2(y - stormY, x - stormX) * 3);
                r = Math.min(255, base.r * 1.6 + swirl * 40);
                g = Math.min(255, base.g * 0.8 + swirl * 20);
                b = Math.min(255, base.b * 1.5 + swirl * 30);
            } else {
                const bandWeight = (band + 1) * 0.5;
                r = Math.floor(base.r * (0.4 + bandWeight * 0.7) + turb * 35);
                g = Math.floor(base.g * (0.4 + bandWeight * 0.7) + turb * 35);
                b = Math.floor(base.b * (0.4 + bandWeight * 0.7) + turb * 35);
            }

            data[idx] = Math.min(255, Math.max(0, r));
            data[idx + 1] = Math.min(255, Math.max(0, g));
            data[idx + 2] = Math.min(255, Math.max(0, b));
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    return { map, bumpMap: null as THREE.CanvasTexture | null };
}

// 3. Rocky Planet / Moon Textures (Crater Impact Basins, Regolith Fissures)
export function createRockyTextures(colorHex: string | number, seed = 99) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d')!;
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const base = hexToRgb(colorHex);

    const craters: { x: number; y: number; radius: number }[] = [];
    for (let c = 0; c < 12; c++) {
        craters.push({
            x: ((Math.abs(seed) * (c + 1) * 37) % w),
            y: ((Math.abs(seed) * (c + 1) * 61) % h),
            radius: 4 + (c % 5) * 3
        });
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 6.0, (y / h) * 4.0, 4, seed);

            let bumpVal = Math.floor(n * 160);
            let r = Math.floor(base.r * (0.6 + n * 0.5));
            let g = Math.floor(base.g * (0.6 + n * 0.5));
            let b = Math.floor(base.b * (0.6 + n * 0.5));

            // Crater impacts
            for (let c = 0; c < craters.length; c++) {
                const cr = craters[c];
                const d = Math.hypot(x - cr.x, y - cr.y);
                if (d < cr.radius) {
                    const ratio = d / cr.radius;
                    if (ratio < 0.7) {
                        r = Math.floor(r * 0.6);
                        g = Math.floor(g * 0.6);
                        b = Math.floor(b * 0.6);
                        bumpVal = Math.max(0, bumpVal - 60);
                    } else {
                        r = Math.min(255, r + 40);
                        g = Math.min(255, g + 40);
                        b = Math.min(255, b + 40);
                        bumpVal = Math.min(255, bumpVal + 70);
                    }
                }
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas)
    };
}

// 4. Ice Moon Textures (Europa-style Cryo-Cracks, Subglacial Fractures)
export function createIceMoonTextures(colorHex: string | number, seed = 123) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d')!;
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 8.0, (y / h) * 6.0, 3, seed);
            const crack1 = Math.abs(Math.sin(x * 0.15 + n * 3.0 + y * 0.08));
            const crack2 = Math.abs(Math.sin(y * 0.2 - x * 0.1 + n * 2.5));
            const isCrack = crack1 < 0.1 || crack2 < 0.08;

            let r, g, b, bumpVal;
            if (isCrack) {
                r = 180 + Math.floor(n * 30);
                g = 100 + Math.floor(n * 20);
                b = 80;
                bumpVal = 180;
            } else {
                r = 210 + Math.floor(n * 40);
                g = 235 + Math.floor(n * 20);
                b = 255;
                bumpVal = 60 + Math.floor(n * 50);
            }

            colData[idx] = Math.min(255, r);
            colData[idx + 1] = Math.min(255, g);
            colData[idx + 2] = Math.min(255, b);
            colData[idx + 3] = 255;

            bumpData[idx] = bumpVal;
            bumpData[idx + 1] = bumpVal;
            bumpData[idx + 2] = bumpVal;
            bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas)
    };
}

// 5. Volcanic Moon Textures (Sulfur Plains & Glowing Magma Emissive Calderas)
export function createVolcanicMoonTextures(colorHex: string | number, seed = 321) {
    const w = 256, h = 128;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w; colCanvas.height = h;
    const colCtx = colCanvas.getContext('2d')!;
    const colImg = colCtx.createImageData(w, h);
    const colData = colImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w; bumpCanvas.height = h;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    const bumpImg = bumpCtx.createImageData(w, h);
    const bumpData = bumpImg.data;

    const emCanvas = document.createElement('canvas');
    emCanvas.width = w; emCanvas.height = h;
    const emCtx = emCanvas.getContext('2d')!;
    const emImg = emCtx.createImageData(w, h);
    const emData = emImg.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 6.0, (y / h) * 4.0, 4, seed);
            const magma = Math.abs(Math.sin(x * 0.12 + y * 0.15 + n * 4.0));
            const isMagma = magma < 0.12;

            let r, g, b, emR, emG, emB, bumpVal;
            if (isMagma) {
                r = 255; g = 110; b = 10;
                emR = 255; emG = 90; emB = 0;
                bumpVal = 20;
            } else if (n > 0.6) {
                r = 230; g = 190; b = 25;
                emR = 0; emG = 0; emB = 0;
                bumpVal = 130;
            } else {
                r = 60 + Math.floor(n * 40);
                g = 40 + Math.floor(n * 30);
                b = 30 + Math.floor(n * 20);
                emR = 0; emG = 0; emB = 0;
                bumpVal = 80;
            }

            colData[idx] = r; colData[idx + 1] = g; colData[idx + 2] = b; colData[idx + 3] = 255;
            emData[idx] = emR; emData[idx + 1] = emG; emData[idx + 2] = emB; emData[idx + 3] = 255;
            bumpData[idx] = bumpVal; bumpData[idx + 1] = bumpVal; bumpData[idx + 2] = bumpVal; bumpData[idx + 3] = 255;
        }
    }
    colCtx.putImageData(colImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);
    emCtx.putImageData(emImg, 0, 0);

    return {
        map: new THREE.CanvasTexture(colCanvas),
        bumpMap: new THREE.CanvasTexture(bumpCanvas),
        emissiveMap: new THREE.CanvasTexture(emCanvas)
    };
}

// 6. Solar Plasma Texture (Turbulent Granulation)
export function createStarTexture(colorHex: string | number, seed = 555) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const base = hexToRgb(colorHex);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 10.0, (y / h) * 6.0, 3, seed);
            const flare = (n - 0.5) * 60;

            data[idx] = Math.min(255, Math.max(0, base.r + flare + 40));
            data[idx + 1] = Math.min(255, Math.max(0, base.g + flare + 20));
            data[idx + 2] = Math.min(255, Math.max(0, base.b + flare));
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return { map: new THREE.CanvasTexture(canvas) };
}

// 7. Dynamic Transparent Cloud Texture (Habitable Atmosphere)
export function createCloudTexture(seed = 888) {
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const n = fbm((x / w) * 8.0, (y / h) * 4.0, 3, seed);
            const alpha = Math.max(0, (n - 0.52) * 2.2);

            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = Math.min(255, Math.floor(alpha * 255));
        }
    }
    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

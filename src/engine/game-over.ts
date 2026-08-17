import * as THREE from 'three';
import { STATE } from '../core/state';
import { scene, camera } from './scene';
import { addLogEntry } from '../ui/hud';
import { playExplosionSound, playSiliconCollectSound } from './audio';
import { clearActiveSystem, spawnPlanetsAndAsteroids } from '../systems/universe';
import { renderCrewUI } from '../systems/crew';
import { updateMutationUI } from '../ui/deck';

interface DebrisParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
}

const activeDebris: DebrisParticle[] = [];
let explosionShockwave: THREE.Mesh | null = null;
let shockwaveLife = 0;
let cameraShakeDuration = 0;

export function initGameOverUI() {
    const respawnBtn = document.getElementById('respawn-btn');
    if (respawnBtn) {
        respawnBtn.addEventListener('click', () => {
            respawnPlayer();
        });
    }

    const restartBtn = document.getElementById('restart-game-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            restartGame();
        });
    }
}

export function triggerGameOver(reason = "Kritischer Hüllenschaden und Kollaps des biologischen Zellkerns.") {
    if (STATE.isGameOver) return;
    STATE.isGameOver = true;
    STATE.health = 0;

    // 1. Play Massive Cinematic Explosion Sound
    playExplosionSound();

    // 2. Trigger Camera Tremor
    cameraShakeDuration = 0.8;

    // 3. Spawn 3D Explosion Particle Shockwave & Debris Fragments
    spawnExplosionFX(STATE.playerPosition);

    // 4. Hide Player Mesh temporarily
    if (STATE.playerGroup) {
        STATE.playerGroup.visible = false;
    }

    addLogEntry("SYSTEM", `💥 KATASTROPHALER ZELLKORNBRENN-SCHADEN: ${reason}`);

    setTimeout(() => {
        const modal = document.getElementById('game-over-modal');
        const reasonEl = document.getElementById('game-over-reason');
        const systemsEl = document.getElementById('go-stat-systems');
        const scannedEl = document.getElementById('go-stat-scanned');
        const crewEl = document.getElementById('go-stat-crew');
        const resEl = document.getElementById('go-stat-resources');

        if (reasonEl) reasonEl.innerText = reason;
        if (systemsEl) systemsEl.innerText = `${STATE.systemsVisited} Sternensysteme`;
        if (scannedEl) scannedEl.innerText = `${Object.keys(STATE.scannedPlanets).length} Welten`;
        if (crewEl) crewEl.innerText = `${STATE.crew.length} Individuen`;
        if (resEl) resEl.innerText = `${Math.floor(STATE.bioRes)} Bio / ${Math.floor(STATE.siliconRes)} Silizium`;

        if (modal) {
            modal.style.display = 'flex';
        }
    }, 750);
}

function spawnExplosionFX(pos: THREE.Vector3) {
    // A. Expanding Fireball / Plasma Ring Shockwave
    const shockGeo = new THREE.RingGeometry(0.5, 2.5, 32);
    shockGeo.rotateX(Math.PI / 2);
    const shockMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    explosionShockwave = new THREE.Mesh(shockGeo, shockMat);
    explosionShockwave.position.copy(pos);
    scene.add(explosionShockwave);
    shockwaveLife = 1.0;

    // B. 60 Disintegrating Biological & Crystalline Fragments
    const particleCount = 65;
    const colors = [0xf97316, 0xef4444, 0xfacc15, 0x00ff88, 0x38bdf8];

    for (let i = 0; i < particleCount; i++) {
        const size = 0.2 + Math.random() * 0.5;
        const geo = Math.random() > 0.5
            ? new THREE.DodecahedronGeometry(size, 0)
            : new THREE.TetrahedronGeometry(size, 0);

        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * 0.4;
        const speed = 12 + Math.random() * 32;

        const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            elevation * speed,
            Math.sin(angle) * speed
        );

        const rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
        );

        activeDebris.push({
            mesh,
            velocity,
            rotSpeed,
            life: 1.2 + Math.random() * 0.6,
            maxLife: 1.8
        });
    }
}

export function updateExplosionEffects(dt: number) {
    // 1. Camera Shake Tremor
    if (cameraShakeDuration > 0) {
        cameraShakeDuration -= dt;
        const shakeStrength = Math.min(1.5, cameraShakeDuration * 2.5);
        camera.position.x += (Math.random() - 0.5) * shakeStrength;
        camera.position.z += (Math.random() - 0.5) * shakeStrength;
    }

    // 2. Shockwave Expansion
    if (explosionShockwave && shockwaveLife > 0) {
        shockwaveLife -= dt;
        const progress = 1.0 - (shockwaveLife / 1.0);
        const scale = 1.0 + progress * 35.0;
        explosionShockwave.scale.set(scale, 1, scale);
        (explosionShockwave.material as THREE.Material).opacity = (1.0 - progress) * 0.9;

        if (shockwaveLife <= 0) {
            scene.remove(explosionShockwave);
            explosionShockwave.geometry.dispose();
            (explosionShockwave.material as THREE.Material).dispose();
            explosionShockwave = null;
        }
    }

    // 3. Debris Fragments Animation
    for (let i = activeDebris.length - 1; i >= 0; i--) {
        const p = activeDebris[i];
        p.life -= dt;

        p.mesh.position.addScaledVector(p.velocity, dt);
        p.velocity.multiplyScalar(Math.exp(-1.5 * dt)); // Drag

        p.mesh.rotation.x += p.rotSpeed.x * dt;
        p.mesh.rotation.y += p.rotSpeed.y * dt;
        p.mesh.rotation.z += p.rotSpeed.z * dt;

        const alpha = Math.max(0, p.life / p.maxLife);
        (p.mesh.material as THREE.Material).opacity = alpha;

        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
            activeDebris.splice(i, 1);
        }
    }
}

export function respawnPlayer() {
    clearExplosionFX();

    STATE.health = STATE.maxHealth;
    STATE.bioEnergy = STATE.maxBioEnergy;
    STATE.mentalEnergy = STATE.maxMentalEnergy;
    STATE.isGameOver = false;

    // Reset position to safe orbital trajectory (Goldilocks Zone R=75)
    STATE.playerPosition.set(0, 0, 75);
    STATE.playerVelocity.set(5.2, 0, 0);
    STATE.playerAcceleration.set(0, 0, 0);

    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 75);
        STATE.playerGroup.visible = true;
    }

    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';

    playSiliconCollectSound();
    addLogEntry("SYSTEM", "🧬 Phönix-Zellregeneration abgeschlossen. Zellkern & Traum-Matrix auf 100% wiederhergestellt.");
}

export function restartGame() {
    clearExplosionFX();

    STATE.health = STATE.maxHealth;
    STATE.bioEnergy = STATE.maxBioEnergy;
    STATE.mentalEnergy = STATE.maxMentalEnergy;
    STATE.isGameOver = false;
    STATE.systemsVisited = 1;
    STATE.bioRes = 0;
    STATE.siliconRes = 0;
    STATE.crew = [];
    STATE.scannedPlanets = {};
    STATE.currentSystemId = 0;

    // Reset mutations
    Object.keys(STATE.mutations).forEach(key => {
        (STATE.mutations as any)[key].purchased = false;
    });

    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';

    clearActiveSystem();
    spawnPlanetsAndAsteroids();

    STATE.playerPosition.set(0, 0, 75);
    STATE.playerVelocity.set(5.2, 0, 0);
    STATE.playerAcceleration.set(0, 0, 0);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 75);
        STATE.playerGroup.visible = true;
    }

    renderCrewUI();
    updateMutationUI();

    addLogEntry("SYSTEM", "🌌 Neues Universum initialisiert. Sternensystem 0 erreicht.");
}

function clearExplosionFX() {
    if (explosionShockwave) {
        scene.remove(explosionShockwave);
        explosionShockwave = null;
    }
    activeDebris.forEach(p => {
        scene.remove(p.mesh);
    });
    activeDebris.length = 0;
    cameraShakeDuration = 0;
}

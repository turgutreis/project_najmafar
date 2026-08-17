import { STATE, activePlanets } from '../core/state';
import { addLogEntry } from '../ui/hud';
import { playCrashSound, playSiliconCollectSound } from './audio';
import { clearActiveSystem, spawnPlanetsAndAsteroids } from '../systems/universe';
import { renderCrewUI } from '../systems/crew';
import { updateMutationUI } from '../ui/deck';

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

    playCrashSound();
    addLogEntry("SYSTEM", `⚠️ KRITISCHER BIOLOGISCHER KOLLAPS: ${reason}`);

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
}

export function respawnPlayer() {
    STATE.health = STATE.maxHealth;
    STATE.bioEnergy = STATE.maxBioEnergy;
    STATE.mentalEnergy = STATE.maxMentalEnergy;
    STATE.isGameOver = false;

    // Reset position to safe orbital trajectory
    STATE.playerPosition.set(0, 0, 65);
    STATE.playerVelocity.set(5, 0, 0);
    STATE.playerAcceleration.set(0, 0, 0);

    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 65);
    }

    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';

    playSiliconCollectSound();
    addLogEntry("SYSTEM", "🧬 Phönix-Zellregeneration abgeschlossen. Zellkern & Traum-Matrix auf 100% wiederhergestellt.");
}

export function restartGame() {
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

    STATE.playerPosition.set(0, 0, 65);
    STATE.playerVelocity.set(5, 0, 0);
    STATE.playerAcceleration.set(0, 0, 0);
    if (STATE.playerGroup) {
        STATE.playerGroup.position.set(0, 0, 65);
    }

    renderCrewUI();
    updateMutationUI();

    addLogEntry("SYSTEM", "🌌 Neues Universum initialisiert. Sternensystem 0 erreicht.");
}

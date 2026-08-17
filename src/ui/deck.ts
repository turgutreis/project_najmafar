import { STATE } from '../core/state';
import { playSiliconCollectSound } from '../engine/audio';
import { addLogEntry } from './hud';
import { calculateCrewBuffs, renderCrewUI } from '../systems/crew';

export function initDeckUI() {
    const leftCollapseBtn = document.getElementById('left-collapse-btn');
    const leftDeckPanel = document.getElementById('left-deck-panel');
    if (leftCollapseBtn && leftDeckPanel) {
        leftCollapseBtn.addEventListener('click', () => {
            leftDeckPanel.classList.toggle('collapsed');
            if (leftDeckPanel.classList.contains('collapsed')) {
                leftCollapseBtn.innerText = '›';
                leftCollapseBtn.title = "Sensoren ausklappen";
            } else {
                leftCollapseBtn.innerText = '‹';
                leftCollapseBtn.title = "Sensoren einklappen";
            }
        });
    }

    const rightCollapseBtn = document.getElementById('right-collapse-btn');
    const rightDeckPanel = document.getElementById('right-deck-panel');
    if (rightCollapseBtn && rightDeckPanel) {
        rightCollapseBtn.addEventListener('click', () => {
            rightDeckPanel.classList.toggle('collapsed');
            if (rightDeckPanel.classList.contains('collapsed')) {
                rightCollapseBtn.innerText = '‹';
                rightCollapseBtn.title = "Status-Deck ausklappen";
            } else {
                rightCollapseBtn.innerText = '›';
                rightCollapseBtn.title = "Status-Deck einklappen";
            }
        });
    }

    const tabButtons = document.querySelectorAll('#right-deck-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const crewContent = document.getElementById('tab-content-crew');
            const evoContent = document.getElementById('tab-content-evolution');

            if (targetTab === 'crew') {
                if (crewContent) crewContent.classList.add('active');
                if (evoContent) evoContent.classList.remove('active');
            } else if (targetTab === 'evolution') {
                if (crewContent) crewContent.classList.remove('active');
                if (evoContent) evoContent.classList.add('active');
            }
        });
    });

    const mutButtons = document.querySelectorAll('.mut-btn');
    mutButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mutType = btn.getAttribute('data-mutation');
            if (mutType) {
                buyMutation(mutType);
            }
        });
    });
}

export function buyMutation(type: string) {
    const mut = (STATE.mutations as any)[type];
    if (!mut || mut.purchased) return;

    if (STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost) {
        STATE.bioRes -= mut.bioCost;
        STATE.siliconRes -= mut.siliconCost;
        mut.purchased = true;

        playSiliconCollectSound();

        const btn = document.querySelector(`.mut-btn[data-mutation="${type}"]`);
        if (btn) {
            btn.classList.add('purchased');
            btn.innerHTML = "Aktiviert ✓";
        }

        if (type === 'armor') {
            addLogEntry("EVOLUTION", "Organische Chitin-Panzerung gehärtet. Kollisionsschaden um 50% reduziert.");
            const hull = document.getElementById('schematic-hull');
            if (hull) hull.setAttribute('stroke-width', '4');
        } else if (type === 'o2') {
            addLogEntry("EVOLUTION", "Metabolische O2-Synthese aktiviert. Stress-Zuwachs halbiert.");
        } else if (type === 'synapses') {
            STATE.psionicRange = 140;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Psionische Synapsen erweitert! Gedanken-Echo Reichweite auf 140 LJ vergrößert.");
        } else if (type === 'cocoon') {
            STATE.maxCrewCapacity = 4;
            addLogEntry("EVOLUTION", "Neuronales Kokon-Gewebe mutiert! Maximale Crew-Kapazität auf 4 erweitert.");
            renderCrewUI();
        } else if (type === 'hivemind') {
            STATE.maxCrewCapacity = 6;
            calculateCrewBuffs();
            addLogEntry("EVOLUTION", "Symbiotische Synapsen-Kammer erwacht! Kapazität auf 6 erhöht & alle Spezialisten-Buffs um +20% verstärkt!");
            renderCrewUI();
        } else if (type === 'folddrive') {
            STATE.warpRange = 160;
            addLogEntry("EVOLUTION", "Raumfaltungs-Membran mutiert! Warp-Reichweite auf 160 LJ erweitert, Faltungskosten um 30% gesenkt.");
        } else if (type === 'translator') {
            addLogEntry("EVOLUTION", "Dschinn-Übersetzer integriert! Alien-Funksignale & Crew-Dialoge werden vollautomatisch dechiffriert.");
        }

        updateMutationUI();
    } else {
        addLogEntry("SYSTEM", `Evolution fehlgeschlagen: Nicht genügend Ressourcen (${mut.bioCost} Bio | ${mut.siliconCost} Silizium benötigt)!`);
    }
}

export function updateMutationUI() {
    const bioEl = document.getElementById('res-bio-count');
    const silEl = document.getElementById('res-silicon-count');
    if (bioEl) bioEl.innerText = `${Math.floor(STATE.bioRes)}`;
    if (silEl) silEl.innerText = `${Math.floor(STATE.siliconRes)}`;

    Object.keys(STATE.mutations).forEach(key => {
        const mut = (STATE.mutations as any)[key];
        const btn = document.querySelector(`.mut-btn[data-mutation="${key}"]`) as HTMLButtonElement;
        if (btn) {
            if (mut.purchased) {
                btn.disabled = true;
                btn.classList.add('purchased');
                btn.innerText = "Aktiviert ✓";
            } else {
                const canAfford = STATE.bioRes >= mut.bioCost && STATE.siliconRes >= mut.siliconCost;
                btn.disabled = !canAfford;
            }
        }
    });
}

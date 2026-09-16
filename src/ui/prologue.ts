import { playHeartbeatPulse } from '../engine/audio';

export interface PrologueLine {
    text: string;
    subtext?: string;
    duration: number; // ms to display before next line
    heartbeat?: boolean;
}

const PROLOGUE_STORY: PrologueLine[] = [
    {
        text: "Deine Heimatwelt ist weiter als das Licht entfernt...",
        subtext: "Milliarden Parsec im toten Vakuum.",
        duration: 3800,
        heartbeat: true
    },
    {
        text: "Du hast gesehen, wie Sterne sterben können.",
        subtext: "Ganze Sonnenreiche verglüht zu schwarzer Asche.",
        duration: 3800,
        heartbeat: true
    },
    {
        text: "Was bleiben wird, sind Säulen der Leere.",
        subtext: "Ein Universum im Kältetod. Und du, der letzte Leviathan.",
        duration: 4000,
        heartbeat: true
    },
    {
        text: "Erwache, Najmafar.",
        subtext: "Erkunde dieses Sternensystem. Durchbrich das ewige Schweigen.",
        duration: 3800,
        heartbeat: true
    }
];

let isPrologueActive = false;
let prologueTimeout: any = null;
let currentLineIndex = 0;
let onCompleteCallback: (() => void) | null = null;

export function isPrologueRunning(): boolean {
    return isPrologueActive;
}

export function triggerPrologueSequence(onComplete: () => void) {
    const overlay = document.getElementById('prologue-overlay');
    if (!overlay) {
        onComplete();
        return;
    }

    // Check if player already saw it this session and wants to bypass
    const seenPrologue = sessionStorage.getItem('where_stars_die_prologue_seen');
    if (seenPrologue === 'true') {
        // Fast start or replay option
    }

    isPrologueActive = true;
    onCompleteCallback = onComplete;
    currentLineIndex = 0;

    overlay.classList.remove('hidden');
    overlay.classList.add('visible');

    const textEl = document.getElementById('prologue-main-text');
    const subTextEl = document.getElementById('prologue-sub-text');
    const stepEl = document.getElementById('prologue-step-counter');

    function showLine(index: number) {
        if (!isPrologueActive) return;

        if (index >= PROLOGUE_STORY.length) {
            finishPrologue();
            return;
        }

        const line = PROLOGUE_STORY[index];

        if (line.heartbeat) {
            try {
                playHeartbeatPulse();
            } catch (e) {
                // Audio might still be warming up
            }
        }

        if (textEl) {
            textEl.classList.remove('fade-in');
            void textEl.offsetWidth; // Trigger reflow
            textEl.innerText = line.text;
            textEl.classList.add('fade-in');
        }

        if (subTextEl) {
            subTextEl.classList.remove('fade-in');
            void subTextEl.offsetWidth;
            subTextEl.innerText = line.subtext || '';
            subTextEl.classList.add('fade-in');
        }

        if (stepEl) {
            stepEl.innerText = `${index + 1} / ${PROLOGUE_STORY.length}`;
        }

        prologueTimeout = setTimeout(() => {
            currentLineIndex++;
            showLine(currentLineIndex);
        }, line.duration);
    }

    showLine(0);
}

export function finishPrologue() {
    if (!isPrologueActive) return;
    isPrologueActive = false;

    if (prologueTimeout) {
        clearTimeout(prologueTimeout);
        prologueTimeout = null;
    }

    sessionStorage.setItem('where_stars_die_prologue_seen', 'true');

    const overlay = document.getElementById('prologue-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.remove('fade-out');
            overlay.classList.add('hidden');
        }, 1200);
    }

    if (onCompleteCallback) {
        const cb = onCompleteCallback;
        onCompleteCallback = null;
        cb();
    }
}

export function initPrologueListeners() {
    const skipBtn = document.getElementById('skip-prologue-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            finishPrologue();
        });
    }

    const overlay = document.getElementById('prologue-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (isPrologueActive) {
                // Skip to next line or finish
                currentLineIndex++;
                if (currentLineIndex >= PROLOGUE_STORY.length) {
                    finishPrologue();
                } else {
                    if (prologueTimeout) clearTimeout(prologueTimeout);
                    const textEl = document.getElementById('prologue-main-text');
                    const subTextEl = document.getElementById('prologue-sub-text');
                    const stepEl = document.getElementById('prologue-step-counter');
                    const line = PROLOGUE_STORY[currentLineIndex];
                    if (line.heartbeat) playHeartbeatPulse();
                    if (textEl) {
                        textEl.classList.remove('fade-in');
                        void textEl.offsetWidth;
                        textEl.innerText = line.text;
                        textEl.classList.add('fade-in');
                    }
                    if (subTextEl) {
                        subTextEl.classList.remove('fade-in');
                        void subTextEl.offsetWidth;
                        subTextEl.innerText = line.subtext || '';
                        subTextEl.classList.add('fade-in');
                    }
                    if (stepEl) stepEl.innerText = `${currentLineIndex + 1} / ${PROLOGUE_STORY.length}`;
                    prologueTimeout = setTimeout(() => {
                        currentLineIndex++;
                        if (currentLineIndex >= PROLOGUE_STORY.length) finishPrologue();
                    }, line.duration);
                }
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!isPrologueActive) return;
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
            finishPrologue();
        }
    });
}

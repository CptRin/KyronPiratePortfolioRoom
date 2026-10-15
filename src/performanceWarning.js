import './performanceWarning.scss';

export const PERFORMANCE_SETTINGS = {
    fpsThreshold: 25,
    lowSeconds: 3,
    windowMs: 1000,
    resumeGraceMs: 1500,
};

// Measures consecutive slow one-second windows, not isolated slow frames.
export function createLowFpsDetector(settings = PERFORMANCE_SETTINGS) {
    let last = null, elapsed = 0, frames = 0, slowMs = 0;
    function reset() { last = null; elapsed = 0; frames = 0; slowMs = 0; }
    return {
        reset,
        sample(now) {
            if (last === null) { last = now; return null; }
            const delta = now - last;
            last = now;
            if (delta <= 0) return null;
            elapsed += delta;
            frames++;
            if (elapsed < settings.windowMs) return null;
            const fps = frames * 1000 / elapsed;
            // One long stall counts as just one slow window.
            slowMs = fps < settings.fpsThreshold
                ? slowMs + settings.windowMs : 0;
            elapsed = 0;
            frames = 0;
            return { fps, shouldWarn: slowMs >= settings.lowSeconds * 1000 };
        },
    };
}

export function createPerformanceWarning({ onOpen, onClose, onClick } = {}) {
    const detector = createLowFpsDetector();
    let started = false;
    let shown = false;
    let dialog = null;
    let readyAt = Infinity;
    let wasPaused = false;
    function show() {
        if (dialog) return;
        shown = true;
        detector.reset();
        const previousFocus = document.activeElement;
        dialog = document.createElement('dialog');
        dialog.className = 'performance-warning';
        dialog.setAttribute('aria-labelledby', 'performance-warning-title');
        dialog.setAttribute('aria-describedby', 'performance-warning-description');
        dialog.innerHTML = `
            <h2 id="performance-warning-title">Running a little slowly?</h2>
            <p id="performance-warning-description">Try turning on hardware acceleration in your browser settings, then restart your browser.</p>
            <button type="button" class="performance-warning-continue">Continue anyway</button>
        `;
        document.body.append(dialog);
        const currentDialog = dialog;
        currentDialog.addEventListener('click', event => event.stopPropagation());
        currentDialog.querySelector('button').addEventListener('click', () => {
            onClick?.();
            currentDialog.close();
        });
        currentDialog.addEventListener('close', () => {
            currentDialog.remove();
            dialog = null;
            onClose?.();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus({ preventScroll: true });
            }
        }, { once: true });
        currentDialog.showModal();
        onOpen?.();
    }

    document.addEventListener('visibilitychange', () => {
        detector.reset();
        readyAt = Math.max(readyAt, performance.now() + PERFORMANCE_SETTINGS.resumeGraceMs);
    });

    return {
        start({ warmupMs = 4000 } = {}) {
            started = true;
            readyAt = performance.now() + warmupMs;
            detector.reset();
        },
        sample(now, { paused = false } = {}) {
            if (!started || shown) return;
            if (document.hidden || paused) {
                detector.reset();
                wasPaused = true;
                return;
            }
            if (wasPaused) {
                wasPaused = false;
                readyAt = Math.max(readyAt, now + PERFORMANCE_SETTINGS.resumeGraceMs);
            }
            if (now < readyAt) { detector.reset(); return; }
            const result = detector.sample(now);
            if (result) {
                if (!shown && result.shouldWarn) show();
            }
        },
        // Manual preview for local testing; it uses the same real dialog.
        preview: show,
    };
}

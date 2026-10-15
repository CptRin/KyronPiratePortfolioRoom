// src/inkDissolve.js
// Procedural ink dissolve — no external texture required.

export const INK_SETTINGS = {
    duration: 1800,       // Background dissolve duration, milliseconds
    textDuration: 700,    // Buttons/text dissolve duration
    pauseAfterText: 100,  // Brief pause before background dissolves
    patchScale: 1.5,        // Lower = larger ink patches
    edgeSoftness: 0.12,   // Higher = softer edges
    resolution: 420,      // Background canvas resolution
    textResolution: 180, // Smaller canvas for the text mask
};

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => value * value * (3 - 2 * value);

function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = smooth(x - ix);
    const ty = smooth(y - iy);

    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);

    return (
        (a + (b - a) * tx) * (1 - ty) +
        (c + (d - c) * tx) * ty
    );
}

function createNoiseCanvas(width, height, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pixels = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const field = new Float32Array(canvas.width * canvas.height);
    const shortEdge = Math.min(canvas.width, canvas.height);

    let minimum = Infinity;
    let maximum = -Infinity;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            let value = 0;
            let amplitude = 1;
            let frequency = 1;
            let weight = 0;

            for (let octave = 0; octave < 4; octave++) {
                value += amplitude * noise(
                    (x / shortEdge) *
                        INK_SETTINGS.patchScale *
                        frequency + 17,
                    (y / shortEdge) *
                        INK_SETTINGS.patchScale *
                        frequency + 31
                );

                weight += amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }

            value /= weight;

            field[y * canvas.width + x] = value;
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
        }
    }

    const range = maximum - minimum || 1;

    for (let i = 0; i < field.length; i++) {
        field[i] = (field[i] - minimum) / range;
    }

    return {
        canvas,

        draw(progress) {
            const softness = Math.max(
                0.001,
                INK_SETTINGS.edgeSoftness
            );

            const threshold =
                -softness +
                clamp(progress) * (1 + 2 * softness);

            for (let i = 0; i < field.length; i++) {
                const opacity = smooth(
                    clamp(
                        (field[i] - threshold) / softness + 0.5
                    )
                );

                pixels.data[i * 4 + 3] =
                    Math.round(opacity * 255);
            }

            ctx.putImageData(pixels, 0, 0);
        },
    };
}

export function prepareInkDissolve(screen) {
    const aspect =
        window.innerWidth / Math.max(1, window.innerHeight);

    const longest = INK_SETTINGS.resolution;

    const width = aspect >= 1
        ? longest
        : longest * aspect;

    const height = aspect >= 1
        ? longest / aspect
        : longest;

    const background = createNoiseCanvas(
        width,
        height,
        getComputedStyle(screen).backgroundColor
    );

    if (!background) return null;

    background.canvas.className = "loading-ink-canvas";
    background.canvas.setAttribute("aria-hidden", "true");

    // A small, separate alpha mask dissolves the actual DOM text
    // and buttons while preserving their fonts, borders and colours.
    const text = createNoiseCanvas(
        INK_SETTINGS.textResolution,
        INK_SETTINGS.textResolution,
        "#ffffff"
    );

    return { background, text };
}

export function playInkDissolve(screen, prepared, onComplete) {
    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion || !prepared) {
        onComplete();
        return;
    }

    const elements = [
        ...screen.querySelectorAll(
            ".loading-center, .loading-footer"
        ),
    ];

    const textDuration = Math.max(
        1,
        INK_SETTINGS.textDuration
    );

    const backgroundDuration = Math.max(
        1,
        INK_SETTINGS.duration
    );

    const backgroundStart =
        textDuration +
        Math.max(0, INK_SETTINGS.pauseAfterText);

    const totalDuration =
        backgroundStart + backgroundDuration;

    let finished = false;
    let backgroundStarted = false;
    let frame;
    let lastTextFrame = -Infinity;

    const started = performance.now();

    function finish() {
        if (finished) return;

        finished = true;
        cancelAnimationFrame(frame);
        clearTimeout(fallback);

        // The loading-screen controller removes the overlay,
        // enables controls, and starts the room intro.
        onComplete();
    }

    const fallback = setTimeout(
        finish,
        totalDuration + 750
    );

    // Keep the existing pink background opaque during text dissolve.
    // Hide keyboard focus decoration once entry has been selected.
    const focused = document.activeElement;

    if (focused instanceof HTMLElement && screen.contains(focused)) {
        focused.blur();
    }

    elements.forEach((element) => {
        element.style.pointerEvents = "none";
        element.style.transition = "none";

        element.style.maskSize = "100% 100%";
        element.style.maskRepeat = "no-repeat";
        element.style.maskMode = "alpha";

        element.style.webkitMaskSize = "100% 100%";
        element.style.webkitMaskRepeat = "no-repeat";
    });

    function drawText(progress) {
        if (!prepared.text) {
            // Graceful fallback if a second canvas is unavailable.
            elements.forEach((element) => {
                element.style.opacity = String(1 - progress);
            });
            return;
        }

        prepared.text.draw(smooth(progress));

        const mask =
            `url("${prepared.text.canvas.toDataURL("image/png")}")`;

        elements.forEach((element) => {
            element.style.maskImage = mask;
            element.style.webkitMaskImage = mask;
        });
    }

    function beginBackground() {
        if (backgroundStarted) return;
        backgroundStarted = true;

        // Text has finished dissolving before the background starts.
        elements.forEach((element) => {
            element.style.visibility = "hidden";
            element.style.maskImage = "none";
            element.style.webkitMaskImage = "none";
        });

        prepared.background.draw(0);
        screen.prepend(prepared.background.canvas);

        screen.classList.add("is-dissolving");
        screen.style.background = "transparent";
    }

    function tick(now) {
        if (finished) return;

        try {
            const elapsed = now - started;

            if (elapsed < textDuration) {
                // Limit PNG mask updates to 30 FPS.
                if (now - lastTextFrame >= 1000 / 30) {
                    drawText(clamp(elapsed / textDuration));
                    lastTextFrame = now;
                }
            } else {
                elements.forEach((element) => {
                    element.style.visibility = "hidden";
                });

                if (elapsed >= backgroundStart) {
                    beginBackground();

                    const progress = clamp(
                        (elapsed - backgroundStart) /
                        backgroundDuration
                    );

                    prepared.background.draw(smooth(progress));

                    if (progress >= 1) {
                        finish();
                        return;
                    }
                }
            }

            frame = requestAnimationFrame(tick);
        } catch (error) {
            console.warn("Ink transition skipped:", error);
            finish();
        }
    }

    frame = requestAnimationFrame(tick);
}
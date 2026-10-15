import "./loadingScreen.scss";
import { prepareInkDissolve, playInkDissolve } from "./inkDissolve.js";

export function createLoadingScreen({ onEnter, onEnterHover, onRevealed }) {
    const screen = document.querySelector("#loading-screen");
    const title = document.querySelector("#loading-title");
    const status = document.querySelector("#loading-status");
    const enter = document.querySelector("#loading-enter");
    const silent = document.querySelector("#loading-silent");
    const retry = document.querySelector("#loading-retry");
    let state = "loading";
    let ink = null;
    const background = [...document.body.children].filter(element =>
        element !== screen && !["SCRIPT", "STYLE"].includes(element.tagName));
    background.forEach(element => { element.inert = true; });

    const slowTimer = setTimeout(() => {
        if (state === "loading") {
            status.textContent = "Still loading the room. This may take a moment on a slower connection.";
        }
    }, 20000);

    function finish(muted) {
        if (state !== "ready") return;
        state = "exiting";
        enter.disabled = true;
        silent.disabled = true;
        // Audio must start synchronously inside this user gesture.
        onEnter(muted);
        // Show the room behind the dissolving overlay, but keep it inert.
        document.body.classList.remove("is-loading");
        playInkDissolve(screen, ink, () => {
            state = "entered";
            background.forEach(element => { element.inert = false; });
            screen.remove();
            onRevealed?.();
            const canvas = document.querySelector("#experience-canvas");
            canvas.tabIndex = 0;
            canvas.focus({ preventScroll: true });
        });
    }

    enter.addEventListener("pointerenter", (event) => {
        if (state === "ready" && event.pointerType !== "touch") {
            onEnterHover?.();
        }
    });
    enter.addEventListener("click", () => finish(false));
    silent.addEventListener("click", () => finish(true));
    retry.addEventListener("click", () => window.location.reload());

    return {
        status(message) {
            if (state === "loading") status.textContent = message;
        },
        ready() {
            if (state !== "loading") return;
            // Generate the mask once; animation only updates alpha values.
            try { ink = prepareInkDissolve(screen); }
            catch (error) { console.warn("Ink transition unavailable", error); }
            state = "ready";
            clearTimeout(slowTimer);
            title.hidden = true;
            status.textContent = "The captain's room is ready";
            status.classList.add("loading-sr-only");
            enter.hidden = false;
            silent.hidden = false;
            // Do not autofocus on load; Tab navigation still shows a focus ring.
        },
        fail() {
            if (state === "entered" || state === "exiting") return;
            state = "error";
            clearTimeout(slowTimer);
            title.hidden = false;
            title.textContent = "Couldn't load the room";
            status.classList.remove("loading-sr-only");
            status.textContent = "Please check your connection and try again.";
            enter.hidden = true;
            silent.hidden = true;
            retry.hidden = false;
        }
    };
}

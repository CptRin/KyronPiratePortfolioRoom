import "./style.scss"
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from "gsap"
import { button } from "framer-motion/client";
import { createGodRays } from "./GodRays.js";
import { inject } from "@vercel/analytics";

inject();



const canvas = document.querySelector("#experience-canvas")
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

// -----------------------------
// My Work Auto Gallery
// -----------------------------
// Put images in:
// public/Interactables/images/My_Work_Images
//
// Vite reads these at dev-server start / build time.
// After adding new images, refresh the dev server if they do not appear straight away.
const MY_WORK_IMAGE_MODULES = import.meta.glob(
    "/public/Interactables/images/My_Work_Images/*.{png,jpg,jpeg,webp,gif,avif}",
    {
        eager: true,
        query: "?url",
        import: "default",
    }
);

const MY_WORK_FALLBACK_IMAGES = [
    {
        title: "Day",
        src: "/Interactables/images/My_Work_Images/Day.png",
    },
    {
        title: "Night",
        src: "/Interactables/images/My_Work_Images/Night.png",
    },
];

function createTitleFromImagePath(path) {
    const fileName = path
        .split("/")
        .pop()
        .replace(/\.[^/.]+$/, "");

    return decodeURIComponent(fileName)
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMyWorkImages() {
    const importedImages = Object.entries(MY_WORK_IMAGE_MODULES).map(([filePath, imageUrl]) => {
        const src = String(imageUrl).replace(/^\/public/, "");

        return {
            title: createTitleFromImagePath(filePath),
            src,
        };
    });

    if (!importedImages.length) {
        return MY_WORK_FALLBACK_IMAGES;
    }

    return importedImages.sort((a, b) => a.title.localeCompare(b.title));
}

const MY_WORK_IMAGES = getMyWorkImages();


// -----------------------------
// SFX / UI Sounds
// -----------------------------
// Your files are in public/SFX, so Vite serves them from /SFX/...
const SFX_CONFIG = {
    click: {
        src: "/SFX/Click_Noise.mp3",
        volume: 0.35,
        poolSize: 5,
    },
    hover: {
        src: "/SFX/Hover_Noise.mp3",
        volume: 0,
        poolSize: 5,
    },
    swoosh: {
        src: "/SFX/Swoosh_Noise.mp3",
        volume: 0.2,
        poolSize: 3,
    },
};

const sfxPlayers = {};
let isSFXEnabled = true;
let isAudioMuted = false;

function clampVolume(value) {
    return Math.min(Math.max(Number(value) || 0, 0), 1);
}

function createSFXPool(src, volume, poolSize) {
    return Array.from({ length: poolSize }, () => {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = volume;
        return audio;
    });
}

function setupSFX() {
    Object.entries(SFX_CONFIG).forEach(([name, config]) => {
        sfxPlayers[name] = {
            pool: createSFXPool(config.src, config.volume, config.poolSize),
            index: 0,
            volume: config.volume,
        };
    });
}

function playSFX(name, options = {}) {
    if (!isSFXEnabled || isAudioMuted) return;

    const player = sfxPlayers[name];
    if (!player || !player.pool.length) return;

    const audio = player.pool[player.index];
    player.index = (player.index + 1) % player.pool.length;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = clampVolume(options.volume ?? player.volume);

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // Browser may block audio until the user interacts with the page.
        });
    }
}

const SFX_HOVER_COOLDOWN = 90;
let lastHoverSFXTime = 0;

function playClickSFX() {
    playSFX("click");
}

function playHoverSFX() {
    const now = performance.now();

    if (now - lastHoverSFXTime < SFX_HOVER_COOLDOWN) return;

    lastHoverSFXTime = now;
    playSFX("hover");
}

function playSwooshSFX() {
    playSFX("swoosh");
}

// -----------------------------
// Background Music / Ambience
// -----------------------------
// Files are inside public/SFX/Music, so Vite serves them from /SFX/Music/...
// Music plays one track after another, then loops back to the top.
// Ambience loops underneath the music at a lower volume.
const MUSIC_PLAYLIST = [
    {
        title: "Sailing On A Pirate Ship",
        src: "/SFX/Music/catch22music-sailing-on-a-pirate-ship-424683.mp3",
    },
    {
        title: "Pirate Adventure",
        src: "/SFX/Music/ebunny-pirate-adventure-361663.mp3",
    },
    {
        title: "Sail Past The Horizon",
        src: "/SFX/Music/echogatestudios-sail-past-the-horizon-507975.mp3",
    },
    {
        title: "Lo-Fi Alarm Clock",
        src: "/SFX/Music/lesiakower-lo-fi-alarm-clock-243766.mp3",
    },
    {
        title: "Nature Dreams",
        src: "/SFX/Music/sonican-nature-dreams-362559.mp3",
    },
];

const AMBIENCE_TRACK = {
    title: "Wooden Ship Interior Ambience",
    src: "/SFX/Music/joelfazhari-wooden-ship-interior-ambience-3min-loop-361505.mp3",
};

const DEFAULT_MUSIC_VOLUME = 0.15;
const DEFAULT_AMBIENCE_VOLUME = 0.08;

let musicVolume = DEFAULT_MUSIC_VOLUME;
let ambienceVolume = DEFAULT_AMBIENCE_VOLUME;

let musicAudio = null;
let ambienceAudio = null;
let currentMusicTrackIndex = 0;
let hasStartedBackgroundAudio = false;
let isMusicPaused = false;

function setupBackgroundAudio() {
    if (musicAudio && ambienceAudio) return;

    musicAudio = new Audio();
    musicAudio.preload = "auto";
    musicAudio.volume = musicVolume;
    musicAudio.muted = isAudioMuted;

    musicAudio.addEventListener("ended", () => {
        playNextMusicTrack();
    });

    ambienceAudio = new Audio(AMBIENCE_TRACK.src);
    ambienceAudio.preload = "auto";
    ambienceAudio.loop = true;
    ambienceAudio.volume = ambienceVolume;
    ambienceAudio.muted = isAudioMuted;
}

function playAudioElement(audio) {
    if (!audio) return;

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // Browser may block background audio until the user clicks/taps the page.
        });
    }
}

function getCurrentMusicTrack() {
    return MUSIC_PLAYLIST[currentMusicTrackIndex] || null;
}

function updateCurrentTrackLabel() {
    const trackName = document.querySelector("#audio-track-name");
    if (!trackName) return;

    const track = getCurrentMusicTrack();
    trackName.textContent = track ? track.title : "No track loaded";
}

function updateAudioMenuIcon() {
    const button = document.querySelector("#audio-menu-toggle-button");
    const icon = document.querySelector("#audio-menu-toggle-icon");

    if (!button || !icon) return;

    const theme = document.body.dataset.theme || currentTheme;
    const src = theme === "night" ? icon.dataset.nightSrc : icon.dataset.daySrc;

    if (src) {
        icon.src = src;
    }

    const isOpen = button.closest(".audio-menu")?.classList.contains("is-open");
    const label = isOpen ? "Close audio menu" : "Open audio menu";

    icon.alt = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("is-muted", isAudioMuted);
}

// Kept as an alias so the existing day/night theme code can still call it.
function updateAudioMuteIcon() {
    updateAudioMenuIcon();
    updateAudioControlsState();
}

function updateAudioControlsState() {
    const musicSlider = document.querySelector("#music-volume-slider");
    const ambienceSlider = document.querySelector("#ambience-volume-slider");
    const pauseButton = document.querySelector("#audio-pause-button");
    const pauseIcon = document.querySelector("#audio-pause-icon");
    const muteButton = document.querySelector("#audio-mute-control-button");
    const muteIcon = document.querySelector("#audio-mute-control-icon");
    const muteLabel = document.querySelector("#audio-mute-control-label");

    if (musicSlider && document.activeElement !== musicSlider) {
        musicSlider.value = String(musicVolume);
    }

    if (ambienceSlider && document.activeElement !== ambienceSlider) {
        ambienceSlider.value = String(ambienceVolume);
    }

    if (pauseButton) {
        pauseButton.setAttribute("aria-label", isMusicPaused ? "Resume music" : "Pause music");
        pauseButton.classList.toggle("is-paused", isMusicPaused);
    }

    if (pauseIcon) {
        pauseIcon.textContent = isMusicPaused ? "▶" : "⏸";
    }

    if (muteButton) {
        muteButton.setAttribute("aria-label", isAudioMuted ? "Unmute all audio" : "Mute all audio");
        muteButton.classList.toggle("is-muted", isAudioMuted);
    }

    if (muteIcon) {
        const theme = document.body.dataset.theme || currentTheme;

        const src = theme === "night"
            ? (isAudioMuted ? muteIcon.dataset.mutedNightSrc : muteIcon.dataset.unmutedNightSrc)
            : (isAudioMuted ? muteIcon.dataset.mutedDaySrc : muteIcon.dataset.unmutedDaySrc);

        if (src) {
            muteIcon.src = src;
        }

        muteIcon.alt = isAudioMuted ? "Unmute all audio" : "Mute all audio";
    }

    if (muteLabel) {
        muteLabel.textContent = isAudioMuted ? "Unmute All Audio" : "Mute All Audio";
    }

    updateCurrentTrackLabel();
    updateAudioMenuIcon();
}

function setMusicVolume(volume) {
    musicVolume = clampVolume(volume);

    if (musicAudio) {
        musicAudio.volume = musicVolume;
    }

    updateAudioControlsState();
    return musicVolume;
}

function setAmbienceVolume(volume) {
    ambienceVolume = clampVolume(volume);

    if (ambienceAudio) {
        ambienceAudio.volume = ambienceVolume;
    }

    updateAudioControlsState();
    return ambienceVolume;
}

function playCurrentMusicTrack() {
    setupBackgroundAudio();

    if (!MUSIC_PLAYLIST.length || !musicAudio) return;

    const track = getCurrentMusicTrack();

    musicAudio.src = track.src;
    musicAudio.volume = musicVolume;
    musicAudio.muted = isAudioMuted;
    musicAudio.currentTime = 0;

    isMusicPaused = false;
    updateAudioControlsState();
    playAudioElement(musicAudio);
}

function playNextMusicTrack() {
    if (!MUSIC_PLAYLIST.length) return;

    currentMusicTrackIndex = (currentMusicTrackIndex + 1) % MUSIC_PLAYLIST.length;
    playCurrentMusicTrack();
}

function playPreviousMusicTrack() {
    if (!MUSIC_PLAYLIST.length) return;

    currentMusicTrackIndex = (currentMusicTrackIndex - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    playCurrentMusicTrack();
}

function startBackgroundAudio() {
    setupBackgroundAudio();

    hasStartedBackgroundAudio = true;

    if (ambienceAudio) {
        ambienceAudio.volume = ambienceVolume;
        ambienceAudio.muted = isAudioMuted;

        if (ambienceAudio.paused) {
            playAudioElement(ambienceAudio);
        }
    }

    if (musicAudio) {
        musicAudio.volume = musicVolume;
        musicAudio.muted = isAudioMuted;

        if (!isMusicPaused && (musicAudio.paused || !musicAudio.src)) {
            playCurrentMusicTrack();
        }
    }

    updateAudioControlsState();
}

function pauseMusicTrack() {
    setupBackgroundAudio();
    isMusicPaused = true;

    if (musicAudio) {
        musicAudio.pause();
    }

    updateAudioControlsState();
}

function resumeMusicTrack() {
    setupBackgroundAudio();
    isMusicPaused = false;
    hasStartedBackgroundAudio = true;

    if (!musicAudio.src) {
        playCurrentMusicTrack();
    } else {
        musicAudio.volume = musicVolume;
        musicAudio.muted = isAudioMuted;
        playAudioElement(musicAudio);
    }

    if (ambienceAudio && ambienceAudio.paused) {
        ambienceAudio.volume = ambienceVolume;
        ambienceAudio.muted = isAudioMuted;
        playAudioElement(ambienceAudio);
    }

    updateAudioControlsState();
}

function toggleMusicPaused() {
    if (isMusicPaused || (musicAudio && musicAudio.paused)) {
        resumeMusicTrack();
        return;
    }

    pauseMusicTrack();
}

function setGlobalAudioMuted(value) {
    isAudioMuted = Boolean(value);
    isSFXEnabled = !isAudioMuted;

    if (musicAudio) {
        musicAudio.muted = isAudioMuted;
    }

    if (ambienceAudio) {
        ambienceAudio.muted = isAudioMuted;
    }

    updateAudioControlsState();
}

function toggleGlobalAudioMute() {
    const shouldMute = !isAudioMuted;

    if (shouldMute) {
        // Play the click before muting, so the button still feels responsive.
        playClickSFX();
        setGlobalAudioMuted(true);
        return;
    }

    setGlobalAudioMuted(false);
    startBackgroundAudio();
    playClickSFX();
}

function unlockSceneAudio() {
    unlockSFX();
    startBackgroundAudio();
}

function unlockSFX() {
    Object.values(sfxPlayers).forEach((player) => {
        const audio = player.pool[player.pool.length - 1];
        if (!audio) return;

        const originalVolume = audio.volume;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise && typeof playPromise.then === "function") {
            playPromise
                .then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = originalVolume;
                })
                .catch(() => {
                    audio.volume = originalVolume;
                });
        } else {
            audio.volume = originalVolume;
        }
    });
}

setupSFX();

window.addEventListener("pointerdown", unlockSceneAudio, { once: true, passive: true });
window.addEventListener("keydown", unlockSceneAudio, { once: true });

// Handy console controls:
// window.setSFXEnabled(false)
// window.setSFXEnabled(true)
// window.setSFXVolume("click", 0.3)
// window.playSFX("swoosh")
window.playSFX = playSFX;
window.setSFXEnabled = (value) => {
    isSFXEnabled = Boolean(value);
};
window.setSFXVolume = (name, volume) => {
    const player = sfxPlayers[name];
    if (!player) return;

    player.volume = clampVolume(volume);
    player.pool.forEach((audio) => {
        audio.volume = player.volume;
    });
};

// Background audio console controls:
// window.setGlobalAudioMuted(true)
// window.setGlobalAudioMuted(false)
// window.setMusicVolume(0.15)
// window.setAmbienceVolume(0.05)
// window.skipMusicTrack()
// window.previousMusicTrack()
// window.toggleMusicPaused()
window.setGlobalAudioMuted = setGlobalAudioMuted;
window.setMusicVolume = setMusicVolume;
window.setAmbienceVolume = setAmbienceVolume;
window.skipMusicTrack = playNextMusicTrack;
window.previousMusicTrack = playPreviousMusicTrack;
window.toggleMusicPaused = toggleMusicPaused;


//modals
const modals = {
    aboutme: document.querySelector(".modal.aboutme"),
    pictures: document.querySelector(".modal.pictures"),
    extra: document.querySelector(".modal.extra"),
    contact: document.querySelector(".modal.contact")
    
};



let touchHappened = false;

document.querySelectorAll(".modal-exit-button").forEach(button => {
    button.addEventListener("touchend", (e) => {
        touchHappened = true;
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();

        const modal = e.target.closest(".modal");
        hideModal(modal);
    }, { passive: false });

    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (touchHappened) {
            touchHappened = false;
            return;
        }

        playClickSFX();

        const modal = e.target.closest(".modal");
        hideModal(modal);
    }, { passive: false });
});

Object.values(modals).forEach((modal) => {
    if (!modal) return;

    modal.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    modal.addEventListener("touchstart", (e) => {
        e.stopPropagation();
    }, { passive: false });

    modal.addEventListener("touchend", (e) => {
        e.stopPropagation();
    }, { passive: false });
});

let isModalOpen = false;
let isRaycastEnabled = true;
let isCameraTransitioning = false;

const savedCameraState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    hasSavedState: false,
};

const documentViewer = document.querySelector("#document-viewer");
const documentViewerPanel = document.querySelector(".document-viewer-panel");
const documentPreviewImage = document.querySelector("#document-preview-image");
const documentViewerTitle = document.querySelector("#document-viewer-title");
const documentDownloadLink = document.querySelector("#document-download-link");
const documentViewerCloseButton = document.querySelector("#document-viewer-close-button");

const myWorkGallery = document.querySelector("#my-work-gallery");
const myWorkInspector = document.querySelector("#my-work-inspector");
const myWorkInspectorImage = document.querySelector("#my-work-inspector-image");
const myWorkInspectorTitle = document.querySelector("#my-work-inspector-title");
const myWorkInspectorCloseButton = document.querySelector("#my-work-inspector-close");

let isDocumentViewerOpen = false;
let isMyWorkInspectorOpen = false;

// These are starter camera views. Tune them in the browser console with window.logCameraView().
// The "pictures" view is your map / My Work view.
const cameraModalViews = {
    // pictures: {
    //     position: new THREE.Vector3(0.15, 4.2, 5.8),
    //     target: new THREE.Vector3(0.15, 1.45, 1.15),
    //     duration: 1.15,
    // },
    aboutme: {
        position: new THREE.Vector3(0.9890881984291968, 3.719253856043575, 5.802515354486388),
        target: new THREE.Vector3(4.325945135570619, 2.5121377566096768, 1.915473975754205),
        duration: 1.15,
    },
    extra: {
        position: new THREE.Vector3(0.0971896315394829, 3.5734332123067243, 3.7995697253330745),
        target: new THREE.Vector3(0.10898369422413885, 0.49635360535240164, 3.1200116693729023),
        duration: 1.15,
    },
};

// -----------------------------
// 3D Resume / CV Envelope Mode
// -----------------------------

let isExtraEnvelopeMode = false;
let currentExtraEnvelopeId = null;

const extraEnvelopeHighlightMeshes = [];

/*
  Page slide settings.

  The code below will slide the page in the direction it already sits
  away from the envelope. This usually gives the cleanest "paper pulls
  further out of envelope" movement.

  Increase or decrease this number to control slide distance.
*/
const EXTRA_ENVELOPE_PAGE_SLIDE_DISTANCE = 0.15;

const EXTRA_ENVELOPE_HOVER_SCALE = 1.18;
const EXTRA_ENVELOPE_HOVER_DURATION = 0.35;
const EXTRA_ENVELOPE_RESET_DURATION = 0.25;

const EXTRA_DOCUMENT_URLS = {
    resume: "/Interactables/Extras/KyronPorterResume.pdf",
    cv: "/Interactables/Extras/CV_Kyron_U.pdf",
};

const EXTRA_DOCUMENT_PREVIEWS = {
    resume: "/Interactables/Extras/KyronPorter_Resume_2026.png",
    cv: "/Interactables/Extras/KyronPorter_CV_General_2026.png",
};

const EXTRA_DOCUMENT_DOWNLOAD_NAMES = {
    resume: "KyronPorterResume.pdf",
    cv: "CV_Kyron_U.pdf",
};

const EXTRA_DOCUMENT_TITLES = {
    resume: "Resume",
    cv: "CV",
};

function showDocumentViewer(type) {
    const pdfUrl = EXTRA_DOCUMENT_URLS[type];
    const previewUrl = EXTRA_DOCUMENT_PREVIEWS[type];
    const title = EXTRA_DOCUMENT_TITLES[type] || "Document";
    const downloadName = EXTRA_DOCUMENT_DOWNLOAD_NAMES[type] || "Document.pdf";

    if (!pdfUrl || !previewUrl) return;
    if (!documentViewer || !documentPreviewImage) return;

    isDocumentViewerOpen = true;

    clearExtraEnvelopeHover();

    documentViewerTitle.textContent = title;

    documentPreviewImage.src = previewUrl;
    documentPreviewImage.alt = `${title} preview`;

    documentDownloadLink.href = pdfUrl;
    documentDownloadLink.download = downloadName;

    documentViewer.classList.add("is-open");
    documentViewer.setAttribute("aria-hidden", "false");

    document.body.style.cursor = "default";
}

function hideDocumentViewer() {
    if (!documentViewer || !documentPreviewImage) return;

    isDocumentViewerOpen = false;

    documentViewer.classList.remove("is-open");
    documentViewer.setAttribute("aria-hidden", "true");

    documentPreviewImage.src = "";
    documentPreviewImage.alt = "Document preview";

    document.body.style.cursor = "default";
}

function openMyWorkInspector(index) {
    if (!myWorkInspector || !myWorkInspectorImage) return;

    const image = MY_WORK_IMAGES[index];
    if (!image) return;

    isMyWorkInspectorOpen = true;

    myWorkInspectorImage.src = image.src;
    myWorkInspectorImage.alt = image.title || "Selected work preview";

    if (myWorkInspectorTitle) {
        myWorkInspectorTitle.textContent = image.title || "";
    }

    myWorkInspector.classList.add("is-open");
    myWorkInspector.setAttribute("aria-hidden", "false");

    document.body.style.cursor = "default";
}

function closeMyWorkInspector() {
    if (!myWorkInspector || !myWorkInspectorImage) return;

    isMyWorkInspectorOpen = false;

    myWorkInspector.classList.remove("is-open");
    myWorkInspector.setAttribute("aria-hidden", "true");

    myWorkInspectorImage.src = "";
    myWorkInspectorImage.alt = "Selected work preview";

    if (myWorkInspectorTitle) {
        myWorkInspectorTitle.textContent = "";
    }
}

function buildMyWorkGallery() {
    if (!myWorkGallery) return;

    myWorkGallery.innerHTML = "";

    MY_WORK_IMAGES.forEach((image, index) => {
        const button = document.createElement("button");
        button.className = "my-work-tile";
        button.type = "button";
        button.setAttribute("aria-label", `Open ${image.title || "work image"}`);

        const img = document.createElement("img");
        img.src = image.src;
        img.alt = image.title || "Portfolio work image";
        img.loading = "lazy";
        img.decoding = "async";

        button.appendChild(img);

        button.addEventListener("mouseenter", () => {
            playHoverSFX();
        });

        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            playClickSFX();
            openMyWorkInspector(index);
        });

        myWorkGallery.appendChild(button);
    });
}

if (myWorkInspector) {
    myWorkInspector.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    myWorkInspector.addEventListener("touchstart", (e) => {
        e.stopPropagation();
    }, { passive: false });

    myWorkInspector.addEventListener("touchend", (e) => {
        e.stopPropagation();
    }, { passive: false });
}

if (myWorkInspectorCloseButton) {
    myWorkInspectorCloseButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        closeMyWorkInspector();
    });

    myWorkInspectorCloseButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMyWorkInspectorOpen) {
        closeMyWorkInspector();
    }
});

buildMyWorkGallery();

if (documentViewer) {
    documentViewer.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    documentViewer.addEventListener("touchstart", (e) => {
        e.stopPropagation();
    }, { passive: false });

    documentViewer.addEventListener("touchend", (e) => {
        e.stopPropagation();
    }, { passive: false });
}

if (documentViewerPanel) {
    documentViewerPanel.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}

if (documentViewerCloseButton) {
    documentViewerCloseButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        hideDocumentViewer();
    });
}

const extraEnvelopePairs = {
    resume: {
        envelope: null,
        page: null,
        pickObjects: [],
    },
    cv: {
        envelope: null,
        page: null,
        pickObjects: [],
    },
};

function clearRaycasterState() {
    currentIntersects = [];

    if (currentHoveredObject) {
        playHoverAnimation(currentHoveredObject, false);
        currentHoveredObject = null;
    }

    removeHighlight();
    clearExtraEnvelopeHover();
    currentSFXHoverObject = null;

    document.body.style.cursor = "default";
}

function disableSceneInteraction() {
    isRaycastEnabled = false;
    clearRaycasterState();
}

function enableSceneInteraction() {
    isRaycastEnabled = true;
}

function saveCurrentCameraState() {
    savedCameraState.position.copy(camera.position);
    savedCameraState.target.copy(controls.target);
    savedCameraState.hasSavedState = true;
}

function animateCameraTo(position, target, duration = 1.1, onComplete = null) {
    isCameraTransitioning = true;

    controls.enabled = false;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    gsap.to(camera.position, {
        x: position.x,
        y: position.y,
        z: position.z,
        duration,
        ease: "power2.inOut",
        onUpdate: () => {
            updateCameraLookAtTarget();
        },
    });

    gsap.to(controls.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration,
        ease: "power2.inOut",
        onUpdate: () => {
            updateCameraLookAtTarget();
        },
        onComplete: () => {
            updateCameraLookAtTarget();
            isCameraTransitioning = false;

            if (onComplete) {
                onComplete();
            }
        },
    });
}

function getExtraEnvelopeType(object) {
    if (!object || !object.name) return null;

    const name = object.name.toLowerCase();

    if (name.includes("resume")) return "resume";
    if (name.includes("cv")) return "cv";

    return null;
}

function isExtraEnvelopeObject(object) {
    if (!object || !object.name) return false;

    const name = object.name.toLowerCase();
    const type = getExtraEnvelopeType(object);

    if (!type) return false;

    return name.includes("envelope") || name.includes("page");
}

function getExtraEnvelopePairObjects(type) {
    const pair = extraEnvelopePairs[type];

    if (!pair) return [];

    return [pair.envelope, pair.page].filter(Boolean);
}

function getExtraEnvelopePickObjects() {
    return Object.values(extraEnvelopePairs)
        .flatMap((pair) => pair.pickObjects)
        .filter(Boolean);
}

function prepareExtraEnvelopeObject(object) {
    if (!object.isMesh) return;
    if (!isExtraEnvelopeObject(object)) return;

    const type = getExtraEnvelopeType(object);
    const pair = extraEnvelopePairs[type];

    if (!pair) return;

    const objectName = object.name.toLowerCase();

    if (objectName.includes("envelope")) {
        pair.envelope = object;
    }

    if (objectName.includes("page")) {
        pair.page = object;
    }

    if (!pair.pickObjects.includes(object)) {
        pair.pickObjects.push(object);
    }

    object.userData.extraEnvelopeType = type;
    object.userData.extraEnvelopeInitialPosition = new THREE.Vector3().copy(object.position);
    object.userData.extraEnvelopeInitialScale = new THREE.Vector3().copy(object.scale);
    object.userData.extraEnvelopeInitialRotation = new THREE.Euler().copy(object.rotation);

    /*
      Important:
      Do NOT push these into raycasterObjects here.

      These objects are stored in extraEnvelopePairs instead.
      That means they only become hoverable/clickable while
      isExtraEnvelopeMode is active.
    */

    console.log("Prepared 3D envelope object:", object.name, "type:", type);
}

function addExtraEnvelopeHighlights(objects) {
    clearExtraEnvelopeHighlights();

    objects.forEach((object) => {
        if (!object || !object.geometry) return;

        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.BackSide,
            transparent: true,
            opacity: 1,
            depthWrite: false,
        });

        const highlightMesh = new THREE.Mesh(object.geometry, highlightMaterial);
        highlightMesh.name = "Extra_Envelope_Linked_Highlight";
        highlightMesh.scale.set(1.06, 1.06, 1.06);
        highlightMesh.renderOrder = 999;

        object.add(highlightMesh);

        extraEnvelopeHighlightMeshes.push({
            parent: object,
            mesh: highlightMesh,
        });
    });
}

function clearExtraEnvelopeHighlights() {
    extraEnvelopeHighlightMeshes.forEach(({ parent, mesh }) => {
        if (parent && mesh) {
            parent.remove(mesh);
        }

        if (mesh && mesh.material) {
            mesh.material.dispose();
        }
    });

    extraEnvelopeHighlightMeshes.length = 0;
}

function getExtraEnvelopePageSlideOffset(type) {
    const pair = extraEnvelopePairs[type];

    if (!pair || !pair.page || !pair.envelope) {
        return new THREE.Vector3(0, 0, 0);
    }

    const pageStart = pair.page.userData.extraEnvelopeInitialPosition;
    const envelopeStart = pair.envelope.userData.extraEnvelopeInitialPosition;

    if (!pageStart || !envelopeStart) {
        return new THREE.Vector3(0, 0, 0);
    }

    /*
      This finds the direction from envelope -> page.
      So instead of sliding upward in world space,
      the paper slides further in the direction it already sticks out.
    */
    const slideDirection = new THREE.Vector3().subVectors(pageStart, envelopeStart);

    if (slideDirection.length() < 0.0001) {
        return new THREE.Vector3(0, 0, 0);
    }

    slideDirection.normalize();
    slideDirection.multiplyScalar(EXTRA_ENVELOPE_PAGE_SLIDE_DISTANCE);

    return slideDirection;
}

function animateExtraEnvelopePair(type, isHovering) {
    const pair = extraEnvelopePairs[type];

    if (!pair) return;

    const objects = getExtraEnvelopePairObjects(type);

    objects.forEach((object) => {
        const baseScale = object.userData.extraEnvelopeInitialScale || object.scale;

        gsap.killTweensOf(object.scale);

        gsap.to(object.scale, {
            x: isHovering ? baseScale.x * EXTRA_ENVELOPE_HOVER_SCALE : baseScale.x,
            y: isHovering ? baseScale.y * EXTRA_ENVELOPE_HOVER_SCALE : baseScale.y,
            z: isHovering ? baseScale.z * EXTRA_ENVELOPE_HOVER_SCALE : baseScale.z,
            duration: isHovering ? EXTRA_ENVELOPE_HOVER_DURATION : EXTRA_ENVELOPE_RESET_DURATION,
            ease: isHovering ? "back.out(1.8)" : "power2.out",
        });
    });

    if (pair.page) {
        const page = pair.page;
        const basePosition = page.userData.extraEnvelopeInitialPosition;

        if (basePosition) {
            const targetPosition = new THREE.Vector3().copy(basePosition);

            if (isHovering) {
                targetPosition.add(getExtraEnvelopePageSlideOffset(type));
            }

            gsap.killTweensOf(page.position);

            gsap.to(page.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: isHovering ? EXTRA_ENVELOPE_HOVER_DURATION : EXTRA_ENVELOPE_RESET_DURATION,
                ease: isHovering ? "back.out(1.4)" : "power2.out",
            });
        }
    }
}

function setExtraEnvelopeHover(type) {
    if (currentExtraEnvelopeId === type) return;

    clearExtraEnvelopeHover();

    currentExtraEnvelopeId = type;
    playHoverSFX();

    animateExtraEnvelopePair(type, true);
    addExtraEnvelopeHighlights(getExtraEnvelopePairObjects(type));
}

function clearExtraEnvelopeHover() {
    if (currentExtraEnvelopeId) {
        animateExtraEnvelopePair(currentExtraEnvelopeId, false);
    }

    currentExtraEnvelopeId = null;
    clearExtraEnvelopeHighlights();
}

function openExtraEnvelopeDocument(type) {
    playClickSFX();
    showDocumentViewer(type);
}

function showExtraEnvelopeMode() {
    if (!modals.extra) return;
    if (isModalOpen || isCameraTransitioning) return;

    const view = cameraModalViews.extra;

    isModalOpen = true;
    isExtraEnvelopeMode = false;

    controls.enabled = false;
    disableSceneInteraction();
    saveCurrentCameraState();

    const enterExtraMode = () => {
        isExtraEnvelopeMode = true;
        isRaycastEnabled = true;

        clearRaycasterState();

        modals.extra.style.display = "block";
        modals.extra.style.opacity = "1";
        clearModalNoiseMask(modals.extra);

        console.log("3D Resume / CV envelope mode active");
    };

    if (!view) {
        enterExtraMode();
        return;
    }

    animateCameraTo(view.position, view.target, view.duration, enterExtraMode);
}

function updateExtraEnvelopeRaycaster() {
    if (isDocumentViewerOpen) {
        clearExtraEnvelopeHover();
        currentIntersects = [];
        document.body.style.cursor = "default";
        return;
    }

    const pickObjects = getExtraEnvelopePickObjects();

    if (!pickObjects.length) {
        clearExtraEnvelopeHover();
        document.body.style.cursor = "default";
        currentIntersects = [];
        return;
    }

    raycaster.setFromCamera(pointer, camera);
    currentIntersects = raycaster.intersectObjects(pickObjects, false);

    if (currentIntersects.length > 0) {
        const object = currentIntersects[0].object;
        const type = getExtraEnvelopeType(object);

        if (type) {
            setExtraEnvelopeHover(type);
            document.body.style.cursor = "pointer";
            return;
        }
    }

    clearExtraEnvelopeHover();
    document.body.style.cursor = "default";
}

function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

function hashNoise(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
}

function valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    const fx = x - ix;
    const fy = y - iy;

    const a = hashNoise(ix, iy);
    const b = hashNoise(ix + 1, iy);
    const c = hashNoise(ix, iy + 1);
    const d = hashNoise(ix + 1, iy + 1);

    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    return (
        a * (1 - ux) * (1 - uy) +
        b * ux * (1 - uy) +
        c * (1 - ux) * uy +
        d * ux * uy
    );
}

function fbmNoise(x, y) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;

    for (let i = 0; i < 5; i++) {
        value += valueNoise(x * frequency, y * frequency) * amplitude;
        frequency *= 2;
        amplitude *= 0.5;
    }

    return value;
}

function createModalNoiseMask(width = 180, height = 110) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    const imageData = context.createImageData(width, height);
    const pixels = imageData.data;

    const noiseValues = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const nx = x / width;
            const ny = y / height;

            const noise = fbmNoise(nx * 2.0, ny * 2.0);
            noiseValues[y * width + x] = noise;
        }
    }

    return {
        canvas,
        context,
        imageData,
        pixels,
        noiseValues,
        width,
        height,
    };
}

const modalNoiseMasks = new WeakMap();

function getModalNoiseMask(modal) {
    if (!modalNoiseMasks.has(modal)) {
        modalNoiseMasks.set(modal, createModalNoiseMask());
    }

    return modalNoiseMasks.get(modal);
}

function applyModalNoiseMask(modal, progress) {
    const mask = getModalNoiseMask(modal);

    const threshold = progress * 1.25 - 0.15;
    const softness = 0.15;

    for (let i = 0; i < mask.noiseValues.length; i++) {
        const noise = mask.noiseValues[i];

        const alpha =
            1.0 - smoothstep(threshold, threshold + softness, noise);

        const pixelIndex = i * 4;

        mask.pixels[pixelIndex + 0] = 255;
        mask.pixels[pixelIndex + 1] = 255;
        mask.pixels[pixelIndex + 2] = 255;
        mask.pixels[pixelIndex + 3] = Math.floor(alpha * 255);
    }

    mask.context.putImageData(mask.imageData, 0, 0);

    const url = `url(${mask.canvas.toDataURL("image/png")})`;

    modal.style.webkitMaskImage = url;
    modal.style.maskImage = url;
}

function clearModalNoiseMask(modal) {
    modal.style.webkitMaskImage = "none";
    modal.style.maskImage = "none";
}

function revealModalWithNoise(modal, duration = 700) {
    modal.style.display = "block";
    modal.style.opacity = "1";

    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easedProgress = 1 - Math.pow(1 - progress, 3);

        applyModalNoiseMask(modal, easedProgress);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            clearModalNoiseMask(modal);
        }
    }

    applyModalNoiseMask(modal, 0);
    requestAnimationFrame(animate);
}

function hideModalWithNoise(modal, duration = 450, onComplete = null) {
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const revealProgress = 1 - easedProgress;

        applyModalNoiseMask(modal, revealProgress);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            clearModalNoiseMask(modal);
            modal.style.opacity = "0";
            modal.style.display = "none";

            if (onComplete) {
                onComplete();
            }
        }
    }

    applyModalNoiseMask(modal, 1);
    requestAnimationFrame(animate);
}

function fadeInModal(modal) {
    revealModalWithNoise(modal, 2550);
}

const showModal = (modal) => {
    if (!modal) return;

    isModalOpen = true;
    controls.enabled = false;
    disableSceneInteraction();

    fadeInModal(modal);
};

function showModalWithCamera(modal, cameraViewKey) {
    if (!modal) return;
    if (isModalOpen || isCameraTransitioning) return;

    // Extra now uses the physical 3D Resume / CV envelopes,
    // not the old HTML envelope menu.
    if (cameraViewKey === "extra") {
        showExtraEnvelopeMode();
        return;
    }

    const view = cameraModalViews[cameraViewKey];

    isModalOpen = true;
    controls.enabled = false;
    disableSceneInteraction();
    saveCurrentCameraState();

    if (!view) {
        fadeInModal(modal);
        return;
    }

    animateCameraTo(view.position, view.target, view.duration, () => {
        fadeInModal(modal);
    });
}

const hideModal = (modal) => {
    if (!modal) return;

    if (modal.classList.contains("pictures")) {
        closeMyWorkInspector();
    }

    const isClosingExtraMode = modal.classList.contains("extra");

    isRaycastEnabled = false;
    controls.enabled = false;

    function finishModalClose() {
        if (savedCameraState.hasSavedState) {
            animateCameraTo(
                savedCameraState.position,
                savedCameraState.target,
                0.9,
                () => {
                    savedCameraState.hasSavedState = false;
                    isModalOpen = false;
                    isExtraEnvelopeMode = false;

                    controls.enabled = true;
                    enableSceneInteraction();
                }
            );
        } else {
            isModalOpen = false;
            isExtraEnvelopeMode = false;

            controls.enabled = true;
            enableSceneInteraction();
        }
    }

    if (isClosingExtraMode) {
        hideDocumentViewer();

        isExtraEnvelopeMode = false;
        clearExtraEnvelopeHover();

        modal.style.opacity = "0";
        modal.style.display = "none";
        clearModalNoiseMask(modal);

        finishModalClose();
        return;
    }

    hideModalWithNoise(modal, 450, finishModalClose);
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

//RayCast
const raycasterObjects = [];
let currentIntersects = [];
let currentHoveredObject = null;
let currentSFXHoverObject = null;
let currentHighlightObject = null;
let currentHighlightMesh = null;

//Day Night
const themeObjects = [];
let currentTheme = "day";
let isThemeChanging = false;
let atlasObject = null;

const animationObjects = [];
const nameAnimationObjects = [];
const daggerAnimationObjects = [];
let hasPlayedIntroAnimation = false;

// Leaf sway
const leafSwayObjects = [];

// Change these if your leaf mesh has a different name.
// Example: if your Blender mesh is named "Corner_Greens", add "Corner_Greens".
const LEAF_SWAY_NAME_KEYWORDS = [
    "Leaf",
    "Leaves",
    "Vine",
    "Vines",
    "Plant",
    "Plants",
    "Ivy",
    "Foliage"
];

//Socials
const socialLinks = {
    ArtStation: "https://www.artstation.com/kyron2",
    Linkdin: "https://www.linkedin.com/in/kyron-porter-4872862a0/",
    Twitter: "https://x.com/CptRin_",
}

//Loaders
const textureLoader = new THREE.TextureLoader();

//Model Loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

//Cube Loader

const enviromentMap = new THREE.CubeTextureLoader()
    .setPath("/textures/SkyBox/")
    .load( [
        'px.webp',
        'nx.webp',
        'py.webp',
        'ny.webp',
        'pz.webp',
        'nz.webp'    
    ] );

const textureMap = {
    First:{
        day:"/textures/Room/Day/First_Day_Texture_Set.webp",
        night:"/textures/Room/Night/First_Night_Texture_Set.webp"
    },
    Second:{
        day:"/textures/Room/Day/Second_Day_Texture_Set.webp",
        night:"/textures/Room/Night/Second_Night_Texture_Set.webp"
    },
    Third:{
        day:"/textures/Room/Day/Third_Day_Texture_Set.webp",
        night:"/textures/Room/Night/Third_Night_Texture_Set.webp"
    },
    Fourth:{
        day:"/textures/Room/Day/Fourth_Day_Texture_Set.webp",
        night:"/textures/Room/Night/Fourth_Night_Texture_Set.webp"
    },
    Fith:{
        day:"/textures/Room/Day/Fith_Day_Texture_Set.webp",
        night:"/textures/Room/Night/Fith_Night_Texture_Set.webp"
    },
    Sixth:{
        day:"/textures/Room/Day/Sixth_Day_Texture_Set.webp",
        night:"/textures/Room/Night/Sixth_Night_Texture_Set.webp"
    },
    Seventh:{
        day:"/textures/Room/Day/Seventh__Day_BackGround.webp",
        night:"/textures/Room/Night/Seventh__Night_BackGround.webp"
    }
};

const loadedTextures = {
    day:{},
    night:{}
};

Object.entries(textureMap).forEach(([key, paths]) => {
    const dayTexture = textureLoader.load(paths.day);
    dayTexture.flipY = false
    dayTexture.colorSpace = THREE.SRGBColorSpace
    loadedTextures.day[key] = dayTexture;

    const nightTexture = textureLoader.load(paths.night);
    nightTexture.flipY = false
    nightTexture.colorSpace = THREE.SRGBColorSpace
    loadedTextures.night[key] = nightTexture;
});

window.addEventListener("mousemove", (e)=>{
    touchHappened = false;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("touchstart", (e) =>{
    if(isModalOpen) return
    e.preventDefault()
    pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
},{passive: false});

window.addEventListener("touchend", (e) =>{
    if(isModalOpen) return
    e.preventDefault()
    handleRaycasterInteraction();

},{passive: false});

function setTheme(theme) {
    themeObjects.forEach((object) => {
        const key = object.userData.textureKey;

        if (!key) return;
        if (!loadedTextures[theme][key]) return;
        if (!object.material) return;

        object.material.map = loadedTextures[theme][key];
        object.material.needsUpdate = true;
    });
}

function fadeTheme(theme, duration = 0.8) {
    themeObjects.forEach((object) => {
        const key = object.userData.textureKey;

        if (!key) return;
        if (!loadedTextures[theme][key]) return;
        if (!loadedTextures[currentTheme][key]) return;
        if (!object.material) return;

        const oldTexture = loadedTextures[currentTheme][key];
        const newTexture = loadedTextures[theme][key];

        if (object.name.includes("Glass")) {
            gsap.delayedCall(2, () => {
                object.material.map = newTexture;
                object.material.needsUpdate = true;
            });

            return;
        }

        if (object.userData.themeFadeOverlay) {
            object.remove(object.userData.themeFadeOverlay);

            if (object.userData.themeFadeOverlay.material) {
                object.userData.themeFadeOverlay.material.dispose();
            }

            object.userData.themeFadeOverlay = null;
        }

        const overlayMaterial = new THREE.MeshBasicMaterial({
            map: oldTexture,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        const overlay = new THREE.Mesh(object.geometry, overlayMaterial);
        overlay.renderOrder = 999;
        object.add(overlay);
        object.userData.themeFadeOverlay = overlay;

        object.material.map = newTexture;
        object.material.needsUpdate = true;

        gsap.to(overlayMaterial, {
            opacity: 0,
            duration: duration,
            ease: "power2.inOut",
            onComplete: () => {
                object.remove(overlay);
                overlayMaterial.dispose();
                object.userData.themeFadeOverlay = null;

                object.material.map = newTexture;
                object.material.needsUpdate = true;
            }
        });
    });
}

const atlasSpinAxis = new THREE.Vector3(-0.59, 1, 0.30).normalize();

function spinAtlas(object) {
    const spin = { angle: 0 };
    let previousAngle = 0;

    gsap.to(spin, {
        angle: Math.PI * 2,
        duration: 1.1,
        ease: "power2.inOut",
        onUpdate: () => {
            const delta = spin.angle - previousAngle;
            object.rotateOnAxis(atlasSpinAxis, delta);
            previousAngle = spin.angle;
        }
    });
}

function toggleDayNight(object) {
    if (isThemeChanging) return;

    isThemeChanging = true;
    playSwooshSFX();

    const nextTheme = currentTheme === "day" ? "night" : "day";
    const spinTarget = atlasObject || object;

    // Change UI colors and icons immediately.
    setUITheme(nextTheme);

    if (spinTarget) {
        spinAtlas(spinTarget);
    }

    // Start the actual room transition immediately.
    fadeTheme(nextTheme, 0.85);
    godRays.setMode(nextTheme);

    gsap.delayedCall(1.2, () => {
        currentTheme = nextTheme;
        isThemeChanging = false;
    });
}

function setDayCycleIcon(theme) {
    const icon = document.querySelector("#day-cycle-icon");
    if (!icon) return;

    const daySrc = icon.dataset.daySrc;
    const nightSrc = icon.dataset.nightSrc;

    icon.src = theme === "night" ? nightSrc : daySrc;
    icon.alt = theme === "night" ? "Night cycle" : "Day cycle";
}

function updateQuickMenuToggleIcon() {
    if (!quickMenu || !quickMenuToggleIcon) return;

    const theme = document.body.dataset.theme || currentTheme;
    const isOpen = quickMenu.classList.contains("is-open");

    let src = "";

    if (theme === "night") {
        src = isOpen
            ? quickMenuToggleIcon.dataset.closeNightSrc
            : quickMenuToggleIcon.dataset.openNightSrc;
    } else {
        src = isOpen
            ? quickMenuToggleIcon.dataset.closeDaySrc
            : quickMenuToggleIcon.dataset.openDaySrc;
    }

    if (src) {
        quickMenuToggleIcon.src = src;
    }

    quickMenuToggleIcon.alt = isOpen ? "Close menu" : "Open menu";
}

function updateThemeIcons(theme) {
    document.querySelectorAll("img.theme-icon").forEach((icon) => {
        if (icon.id === "quick-menu-toggle-icon") return;

        const daySrc = icon.dataset.daySrc;
        const nightSrc = icon.dataset.nightSrc;

        if (!daySrc || !nightSrc) return;

        icon.src = theme === "night" ? nightSrc : daySrc;
    });

    setDayCycleIcon(theme);
    updateQuickMenuToggleIcon();
}

function setUITheme(theme) {
    document.body.dataset.theme = theme;
    updateThemeIcons(theme);
    updateAudioMuteIcon();
}

function shouldOpenMyWorkFromSceneObject(object) {
    if (!object || !object.name) return false;

    const myWorkOpenNames = [
        "M_Text_BackGround",
        "Y_Text_BackGround",
        "W_Text_BackGround",
        "O_Text_BackGround",
        "R_Text_BackGround",
        "K_Text_BackGround",
        "Shelf_First_RayCast_Pointer",
    ];

    return myWorkOpenNames.some((namePart) => object.name.includes(namePart));
}

function handleRaycasterInteraction() {
    if (isDocumentViewerOpen || isMyWorkInspectorOpen) return;
    if (!isRaycastEnabled || (isModalOpen && !isExtraEnvelopeMode)) return;

    if (currentIntersects.length <= 0) return;

    const object = currentIntersects[0].object;

    /*
      Extra focused mode:
      Only Resume / CV physical models work here.
      The map behind them cannot be clicked again.
    */
    if (isExtraEnvelopeMode) {
        const envelopeType = getExtraEnvelopeType(object);

        if (envelopeType) {
            openExtraEnvelopeDocument(envelopeType);
        }

        return;
    }

    if (object.name.includes("Atlas")) {
        toggleDayNight(object);
        return;
    }

    /*
      Physical Resume / CV envelopes are intentionally ignored here.
      They only work after entering Extra envelope mode.
    */
    if (isExtraEnvelopeObject(object)) {
        return;
    }

    if (shouldOpenMyWorkFromSceneObject(object)) {
        playClickSFX();
        showModalWithCamera(modals.pictures, "pictures");
        return;
}

    Object.entries(socialLinks).forEach(([key, url]) => {
        if (object.name.includes(key)) {
            playClickSFX();

            const newWindow = window.open();
            newWindow.opener = null;
            newWindow.location = url;
            newWindow.target = "_blank";
            newWindow.rel = "noopener noreferrer";
        }
    });

    if (object.name.includes("Pictures_Button")) {
        playClickSFX();
        showModalWithCamera(modals.pictures, "pictures");
    } else if (object.name.includes("AboutMe_Button")) {
        playClickSFX();
        showModalWithCamera(modals.aboutme, "aboutme");
    } else if (object.name.includes("Extra_Button")) {
        playClickSFX();
        showExtraEnvelopeMode();
    }
}

window.addEventListener("click", handleRaycasterInteraction);

const quickMenu = document.querySelector("#quick-menu");
const quickMenuToggleButton = document.querySelector("#quick-menu-toggle-button");
const quickMenuToggleIcon = document.querySelector("#quick-menu-toggle-icon");

const audioMenu = document.querySelector("#audio-menu");
const audioMenuToggleButton = document.querySelector("#audio-menu-toggle-button");
const audioMenuToggleIcon = document.querySelector("#audio-menu-toggle-icon");
const musicVolumeSlider = document.querySelector("#music-volume-slider");
const ambienceVolumeSlider = document.querySelector("#ambience-volume-slider");
const audioPrevButton = document.querySelector("#audio-prev-button");
const audioPauseButton = document.querySelector("#audio-pause-button");
const audioNextButton = document.querySelector("#audio-next-button");
const audioMuteControlButton = document.querySelector("#audio-mute-control-button");

function closeQuickMenuOnly() {
    if (!quickMenu) return;

    quickMenu.classList.remove("is-open");
    updateQuickMenuToggleIcon();
}

function closeAudioMenuOnly() {
    if (!audioMenu) return;

    audioMenu.classList.remove("is-open");
    updateAudioMenuIcon();
}

function setQuickMenuOpen(isOpen) {
    if (!quickMenu) return;

    if (isOpen) {
        closeAudioMenuOnly();
    }

    quickMenu.classList.toggle("is-open", isOpen);
    updateQuickMenuToggleIcon();
}

function toggleQuickMenu() {
    if (!quickMenu) return;

    const isOpen = quickMenu.classList.contains("is-open");
    setQuickMenuOpen(!isOpen);
}

function collapseQuickMenu() {
    setQuickMenuOpen(false);
}

function openContactMenu() {
    showModal(modals.contact);
}

if (quickMenu) {
    quickMenu.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    quickMenu.addEventListener("touchstart", (e) => {
        e.stopPropagation();
    }, { passive: false });

    quickMenu.addEventListener("touchend", (e) => {
        e.stopPropagation();
    }, { passive: false });
}

if (quickMenuToggleButton) {
    quickMenuToggleButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        toggleQuickMenu();
    });

    quickMenuToggleButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

function setAudioMenuOpen(isOpen) {
    if (!audioMenu) return;

    if (isOpen) {
        closeQuickMenuOnly();
    }

    audioMenu.classList.toggle("is-open", isOpen);
    updateAudioMenuIcon();
}

function toggleAudioMenu() {
    if (!audioMenu) return;

    const isOpen = audioMenu.classList.contains("is-open");
    setAudioMenuOpen(!isOpen);
}

if (audioMenu) {
    audioMenu.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    audioMenu.addEventListener("touchstart", (e) => {
        e.stopPropagation();
    }, { passive: false });

    audioMenu.addEventListener("touchend", (e) => {
        e.stopPropagation();
    }, { passive: false });
}

if (audioMenuToggleButton) {
    audioMenuToggleButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        toggleAudioMenu();
    });

    audioMenuToggleButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

if (musicVolumeSlider) {
    musicVolumeSlider.value = String(musicVolume);

    musicVolumeSlider.addEventListener("input", (e) => {
        setMusicVolume(e.target.value);
    });

    musicVolumeSlider.addEventListener("pointerdown", () => {
        playClickSFX();
    });
}

if (ambienceVolumeSlider) {
    ambienceVolumeSlider.value = String(ambienceVolume);

    ambienceVolumeSlider.addEventListener("input", (e) => {
        setAmbienceVolume(e.target.value);
    });

    ambienceVolumeSlider.addEventListener("pointerdown", () => {
        playClickSFX();
    });
}

if (audioPrevButton) {
    audioPrevButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        playPreviousMusicTrack();
    });

    audioPrevButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

if (audioPauseButton) {
    audioPauseButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        toggleMusicPaused();
    });

    audioPauseButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

if (audioNextButton) {
    audioNextButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        playClickSFX();
        playNextMusicTrack();
    });

    audioNextButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

if (audioMuteControlButton) {
    audioMuteControlButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        toggleGlobalAudioMute();
    });

    audioMuteControlButton.addEventListener("mouseenter", () => {
        playHoverSFX();
    });
}

updateAudioControlsState();

let isQuickMenuActionPlaying = false;

function runQuickMenuAction(action) {
    if (action === "resumeCV") {
        showExtraEnvelopeMode();
        return;
    }

    if (action === "myWork") {
        showModalWithCamera(modals.pictures, "pictures");
        return;
    }

    if (action === "aboutMe") {
        showModalWithCamera(modals.aboutme, "aboutme");
        return;
    }

    if (action === "contactMe") {
        openContactMenu();
        return;
    }

    if (action === "dayCycle") {
        toggleDayNight(atlasObject);
        return;
    }
}

function collapseQuickMenuWithSelectedDelay(selectedButton, action) {
    if (!quickMenu || isQuickMenuActionPlaying) return;

    isQuickMenuActionPlaying = true;

    selectedButton.classList.add("is-selected");
    quickMenu.classList.add("is-closing-choice");

    // This starts collapsing all the other buttons.
    setQuickMenuOpen(false);

    // How long the selected button waits while the others collapse.
    const otherButtonsCollapseDelay = 280;

    // How long the selected button takes to leave after the others collapse.
    const selectedButtonLeaveDuration = 260;

    window.setTimeout(() => {
        selectedButton.classList.add("is-leaving");
    }, otherButtonsCollapseDelay);

    window.setTimeout(() => {
        selectedButton.classList.remove("is-selected");
        selectedButton.classList.remove("is-leaving");
        quickMenu.classList.remove("is-closing-choice");

        isQuickMenuActionPlaying = false;

        // Some actions, like Day Cycle, are already run immediately on click.
        if (action) {
            runQuickMenuAction(action);
        }
    }, otherButtonsCollapseDelay + selectedButtonLeaveDuration);
}

document.querySelectorAll(".quick-menu-item").forEach((button) => {
    button.addEventListener("mouseenter", () => {
        playHoverSFX();
    });

    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const action = button.dataset.uiAction;
        playClickSFX();

        // Day Cycle should happen immediately, not after the menu collapse delay.
        if (action === "dayCycle") {
            if (!isThemeChanging) {
                toggleDayNight(atlasObject);
            }

            collapseQuickMenuWithSelectedDelay(button, null);
            return;
        }

        collapseQuickMenuWithSelectedDelay(button, action);
    });
});

document
    .querySelectorAll(".contact-link, .document-action-button, .modal-exit-button, .document-viewer-close-button, .my-work-inspector-close")
    .forEach((element) => {
        element.addEventListener("mouseenter", () => {
            playHoverSFX();
        });

        if (element.matches(".contact-link, .document-action-button")) {
            element.addEventListener("click", () => {
                playClickSFX();
            });
        }
    });

setUITheme(currentTheme);

// Leaf sway helper functions
function shouldApplyLeafSway(object) {
    const objectName = object.name.toLowerCase();

    return LEAF_SWAY_NAME_KEYWORDS.some(keyword =>
        objectName.includes(keyword.toLowerCase())
    );
}

function prepareLeafSway(object) {
    if (!object.isMesh) return;
    if (!object.material) return;
    if (!shouldApplyLeafSway(object)) return;
    if (object.userData.hasLeafSway) return;

    object.userData.hasLeafSway = true;

    // Clone the material so only the leaves get the shader modification.
    if (Array.isArray(object.material)) {
        object.material = object.material.map(material => material.clone());
    } else {
        object.material = object.material.clone();
    }

    object.geometry.computeBoundingBox();

    const box = object.geometry.boundingBox;
    const minY = box.min.y;
    const maxY = Math.max(box.max.y, box.min.y + 0.0001);

    object.userData.leafSwayUniforms = [];

    const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

    materials.forEach((material) => {
        const uniforms = {
            uLeafTime: { value: 0 },

            // Main controls:
            // Lower strength = more subtle movement.
            uLeafStrength: { value: 0.035 },

            // Lower frequency = larger smoother waves.
            // Higher frequency = tighter ripples.
            uLeafFrequency: { value: 2.8 },

            // Lower speed = slower movement.
            uLeafSpeed: { value: 0.55 },

            // Random phase so multiple leaf meshes would not move identically.
            uLeafPhase: { value: Math.random() * Math.PI * 2 },

            // Used to make the top/outer parts move more than the lower parts.
            uLeafMinY: { value: minY },
            uLeafMaxY: { value: maxY },
        };

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uLeafTime = uniforms.uLeafTime;
            shader.uniforms.uLeafStrength = uniforms.uLeafStrength;
            shader.uniforms.uLeafFrequency = uniforms.uLeafFrequency;
            shader.uniforms.uLeafSpeed = uniforms.uLeafSpeed;
            shader.uniforms.uLeafPhase = uniforms.uLeafPhase;
            shader.uniforms.uLeafMinY = uniforms.uLeafMinY;
            shader.uniforms.uLeafMaxY = uniforms.uLeafMaxY;

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
                #include <common>

                uniform float uLeafTime;
                uniform float uLeafStrength;
                uniform float uLeafFrequency;
                uniform float uLeafSpeed;
                uniform float uLeafPhase;
                uniform float uLeafMinY;
                uniform float uLeafMaxY;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                #include <begin_vertex>

                float leafHeightMask = smoothstep(uLeafMinY, uLeafMaxY, position.y);

                float time = uLeafTime * uLeafSpeed;

                float waveA = sin(
                    position.y * uLeafFrequency +
                    position.x * 1.35 +
                    time +
                    uLeafPhase
                );

                float waveB = cos(
                    position.z * uLeafFrequency * 0.85 +
                    time * 0.7 +
                    uLeafPhase
                );

                transformed.x += waveA * uLeafStrength * leafHeightMask;
                transformed.z += waveB * uLeafStrength * 0.45 * leafHeightMask;
                `
            );
        };

        material.needsUpdate = true;
        object.userData.leafSwayUniforms.push(uniforms);
    });

    leafSwayObjects.push(object);

    // console.log("Leaf sway applied to:", object.name);
}

function updateLeafSway(elapsedTime) {
    leafSwayObjects.forEach((object) => {
        const uniformsList = object.userData.leafSwayUniforms;

        if (!uniformsList) return;

        uniformsList.forEach((uniforms) => {
            uniforms.uLeafTime.value = elapsedTime;
        });
    });
}

loader.load("/models/CaptainRoomExportPortfolio-v1.glb", (glb)=>{
    glb.scene.traverse(child=>{
        if(child.isMesh){
            if (child.isMesh){
                if(child.name.includes("RayCast")){
                    raycasterObjects.push(child);
                }
            }

            if (child.isMesh){
                if(child.name.includes("Atlas")){
                    atlasObject = child;

                    if(!raycasterObjects.includes(child)){
                        raycasterObjects.push(child);
                    }
                }
            }

            if (child.isMesh){
                if(child.name.includes("Hover")){
                    child.userData.initialScale = new THREE.Vector3().copy(child.scale)
                    child.userData.initialPosition = new THREE.Vector3().copy(child.position)
                    child.userData.initialRotation = new THREE.Euler().copy(child.rotation)

                }
            }

            if (child.name.includes("Animation") || child.name.includes("Dagger")){
                prepareIntroAnimation(child);
            }

            Object.keys(textureMap).forEach(key=>{
                if(child.name.includes(key)){
                    const material = new THREE.MeshBasicMaterial({
                        map: loadedTextures.day[key],
                    });

                    child.material = material;
                    child.userData.textureKey = key;

                    if(!themeObjects.includes(child)){
                        themeObjects.push(child);
                    }

                    if (child.material.map){
                        child.material.map.minFilter = THREE.LinearFilter;
                    }   
                }
                //Glass Mat
                if(child.name.includes("Glass")){
                    child.material = new THREE.MeshPhysicalMaterial({
                        transmission: 1,
                        opacity: 1,
                        metalness: 0,
                        roughness: 0.2,
                        ior: 1.5,
                        thickness: 0.01,
                        specularIntensity: 1,
                        envMap: enviromentMap,
                        envMapIntensity: 1,
                        lightMapIntensity: 1,
                    });   
                }
            });

            // Apply GPU leaf sway after the final material has been assigned.
            prepareLeafSway(child);
            prepareExtraEnvelopeObject(child);
        }
    });

    scene.add(glb.scene);
    playIntroAnimations();

    // Debug helpers.
    // In the browser console you can run:
    // roomModel.traverse((child) => { if (child.isMesh) console.log(child.name); });
    window.roomModel = glb.scene;
    window.leafSwayObjects = leafSwayObjects;
});

//Lock Oribital Controls
const scene = new THREE.Scene();

const godRays = createGodRays();
godRays.setMode(currentTheme);
scene.add(godRays.group);

// Debug helpers for browser console
window.godRays = godRays;
window.THREE = THREE;
window.scene = scene;

window.cameraModalViews = cameraModalViews;

window.logCameraView = () => {
    console.log("camera.position.set(", camera.position.x, camera.position.y, camera.position.z, ")");
    console.log("controls.target.set(", controls.target.x, controls.target.y, controls.target.z, ")");
};

const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(
    3.1614952480796013, 
    6.049569369916736, 
    18.623192008189704);

const renderer = new THREE.WebGLRenderer({canvas:canvas, antialias: true});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

//Orbital Controls
const controls = new OrbitControls( camera, renderer.domElement );

controls.minDistance = 5;
controls.maxDistance = 20;

controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = Math.PI * 1.83;
controls.maxAzimuthAngle = Math.PI / 5.2;

controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.target.set(
    0.4999349138467539,
    1.0595564377570528,
    1.5081876754084138
);

controls.update();

window.camera = camera;
window.controls = controls;

function updateCameraLookAtTarget() {
    camera.lookAt(controls.target);
}

window.disableCameraClamp = () => {
    controls.minDistance = 0;
    controls.maxDistance = Infinity;

    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;

    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;

    window.isPanClampDisabled = true;

    console.log("Camera clamp disabled");
};

window.enableCameraClamp = () => {
    controls.minDistance = 5;
    controls.maxDistance = 20;

    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;

    controls.minAzimuthAngle = Math.PI * 1.83;
    controls.maxAzimuthAngle = Math.PI / 5.2;

    window.isPanClampDisabled = false;

    console.log("Camera clamp restored");
};

window.logCameraView = () => {
    console.log(`position: new THREE.Vector3(${camera.position.x}, ${camera.position.y}, ${camera.position.z}),`);
    console.log(`target: new THREE.Vector3(${controls.target.x}, ${controls.target.y}, ${controls.target.z}),`);
};


const minPan = new THREE.Vector3(-1.2, 0.4, 0.2);
const maxPan = new THREE.Vector3(2.2, 1.8, 2.8);
const previousTarget = new THREE.Vector3();

function clampControlsTarget() {
    previousTarget.copy(controls.target);

    controls.target.clamp(minPan, maxPan);

    const delta = controls.target.clone().sub(previousTarget);
    camera.position.add(delta);
}

function addHighlight(object) {
    if (currentHighlightObject === object) return;

    removeHighlight();

    const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1,
        depthWrite: false
    });

    currentHighlightMesh = new THREE.Mesh(object.geometry, highlightMaterial);
    currentHighlightMesh.name = "Highlight_Outline";
    currentHighlightMesh.scale.set(1.06, 1.06, 1.06);
    currentHighlightMesh.renderOrder = 999;

    object.add(currentHighlightMesh);
    currentHighlightObject = object;
}

function removeHighlight() {
    if (currentHighlightObject && currentHighlightMesh) {
        currentHighlightObject.remove(currentHighlightMesh);

        if (currentHighlightMesh.material) {
            currentHighlightMesh.material.dispose();
        }
    }

    currentHighlightObject = null;
    currentHighlightMesh = null;
}

function getNameIndex(object) {
    const match = object.name.match(/Name_(\d+)/);
    return match ? Number(match[1]) : 999;
}

function prepareIntroAnimation(object) {
    object.userData.introScale = new THREE.Vector3().copy(object.scale);
    object.userData.introPosition = new THREE.Vector3().copy(object.position);
    object.userData.introRotation = new THREE.Euler().copy(object.rotation);

    if(object.name.includes("Dagger")){
        daggerAnimationObjects.push(object);
        return;
    }

    object.scale.set(0.01, 0.01, 0.01);

    animationObjects.push(object);

    if(object.name.includes("Name_")){
        nameAnimationObjects.push(object);
    }
}

function playIntroAnimations() {
    if(hasPlayedIntroAnimation) return;

    hasPlayedIntroAnimation = true;

    animationObjects.forEach((object) => {
        const originalScale = object.userData.introScale;
        const randomDelay = Math.random() * 1.3;

        gsap.to(object.scale, {
            x: originalScale.x,
            y: originalScale.y,
            z: originalScale.z,
            duration: 1,
            delay: randomDelay,
            ease: "back.out(1.7)"
        });
    });

    daggerAnimationObjects.forEach((object, index) => {
        const originalScale = object.userData.introScale;
        const originalPosition = object.userData.introPosition;
        const originalRotation = object.userData.introRotation;

        gsap.killTweensOf(object.position);

        object.scale.copy(originalScale);
        object.rotation.copy(originalRotation);

        gsap.fromTo(object.position,
            {
                x: originalPosition.x,
                y: originalPosition.y + 8,
                z: originalPosition.z
            },
            {
                x: originalPosition.x,
                y: originalPosition.y,
                z: originalPosition.z,
                duration: 0.8,
                delay: 0.25 + index * 0.1,
                ease: "power2.in",
                overwrite: true,
                onComplete: () => {
                    object.position.copy(originalPosition);
                    object.rotation.copy(originalRotation);
                    object.scale.copy(originalScale);
                }
            }
        );
    });
    
    nameAnimationObjects
        .sort((a, b) => getNameIndex(a) - getNameIndex(b))
        .forEach((object, index) => {
            const originalPosition = object.userData.introPosition;

            gsap.to(object.position, {
                y: originalPosition.y + 0.18,
                duration: 0.25,
                delay: 0.5 + index * 0.08,
                repeat: 1,
                yoyo: true,
                ease: "power1.inOut"
            });
        });
}

window.addEventListener("resize",()=>{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
});

function playHoverAnimation (object, isHovering){
    gsap.killTweensOf(object.scale);
    gsap.killTweensOf(object.rotation);

    if (isHovering){
        gsap.to(object.scale, {
            x: object.userData.initialScale.x * 1.3,
            y: object.userData.initialScale.y * 1.3,
            z: object.userData.initialScale.z * 1.3,
            duration: 0.4,
            ease: "bounce.out(1)",
        });
        // gsap.to(object.rotation, {
        //     x: object.userData.initialRotation.x * Math.PI / 8,
        //     duration: 0.5,
        //     ease: "bounce.out(1.8)",
        // });
    }else{
        gsap.to(object.scale, {
            x: object.userData.initialScale.x,
            y: object.userData.initialScale.y,
            z: object.userData.initialScale.z,
            duration: 0.3,
            ease: "bounce.out(1.8)",
        });
        // gsap.to(object.rotation, {
        //     x: object.userData.initialRotation.x,
        //     duration: 0.3,
        //     ease: "bounce.out(1.8)",
        // });
    }
}

const render = () => {
  const elapsedTime = performance.now() * 0.001;


    if (!isCameraTransitioning && !isModalOpen) {
        controls.update();

        if (!window.isPanClampDisabled) {
            clampControlsTarget();
        }
    } else {
        updateCameraLookAtTarget();
    }

  godRays.update(elapsedTime);
  updateLeafSway(elapsedTime);

// Raycaster
if (isRaycastEnabled && isExtraEnvelopeMode) {
    updateExtraEnvelopeRaycaster();
} else if (isRaycastEnabled && !isModalOpen) {
    raycaster.setFromCamera(pointer, camera);
    const normalRaycasterObjects = raycasterObjects.filter((object) => {
    return !isExtraEnvelopeObject(object);
});

    currentIntersects = raycaster.intersectObjects(normalRaycasterObjects);

    if (currentIntersects.length > 0) {
        const currentIntersectObject = currentIntersects[0].object;
        const isSFXHoverTarget =
            currentIntersectObject.name.includes("Pointer") ||
            currentIntersectObject.name.includes("Atlas") ||
            currentIntersectObject.name.includes("Hover") ||
            currentIntersectObject.name.includes("Highlight") ||
            Object.keys(socialLinks).some((key) => currentIntersectObject.name.includes(key));

        if (isSFXHoverTarget && currentSFXHoverObject !== currentIntersectObject) {
            playHoverSFX();
            currentSFXHoverObject = currentIntersectObject;
        }

        if (!isSFXHoverTarget) {
            currentSFXHoverObject = null;
        }

        if (currentIntersectObject.name.includes("Highlight")) {
            addHighlight(currentIntersectObject);
        } else {
            removeHighlight();
        }

        if (currentIntersectObject.name.includes("Hover")) {
            if (currentIntersectObject !== currentHoveredObject) {
                if (currentHoveredObject) {
                    playHoverAnimation(currentHoveredObject, false);
                }

                playHoverAnimation(currentIntersectObject, true);
                currentHoveredObject = currentIntersectObject;
            }
        } else {
            if (currentHoveredObject) {
                playHoverAnimation(currentHoveredObject, false);
                currentHoveredObject = null;
            }
        }

        if (
            currentIntersectObject.name.includes("Pointer") ||
            currentIntersectObject.name.includes("Atlas")
        ) {
            document.body.style.cursor = "pointer";
        } else {
            document.body.style.cursor = "default";
        }
    } else {
        clearRaycasterState();
    }
} else {
    clearRaycasterState();
}

  renderer.render( scene, camera );

  window.requestAnimationFrame(render);
};

render();
import "./style.scss"
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from "gsap"
import { button } from "framer-motion/client";


const canvas = document.querySelector("#experience-canvas")
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

//modals
const modals = {
    aboutme: document.querySelector(".modal.aboutme"),
    pictures: document.querySelector(".modal.pictures"),
    extra: document.querySelector(".modal.extra")
};

let touchHappened = false;
document.querySelectorAll(".modal-exit-button").forEach(button=>{

    button.addEventListener("touchend",(e)=>{
        touchHappened = true;
        e.preventDefault
        const modal = e.target.closest(".modal");
        hideModal(modal);
    },{passive: false});
    button.addEventListener("click",(e)=>{
        if(touchHappened) return;
        e.preventDefault
        const modal = e.target.closest(".modal");
        hideModal(modal);
    },{passive: false});
});

let isModalOpen = false;

const showModal = (modal) => {
    modal.style.display = "block"
    isModalOpen = true;
    controls.enabled = false;

    if (currentHoveredObject) {
        playHoverAnimation(currentHoveredObject, false);
        currentHoveredObject = null;
    }

    removeHighlight();

    document.body.style.cursor = "default";
    currentIntersects = [];

    gsap.set(modal, { opacity: 0 });

    gsap.to(modal,{
        opacity: 1,
        duration: 0.5,

    });

};

const hideModal = (modal) => {
    isModalOpen = false;
    controls.enabled = true;

    gsap.to(modal,{
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            modal.style.display = "none"
        }
    });

};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

//RayCast
const raycasterObjects = [];
let currentIntersects = [];
let currentHoveredObject = null;
let currentHighlightObject = null;
let currentHighlightMesh = null;

//Day Night
const themeObjects = [];
let currentTheme = "day";
let isThemeChanging = false;
let atlasObject = null;

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

function toggleDayNight(object) {
    if (isThemeChanging) return;

    isThemeChanging = true;

    const nextTheme = currentTheme === "day" ? "night" : "day";
    const spinTarget = atlasObject || object;

    if (spinTarget) {
        gsap.to(spinTarget.rotation, {
            y: spinTarget.rotation.y + Math.PI * 2,
            duration: 1.1,
            ease: "power2.inOut"
        });
    }

    gsap.delayedCall(0.45, () => {
        setTheme(nextTheme);
    });

    gsap.delayedCall(1.1, () => {
        currentTheme = nextTheme;
        isThemeChanging = false;
    });
}


function handleRaycasterInteraction(){
        if (currentIntersects.length > 0){
        const object = currentIntersects[0].object;

        if(object.name.includes("Atlas")){
            toggleDayNight(object);
            return;
        }

        Object.entries(socialLinks).forEach(([key, url]) =>{
            if (object.name.includes(key)){
                const newWindow = window.open();
                newWindow.opener = null;
                newWindow.location = url;
                newWindow.target = "_blank";
                newWindow.rel = "noopener noreferrer";
            }
        });


         if(object.name.includes("Pictures_Button")){
            showModal(modals.pictures)
        }else if (object.name.includes("AboutMe_Button")){
            showModal(modals.aboutme)
        }else if (object.name.includes("Extra_Button")){
            showModal(modals.extra)
        }
    }
}

window.addEventListener("click", handleRaycasterInteraction);



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
                        // exposure: 1,
                        // transmissionResolutionScale: 1,

                    });   
                }
            });
        }
    });
    scene.add(glb.scene);
});


//Lock Oribital Controls
const scene = new THREE.Scene();
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
    gsap.killTweensOf(object.position);


    if (isHovering){
        gsap.to(object.scale, {
            x: object.userData.initialScale.x * 1.2,
            y: object.userData.initialScale.y * 1.2,
            z: object.userData.initialScale.z * 1.2,
            duration: 0.5,
            ease: "bounce.out(1.8)",
        });
        gsap.to(object.rotation, {
            x: object.userData.initialRotation.x * Math.PI / 8,
            duration: 0.5,
            ease: "bounce.out(1.8)",
        });
    }else{
        gsap.to(object.scale, {
            x: object.userData.initialScale.x,
            y: object.userData.initialScale.y,
            z: object.userData.initialScale.z,
            duration: 0.3,
            ease: "bounce.out(1.8)",
        });
        gsap.to(object.rotation, {
            x: object.userData.initialRotation.x,
            duration: 0.3,
            ease: "bounce.out(1.8)",
        });
    }
}


const render = () => {
  controls.update();
    clampControlsTarget();

//   console.log(camera.position);
//   console.log("000000000");
//   console.log(controls.target);

//Raycaster
raycaster.setFromCamera(pointer, camera);
currentIntersects = raycaster.intersectObjects(raycasterObjects);
for (let i = 0; i < currentIntersects.length; i++){
}

if(currentIntersects.length>0){
    const currentIntersectObject = currentIntersects[0].object

    if(currentIntersectObject.name.includes("Highlight")){
        addHighlight(currentIntersectObject);
    }else{
        removeHighlight();
    }

    if(currentIntersectObject.name.includes("Hover")){
        if(currentIntersectObject !== currentHoveredObject){

            if(currentHoveredObject){
                playHoverAnimation(currentHoveredObject, false);
            }


            playHoverAnimation(currentIntersectObject, true);
            currentHoveredObject = currentIntersectObject;
        }
    }

    if(currentIntersectObject.name.includes("Pointer") || currentIntersectObject.name.includes("Atlas")){
        document.body.style.cursor = "pointer"
    }else{
        document.body.style.cursor = "default"
    }
    
}else{
    removeHighlight();

    if (currentHoveredObject) {
        playHoverAnimation(currentHoveredObject, false);
        currentHoveredObject = null;
    }
        document.body.style.cursor = "default"
    }


  renderer.render( scene, camera );

  window.requestAnimationFrame(render);
};

render();
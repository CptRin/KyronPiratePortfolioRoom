// src/GodRays.js
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;

  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x)
      + (c - a) * u.y * (1.0 - u.x)
      + (d - b) * u.x * u.y;
  }

  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(st * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    // Slow movement timer.
    // Lower = slower movement.
    float t = uTime * 0.135;

    // Fade on left and right edges
    float leftFade = smoothstep(0.0, 0.28, vUv.x);
    float rightFade = 1.0 - smoothstep(0.72, 1.0, vUv.x);
    float sideFade = leftFade * rightFade;

    // Fade at both ends of the ray
    float startFade = smoothstep(0.0, 0.18, vUv.y);
    float endFade = 1.0 - smoothstep(0.72, 1.0, vUv.y);
    float lengthFade = startFade * endFade;

    // Keep the strongest part in the middle of the ray width
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0;
    center = pow(clamp(center, 0.0, 1.0), 1.7);

    // Distort UVs slightly so the mask drifts instead of sliding straight
    vec2 driftingUv = vUv;
    driftingUv.x += sin(vUv.y * 5.0 + t * 2.0) * 0.035;
    driftingUv.y += cos(vUv.x * 4.0 + t * 1.5) * 0.025;

    // Large soft cloud breakup.
    // Higher Y frequency helps avoid the stretched vertical look.
    float largeNoise = fbm(vec2(
      driftingUv.x * 1.5 + t,
      driftingUv.y * 4.0 - t * 1.4
    ));

    float fineNoise = fbm(vec2(
      driftingUv.x * 4.0 - t * 1.2,
      driftingUv.y * 7.0 - t * 2.0
    ));

    // Alpha mask from noise.
    // Increasing the first value makes the ray more broken up.
    float largeMask = smoothstep(0.28, 0.88, largeNoise);
    float fineMask = smoothstep(0.32, 0.92, fineNoise);

    float noiseMask = mix(0.45, 1.0, largeMask) * mix(0.65, 1.0, fineMask);

    // Very subtle pulse so the rays feel alive
    float pulse = 0.88 + sin(uTime * 0.35) * 0.12;

    float alpha = sideFade * lengthFade * center * noiseMask * pulse * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createGodRays() {
  const group = new THREE.Group();
  group.name = "GodRays";

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.035 },
      uColor: { value: new THREE.Color("#fff2c4") },
    },
  });

  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

  const ray1 = new THREE.Mesh(geometry, material);
  ray1.name = "GodRay_01";
  ray1.position.set(0, 2.7, 2);
  ray1.rotation.set(90, 0, 0);
  ray1.scale.set(2.2, 5, 1);

  const ray2 = new THREE.Mesh(geometry, material);
  ray2.name = "GodRay_02";
  ray2.position.set(0.3, 2.7, 0);
  ray2.rotation.set(90, 0, 0);
  ray2.scale.set(1.8, 4.5, 1);

  const ray3 = new THREE.Mesh(geometry, material);
  ray3.name = "GodRay_03";
  ray3.position.set(-0.6, 1.7, 1);
  ray3.rotation.set(90, 0, 0);
  ray3.scale.set(1.2, 4, 1);



  //Right side
    const ray4 = new THREE.Mesh(geometry, material);
  ray4.name = "GodRay_04";
  ray4.position.set(3, 2.7, 2);
  ray4.rotation.set(90, 0, 0);
  ray4.scale.set(2.2, 5, 1);

  const ray5 = new THREE.Mesh(geometry, material);
  ray5.name = "GodRay_05";
  ray5.position.set(2, 2.7, 0);
  ray5.rotation.set(90, 0, 0);
  ray5.scale.set(1.8, 4.5, 1);

  const ray6 = new THREE.Mesh(geometry, material);
  ray6.name = "GodRay_06";
  ray6.position.set(3, 1.7, 1);
  ray6.rotation.set(90, 0, 0);
  ray6.scale.set(1.2, 4, 1);



  //Left Side
    const ray7 = new THREE.Mesh(geometry, material);
  ray7.name = "GodRay_07";
  ray7.position.set(-3, 2.7, 2);
  ray7.rotation.set(90, 0, 0);
  ray7.scale.set(2.2, 5, 1);

  const ray8 = new THREE.Mesh(geometry, material);
  ray8.name = "GodRay_08";
  ray8.position.set(-2.1, 2.7, 0);
  ray8.rotation.set(90, 0, 0);
  ray8.scale.set(1.8, 4.5, 1);

  const ray9 = new THREE.Mesh(geometry, material);
  ray9.name = "GodRay_09";
  ray9.position.set(-3, 1.7, 1);
  ray9.rotation.set(90, 0, 0);
  ray9.scale.set(1.2, 4, 1);


  ray1.renderOrder = 9999;
  ray2.renderOrder = 9999;
  ray3.renderOrder = 9999;

  ray4.renderOrder = 9999;
  ray5.renderOrder = 9999;
  ray6.renderOrder = 9999;

  ray7.renderOrder = 9999;
  ray8.renderOrder = 9999;
  ray9.renderOrder = 9999;

  group.add(ray1, ray2, ray3, ray4, ray5, ray6, ray7, ray8, ray9);


  function update(elapsedTime) {
    material.uniforms.uTime.value = elapsedTime;
  }

  function setMode(mode) {
    if (mode === "day") {
      group.visible = true;
      material.uniforms.uColor.value.set("#fff2c4");

      material.uniforms.uOpacity.value = 0.2;
    }

    if (mode === "night") {
      group.visible = true;
      material.uniforms.uColor.value.set("#b8ccff");

      material.uniforms.uOpacity.value = 0.218;
    }

    if (mode === "off") {
      group.visible = false;
    }
  }

  return {
    group,
    update,
    setMode,
  };
}
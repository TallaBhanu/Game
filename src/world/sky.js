// Sky dome, sun/moon lighting and the day-night cycle.
import * as THREE from 'three';
import { Sky as PhysicalSky } from 'three/examples/jsm/objects/Sky.js';
import { clamp, lerp, smoothstep } from '../core/util.js';

const KEYS = [
  // hour, zenith, horizon, sunColor, sunIntensity, ambient
  [0, '#0b1530', '#1c2742', '#8fa6d6', 0.25, 0.35],
  [5, '#13203f', '#3a3c5a', '#8fa6d6', 0.2, 0.35],
  [6, '#4d5f8a', '#e89a63', '#ffb27a', 1.0, 0.6],
  [7.5, '#6aa3d6', '#efc79a', '#ffd9a8', 2.2, 0.9],
  [12, '#5f9fd8', '#e6dcc4', '#fff4e0', 3.0, 1.05],
  [16.5, '#6aa0d0', '#ecd2a6', '#ffe2b8', 2.6, 0.95],
  [18, '#5a6a9a', '#f08a4a', '#ff9a5a', 1.2, 0.65],
  [19.2, '#1d2648', '#5a3f5a', '#8fa6d6', 0.3, 0.4],
  [24, '#0b1530', '#1c2742', '#8fa6d6', 0.25, 0.35],
];
const cA = new THREE.Color(), cB = new THREE.Color();

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.hour = 8.5;
    this.speed = 1 / 40; // game hours per real second (a day in 16 min)
    this.uniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
    };
    // Physically based (Preetham) daylight sky
    this.sky = new PhysicalSky();
    this.sky.scale.setScalar(4000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 7.5;        // dusty Deccan air
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);
    // stars + moon for the night
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.95 + 0.05;
      v.normalize().multiplyScalar(1800);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color: '#eef2ff', fog: false, transparent: true, opacity: 0 }));
    scene.add(this.moon);
    this.dome = new THREE.Group(); // follows the camera (stars + moon + sky)
    // environment lighting generated from the sky itself
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new PhysicalSky();
    this.envSky.scale.setScalar(1000);
    this.envSky.material.uniforms = THREE.UniformsUtils.clone(this.sky.material.uniforms);
    this.envScene.add(this.envSky);
    this.lastEnvDir = new THREE.Vector3(0, -1, 0);
    this.envRT = null;
    this.sun = new THREE.DirectionalLight('#fff', 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 420;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe0ff', '#7a5a3a', 1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog('#e6dcc4', 160, 900);
    this.night = 0;
    this.sunDir = new THREE.Vector3();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;
  }

  get timeLabel() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    const prahar = h < 4 ? 'Night' : h < 6 ? 'Before dawn' : h < 9 ? 'Morning' : h < 12 ? 'Late morning' : h < 15 ? 'Afternoon' : h < 18 ? 'Evening' : h < 20 ? 'Dusk' : 'Night';
    const hh = ((h + 11) % 12) + 1;
    return `${prahar} · ${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  update(dt, focus) {
    this.hour = (this.hour + dt * this.speed) % 24;
    const H = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= H) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smoothstep(0, 1, (H - a[0]) / (b[0] - a[0]));
    this.uniforms.zenith.value.copy(cA.set(a[1])).lerp(cB.set(b[1]), t);
    this.uniforms.horizon.value.copy(cA.set(a[2])).lerp(cB.set(b[2]), t);
    const sunCol = cA.set(a[3]).clone().lerp(cB.set(b[3]), t);
    // sun arc: rises in the east (+x), sets in the west, leaning south
    const ang = ((H - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const isNight = this.sunDir.y < 0;
    this.night = clamp(1 - smoothstep(-0.12, 0.08, this.sunDir.y), 0, 1);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.position.copy(focus);
    this.sky.visible = this.night < 0.999;
    this.starMat.opacity = smoothstep(0.5, 1, this.night);
    this.stars.position.copy(focus);
    this.moon.material.opacity = this.night;
    this.moon.position.copy(focus).addScaledVector(this.sunDir, -1700);
    // refresh image-based lighting when the sun has moved noticeably
    if (this.sunDir.distanceTo(this.lastEnvDir) > 0.02) {
      this.lastEnvDir.copy(this.sunDir);
      const eu = this.envSky.material.uniforms;
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[k].value = this.sky.material.uniforms[k].value;
      eu.sunPosition.value.copy(this.sunDir);
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
    }
    this.scene.environmentIntensity = lerp(0.55, 0.05, this.night);
    const lightDir = isNight ? this.sunDir.clone().negate() : this.sunDir;
    const elev = Math.max(0.15, lightDir.y);
    const ld = new THREE.Vector3(lightDir.x, elev, lightDir.z).normalize();
    this.sun.position.copy(focus).addScaledVector(ld, 160);
    this.sun.target.position.copy(focus);
    this.sun.color.copy(isNight ? cB.set('#9fb4e8') : sunCol);
    this.sun.intensity = lerp(a[4], b[4], t) * (isNight ? 0.6 : 1.15);
    const amb = lerp(a[5], b[5], t);
    this.hemi.intensity = amb * 0.55;
    this.hemi.color.set(isNight ? '#5a6fa8' : '#d8e6ff');
    this.hemi.groundColor.set(isNight ? '#1c1a24' : '#8a6040');
    this.scene.fog.color.copy(this.uniforms.horizon.value);
    if (isNight) this.scene.background = cB.set('#070b18').clone(); else this.scene.background = null;
    this.scene.fog.near = lerp(180, 60, this.night);
    this.scene.fog.far = lerp(950, 320, this.night);
    this.renderer.toneMappingExposure = lerp(0.62, 1.1, this.night);
  }
}

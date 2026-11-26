// Sky dome, sun/moon lighting and the day-night cycle.
import * as THREE from 'three';
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
      sunDir: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() },
      night: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          if (d.y < 0.0) col = horizon * 0.92;
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.25) * (1.0 - night * 0.6);
          // moon opposite the sun
          float m = max(dot(d, -normalize(sunDir)), 0.0);
          col += vec3(0.85, 0.9, 1.0) * pow(m, 1800.0) * 2.0 * night;
          // stars
          vec3 cell = floor(d * 220.0);
          float st = step(0.9975, hash(cell)) * night * smoothstep(0.05, 0.3, d.y);
          col += vec3(st);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight('#fff', 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe0ff', '#7a5a3a', 1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog('#e6dcc4', 120, 520);
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
    this.uniforms.sunColor.value.copy(sunCol);
    // sun arc: rises in the east (+x), sets in the west, leaning south
    const ang = ((H - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const isNight = this.sunDir.y < 0;
    this.night = clamp(1 - smoothstep(-0.12, 0.08, this.sunDir.y), 0, 1);
    this.uniforms.sunDir.value.copy(this.sunDir);
    this.uniforms.night.value = this.night;
    // light: moon at night (opposite the sun)
    const lightDir = isNight ? this.sunDir.clone().negate() : this.sunDir;
    const elev = Math.max(0.15, lightDir.y);
    const ld = new THREE.Vector3(lightDir.x, elev, lightDir.z).normalize();
    this.sun.position.copy(focus).addScaledVector(ld, 150);
    this.sun.target.position.copy(focus);
    this.sun.color.copy(isNight ? cB.set('#9fb4e8') : sunCol);
    this.sun.intensity = lerp(a[4], b[4], t) * (isNight ? 0.8 : 1);
    const amb = lerp(a[5], b[5], t);
    this.hemi.intensity = amb;
    this.hemi.color.set(isNight ? '#5a6fa8' : '#d8e6ff');
    this.hemi.groundColor.set(isNight ? '#1c1a24' : '#8a6040');
    this.scene.fog.color.copy(this.uniforms.horizon.value);
    this.scene.fog.near = lerp(140, 60, this.night);
    this.scene.fog.far = lerp(560, 300, this.night);
    this.renderer.toneMappingExposure = lerp(1.0, 1.35, this.night);
    this.dome.position.copy(focus);
  }
}

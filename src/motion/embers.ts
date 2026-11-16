// Cendre et spores qui tombent dans la brume (calque global, devant le carrousel, persistant d'une page à l'autre).
import * as THREE from 'three';
import { isMobile } from '../engine';
import { addLayer, getRenderer } from '../engine/gl';

const VERT = /* glsl */ `
precision highp float;
attribute vec3 position;  // x, y de départ (-1..1), profondeur 0..1
attribute vec2 aSeed;     // vitesse, phase
uniform float uTime;
uniform float uDpr;
uniform float uAspect;
varying float vGlow;
void main() {
  float depth = position.z;
  float speed = mix(0.008, 0.03, aSeed.x) * mix(0.5, 1.0, depth);
  float y = 1.2 - mod(1.2 - position.y + uTime * speed, 2.4);
  float x = position.x + sin(uTime * (0.3 + aSeed.y) + aSeed.y * 40.0) * 0.04 + y * 0.06;
  gl_Position = vec4(x, y, 0.0, 1.0);
  float flicker = 0.6 + 0.4 * sin(uTime * (0.6 + aSeed.x) + aSeed.y * 30.0);
  vGlow = flicker * smoothstep(-1.2, -0.6, y) * smoothstep(1.2, 0.4, y) * mix(0.35, 1.0, depth);
  gl_PointSize = mix(1.5, 4.5, depth * depth) * uDpr;
}`;

const FRAG = /* glsl */ `
precision highp float;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vGlow;
  vec3 col = mix(vec3(0.42, 0.47, 0.43), vec3(0.78, 0.76, 0.70), smoothstep(0.25, 0.0, d)) * 0.55;
  gl_FragColor = vec4(col * a, a);
}`;

export function embers() {
  if (!getRenderer()) return;
  const n = isMobile() ? 70 : 140;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos.set([Math.random() * 2 - 1, Math.random() * 2.4 - 1.2, Math.random()], i * 3);
    seed.set([Math.random(), Math.random()], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const mat = new THREE.RawShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: Math.min(devicePixelRatio, 2) }, uAspect: { value: 1 } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(points);
  const cam = new THREE.Camera();
  addLayer({
    z: 10,
    resize: (w, h) => { mat.uniforms.uAspect.value = w / h; },
    render: (r, t) => { mat.uniforms.uTime.value = t; r.render(scene, cam); },
  });
}

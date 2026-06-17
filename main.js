import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const totalScoreEl = document.querySelector('#totalScore');
const comboScoreEl = document.querySelector('#comboScore');
const bestScoreEl = document.querySelector('#bestScore');
const goalLabelEl = document.querySelector('#goalLabel');
const statusEl = document.querySelector('#status');
const goalButtons = Array.from(document.querySelectorAll('[data-target]'));
const actionButtons = Array.from(document.querySelectorAll('[data-action]'));

const TARGETS = {
  bigCup: {
    label: '大皿',
    local: new THREE.Vector3(-0.26, 0.34, 0),
    catchRadius: 0.18,
    catchDirection: new THREE.Vector3(-1, 0, 0),
    releaseOffset: new THREE.Vector3(-0.02, 0.08, 0.02),
    score: 1,
    color: 0xf2a65a,
  },
  smallCup: {
    label: '小皿',
    local: new THREE.Vector3(0.26, 0.3, 0),
    catchRadius: 0.15,
    catchDirection: new THREE.Vector3(1, 0, 0),
    releaseOffset: new THREE.Vector3(0.02, 0.08, 0.01),
    score: 1,
    color: 0x6ed7ff,
  },
  spike: {
    label: 'けん先',
    local: new THREE.Vector3(0, 0.64, 0),
    catchRadius: 0.11,
    catchDirection: new THREE.Vector3(0, 1, 0),
    releaseOffset: new THREE.Vector3(0, 0.11, 0),
    score: 3,
    color: 0x83f0b1,
  },
};

const state = {
  targetId: 'bigCup',
  score: 0,
  combo: 0,
  best: 0,
  pointerDown: false,
  dragging: false,
  lockCatch: 0,
  catchMode: 'string',
  caughtTargetId: null,
  dragStartX: 0,
  dragStartY: 0,
  lastPointerX: 0,
  lastPointerY: 0,
  dragTiltX: 0,
  dragTiltZ: 0,
  pointerVX: 0,
  pointerVY: 0,
  pointerVXSmoothed: 0,
  pointerVYSmoothed: 0,
  lastPointerTime: 0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 5, 14);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
camera.position.set(1.25, 1.65, 4.9);
camera.lookAt(0, 0.15, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ambient = new THREE.HemisphereLight(0xb9d8ff, 0x0b1020, 1.3);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffefcf, 2.8);
key.position.set(4, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 18;
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
scene.add(key);

const fill = new THREE.DirectionalLight(0x6ed7ff, 0.8);
fill.position.set(-5, 2, -2);
scene.add(fill);

const rim = new THREE.PointLight(0xf2a65a, 1.8, 12, 2);
rim.position.set(-2.5, 1.4, 2.6);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x09111f, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.02;
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(1.28, 0.03, 12, 64),
  new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.88, metalness: 0.08, transparent: true, opacity: 0.55 }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -1.01;
scene.add(ring);

function makeShadowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.18)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

const shadowBlob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, opacity: 0.48, depthWrite: false }),
);
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.position.y = -1.01;
shadowBlob.scale.set(2.2, 2.2, 2.2);
scene.add(shadowBlob);

const kendama = new THREE.Group();
kendama.position.set(0, 0.12, 0);
scene.add(kendama);

const wood = new THREE.MeshStandardMaterial({ color: 0xb17045, roughness: 0.82, metalness: 0.03 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x7e4829, roughness: 0.86, metalness: 0.01 });
const cupMaterial = new THREE.MeshStandardMaterial({ color: 0xc98b58, roughness: 0.78, metalness: 0.02 });
const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.9, metalness: 0.06 });
const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xf2d4bc, roughness: 0.52, metalness: 0.12 });
const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xd0a17d, roughness: 0.72, metalness: 0.02 });
const ballMarkerMaterial = new THREE.MeshStandardMaterial({ color: 0x121721, roughness: 0.95 });

const handle = new THREE.Group();
kendama.add(handle);

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.18, 24), wood);
body.castShadow = true;
body.receiveShadow = true;
handle.add(body);

const bodyTop = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), wood);
bodyTop.position.y = 0.59;
bodyTop.castShadow = true;
handle.add(bodyTop);

const bodyBottom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), woodDark);
bodyBottom.position.y = -0.59;
bodyBottom.castShadow = true;
handle.add(bodyBottom);

const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.14, 22), accentMaterial);
waist.position.y = -0.18;
waist.castShadow = true;
handle.add(waist);

function createCup(radius, depth, y, x, color) {
  const cup = new THREE.Group();
  cup.position.set(x, y, 0);
  cup.rotation.z = x > 0 ? Math.PI * 0.52 : -Math.PI * 0.52;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.38, 16), cupMaterial);
  stem.position.x = 0;
  stem.castShadow = true;
  cup.add(stem);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, depth, 24, 1, false), new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.02 }));
  bowl.rotation.z = Math.PI / 2;
  bowl.position.x = x > 0 ? 0.2 : -0.2;
  bowl.castShadow = true;
  cup.add(bowl);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 12, 28), new THREE.MeshStandardMaterial({ color: 0xf0c7a3, roughness: 0.72, metalness: 0.04 }));
  rim.rotation.y = Math.PI / 2;
  rim.position.x = x > 0 ? 0.19 : -0.19;
  cup.add(rim);

  return cup;
}

const bigCup = createCup(0.26, 0.12, 0.28, -0.34, 0xb87848);
const smallCup = createCup(0.19, 0.1, 0.24, 0.34, 0xbf7f51);
handle.add(bigCup, smallCup);

const spikeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.28, 18), spikeMaterial);
spikeBase.position.y = 0.67;
spikeBase.castShadow = true;
handle.add(spikeBase);

const spikeTip = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.18, 18), spikeMaterial);
spikeTip.position.y = 0.9;
spikeTip.castShadow = true;
handle.add(spikeTip);

const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), accentMaterial);
topCap.position.y = 1.0;
topCap.castShadow = true;
handle.add(topCap);

const stringAnchor = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), accentMaterial);
stringAnchor.position.set(0, 0.96, 0);
handle.add(stringAnchor);

const ballGroup = new THREE.Group();
scene.add(ballGroup);

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 20), ballMaterial);
ball.castShadow = true;
ball.receiveShadow = true;
ballGroup.add(ball);

const ballHole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), ballMarkerMaterial);
ballHole.rotation.z = Math.PI / 2;
ballHole.position.set(0.11, 0, 0);
ballHole.castShadow = true;
ballGroup.add(ballHole);

const ballHighlight = new THREE.Mesh(
  new THREE.SphereGeometry(0.035, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xfff1db }),
);
ballHighlight.position.set(-0.05, 0.08, 0.07);
ballGroup.add(ballHighlight);

const ropePoints = Array.from({ length: 28 }, () => new THREE.Vector3());
const ropeGeometry = new THREE.BufferGeometry().setFromPoints(ropePoints);
const ropeMaterial = new THREE.LineBasicMaterial({ color: 0xfff4df, transparent: true, opacity: 0.92 });
const rope = new THREE.Line(ropeGeometry, ropeMaterial);
scene.add(rope);

const trailPoints = Array.from({ length: 32 }, () => new THREE.Vector3());
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trail = new THREE.Line(
  trailGeometry,
  new THREE.LineBasicMaterial({ color: 0x6ed7ff, transparent: true, opacity: 0.32 }),
);
scene.add(trail);

const particleGeometry = new THREE.SphereGeometry(0.028, 10, 8);
const particleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15, emissive: 0x224466, emissiveIntensity: 0.6 });
const burstParticles = [];

const anchorLocal = new THREE.Vector3(0, 0.96, 0);
const ballPos = new THREE.Vector3(0, -0.15, 0);
const ballVel = new THREE.Vector3(0.8, 0, -0.2);
const anchorWorld = new THREE.Vector3();
const prevAnchorWorld = new THREE.Vector3();
const anchorVelocity = new THREE.Vector3();
const ballLocal = new THREE.Vector3();
const ballLocalVelocity = new THREE.Vector3();
const ballHandleLocal = new THREE.Vector3();
const targetWorld = new THREE.Vector3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();

const gravity = new THREE.Vector3(0, -9.8, 0);
const stringLength = 1.1;
const targetNames = Object.keys(TARGETS);
const activeColors = {
  bigCup: 0xf2a65a,
  smallCup: 0x6ed7ff,
  spike: 0x83f0b1,
};

let goalFlashTimer = 0;
let lastTime = performance.now();
let cameraTargetX = 0;
let cameraTargetY = 0;
let handleTargetX = 0.1;
let handleTargetZ = -0.22;

handle.rotation.x = handleTargetX;
handle.rotation.z = handleTargetZ;
handle.rotation.y = 0.45;
kendama.rotation.y = -0.1;

function setStatus(message, kind = 'info') {
  statusEl.textContent = message;
  statusEl.style.color = kind === 'success' ? 'var(--success)' : 'var(--muted)';
  statusEl.classList.remove('flash');
  void statusEl.offsetWidth;
  statusEl.classList.add('flash');
}

function updateHud() {
  totalScoreEl.textContent = String(state.score);
  comboScoreEl.textContent = String(state.combo);
  bestScoreEl.textContent = String(state.best);
  goalLabelEl.textContent = TARGETS[state.targetId].label;
}

function updateGoalButtons() {
  goalButtons.forEach((button) => {
    const active = button.dataset.target === state.targetId;
    button.classList.toggle('active', active);
  });
}

function highlightTargets() {
  const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.03;
  const activeColor = new THREE.Color(activeColors[state.targetId]);

  bigCup.scale.setScalar(state.targetId === 'bigCup' ? 1.05 * pulse : 1);
  smallCup.scale.setScalar(state.targetId === 'smallCup' ? 1.05 * pulse : 1);
  spikeTip.scale.setScalar(state.targetId === 'spike' ? 1.04 * pulse : 1);
  spikeBase.scale.setScalar(state.targetId === 'spike' ? 1.04 * pulse : 1);

  bigCup.children[1].material.emissiveIntensity = 0;
  smallCup.children[1].material.emissiveIntensity = 0;
  spikeTip.material.emissiveIntensity = 0;
  spikeBase.material.emissiveIntensity = 0;

  if (state.targetId === 'bigCup') {
    bigCup.children[1].material.emissive = activeColor;
    bigCup.children[1].material.emissiveIntensity = 0.42;
  }

  if (state.targetId === 'smallCup') {
    smallCup.children[1].material.emissive = activeColor;
    smallCup.children[1].material.emissiveIntensity = 0.42;
  }

  if (state.targetId === 'spike') {
    spikeTip.material.emissive = activeColor;
    spikeBase.material.emissive = activeColor;
    spikeTip.material.emissiveIntensity = 0.42;
    spikeBase.material.emissiveIntensity = 0.2;
  }
}

function pointTrail() {
  for (let i = trailPoints.length - 1; i > 0; i -= 1) {
    trailPoints[i].copy(trailPoints[i - 1]);
  }
  trailPoints[0].copy(ballPos);
  trailGeometry.setFromPoints(trailPoints);
  trailGeometry.attributes.position.needsUpdate = true;
}

function updateRope() {
  const start = anchorWorld.clone();
  const end = ballPos.clone();
  for (let i = 0; i < ropePoints.length; i += 1) {
    const t = i / (ropePoints.length - 1);
    const sag = Math.sin(Math.PI * t) * 0.06;
    ropePoints[i].set(
      THREE.MathUtils.lerp(start.x, end.x, t),
      THREE.MathUtils.lerp(start.y, end.y, t) - sag,
      THREE.MathUtils.lerp(start.z, end.z, t),
    );
  }
  ropeGeometry.setFromPoints(ropePoints);
  ropeGeometry.attributes.position.needsUpdate = true;
}

function spawnBurst(position, baseColor) {
  const color = new THREE.Color(baseColor);
  for (let i = 0; i < 14; i += 1) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial.clone());
    mesh.material.color.copy(color).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.08);
    mesh.material.emissive = color.clone();
    mesh.material.emissiveIntensity = 0.6 + Math.random() * 0.8;
    mesh.position.copy(position);
    mesh.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.4,
      Math.random() * 2.2 + 0.5,
      (Math.random() - 0.5) * 2.4,
    );
    mesh.userData.life = 0.55 + Math.random() * 0.25;
    mesh.castShadow = false;
    scene.add(mesh);
    burstParticles.push(mesh);
  }
}

function updateBursts(dt) {
  for (let i = burstParticles.length - 1; i >= 0; i -= 1) {
    const particle = burstParticles[i];
    particle.userData.life -= dt;
    particle.userData.velocity.y -= 7.2 * dt;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.scale.setScalar(Math.max(0, particle.userData.life) * 1.2);
    if (particle.userData.life <= 0) {
      scene.remove(particle);
      burstParticles.splice(i, 1);
    }
  }
}

function getTargetWorld(id, out = targetWorld) {
  out.copy(TARGETS[id].local);
  handle.localToWorld(out);
  return out;
}

function syncWorldTransforms() {
  kendama.updateMatrixWorld(true);
}

function catchBall(id) {
  const target = TARGETS[id];
  syncWorldTransforms();
  const world = getTargetWorld(id, tmpVecA);
  ballPos.copy(world).add(target.releaseOffset.clone().applyQuaternion(handle.quaternion));
  ballVel.copy(anchorVelocity);
  ballLocalVelocity.set(0, 0, 0);
  state.catchMode = 'caught';
  state.caughtTargetId = id;
  state.lockCatch = 0.45;
  state.combo += 1;
  state.best = Math.max(state.best, state.combo);
  state.score += target.score;
  updateHud();
  updateGoalButtons();
  const message = `${target.label} にキャッチ！ +${target.score} / combo ${state.combo}`;
  setStatus(message, 'success');
  goalFlashTimer = 0.35;
  spawnBurst(world, target.color);
}

function releaseBall(strength = 1) {
  const target = TARGETS[state.caughtTargetId] ?? TARGETS[state.targetId];
  syncWorldTransforms();
  const up = tmpVecA.set(0, 1, 0).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();
  const right = tmpVecB.set(1, 0, 0).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();
  const forward = tmpVecC.set(0, 0, 1).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();

  const impulse = new THREE.Vector3()
    .addScaledVector(up, 2.2 * strength)
    .addScaledVector(right, state.pointerVXSmoothed * 0.004)
    .addScaledVector(forward, -state.pointerVYSmoothed * 0.003);

  ballVel.copy(anchorVelocity).add(impulse);
  ballVel.y += 0.9 * strength;
  ballVel.x += handle.rotation.z * 0.6;
  ballVel.z += -handle.rotation.x * 0.6;

  if (target && state.catchMode === 'caught') {
    const world = getTargetWorld(state.caughtTargetId, tmpVecA);
    ballPos.copy(world).add(target.releaseOffset.clone().applyQuaternion(handle.quaternion));
  }

  state.catchMode = 'string';
  state.caughtTargetId = null;
  state.lockCatch = 0.25;
  setStatus('フリックした。次のキャッチを狙おう。');
}

function resetGame() {
  state.score = 0;
  state.combo = 0;
  state.best = 0;
  state.catchMode = 'string';
  state.caughtTargetId = null;
  state.lockCatch = 0.3;
  handleTargetX = 0.1;
  handleTargetZ = -0.22;
  handle.rotation.set(handleTargetX, 0.45, handleTargetZ);
  ballPos.set(0.12, -0.16, 0.06);
  ballVel.set(0.3, 0.2, -0.1);
  ballLocalVelocity.set(0, 0, 0);
  syncWorldTransforms();
  handle.localToWorld(anchorWorld.copy(anchorLocal));
  prevAnchorWorld.copy(anchorWorld);
  updateHud();
  setStatus('リセットした。ドラッグで振り直せる。');
}

function setTarget(id) {
  if (!TARGETS[id] || id === state.targetId) {
    return;
  }
  state.targetId = id;
  updateGoalButtons();
  updateHud();
  const target = TARGETS[id];
  setStatus(`狙いを ${target.label} に変更した。`, 'success');
}

function flick() {
  syncWorldTransforms();
  if (state.catchMode === 'caught') {
    releaseBall(1);
    return;
  }

  const up = tmpVecA.set(0, 1, 0).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();
  const right = tmpVecB.set(1, 0, 0).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();
  const forward = tmpVecC.set(0, 0, 1).applyQuaternion(handle.getWorldQuaternion(tmpQuat)).normalize();

  ballVel.addScaledVector(up, 2.8);
  ballVel.addScaledVector(right, state.pointerVXSmoothed * 0.006);
  ballVel.addScaledVector(forward, -state.pointerVYSmoothed * 0.0045);
  ballVel.y += 1.3 + Math.max(0, handleTargetX) * 0.5;
  state.lockCatch = 0.18;
  setStatus('Flick! ボールを放った。');
}

function updatePointerVector(clientX, clientY, now) {
  const dt = Math.max((now - state.lastPointerTime) / 1000, 0.016);
  const vx = (clientX - state.lastPointerX) / dt;
  const vy = (clientY - state.lastPointerY) / dt;
  state.pointerVX = vx;
  state.pointerVY = vy;
  state.pointerVXSmoothed = THREE.MathUtils.lerp(state.pointerVXSmoothed, vx, 0.2);
  state.pointerVYSmoothed = THREE.MathUtils.lerp(state.pointerVYSmoothed, vy, 0.2);
  state.lastPointerX = clientX;
  state.lastPointerY = clientY;
  state.lastPointerTime = now;
}

canvas.addEventListener('pointerdown', (event) => {
  state.pointerDown = true;
  state.dragging = true;
  canvas.setPointerCapture(event.pointerId);
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  state.dragTiltX = handleTargetX;
  state.dragTiltZ = handleTargetZ;
  state.lastPointerTime = performance.now();
  state.pointerVX = 0;
  state.pointerVY = 0;
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging) {
    return;
  }
  const now = performance.now();
  const dx = (event.clientX - state.dragStartX) / window.innerWidth;
  const dy = (event.clientY - state.dragStartY) / window.innerHeight;
  handleTargetZ = THREE.MathUtils.clamp(state.dragTiltZ + dx * 2.2, -0.92, 0.92);
  handleTargetX = THREE.MathUtils.clamp(state.dragTiltX + dy * 1.8, -0.72, 0.72);
  updatePointerVector(event.clientX, event.clientY, now);
});

function endDrag() {
  if (!state.pointerDown) {
    return;
  }
  state.pointerDown = false;
  state.dragging = false;
  if (Math.abs(state.pointerVXSmoothed) + Math.abs(state.pointerVYSmoothed) > 90) {
    flick();
  }
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    flick();
  }
  if (event.code === 'KeyR') {
    resetGame();
  }
});

goalButtons.forEach((button) => {
  button.addEventListener('click', () => setTarget(button.dataset.target));
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'flick') {
      flick();
    }
    if (action === 'reset') {
      resetGame();
    }
  });
});

function updateBallPhysics(dt) {
  kendama.updateMatrixWorld(true);
  handle.localToWorld(anchorWorld.copy(anchorLocal));
  anchorVelocity.copy(anchorWorld).sub(prevAnchorWorld).divideScalar(Math.max(dt, 0.016));

  if (state.catchMode === 'caught') {
    const target = TARGETS[state.caughtTargetId];
    const caught = getTargetWorld(state.caughtTargetId, tmpVecA);
    ballPos.copy(caught).add(target.releaseOffset.clone().applyQuaternion(handle.quaternion));
    ballVel.copy(anchorVelocity);
    prevAnchorWorld.copy(anchorWorld);
    return;
  }

  ballLocal.copy(ballPos).sub(anchorWorld);
  ballLocalVelocity.copy(ballVel).sub(anchorVelocity);

  ballLocalVelocity.addScaledVector(gravity, dt);
  ballLocalVelocity.multiplyScalar(1 - 0.06 * dt);
  ballLocal.addScaledVector(ballLocalVelocity, dt);

  const distance = ballLocal.length() || 0.0001;
  tmpVecA.copy(ballLocal).divideScalar(distance);
  ballLocal.copy(tmpVecA).multiplyScalar(stringLength);
  const radialSpeed = ballLocalVelocity.dot(tmpVecA);
  ballLocalVelocity.addScaledVector(tmpVecA, -radialSpeed);

  ballPos.copy(anchorWorld).add(ballLocal);
  ballVel.copy(ballLocalVelocity).add(anchorVelocity);

  const floorY = -0.88;
  if (ballPos.y < floorY + ball.geometry.parameters.radius) {
    ballPos.y = floorY + ball.geometry.parameters.radius;
    ballVel.y = Math.abs(ballVel.y) * 0.58;
    ballVel.x *= 0.92;
    ballVel.z *= 0.92;
    ballLocal.copy(ballPos).sub(anchorWorld);
    ballLocalVelocity.copy(ballVel).sub(anchorVelocity);
  }

  const targetIds = targetNames;
  if (state.lockCatch <= 0) {
    handle.worldToLocal(ballHandleLocal.copy(ballPos));
    const handleQuat = handle.getWorldQuaternion(tmpQuat).invert();
    const localVelocity = tmpVecB.copy(ballVel).applyQuaternion(handleQuat);
    for (const id of targetIds) {
      const target = TARGETS[id];
      const distance = ballHandleLocal.distanceTo(target.local);
      const approach = localVelocity.dot(target.catchDirection);
      const openingDepth = tmpVecD.copy(ballHandleLocal).sub(target.local).dot(target.catchDirection);
      const speed = ballVel.length();
      const catchWindow = target.catchRadius + (id === 'spike' ? 0.01 : 0.03);
      const isFacingOpening = openingDepth > 0.02 && openingDepth < 0.42;
      const isApproaching = approach < 1.8;
      if (distance < catchWindow && isFacingOpening && isApproaching && speed < 8.2) {
        catchBall(id);
        break;
      }
    }
  }

  prevAnchorWorld.copy(anchorWorld);
}

function updateVisuals(dt) {
  handle.rotation.x = THREE.MathUtils.lerp(handle.rotation.x, handleTargetX, 0.12);
  handle.rotation.z = THREE.MathUtils.lerp(handle.rotation.z, handleTargetZ, 0.12);
  handle.rotation.y = THREE.MathUtils.lerp(handle.rotation.y, 0.45, 0.03);

  if (!state.dragging) {
    handleTargetX = THREE.MathUtils.lerp(handleTargetX, 0.06, 0.01);
    handleTargetZ = THREE.MathUtils.lerp(handleTargetZ, -0.15, 0.012);
  }

  const bob = Math.sin(performance.now() * 0.0016) * 0.02;
  kendama.position.y = 0.12 + bob;

  const ballWorld = ballPos.clone();
  ballGroup.position.copy(ballWorld);

  const lift = THREE.MathUtils.clamp(1 - (ballPos.y + 0.3) / 1.5, 0, 1);
  shadowBlob.position.set(ballPos.x, -1.009, ballPos.z);
  shadowBlob.scale.setScalar(1.2 + lift * 0.9);
  shadowBlob.material.opacity = 0.18 + lift * 0.28;

  const time = performance.now() * 0.001;
  const glow = 1 + Math.sin(time * 5) * 0.06;
  ballHighlight.scale.setScalar(glow);

  if (goalFlashTimer > 0) {
    goalFlashTimer -= dt;
    goalLabelEl.style.textShadow = `0 0 ${24 * (goalFlashTimer + 0.1)}px rgba(131, 240, 177, 0.6)`;
  } else {
    goalLabelEl.style.textShadow = 'none';
  }

  cameraTargetX = THREE.MathUtils.lerp(cameraTargetX, (state.pointerDown ? handleTargetZ : 0) * 0.15, 0.04);
  cameraTargetY = THREE.MathUtils.lerp(cameraTargetY, (state.pointerDown ? handleTargetX : 0) * 0.08, 0.04);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, 1.25 + cameraTargetX, 0.04);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.65 + cameraTargetY, 0.04);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 4.9, 0.03);
  camera.lookAt(0, 0.12, 0);

  ropeMaterial.opacity = state.catchMode === 'caught' ? 0.72 : 0.92;
  trailMaterialOpacity();
}

function trailMaterialOpacity() {
  const velocity = ballVel.length();
  trail.material.opacity = THREE.MathUtils.clamp(velocity / 8.5, 0.12, 0.38);
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (state.lockCatch > 0) {
    state.lockCatch -= dt;
  }

  updateBallPhysics(dt);
  updateVisuals(dt);
  updateRope();
  pointTrail();
  updateBursts(dt);
  highlightTargets();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
});

updateHud();
updateGoalButtons();
setStatus('ドラッグでけん玉を振って、Flickでボールを飛ばそう。');
requestAnimationFrame(animate);

resetGame();

import * as THREE from 'three';

const canvas = document.querySelector('#game');
const distanceLabel = document.querySelector('#distance');
const stateLabel = document.querySelector('#state');
const startScreen = document.querySelector('#startScreen');
const startButton = document.querySelector('#startButton');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);
scene.fog = new THREE.FogExp2(0x06080d, 0.008);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 1100);
camera.position.set(-165, 4.5, -165);

const floorSize = 420;
const secretWorldSize = 1200;
const cellSize = 28;
const wallHeight = 16;
const wallThickness = 3.8;
const playerRadius = 2.7;
const playerHeight = 4.5;
const gravity = 35;
const moveSpeed = 28;
const jumpVelocity = 13;
const monsterSpeed = 7.5;
const catchDistance = 6.2;
const portalDistance = 18;
const supplyDistance = 6.5;

const clock = new THREE.Clock();
const keys = new Set();
const drone = {
  active: false,
  position: new THREE.Vector3(),
  home: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.18,
};
const mazeGroup = new THREE.Group();
const grasslandGroup = new THREE.Group();
const mazeColliders = [];
const grasslandColliders = [];
const portals = [];
const supplyBoxes = [];
scene.add(mazeGroup);
scene.add(grasslandGroup);
grasslandGroup.visible = false;

let activeColliders = mazeColliders;
let gameStarted = false;
let survivalTime = 0;
let supplies = 0;
let statusMessage = '';
let statusUntil = 0;
let ambientLight;
let sunLight;

const player = {
  velocity: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: true,
  caught: false,
};

const monster = {
  group: null,
  position: new THREE.Vector3(165, 0, -165),
};

const world = {
  realm: 'maze',
  secretName: '',
  portalCooldownUntil: 0,
};

const maze = [
  '###############',
  '#S#.....#.....#',
  '#.#.###.#.###.#',
  '#...#...#...#.#',
  '###.#.#####.#.#',
  '#...#.....#.#.#',
  '#.#######.#.#.#',
  '#.#.....#.#...#',
  '#.#.###.#.###.#',
  '#...#...#...#.#',
  '#.###.#####.#.#',
  '#.....#.....#.#',
  '#.#####.#####.#',
  '#..............',
  '###############',
];

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x161b22,
  roughness: 0.92,
  metalness: 0.05,
});
const gridMaterial = new THREE.MeshBasicMaterial({
  color: 0x273244,
  transparent: true,
  opacity: 0.42,
});
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f2937,
  roughness: 0.78,
  metalness: 0.08,
});
const wallTrimMaterial = new THREE.MeshStandardMaterial({
  color: 0x8fb7ff,
  roughness: 0.5,
  metalness: 0.35,
  emissive: 0x183b72,
  emissiveIntensity: 0.28,
});
const portalMaterial = new THREE.MeshStandardMaterial({
  color: 0x78f6ff,
  emissive: 0x27b6ff,
  emissiveIntensity: 2.2,
  roughness: 0.2,
  metalness: 0.15,
});
const portalCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0xdffbff,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
});
const monsterMaterial = new THREE.MeshStandardMaterial({
  color: 0xff3155,
  emissive: 0xa90022,
  emissiveIntensity: 1.9,
  roughness: 0.38,
});
const monsterAuraMaterial = new THREE.MeshBasicMaterial({
  color: 0xff3155,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const grassMaterial = new THREE.MeshStandardMaterial({
  color: 0x8ddf63,
  roughness: 0.96,
});
const grassStripeMaterial = new THREE.MeshBasicMaterial({
  color: 0xd9ff7a,
  transparent: true,
  opacity: 0.12,
});
const houseMaterial = new THREE.MeshStandardMaterial({
  color: 0xfff2c4,
  roughness: 0.74,
});
const roofMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6f5c,
  roughness: 0.66,
});
const supplyMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd04d,
  emissive: 0x5c3300,
  emissiveIntensity: 0.2,
  roughness: 0.5,
});
const collectedSupplyMaterial = new THREE.MeshStandardMaterial({
  color: 0x7c806f,
  roughness: 0.85,
});

buildLights();
buildMazeFloor();
buildMaze();
buildPortals();
buildSecretRealms();
buildMonster();

startButton.addEventListener('click', () => {
  if (player.caught) {
    window.location.reload();
    return;
  }
  gameStarted = true;
  startScreen.classList.add('hidden');
  canvas.requestPointerLock().catch(() => {
    setStatusMessage('键盘模式', 2);
  });
});

document.addEventListener('pointerlockchange', () => {
  if (player.caught) return;
  const locked = document.pointerLockElement === canvas;
  if (locked || gameStarted) {
    startScreen.classList.add('hidden');
  }
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || player.caught) return;
  if (drone.active) {
    drone.yaw -= event.movementX * 0.0022;
    drone.pitch -= event.movementY * 0.0018;
    drone.pitch = THREE.MathUtils.clamp(drone.pitch, -1.45, 1.15);
    return;
  }
  player.yaw -= event.movementX * 0.0022;
  player.pitch -= event.movementY * 0.0018;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.15, 1.05);
});

window.addEventListener('keydown', (event) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyC', 'ControlLeft', 'ControlRight', 'KeyV'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === 'KeyV' && !event.repeat) toggleDrone();
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

function buildLights() {
  ambientLight = new THREE.HemisphereLight(0x8fb7ff, 0x12161f, 1.8);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 2.1);
  sunLight.position.set(-90, 150, -110);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 520;
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  scene.add(sunLight);
}

function buildMazeFloor() {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorSize, 1, floorSize), floorMaterial);
  floor.position.y = -0.55;
  floor.receiveShadow = true;
  mazeGroup.add(floor);

  const grid = new THREE.GridHelper(floorSize, 30, 0x5f759a, 0x344257);
  grid.position.y = 0.03;
  grid.material = gridMaterial;
  mazeGroup.add(grid);

  const boundaryShape = new THREE.BoxGeometry(floorSize + wallThickness, wallHeight, wallThickness);
  addColliderBox(boundaryShape, 0, wallHeight / 2, -floorSize / 2, wallMaterial, mazeGroup, mazeColliders, true);
  addColliderBox(boundaryShape, 0, wallHeight / 2, floorSize / 2, wallMaterial, mazeGroup, mazeColliders, true);
  const sideShape = new THREE.BoxGeometry(wallThickness, wallHeight, floorSize + wallThickness);
  addColliderBox(sideShape, -floorSize / 2, wallHeight / 2, 0, wallMaterial, mazeGroup, mazeColliders, true);
  addColliderBox(sideShape, floorSize / 2, wallHeight / 2, 0, wallMaterial, mazeGroup, mazeColliders, true);
}

function buildMaze() {
  const offset = -((maze.length - 1) * cellSize) / 2;
  const wallGeometry = new THREE.BoxGeometry(cellSize + 0.8, wallHeight, cellSize + 0.8);
  const trimGeometry = new THREE.BoxGeometry(cellSize + 1.1, 0.45, cellSize + 1.1);

  maze.forEach((row, zIndex) => {
    [...row].forEach((cell, xIndex) => {
      if (cell !== '#') return;
      const x = offset + xIndex * cellSize;
      const z = offset + zIndex * cellSize;
      addColliderBox(wallGeometry, x, wallHeight / 2, z, wallMaterial, mazeGroup, mazeColliders, false);

      const trim = new THREE.Mesh(trimGeometry, wallTrimMaterial);
      trim.position.set(x, wallHeight + 0.2, z);
      mazeGroup.add(trim);
    });
  });
}

function buildPortals() {
  const portalDefs = [
    createPortalDef('晴天草原', -196, -112, Math.PI / 2, -165, -112, -18, 78, 0x91d7ff, 0xffffff, 0xa8e46a),
    createPortalDef('水晶庭院', -112, -196, 0, -112, -165, 338, 12, 0xb9f7ff, 0xeeffff, 0x7be1e8),
    createPortalDef('黄昏村落', 28, -196, 0, 28, -181, -350, 24, 0xffb06a, 0xfff0c2, 0xd69348),
    createPortalDef('雪白庭院', 196, -84, -Math.PI / 2, 165, -84, -12, 342, 0xdff6ff, 0xffffff, 0xd8f2ff),
    createPortalDef('月光湖畔', 196, 112, -Math.PI / 2, 181, 112, 4, -342, 0x27335f, 0xbfd2ff, 0x24345a),
    createPortalDef('水晶庭院', -196, 84, Math.PI / 2, -181, 84, 286, -82, 0xb9f7ff, 0xeeffff, 0x7be1e8),
    createPortalDef('黄昏村落', 84, 196, Math.PI, 84, 181, -286, -78, 0xffb06a, 0xfff0c2, 0xd69348),
    createPortalDef('雪白庭院', -28, 196, Math.PI, -28, 181, 88, 294, 0xdff6ff, 0xffffff, 0xd8f2ff),
    createPortalDef('月光湖畔', -196, -28, Math.PI / 2, -181, -28, -86, -292, 0x27335f, 0xbfd2ff, 0x24345a),
  ];

  portalDefs.forEach((def) => {
    const group = new THREE.Group();
    const ringMaterial = portalMaterial.clone();
    ringMaterial.color.set(def.portalColor);
    ringMaterial.emissive.set(def.portalColor);
    const coreMaterial = portalCoreMaterial.clone();
    coreMaterial.color.set(def.portalColor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.34, 16, 72), ringMaterial);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);

    const core = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), coreMaterial);
    core.rotation.y = Math.PI / 2;
    group.add(core);

    const light = new THREE.PointLight(def.portalColor, 7, 46);
    light.position.set(0, 0.4, 0);
    group.add(light);

    group.position.copy(def.position);
    group.rotation.y = def.yaw;
    mazeGroup.add(group);
    portals.push({ ...def, group });
  });
}

function createPortalDef(name, x, z, yaw, triggerX, triggerZ, spawnX, spawnZ, sky, sun, ground) {
  return {
    name,
    position: new THREE.Vector3(x, 7, z),
    yaw,
    trigger: new THREE.Vector3(triggerX, 0, triggerZ),
    spawn: new THREE.Vector3(spawnX, playerHeight, spawnZ),
    sky,
    sun,
    ground,
    portalColor: sky,
  };
}

function buildSecretRealms() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(secretWorldSize, 1, secretWorldSize), grassMaterial);
  ground.position.y = -0.55;
  ground.receiveShadow = true;
  grasslandGroup.add(ground);

  const stripeGeometry = new THREE.PlaneGeometry(secretWorldSize, 9);
  for (let i = -5; i <= 5; i += 1) {
    const stripe = new THREE.Mesh(stripeGeometry, grassStripeMaterial);
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = 0.38;
    stripe.position.set(i * 58, 0.04, i * 18);
    grasslandGroup.add(stripe);
  }

  buildMeadowRealm();
  buildCrystalRealm();
  buildSunsetRealm();
  buildSnowRealm();
  buildMoonRealm();
}

function buildMeadowRealm() {
  buildHouse(-70, 30, Math.PI * 0.08);
  buildHouse(72, -54, -Math.PI * 0.12);
  buildHouse(108, 94, Math.PI * 0.3);
  buildHouse(-128, -96, -Math.PI * 0.35);

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (let i = -2; i <= 2; i += 1) {
    addPropBox(new THREE.BoxGeometry(2, 8, 2), i * 38, 4, 142, fenceMaterial, grasslandGroup);
    addPropBox(new THREE.BoxGeometry(34, 2, 2), i * 38 + 18, 6, 142, fenceMaterial, grasslandGroup);
  }
}

function buildCrystalRealm() {
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ef6ff,
    emissive: 0x166d96,
    emissiveIntensity: 0.8,
    roughness: 0.22,
    metalness: 0.18,
  });
  for (let i = 0; i < 18; i += 1) {
    const angle = i * 0.92;
    const radius = 28 + (i % 4) * 13;
    const height = 10 + (i % 5) * 5;
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 3), height, 5), crystalMaterial);
    crystal.position.set(320 + Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    crystal.rotation.y = angle;
    crystal.castShadow = true;
    grasslandGroup.add(crystal);
  }
  addSupplyCrate(330, 18);
  addSupplyCrate(288, -58);
}

function buildSunsetRealm() {
  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xffc78f, roughness: 0.72 });
  buildHouse(-344, 36, Math.PI * 0.16);
  buildHouse(-290, -84, -Math.PI * 0.18);
  buildHouse(-430, -18, Math.PI * 0.45);
  for (let i = 0; i < 5; i += 1) {
    const tower = addPropBox(new THREE.BoxGeometry(7, 28 + i * 2, 7), -372 + i * 22, 14 + i, 104, towerMaterial, grasslandGroup);
    tower.rotation.y = i * 0.2;
  }
}

function buildSnowRealm() {
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fdff, roughness: 0.9 });
  const pineMaterial = new THREE.MeshStandardMaterial({ color: 0x1f8f70, roughness: 0.8 });
  for (let i = 0; i < 16; i += 1) {
    const angle = i * 0.74;
    const x = Math.cos(angle) * (62 + (i % 3) * 20);
    const z = 330 + Math.sin(angle) * (58 + (i % 4) * 16);
    addPropBox(new THREE.BoxGeometry(7, 6, 7), x, 3, z, snowMaterial, grasslandGroup);
    const pine = new THREE.Mesh(new THREE.ConeGeometry(8, 24, 8), pineMaterial);
    pine.position.set(x, 18, z);
    pine.castShadow = true;
    grasslandGroup.add(pine);
  }
  buildHouse(-62, 316, -Math.PI * 0.08);
  buildHouse(86, 298, Math.PI * 0.18);
}

function buildMoonRealm() {
  const lakeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f6dff,
    emissive: 0x061b6d,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.18,
  });
  const lake = new THREE.Mesh(new THREE.CylinderGeometry(74, 74, 0.35, 64), lakeMaterial);
  lake.position.set(0, 0.05, -330);
  lake.receiveShadow = true;
  grasslandGroup.add(lake);

  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xe6ecff });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 16), moonMaterial);
  moon.position.set(-62, 64, -388);
  grasslandGroup.add(moon);

  buildHouse(-92, -292, Math.PI * 0.2);
  buildHouse(92, -282, -Math.PI * 0.28);
  addSupplyCrate(12, -250);
}

function buildHouse(x, z, yaw) {
  const house = new THREE.Group();
  house.position.set(x, 0, z);
  house.rotation.y = yaw;
  grasslandGroup.add(house);
  house.updateMatrixWorld(true);

  const wallH = 14;
  const wallT = 1.4;
  const width = 30;
  const depth = 26;
  const doorW = 8;
  const frontZ = -depth / 2;
  const backZ = depth / 2;
  const sideX = width / 2;

  addHouseWall(house, new THREE.BoxGeometry((width - doorW) / 2, wallH, wallT), -(doorW / 2 + (width - doorW) / 4), wallH / 2, frontZ, houseMaterial);
  addHouseWall(house, new THREE.BoxGeometry((width - doorW) / 2, wallH, wallT), doorW / 2 + (width - doorW) / 4, wallH / 2, frontZ, houseMaterial);
  addHouseWall(house, new THREE.BoxGeometry(width, wallH, wallT), 0, wallH / 2, backZ, houseMaterial);
  addHouseWall(house, new THREE.BoxGeometry(wallT, wallH, depth), -sideX, wallH / 2, 0, houseMaterial);
  addHouseWall(house, new THREE.BoxGeometry(wallT, wallH, depth), sideX, wallH / 2, 0, houseMaterial);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(23, 11, 4), roofMaterial);
  roof.position.y = wallH + 5.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(roof);

  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW * 0.9, wallH * 0.78),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  doorGlow.position.set(0, wallH * 0.42, frontZ - 0.04);
  house.add(doorGlow);

  const boxLocal = new THREE.Vector3(0, 2.2, 4);
  house.updateMatrixWorld(true);
  const boxWorld = boxLocal.clone().applyMatrix4(house.matrixWorld);
  const supply = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.4), supplyMaterial);
  supply.position.copy(boxLocal);
  supply.castShadow = true;
  house.add(supply);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 4.8), supplyMaterial);
  lid.position.set(0, 4.15, 4);
  lid.castShadow = true;
  house.add(lid);

  supplyBoxes.push({ mesh: supply, lid, position: boxWorld, collected: false });
}

function addSupplyCrate(x, z) {
  const supply = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.4), supplyMaterial);
  supply.position.set(x, 2.2, z);
  supply.castShadow = true;
  grasslandGroup.add(supply);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 4.8), supplyMaterial);
  lid.position.set(x, 4.15, z);
  lid.castShadow = true;
  grasslandGroup.add(lid);

  supplyBoxes.push({ mesh: supply, lid, position: new THREE.Vector3(x, 2.2, z), collected: false });
}

function buildMonster() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.8, 5.2, 8, 18), monsterMaterial);
  body.position.y = 5.1;
  body.castShadow = true;
  group.add(body);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4f4 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), eyeMaterial);
  leftEye.position.set(-0.85, 7.3, -2.35);
  group.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.85;
  group.add(rightEye);

  const aura = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 16), monsterAuraMaterial);
  aura.position.y = 4.6;
  group.add(aura);

  const light = new THREE.PointLight(0xff3155, 12, 52);
  light.position.y = 6;
  group.add(light);

  group.position.copy(monster.position);
  monster.group = group;
  scene.add(group);
}

function addColliderBox(geometry, x, y, z, material, parent, targetColliders, boundary) {
  const mesh = new THREE.Mesh(geometry, boundary ? material.clone() : material);
  if (boundary) mesh.material.color.set(0x101722);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  targetColliders.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
}

function addHouseWall(house, geometry, x, y, z, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  house.add(mesh);
  mesh.updateMatrixWorld(true);
  grasslandColliders.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
}

function addPropBox(geometry, x, y, z, material, parent) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  if (drone.active) updateDrone(delta);
  else updatePlayer(delta);
  updatePortals();
  updateSupplyBoxes();
  updateMonster(delta);
  updateCamera();
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function toggleDrone() {
  drone.active = !drone.active;
  drone.velocity.set(0, 0, 0);
  if (drone.active) {
    drone.position.copy(camera.position);
    drone.home.copy(camera.position);
    drone.yaw = player.yaw;
    drone.pitch = player.pitch;
    setStatusMessage('无人机已起飞：WASD 飞行，Space 上升，C/Ctrl 下降。', 3);
  } else {
    camera.position.copy(drone.home);
    setStatusMessage('无人机已收回', 2);
  }
}

function updateDrone(delta) {
  const forward = new THREE.Vector3(-Math.sin(drone.yaw), 0, -Math.cos(drone.yaw));
  const right = new THREE.Vector3(Math.cos(drone.yaw), 0, -Math.sin(drone.yaw));
  const thrust = new THREE.Vector3();

  if (keys.has('KeyW')) thrust.add(forward);
  if (keys.has('KeyS')) thrust.sub(forward);
  if (keys.has('KeyD')) thrust.add(right);
  if (keys.has('KeyA')) thrust.sub(right);
  if (keys.has('Space')) thrust.y += 1;
  if (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')) thrust.y -= 1;

  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 76 : 38;
  if (thrust.lengthSq() > 0) {
    thrust.normalize().multiplyScalar(speed);
    drone.velocity.lerp(thrust, 1 - Math.pow(0.001, delta));
  } else {
    drone.velocity.multiplyScalar(Math.pow(0.045, delta));
  }

  drone.position.addScaledVector(drone.velocity, delta);
  const limit = world.realm === 'secret' ? secretWorldSize * 0.52 : floorSize * 0.52;
  drone.position.x = THREE.MathUtils.clamp(drone.position.x, -limit, limit);
  drone.position.y = THREE.MathUtils.clamp(drone.position.y, 3.5, world.realm === 'secret' ? 160 : 80);
  drone.position.z = THREE.MathUtils.clamp(drone.position.z, -limit, limit);
}

function updatePlayer(delta) {
  if (!player.caught) {
    const direction = getMoveDirection();
    player.velocity.x = direction.x * moveSpeed;
    player.velocity.z = direction.z * moveSpeed;

    if (keys.has('Space') && player.grounded) {
      player.velocity.y = jumpVelocity;
      player.grounded = false;
    }
  } else {
    player.velocity.x = 0;
    player.velocity.z = 0;
  }

  player.velocity.y -= gravity * delta;
  moveAxis('x', player.velocity.x * delta);
  moveAxis('z', player.velocity.z * delta);

  camera.position.y += player.velocity.y * delta;
  if (camera.position.y <= playerHeight) {
    camera.position.y = playerHeight;
    player.velocity.y = 0;
    player.grounded = true;
  }
}

function getLivePlayerPosition() {
  return drone.active ? drone.home : camera.position;
}

function getLivePlayerGroundPosition() {
  const position = getLivePlayerPosition();
  return new THREE.Vector3(position.x, 0, position.z);
}

function updatePortals() {
  if (!gameStarted || player.caught || world.realm !== 'maze' || survivalTime < world.portalCooldownUntil) return;
  const playerGroundPosition = getLivePlayerGroundPosition();
  const portal = portals.find((candidate) => playerGroundPosition.distanceTo(candidate.trigger) < portalDistance);
  if (portal) {
    enterSecretRealm(portal);
  }
}

function enterSecretRealm(portal) {
  world.realm = 'secret';
  world.secretName = portal.name;
  world.portalCooldownUntil = survivalTime + 1;
  activeColliders = grasslandColliders;
  mazeGroup.visible = false;
  grasslandGroup.visible = true;
  camera.position.copy(portal.spawn);
  drone.home.copy(portal.spawn);
  if (drone.active) drone.position.copy(portal.spawn);
  player.velocity.set(0, 0, 0);
  player.grounded = true;
  player.yaw = Math.PI * 0.96;
  player.pitch = 0;

  monster.position.set(portal.spawn.x + 185, 0, portal.spawn.z - 175);
  monster.group.position.copy(monster.position);

  scene.background.set(portal.sky);
  scene.fog.color.set(portal.sky);
  scene.fog.density = portal.name === '月光湖畔' ? 0.004 : 0.0018;
  ambientLight.color.set(portal.sun);
  ambientLight.groundColor.set(portal.ground);
  ambientLight.intensity = 2.6;
  sunLight.color.set(portal.sun);
  sunLight.intensity = portal.name === '月光湖畔' ? 1.6 : 4.2;
  sunLight.position.set(-160, 210, portal.name === '黄昏村落' ? -80 : 120);
  setStatusMessage(`传送到了${portal.name}`, 3.2);
}

function updateSupplyBoxes() {
  if (!gameStarted || player.caught || world.realm !== 'secret') return;
  const playerGroundPosition = getLivePlayerGroundPosition();
  const box = supplyBoxes.find((candidate) => !candidate.collected && playerGroundPosition.distanceTo(candidate.position) < supplyDistance);
  if (!box) return;

  box.collected = true;
  supplies += 1;
  box.mesh.material = collectedSupplyMaterial;
  box.lid.material = collectedSupplyMaterial;
  box.lid.rotation.x = -0.75;
  box.lid.position.y += 1.2;
  setStatusMessage(`找到物资箱 ${supplies}/${supplyBoxes.length}`, 2.5);
}

function updateMonster(delta) {
  if (!gameStarted || player.caught) return;
  survivalTime += delta;

  const playerPosition = getLivePlayerPosition();
  const playerGroundPosition = getLivePlayerGroundPosition();
  const chaseVector = playerGroundPosition.clone().sub(monster.position);
  const distance = chaseVector.length();

  if (distance > 0.01) {
    monster.position.add(chaseVector.normalize().multiplyScalar(monsterSpeed * delta));
    monster.group.position.copy(monster.position);
    monster.group.lookAt(playerPosition.x, 4, playerPosition.z);
  }

  if (distance <= catchDistance) {
    player.caught = true;
    stateLabel.textContent = '被抓住';
    startScreen.classList.remove('hidden');
    startScreen.querySelector('h1').textContent = '你被抓住了';
    startScreen.querySelector('p').textContent = `你坚持了 ${formatTime(survivalTime)}，找到了 ${supplies} 个物资箱。点击重新开始。`;
    startButton.textContent = '重新开始';
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function getMoveDirection() {
  const input = new THREE.Vector3(
    Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    0,
    Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
  );

  if (input.lengthSq() === 0) return input;
  input.normalize();

  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  return forward.multiplyScalar(input.z).add(right.multiplyScalar(input.x)).normalize();
}

function moveAxis(axis, amount) {
  if (amount === 0) return;
  camera.position[axis] += amount;
  const playerBox = getPlayerBox();
  const hit = activeColliders.some((box) => playerBox.intersectsBox(box));
  if (hit) camera.position[axis] -= amount;
}

function getPlayerBox() {
  return new THREE.Box3(
    new THREE.Vector3(
      camera.position.x - playerRadius,
      camera.position.y - playerHeight,
      camera.position.z - playerRadius,
    ),
    new THREE.Vector3(
      camera.position.x + playerRadius,
      camera.position.y,
      camera.position.z + playerRadius,
    ),
  );
}

function updateCamera() {
  if (drone.active) {
    camera.position.copy(drone.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = drone.yaw;
    camera.rotation.x = drone.pitch;
    return;
  }

  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateHud() {
  const distance = getMonsterDistance();
  distanceLabel.textContent = `${Math.max(0, Math.round(distance))}m`;
  if (player.caught) return;

  if (!gameStarted) {
    stateLabel.textContent = '准备生存';
  } else if (statusMessage && survivalTime < statusUntil) {
    stateLabel.textContent = statusMessage;
  } else if (!player.grounded) {
    stateLabel.textContent = '跳跃中';
  } else {
    const realmText = world.realm === 'secret' ? `${world.secretName} 物资 ${supplies}/${supplyBoxes.length}` : '寻找传送门';
    stateLabel.textContent = `${realmText} ${formatTime(survivalTime)}`;
  }
}

function getMonsterDistance() {
  const playerPosition = getLivePlayerPosition();
  const dx = playerPosition.x - monster.position.x;
  const dz = playerPosition.z - monster.position.z;
  return Math.hypot(dx, dz);
}

function setStatusMessage(text, duration) {
  statusMessage = text;
  statusUntil = survivalTime + duration;
}

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

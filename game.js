/*
 * CENIT DE HIERRO — Phaser 3
 * ← → Mover | ↑ o ESPACIO Saltar
 * Mantener X: cargar lanzamiento
 * Soltar X: lanzar Áurea
 * Mantener C: atracción magnética
 */

const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;
const WORLD_WIDTH = 2820;
const WORLD_HEIGHT = 900;
const REQUIRED_SHARDS = 3;

const MAX_CHARGE_MS = 1200;
const MIN_THROW_SPEED = 360;
const MAX_THROW_SPEED = 760;
const AXE_GRAVITY = 1180;

let sceneRef;
let player;
let playerArt;
let axeBody;
let axeArt;
let trajectoryGraphics;
let platforms;
let crystals;
let portal;
let cursors;
let spaceKey;
let throwKey;
let magnetKey;
let hudInfo;
let promptText;
let statusText;

let shardCount = 0;
let axeThrown = false;
let axeAnchored = false;
let magnetActive = false;
let chargingThrow = false;
let throwChargeStart = 0;
let throwCharge = 0;
let facing = 1;
let won = false;
let lastMetalBounce = 0;
let lastThrowAt = 0;

const checkpoint = { x: 90, y: 512 };

const config = {
  type: Phaser.AUTO,
  parent: "game-wrap",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#101629",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1000 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  scene: {
    create,
    update
  }
};

new Phaser.Game(config);

function create() {
  sceneRef = this;
  shardCount = 0;
  axeThrown = false;
  axeAnchored = false;
  magnetActive = false;
  chargingThrow = false;
  throwCharge = 0;
  facing = 1;
  won = false;
  lastMetalBounce = 0;
  lastThrowAt = 0;

  this.physics.world.setBounds(
    0, 0, WORLD_WIDTH, WORLD_HEIGHT
  );

  this.cameras.main.setBounds(
    0, 0, WORLD_WIDTH, WORLD_HEIGHT
  );

  drawSky(this);

  platforms = this.physics.add.staticGroup();
  makeLevel(this);

  // Aurel
  player = this.add.rectangle(
    checkpoint.x, checkpoint.y,
    28, 42, 0xffffff, 0
  );

  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(false);
  player.body.setMaxVelocity(620, 760);
  player.body.setDragX(1050);
  player.body.setSize(25, 40);

  this.physics.add.collider(player, platforms);

  playerArt = this.add.graphics().setDepth(20);
  drawAurel();

  // Áurea
  axeBody = this.add.rectangle(
    player.x + 28, player.y,
    36, 38, 0xffffff, 0
  );

  this.physics.add.existing(axeBody);
  axeBody.body.enable = false;
  axeBody.body.setAllowGravity(false);
  axeBody.body.setSize(32, 36);
  axeBody.body.setBounce(0.12);

  axeArt = this.add.graphics().setDepth(22);
  trajectoryGraphics = this.add.graphics().setDepth(18);

  drawAxe();

  this.physics.add.collider(
    axeBody,
    platforms,
    onAxeHitPlatform,
    null,
    this
  );

  // Fragmentos solares
  crystals = this.physics.add.group({
    allowGravity: false,
    immovable: true
  });

  [
    { x: 430, y: 420 },
    { x: 905, y: 423 },
    { x: 1330, y: 282 },
    { x: 1940, y: 197 },
    { x: 2375, y: 192 }
  ].forEach((point, i) => {
    makeCrystal(this, point.x, point.y, i);
  });

  this.physics.add.overlap(
    player,
    crystals,
    collectCrystal,
    null,
    this
  );

  // Portal final
  portal = this.add.container(2640, 128).setDepth(12);

  const portalGlow = this.add.circle(
    0, 0, 36, 0xffb92e, 0.13
  );

  const portalOuter = this.add.circle(
    0, 0, 25, 0x16233d, 1
  ).setStrokeStyle(5, 0xf4bd42, 1);

  const portalInner = this.add.circle(
    0, 0, 15, 0x5de3cb, 0.88
  ).setStrokeStyle(2, 0xffefad, 1);

  const portalCore = this.add.circle(
    0, 0, 6, 0xffffff, 1
  );

  portal.add([
    portalGlow,
    portalOuter,
    portalInner,
    portalCore
  ]);

  this.tweens.add({
    targets: portal,
    scaleX: 1.08,
    scaleY: 1.08,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });

  portal.setSize(80, 80);
  this.physics.add.existing(portal, true);
  portal.body.setSize(80, 80);

  this.physics.add.overlap(
    player,
    portal,
    reachPortal,
    null,
    this
  );

  // Controles
  cursors = this.input.keyboard.createCursorKeys();

  spaceKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE
  );

  throwKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.X
  );

  magnetKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.C
  );

  // Interfaz
  this.add.text(18, 14, "CENIT DE HIERRO", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "18px",
    fontStyle: "bold",
    color: "#ffdb73",
    stroke: "#101629",
    strokeThickness: 4
  }).setScrollFactor(0).setDepth(50);

  hudInfo = this.add.text(
    18, 39,
    "FRAGMENTOS SOLARES  0 / 5  ·  PORTAL: 3",
    {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#eef4ff",
      stroke: "#101629",
      strokeThickness: 3
    }
  ).setScrollFactor(0).setDepth(50);

  statusText = this.add.text(
    GAME_WIDTH - 18, 15,
    "ÁUREA: EN MANO",
    {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#a8f4de",
      stroke: "#101629",
      strokeThickness: 3
    }
  ).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

  promptText = this.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT - 18,
    "Mantén X para cargar · Suelta X para lanzar · Mantén C para atraer",
    {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#fff0bc",
      backgroundColor: "#101629cc",
      padding: { x: 12, y: 7 }
    }
  ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(50);

  this.cameras.main.startFollow(
    player, true, 0.09, 0.09
  );

  this.cameras.main.setDeadzone(180, 100);
}

function update(time, delta) {
  if (won) return;

  const body = player.body;
  const hasAxe = !axeThrown;

  const maxRun = hasAxe ? 205 : 280;

  body.setMaxVelocity(620, 760);

  // Movimiento horizontal
  let direction = 0;

  if (cursors.left.isDown) direction--;
  if (cursors.right.isDown) direction++;

  if (direction !== 0) {
    facing = direction;

    body.setAccelerationX(
      direction * (hasAxe ? 1050 : 1450)
    );
  } else {
    body.setAccelerationX(0);
  }

  if (Math.abs(body.velocity.x) > maxRun) {
    body.setVelocityX(
      Math.sign(body.velocity.x) * maxRun
    );
  }

  // Salto
  const grounded =
    body.blocked.down || body.touching.down;

  if (
    (
      Phaser.Input.Keyboard.JustDown(cursors.up) ||
      Phaser.Input.Keyboard.JustDown(spaceKey)
    ) &&
    grounded
  ) {
    body.setVelocityY(hasAxe ? -445 : -475);

    promptText.setText(
      "¡En el aire! Puedes lanzar Áurea y atraerla."
    );
  }

  // Carga del lanzamiento
  if (
    !axeThrown &&
    throwKey.isDown &&
    time - lastThrowAt > 220
  ) {
    if (!chargingThrow) {
      chargingThrow = true;
      throwChargeStart = time;
    }

    throwCharge = Phaser.Math.Clamp(
      (time - throwChargeStart) / MAX_CHARGE_MS,
      0,
      1
    );

    drawAxeTrajectory(throwCharge);

    promptText.setText(
      `CARGANDO ÁUREA · ${Math.round(throwCharge * 100)}% · Suelta X`
    );
  } else if (chargingThrow && !axeThrown) {
    launchAxe(throwCharge);

    lastThrowAt = time;
    chargingThrow = false;
    throwCharge = 0;

    trajectoryGraphics.clear();
  } else if (!chargingThrow) {
    trajectoryGraphics.clear();
  }

  // Atracción magnética
  magnetActive = axeThrown && magnetKey.isDown;

  if (magnetActive) {
    const dx = axeBody.x - player.x;
    const dy = axeBody.y - player.y;

    const distance = Math.max(
      1,
      Math.hypot(dx, dy)
    );

    if (distance > 39) {
      const pullStrength = axeAnchored ? 1050 : 1250;

      // Aurel acelera hacia el hacha
      body.setAcceleration(
        (dx / distance) * pullStrength,
        (dy / distance) * pullStrength
      );

      if (!axeAnchored && axeBody.body.enable) {
        // El hacha también es atraída hacia Aurel.
        // Su velocidad cambia gradualmente y conserva la inercia.
        axeBody.body.setAcceleration(
          Phaser.Math.Clamp(-dx * 2, -950, 950),
          Phaser.Math.Clamp(-dy * 2, -950, 950)
        );
      }

      promptText.setText(
        "ATRACCIÓN ACTIVA · Suelta C para conservar el impulso."
      );
    } else {
      recoverAxe();

      promptText.setText(
        "Áurea recuperada. ¡Aprovecha la inercia!"
      );
    }
  }

  // Al soltar C, se conserva la velocidad acumulada
  if (!magnetActive) {
    body.setAccelerationY(0);

    if (axeThrown && !axeAnchored && axeBody.body.enable) {
      axeBody.body.setAcceleration(0, 0);
    }
  }

  // Actualizar posición y giro del hacha
  if (!axeThrown) {
    axeBody.setPosition(
      player.x + facing * 26,
      player.y - 1
    );

    axeBody.body.enable = false;

    axeArt.setPosition(axeBody.x, axeBody.y);

    axeArt.rotation =
      facing > 0 ? 0.12 : Math.PI - 0.12;

    statusText.setText("ÁUREA: EN MANO");
  } else {
    axeArt.setPosition(axeBody.x, axeBody.y);

    if (!axeAnchored && axeBody.body.enable) {
      const vx = axeBody.body.velocity.x;
      const vy = axeBody.body.velocity.y;

      if (Math.hypot(vx, vy) > 25 && !magnetActive) {
        axeArt.rotation =
          Math.atan2(vy, vx) + Math.PI / 2;
      }
    }

    if (axeAnchored) {
      statusText.setText(
        magnetActive ? "ANCLA MAGNÉTICA" : "ÁUREA: ANCLADA"
      );
    } else {
      statusText.setText(
        magnetActive ? "ATRACCIÓN ACTIVA" : "ÁUREA: EN VUELO"
      );
    }
  }

  // Actualizar ilustración del personaje
  playerArt.setPosition(player.x, player.y);

  if (direction < 0) playerArt.scaleX = -1;
  else if (direction > 0) playerArt.scaleX = 1;

  // Recuperación al caer al vacío
  if (
    player.y > WORLD_HEIGHT - 45 ||
    player.x < -80
  ) {
    player.setPosition(checkpoint.x, checkpoint.y);
    player.body.setVelocity(0, 0);
    player.body.setAcceleration(0, 0);

    recoverAxe();

    this.cameras.main.flash(
      180, 245, 190, 75
    );

    promptText.setText(
      "Las ruinas te devolvieron al inicio."
    );
  }

  // Evitar perder el hacha fuera del escenario
  if (
    axeThrown &&
    (
      axeBody.y > WORLD_HEIGHT - 20 ||
      axeBody.x < -40 ||
      axeBody.x > WORLD_WIDTH + 40
    )
  ) {
    recoverAxe();

    promptText.setText(
      "Áurea regresó a tu mano. Vuelve a intentarlo."
    );
  }
}

function drawSky(scene) {
  const g = scene.add.graphics().setDepth(-20);

  g.fillStyle(0x17213a, 0.95);

  g.fillPoints([
    new Phaser.Geom.Point(0, 485),
    new Phaser.Geom.Point(0, 370),
    new Phaser.Geom.Point(210, 285),
    new Phaser.Geom.Point(380, 390),
    new Phaser.Geom.Point(620, 255),
    new Phaser.Geom.Point(830, 380),
    new Phaser.Geom.Point(1110, 260),
    new Phaser.Geom.Point(1340, 395),
    new Phaser.Geom.Point(1580, 275),
    new Phaser.Geom.Point(1810, 405),
    new Phaser.Geom.Point(2080, 260),
    new Phaser.Geom.Point(2330, 410),
    new Phaser.Geom.Point(2570, 290),
    new Phaser.Geom.Point(2820, 390),
    new Phaser.Geom.Point(2820, 600),
    new Phaser.Geom.Point(0, 600)
  ], true);

  g.fillStyle(0x0c1326, 0.82);

  g.fillPoints([
    new Phaser.Geom.Point(0, 540),
    new Phaser.Geom.Point(250, 450),
    new Phaser.Geom.Point(470, 520),
    new Phaser.Geom.Point(790, 435),
    new Phaser.Geom.Point(1030, 515),
    new Phaser.Geom.Point(1300, 435),
    new Phaser.Geom.Point(1580, 525),
    new Phaser.Geom.Point(1890, 435),
    new Phaser.Geom.Point(2200, 520),
    new Phaser.Geom.Point(2490, 440),
    new Phaser.Geom.Point(2820, 520),
    new Phaser.Geom.Point(2820, 600),
    new Phaser.Geom.Point(0, 600)
  ], true);

  const stars = scene.add.graphics().setDepth(-18);

  for (let i = 0; i < 180; i++) {
    const x = Phaser.Math.Between(20, WORLD_WIDTH - 20);
    const y = Phaser.Math.Between(25, 430);
    const radius = Math.random() > 0.88 ? 2 : 1;

    stars.fillStyle(
      i % 7 === 0 ? 0xffd579 : 0xb9d4ff,
      Math.random() * 0.5 + 0.28
    );

    stars.fillCircle(x, y, radius);
  }

  const eclipse = scene.add.graphics().setDepth(-17);

  eclipse.fillStyle(0xf3b73c, 0.08).fillCircle(1420, 135, 105);
  eclipse.fillStyle(0xffd36c, 0.12).fillCircle(1420, 135, 75);
  eclipse.fillStyle(0xf3c66a, 0.95).fillCircle(1420, 135, 53);
  eclipse.fillStyle(0x121a30, 1).fillCircle(1441, 123, 49);
  eclipse.lineStyle(2, 0xffd67b, 0.6).strokeCircle(1420, 135, 62);

  const beams = scene.add.graphics().setDepth(-16);

  beams.fillStyle(0xf7cc67, 0.045);

  beams.fillPoints([
    new Phaser.Geom.Point(1390, 170),
    new Phaser.Geom.Point(1340, 530),
    new Phaser.Geom.Point(1410, 530),
    new Phaser.Geom.Point(1410, 170)
  ], true);

  beams.fillPoints([
    new Phaser.Geom.Point(1445, 170),
    new Phaser.Geom.Point(1530, 500),
    new Phaser.Geom.Point(1570, 500),
    new Phaser.Geom.Point(1462, 170)
  ], true);
}

function makeLevel(scene) {
  const layout = [
    [220, 570, 440, 50, "stone"],
    [650, 570, 140, 50, "stone"],
    [940, 570, 190, 50, "stone"],
    [1260, 570, 170, 50, "stone"],
    [1590, 570, 190, 50, "stone"],
    [1950, 570, 210, 50, "stone"],
    [2350, 570, 220, 50, "stone"],
    [2700, 570, 240, 50, "stone"],

    [430, 465, 145, 22, "stone"],
    [690, 420, 145, 22, "stone"],
    [900, 468, 160, 22, "stone"],
    [1120, 405, 155, 22, "metal"],
    [1330, 330, 170, 22, "stone"],
    [1530, 405, 155, 22, "stone"],
    [1740, 320, 155, 22, "metal"],
    [1940, 245, 170, 22, "stone"],
    [2150, 320, 150, 22, "stone"],
    [2375, 240, 170, 22, "stone"],
    [2600, 170, 205, 22, "stone"]
  ];

  layout.forEach(([x, y, w, h, type]) => {
    const fill = type === "metal"
      ? 0x28677c
      : (h > 30 ? 0x333e56 : 0x596680);

    const outline = type === "metal"
      ? 0x68e0ee
      : 0x9baac4;

    const platform = scene.add.rectangle(
      x, y, w, h, fill, 1
    ).setStrokeStyle(2, outline, 0.9).setDepth(3);

    platform.surfaceType = type;
    platforms.add(platform);

    const detail = scene.add.graphics().setDepth(4);

    detail.lineStyle(
      2,
      type === "metal" ? 0x9af4ff : 0xc7d2e7,
      0.55
    );

    detail.lineBetween(
      x - w / 2 + 8,
      y - h / 2 + 3,
      x + w / 2 - 8,
      y - h / 2 + 3
    );

    if (type === "metal") {
      detail.fillStyle(0xb5f6ff, 0.85);
      detail.fillCircle(x - w / 2 + 13, y, 2);
      detail.fillCircle(x + w / 2 - 13, y, 2);
    }
  });

  scene.add.text(75, 485, "LAS RAÍCES", {
    fontSize: "12px",
    color: "#b4c1db",
    fontStyle: "bold"
  }).setDepth(5);

  scene.add.text(1255, 285, "EL CAMINO DEL ECLIPSE", {
    fontSize: "12px",
    color: "#f4d47a",
    fontStyle: "bold"
  }).setDepth(5);

  scene.add.text(2390, 194, "LA CÚSPIDE", {
    fontSize: "12px",
    color: "#f4d47a",
    fontStyle: "bold"
  }).setDepth(5);
}

function makeCrystal(scene, x, y, index) {
  const glow = scene.add.circle(
    x, y, 18, 0xffcc4b, 0.12
  ).setDepth(7);

  scene.tweens.add({
    targets: glow,
    scale: 1.35,
    alpha: 0.03,
    duration: 850 + index * 90,
    yoyo: true,
    repeat: -1
  });

  const crystal = scene.add.polygon(
    x, y,
    [0, -12, 9, -3, 0, 12, -9, -3],
    0xffd35b, 1
  ).setStrokeStyle(2, 0xfff0ad, 1).setDepth(8);

  crystal.setData("glow", glow);

  scene.physics.add.existing(crystal);

  crystal.body.setAllowGravity(false);
  crystal.body.setImmovable(true);
  crystal.body.setSize(20, 26);

  crystals.add(crystal);

  scene.tweens.add({
    targets: crystal,
    y: y - 7,
    duration: 800 + index * 75,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });
}

function drawAurel() {
  playerArt.clear();

  // Capa
  playerArt.fillStyle(0x8d3557, 1);

  playerArt.fillPoints([
    new Phaser.Geom.Point(-8, -8),
    new Phaser.Geom.Point(-17, 7),
    new Phaser.Geom.Point(-12, 17),
    new Phaser.Geom.Point(3, 11),
    new Phaser.Geom.Point(7, -7)
  ], true);

  // Armadura
  playerArt.fillStyle(0x21c9a0, 1)
    .fillRoundedRect(-12, -10, 24, 27, 5);

  playerArt.lineStyle(2, 0x9affdf, 0.95)
    .strokeRoundedRect(-12, -10, 24, 27, 5);

  playerArt.fillStyle(0xf2c66d, 1)
    .fillRect(-10, 1, 20, 4);

  // Cabeza y yelmo
  playerArt.fillStyle(0xe8c6a0, 1).fillCircle(0, -17, 8);
  playerArt.fillStyle(0x48546e, 1).fillRoundedRect(-9, -23, 18, 6, 2);
  playerArt.fillStyle(0xffd36c, 1).fillRect(-2, -25, 4, 4);

  // Botas
  playerArt.fillStyle(0x9a6a38, 1).fillRoundedRect(-12, 15, 10, 6, 2);
  playerArt.fillRoundedRect(2, 15, 10, 6, 2);

  // Ojo
  playerArt.fillStyle(0x182033, 1).fillCircle(3, -17, 1.6);
}

function drawAxe() {
  axeArt.clear();

  axeArt.lineStyle(5, 0x75461f, 1);
  axeArt.beginPath();
  axeArt.moveTo(0, -15);
  axeArt.lineTo(0, 20);
  axeArt.strokePath();

  axeArt.fillStyle(0xffce47, 1);

  axeArt.fillPoints([
    new Phaser.Geom.Point(-2, -15),
    new Phaser.Geom.Point(-15, -24),
    new Phaser.Geom.Point(-27, -17),
    new Phaser.Geom.Point(-21, -6),
    new Phaser.Geom.Point(-7, -4),
    new Phaser.Geom.Point(-2, -7)
  ], true);

  axeArt.lineStyle(2, 0xfff0a4, 1);

  axeArt.strokePoints([
    new Phaser.Geom.Point(-2, -15),
    new Phaser.Geom.Point(-15, -24),
    new Phaser.Geom.Point(-27, -17),
    new Phaser.Geom.Point(-21, -6),
    new Phaser.Geom.Point(-7, -4),
    new Phaser.Geom.Point(-2, -7)
  ], true);

  axeArt.fillStyle(0xfff6bd, 1).fillCircle(-12, -14, 2.5);
}

function launchAxe(charge = 0.5) {
  axeThrown = true;
  axeAnchored = false;
  magnetActive = false;

  const power = Phaser.Math.Clamp(charge, 0, 1);

  const speed = Phaser.Math.Linear(
    MIN_THROW_SPEED,
    MAX_THROW_SPEED,
    power
  );

  axeBody.setPosition(
    player.x + facing * 28,
    player.y - 4
  );

  axeBody.body.enable = true;
  axeBody.body.reset(axeBody.x, axeBody.y);
  axeBody.body.setAllowGravity(true);
  axeBody.body.setImmovable(false);
  axeBody.body.setGravityY(AXE_GRAVITY - 1000);
  axeBody.body.setAcceleration(0, 0);

  axeBody.body.setVelocity(
    facing * speed,
    -speed * 0.78
  );

  // El hacha gira más rápido cuanto mayor es la carga
  axeBody.body.setAngularVelocity(
    facing * Phaser.Math.Linear(280, 720, power)
  );

  axeBody.body.setBounce(0.1);

  axeArt.setPosition(axeBody.x, axeBody.y);

  axeArt.rotation = facing > 0
    ? 0.65
    : Math.PI - 0.65;

  promptText.setText(
    `ÁUREA LANZADA · CARGA ${Math.round(power * 100)}% · Mantén C para atraer`
  );

  statusText.setText("ÁUREA: EN VUELO");
}

function drawAxeTrajectory(charge) {
  if (!trajectoryGraphics || !player || !platforms) return;

  trajectoryGraphics.clear();

  const speed = Phaser.Math.Linear(
    MIN_THROW_SPEED,
    MAX_THROW_SPEED,
    charge
  );

  const vx = facing * speed;
  const vy = -speed * 0.78;

  const startX = player.x + facing * 28;
  const startY = player.y - 4;

  const gravity = AXE_GRAVITY;
  const step = 0.035;
  const maxTime = 1.55;

  let previousX = startX;
  let previousY = startY;
  let impact = null;

  const pathColor = charge >= 0.75
    ? 0xffc642
    : 0x65e7d1;

  for (let t = 0; t <= maxTime; t += step) {
    const x = startX + vx * t;
    const y = startY + vy * t + 0.5 * gravity * t * t;

    if (
      x < 0 || x > WORLD_WIDTH ||
      y < 0 || y > WORLD_HEIGHT
    ) {
      break;
    }

    // Estimar el primer impacto descendente contra una plataforma
    if (t > 0 && y > previousY) {
      for (const platform of platforms.getChildren()) {
        const left = platform.x - platform.width / 2 - 15;
        const right = platform.x + platform.width / 2 + 15;
        const top = platform.y - platform.height / 2 - 18;

        if (
          x >= left &&
          x <= right &&
          previousY < top &&
          y >= top
        ) {
          const ratio = (top - previousY) /
            Math.max(0.001, y - previousY);

          impact = {
            x: Phaser.Math.Linear(previousX, x, ratio),
            y: top,
            type: platform.surfaceType || "stone"
          };

          break;
        }
      }
    }

    const px = impact ? impact.x : x;
    const py = impact ? impact.y : y;

    const alpha = Math.max(
      0.25,
      1 - t / (maxTime * 1.35)
    );

    // Puntos de trayectoria
    trajectoryGraphics.fillStyle(pathColor, alpha);
    trajectoryGraphics.fillCircle(
      px,
      py,
      2.4 + charge * 1.2
    );

    // Orientación estimada del hacha durante el vuelo
    const angle = Math.atan2(
      vy + gravity * t,
      vx
    ) + Math.PI / 2;

    trajectoryGraphics.lineStyle(1.5, 0xffe8a0, 0.78);

    trajectoryGraphics.lineBetween(
      px,
      py,
      px + Math.cos(angle) * 7,
      py + Math.sin(angle) * 7
    );

    if (impact) break;

    previousX = x;
    previousY = y;
  }

  // Marcador de impacto previsto
  if (impact) {
    const impactColor = impact.type === "metal"
      ? 0x68e0ee
      : 0xffdb73;

    trajectoryGraphics.lineStyle(2, impactColor, 0.95);
    trajectoryGraphics.strokeCircle(
      impact.x,
      impact.y,
      12
    );

    trajectoryGraphics.fillStyle(impactColor, 0.95);
    trajectoryGraphics.fillCircle(
      impact.x,
      impact.y,
      3.5
    );
  }

  // Barra de carga sobre Aurel
  const barWidth = 58;

  trajectoryGraphics.fillStyle(0x101629, 0.92);

  trajectoryGraphics.fillRoundedRect(
    player.x - barWidth / 2,
    player.y - 48,
    barWidth,
    8,
    3
  );

  trajectoryGraphics.fillStyle(pathColor, 1);

  if (charge > 0) {
    trajectoryGraphics.fillRoundedRect(
      player.x - barWidth / 2 + 2,
      player.y - 46,
      (barWidth - 4) * charge,
      4,
      2
    );
  }
}

function onAxeHitPlatform(axeObject, platform) {
  if (
    !axeThrown ||
    !axeObject.body.enable ||
    axeAnchored ||
    won
  ) {
    return;
  }

  if (platform.surfaceType === "metal") {
    if (sceneRef.time.now - lastMetalBounce < 240) return;

    lastMetalBounce = sceneRef.time.now;

    const vx = axeObject.body.velocity.x;
    const vy = axeObject.body.velocity.y;

    if (Math.abs(vy) > Math.abs(vx) * 0.45) {
      axeObject.body.setVelocity(
        vx * 0.72,
        -Math.max(190, Math.abs(vy) * 0.62)
      );
    } else {
      axeObject.body.setVelocity(
        -vx * 0.72,
        vy * 0.7 - 110
      );
    }

    axeArt.rotation += 0.8;

    promptText.setText(
      "¡REBOTE METÁLICO! Activa C para redirigir Áurea."
    );

    statusText.setText("ÁUREA: REBOTE");
  } else {
    // Piedra: el hacha queda anclada
    axeAnchored = true;

    axeObject.body.setVelocity(0, 0);
    axeObject.body.setAcceleration(0, 0);
    axeObject.body.setAllowGravity(false);
    axeObject.body.setAngularVelocity(0);
    axeObject.body.setImmovable(true);

    promptText.setText(
      "Áurea se ancló en piedra. Mantén C y suéltala para impulsarte."
    );

    statusText.setText("ÁUREA: ANCLADA");
  }
}

function recoverAxe() {
  chargingThrow = false;
  throwCharge = 0;

  if (trajectoryGraphics) {
    trajectoryGraphics.clear();
  }

  axeThrown = false;
  axeAnchored = false;
  magnetActive = false;

  if (axeBody && axeBody.body) {
    axeBody.body.setVelocity(0, 0);
    axeBody.body.setAcceleration(0, 0);
    axeBody.body.setAngularVelocity(0);
    axeBody.body.setAllowGravity(false);
    axeBody.body.setImmovable(false);
    axeBody.body.enable = false;
  }

  if (axeArt) {
    axeArt.rotation = 0;
  }
}

function collectCrystal(_player, crystal) {
  if (!crystal.active) return;

  const glow = crystal.getData("glow");

  if (glow) glow.destroy();

  crystal.destroy();
  shardCount++;

  hudInfo.setText(
    `FRAGMENTOS SOLARES  ${shardCount} / 5  ·  PORTAL: ${REQUIRED_SHARDS}`
  );

  promptText.setText(
    shardCount >= REQUIRED_SHARDS
      ? "¡Suficiente luz! Alcanza el portal dorado."
      : `Fragmento solar recuperado (${shardCount}/5). Busca más luz.`
  );

  sceneRef.cameras.main.shake(100, 0.002);
}

function reachPortal() {
  if (won) return;

  if (shardCount < REQUIRED_SHARDS) {
    promptText.setText(
      `El portal está sellado: faltan ${REQUIRED_SHARDS - shardCount} fragmento(s) solar(es).`
    );

    return;
  }

  won = true;

  player.body.setVelocity(0, 0);
  player.body.setAcceleration(0, 0);

  sceneRef.add.rectangle(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_WIDTH,
    GAME_HEIGHT,
    0x080d19,
    0.83
  ).setScrollFactor(0).setDepth(100);

  sceneRef.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 - 55,
    "EL SOL AÚN RECUERDA",
    {
      fontFamily: "Georgia, serif",
      fontSize: "32px",
      color: "#ffdc7c",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 760 }
    }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  sceneRef.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 + 4,
    "Has alcanzado la cúspide de la Aguja Celeste.\nÁurea vuelve a brillar bajo el eclipse.",
    {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: "#e8efff",
      align: "center",
      lineSpacing: 8
    }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  sceneRef.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 + 82,
    "PULSA R PARA VOLVER A JUGAR",
    {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#85f0d5",
      fontStyle: "bold"
    }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  const restartKey = sceneRef.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.R
  );

  restartKey.once("down", () => {
    sceneRef.scene.restart();
  });
}
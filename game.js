"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const frame = document.querySelector("#game-frame");
const scoreText = document.querySelector("#score");
const levelText = document.querySelector("#level");
const timerText = document.querySelector("#boss-timer");
const bonusStatusText = document.querySelector("#bonus-status");
const notice = document.querySelector("#notice");
const screen = document.querySelector("#screen");
const screenKicker = document.querySelector("#screen-kicker");
const screenTitle = document.querySelector("#screen-title");
const screenMessage = document.querySelector("#screen-message");
const screenButton = document.querySelector("#screen-button");
const instructionsButton = document.querySelector("#instructions-button");
const soundToggle = document.querySelector("#sound-toggle");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAY_TOP = 78;
const keys = new Set();
const sprites = new Image();
sprites.src = "assets/game-sprites.png";
const platyBack = new Image();
platyBack.src = "assets/platy-back.png";
const platyTailAnimation = new Image();
platyTailAnimation.src = "assets/platy-tail-animation.png";
const bonusIcons = new Image();
bonusIcons.src = "assets/bonus-icons.png";
const megaTailIcon = new Image();
megaTailIcon.src = "assets/mega-tail-power.png";

const SPRITE = {
  platy: 0,
  piggyMaster: 1,
  deer: 2,
  pinkPig: 3,
  whiteDog: 4,
  dalmatian: 5,
  blackDog: 6,
  tinyPig: 7,
  orange: 8,
  apple: 9,
  pear: 10,
  banana: 11,
};

const SETTINGS = [
  { name: "Wildflower Meadow", top: "#aee9ff", ground: "#68bd68", accent: "#ffef78", kind: "meadow", trail: "#b78b5d" },
  { name: "Deep Forest", top: "#93d7c1", ground: "#28734b", accent: "#d6ff8b", kind: "forest", trail: "#8d6848" },
  { name: "Jungle Trail", top: "#8ad9c0", ground: "#3e9b55", accent: "#ffca6b", kind: "jungle", trail: "#9d754d" },
  { name: "Snowy Woods", top: "#c9eaff", ground: "#dceff1", accent: "#ffffff", kind: "snow", trail: "#b8a99b" },
  { name: "Autumn Wilds", top: "#ffd99b", ground: "#799c4a", accent: "#e96545", kind: "autumn", trail: "#a8784f" },
  { name: "Firefly Forest", top: "#182b59", ground: "#174a3a", accent: "#fff36b", kind: "firefly", trail: "#735a43" },
  { name: "Crystal Canyon", top: "#d0b9ff", ground: "#557d8e", accent: "#8ff5ff", kind: "crystal", trail: "#927aa0" },
  { name: "Volcano Valley", top: "#ff9c62", ground: "#3d3034", accent: "#ffcf4f", kind: "volcano", trail: "#5e4a45" },
];

let state = "title";
let score = 0;
let level = 1;
let settingIndex = -1;
let setting = SETTINGS[0];
let lastTime = 0;
let worldTime = 0;
let bossTimer = 20;
let bossTarget = null;
let earthquake = 0;
let readyMessageShown = false;
let fruitHitCooldown = 0;
let pathDistance = 0;
let outcomeTimer = 0;
let currentBonus = null;
let bonusSpawnTimer = 10;
let magnetFlashTimer = 0;
let invisibleTimer = 0;
let megaTailTimer = 0;
let lastBonusType = "invisible";
let powersEnabledThisLevel = true;
let guaranteedMegaTailPending = false;
const HORIZON = 105;
const PATH_NEAR_WIDTH = 690;
const PATH_FAR_WIDTH = 105;

class GameAudio {
  constructor() {
    this.context = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.muted = false;
    this.lastYay = 0;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") this.context.resume();
    return true;
  }

  tone(frequency, duration, type = "sine", volume = 0.08, delay = 0, endFrequency = frequency) {
    if (this.muted || !this.ensureContext()) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise(duration = 0.25, volume = 0.09, frequency = 500) {
    if (this.muted || !this.ensureContext()) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start();
  }

  startMusic() {
    if (this.muted || this.musicTimer || !this.ensureContext()) return;
    const melody = [523, 659, 784, 659, 587, 698, 880, 698];
    const playBeat = () => {
      if (this.muted) return;
      const note = melody[this.musicStep % melody.length];
      this.tone(note, 0.13, "triangle", 0.035);
      if (this.musicStep % 2 === 0) this.tone(note / 2, 0.18, "sine", 0.028);
      if (this.musicStep % 4 === 0) this.tone(110, 0.07, "sine", 0.04, 0, 70);
      this.musicStep += 1;
    };
    playBeat();
    this.musicTimer = window.setInterval(playBeat, 220);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  toggle() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } else if (state !== "title" && state !== "game-over") {
      this.startMusic();
    }
    return this.muted;
  }

  collect() {
    const now = performance.now();
    if (now - this.lastYay < 280 || this.muted) return;
    this.lastYay = now;
    this.tone(720, 0.1, "sine", 0.065, 0, 1080);
    this.tone(1080, 0.13, "triangle", 0.055, 0.07, 1440);
    this.tone(1620, 0.18, "sine", 0.035, 0.15, 1900);
  }

  fumble() {
    this.tone(260, 0.18, "square", 0.07, 0, 150);
    this.tone(190, 0.24, "sawtooth", 0.055, 0.12, 95);
    this.noise(0.16, 0.035, 350);
  }

  powerUp() {
    [440, 554, 659, 880, 1108].forEach((note, index) => this.tone(note, 0.14, "triangle", 0.07, index * 0.075));
  }

  win() {
    const fanfare = [
      [392, 0, 0.32], [523, 0.24, 0.32], [659, 0.48, 0.42],
      [523, 0.93, 0.25], [659, 1.13, 0.25], [784, 1.33, 0.52],
      [659, 1.9, 0.25], [784, 2.1, 0.25], [1046, 2.3, 0.9],
    ];
    fanfare.forEach(([note, delay, duration]) => {
      this.tone(note, duration, "sawtooth", 0.052, delay);
      this.tone(note * 1.5, duration, "triangle", 0.025, delay);
    });
    this.tone(523, 1.05, "sawtooth", 0.045, 2.3);
    this.tone(784, 1.05, "sawtooth", 0.045, 2.3);
  }

  smash() {
    this.noise(0.42, 0.13, 260);
    this.tone(120, 0.45, "sawtooth", 0.1, 0, 45);
  }

  earthquakeCrash() {
    this.noise(0.78, 0.16, 420);
    this.noise(0.28, 0.11, 1800);
    this.tone(95, 0.85, "sawtooth", 0.12, 0, 34);
    this.tone(62, 1.05, "sine", 0.13, 0.05, 28);
    this.tone(1300, 0.09, "square", 0.045, 0.08, 420);
    this.tone(950, 0.12, "square", 0.04, 0.2, 280);
  }

  boing() {
    if (this.muted || !this.ensureContext()) return;
    const start = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const wobble = this.context.createOscillator();
    const wobbleDepth = this.context.createGain();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(125, start);
    oscillator.frequency.exponentialRampToValueAtTime(820, start + 0.13);
    oscillator.frequency.exponentialRampToValueAtTime(210, start + 0.34);
    oscillator.frequency.exponentialRampToValueAtTime(590, start + 0.55);
    oscillator.frequency.exponentialRampToValueAtTime(175, start + 0.92);
    wobble.type = "sine";
    wobble.frequency.value = 13;
    wobbleDepth.gain.setValueAtTime(85, start);
    wobbleDepth.gain.exponentialRampToValueAtTime(4, start + 1.05);
    wobble.connect(wobbleDepth).connect(oscillator.frequency);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.08);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    wobble.start(start);
    oscillator.stop(start + 1.1);
    wobble.stop(start + 1.1);
  }
}

const audio = new GameAudio();

const player = {
  x: WIDTH / 2,
  y: HEIGHT - 130,
  radius: 30,
  directionX: 1,
  directionY: 0,
  jumpClock: 0,
  jumpHeight: 0,
  jumpVelocity: 0,
};

let toys = [];
let fruits = [];
let tailCollections = [];
let groundCracks = [];

function random(min, max) {
  return min + Math.random() * (max - min);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function chooseSetting() {
  let next = Math.floor(Math.random() * SETTINGS.length);
  if (SETTINGS.length > 1 && next === settingIndex) next = (next + 1) % SETTINGS.length;
  settingIndex = next;
  setting = SETTINGS[settingIndex];
}

function safePosition(margin = 80) {
  return { x: random(margin, WIDTH - margin), y: random(PLAY_TOP + margin, HEIGHT - margin) };
}

function pathCenter(y, extraDistance = 0) {
  const depth = pathDepth(y);
  const place = pathDistance + extraDistance + (HEIGHT - y) * 1.7;
  const turn = Math.sin(place * 0.0032) * 135 + Math.sin(place * 0.0067 + 1.4) * 44;
  return WIDTH / 2 + turn * depth;
}

function pathDepth(y) {
  return Math.max(0, Math.min(1, (y - HORIZON) / (HEIGHT - HORIZON)));
}

function pathWidthAt(y) {
  const depth = pathDepth(y);
  return PATH_FAR_WIDTH + (PATH_NEAR_WIDTH - PATH_FAR_WIDTH) * Math.pow(depth, 0.82);
}

function positionOnPath(y, sidePadding = 65) {
  const width = pathWidthAt(y);
  const usableHalf = Math.max(10, width / 2 - sidePadding * (0.25 + pathDepth(y) * 0.75));
  const lane = random(-0.88, 0.88);
  return {
    x: pathCenter(y) + lane * usableHalf,
    y,
    lane,
  };
}

function buildLevel() {
  chooseSetting();
  pathDistance = random(0, 2000);
  player.x = pathCenter(HEIGHT - 110);
  player.y = HEIGHT - 110;
  player.radius = 30;
  player.jumpClock = 0;
  player.jumpHeight = 0;
  player.jumpVelocity = 0;
  bossTimer = 20;
  bossTarget = null;
  readyMessageShown = false;
  fruitHitCooldown = 0;
  outcomeTimer = 0;
  currentBonus = null;
  powersEnabledThisLevel = Math.random() < 0.72;
  bonusSpawnTimer = powersEnabledThisLevel ? random(18, 30) : Number.POSITIVE_INFINITY;
  magnetFlashTimer = 0;
  invisibleTimer = 0;
  megaTailTimer = 0;
  bonusStatusText.textContent = "—";
  tailCollections = [];
  groundCracks = [];

  const toyKinds = [SPRITE.deer, SPRITE.pinkPig, SPRITE.whiteDog, SPRITE.dalmatian, SPRITE.blackDog, SPRITE.tinyPig];
  const startingKinds = [Math.floor(random(0, 3)), 3 + Math.floor(random(0, 3)), Math.floor(random(0, 6))];
  toys = startingKinds.map((index) => {
    const sprite = toyKinds[index];
    const small = index >= 3;
    const position = positionOnPath(random(PLAY_TOP + 20, HEIGHT - 120), small ? 35 : 60);
    const angle = random(0, Math.PI * 2);
    return {
      ...position,
      sprite,
      small,
      points: small ? 5 : 1,
      radius: small ? 20 : 31,
      speed: (small ? 78 : 30) + level * (small ? 3 : 1),
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      caught: 0,
      magnetized: false,
    };
  });

  const fruitSprites = [SPRITE.orange, SPRITE.apple, SPRITE.pear, SPRITE.banana];
  fruits = fruitSprites.map((sprite, index) => ({
    ...positionOnPath(105 + index * 125, 70),
    sprite,
    radius: index === 3 ? 36 : 33,
  }));

  levelText.textContent = level;
  timerText.textContent = "20s";
  showNotice(`${setting.name} — Level ${level}`, "", 2300);
}

function startNewGame() {
  score = 0;
  level = 1;
  scoreText.textContent = score;
  buildLevel();
  guaranteedMegaTailPending = true;
  powersEnabledThisLevel = true;
  bonusSpawnTimer = random(6, 10);
  hideScreen();
  state = "playing";
  lastTime = performance.now();
  audio.startMusic();
}

function startNextLevel() {
  level += 1;
  guaranteedMegaTailPending = false;
  buildLevel();
  hideScreen();
  state = "playing";
  lastTime = performance.now();
  audio.startMusic();
}

function showScreen(kicker, title, message, buttonLabel, action) {
  screenKicker.textContent = kicker;
  screenTitle.textContent = title;
  screenMessage.textContent = message;
  screenButton.textContent = buttonLabel;
  screenButton.onclick = action;
  instructionsButton.classList.add("hidden");
  screen.classList.add("show");
}

function showHomeScreen() {
  screenKicker.textContent = "A bouncy adventure";
  screenTitle.textContent = "DEFEAT PIGGY MASTER";
  screenMessage.textContent = "Platy travels forward automatically. Turn with the left and right arrows, press the up arrow to jump, and scoop up stuffies from the trail with her tail!";
  screenButton.textContent = "Start Game";
  screenButton.onclick = startNewGame;
  instructionsButton.classList.remove("hidden");
  screen.classList.add("show");
}

function showInstructions() {
  const instructions = [
    "← →  Turn Platy left and right.",
    "↑  Jump over fruit and scoop up stuffies with Platy's tail.",
    "Big stuffies give 1 point. Smaller, harder stuffies give 5 points. Every stuffy helps Platy grow.",
    "Touching fruit removes 2 points.",
    "A magnet gives one pull that brings in the stuffies on the trail. Invisibility protects Platy from fruit for 15 seconds. Mega Tail makes Platy's tail huge for 10 seconds.",
    "Piggy Master falls every 20 seconds. Dodge her while Platy is small. When Platy is bigger, get under Piggy Master so she bounces into space!",
  ].join("\n\n");
  showScreen("How to play", "Instructions", instructions, "Back", showHomeScreen);
}

function hideScreen() {
  screen.classList.remove("show");
}

let noticeTimeout;
function showNotice(message, type = "", duration = 1800) {
  clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.className = `notice show ${type}`.trim();
  noticeTimeout = setTimeout(() => notice.classList.remove("show"), duration);
}

function updateScore(change) {
  score = Math.max(0, score + change);
  scoreText.textContent = score;
}

function isPlatyReady() {
  return player.radius > 59;
}

function updatePlayer(dt) {
  let dx = 0;
  if (keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("ArrowRight")) dx += 1;

  if (dx) {
    player.directionX = dx;
    player.directionY = -1;
    const speed = 260;
    player.x += dx * speed * dt;
  }

  player.y = HEIGHT - 112;

  const center = pathCenter(player.y);
  const pathEdge = pathWidthAt(player.y) / 2 - player.radius * 0.65;
  player.x = Math.max(center - pathEdge, Math.min(center + pathEdge, player.x));

  // Platy only leaves the ground after the player presses the up arrow.
  player.jumpClock += dt;
  if (player.jumpHeight > 0 || player.jumpVelocity > 0) {
    player.jumpHeight += player.jumpVelocity * dt;
    player.jumpVelocity -= 1120 * dt;
    if (player.jumpHeight <= 0) {
      player.jumpHeight = 0;
      player.jumpVelocity = 0;
    }
  }
}

function jump() {
  if (state === "playing" && player.jumpHeight === 0) {
    player.jumpVelocity = 525;
  }
}

function updateToys(dt) {
  const travelSpeed = 82 + level * 4;
  for (const toy of toys) {
    if (toy.caught > 0) {
      toy.caught -= dt;
      if (toy.caught <= 0) {
        const kindIndex = Math.floor(random(0, 6));
        const toyKinds = [SPRITE.deer, SPRITE.pinkPig, SPRITE.whiteDog, SPRITE.dalmatian, SPRITE.blackDog, SPRITE.tinyPig];
        toy.sprite = toyKinds[kindIndex];
        toy.small = kindIndex >= 3;
        toy.points = toy.small ? 5 : 1;
        toy.radius = toy.small ? 20 : 31;
        toy.magnetized = false;
        Object.assign(toy, positionOnPath(random(-320, -80), toy.small ? 35 : 60));
      }
      continue;
    }

    toy.y += travelSpeed * dt;
    if (toy.y > HEIGHT + 80) {
      Object.assign(toy, positionOnPath(random(-350, -80), toy.small ? 35 : 60));
    }
    const tail = {
      x: player.x - player.directionX * player.radius * 0.82,
      y: player.y - player.jumpHeight + player.radius * 0.45,
    };
    if (toy.magnetized) {
      const pull = Math.min(1, dt * 3.4);
      toy.x += (tail.x - toy.x) * pull;
      toy.y += (tail.y - toy.y) * pull;
    } else {
      const sidePadding = toy.small ? 35 : 60;
      const usableHalf = Math.max(10, pathWidthAt(toy.y) / 2 - sidePadding * (0.25 + pathDepth(toy.y) * 0.75));
      toy.x = pathCenter(toy.y) + toy.lane * usableHalf;
    }

    const megaReach = megaTailTimer > 0 ? 95 : 0;
    const closeEnoughToScoop = Math.abs(player.x - toy.x) < player.radius * 0.65 + toy.radius + megaReach
      && Math.abs(player.y - toy.y) < player.radius + toy.radius + megaReach * 0.3;
    const magnetReachedTail = toy.magnetized && distance(tail, toy) < player.radius * 0.45 + toy.radius;
    if (magnetReachedTail || (player.jumpHeight > 18 && closeEnoughToScoop)) {
      toy.caught = 1.15;
      toy.magnetized = false;
      updateScore(toy.points);
      player.radius += 1.55;
      audio.collect();
      tailCollections.push({
        sprite: toy.sprite,
        small: toy.small,
        age: 0,
        side: tailCollections.length % 3 - 1,
      });
      showNotice(`Tail catch! +${toy.points} point${toy.points === 1 ? "" : "s"}`, "");

      if (isPlatyReady() && !readyMessageShown) {
        readyMessageShown = true;
        showNotice("Platy is bigger! Get under Piggy Master to defeat her!", "ready", 4500);
      }
    }
  }
}

function updateTailCollections(dt) {
  tailCollections.forEach((collected) => { collected.age += dt; });
  tailCollections = tailCollections.filter((collected) => collected.age < 1.65);
}

function updateFruits(dt) {
  const travelSpeed = 82 + level * 4;
  for (const fruit of fruits) {
    fruit.y += travelSpeed * dt;
    if (fruit.y > HEIGHT + 75) {
      Object.assign(fruit, positionOnPath(random(-520, -100), 70));
    }
    fruit.x = pathCenter(fruit.y) + fruit.lane * Math.max(10, pathWidthAt(fruit.y) / 2 - 70 * (0.25 + pathDepth(fruit.y) * 0.75));
  }

  fruitHitCooldown = Math.max(0, fruitHitCooldown - dt);
  if (invisibleTimer > 0) return;
  if (fruitHitCooldown > 0) return;

  for (const fruit of fruits) {
    if (distance(player, fruit) < player.radius * 0.65 + fruit.radius) {
      updateScore(-2);
      audio.fumble();
      fruitHitCooldown = 1.15;
      showNotice("Ouch, fruit! −2 points", "danger");
      const pushX = player.x - fruit.x || 1;
      const pushY = player.y - fruit.y;
      const length = Math.hypot(pushX, pushY);
      player.x += (pushX / length) * 22;
      player.y += (pushY / length) * 22;
      break;
    }
  }
}

function spawnBonus() {
  const bonusTypes = ["magnet", "invisible", "mega-tail"];
  const choices = bonusTypes.filter((typeName) => typeName !== lastBonusType);
  const type = guaranteedMegaTailPending ? "mega-tail" : choices[Math.floor(Math.random() * choices.length)];
  guaranteedMegaTailPending = false;
  lastBonusType = type;
  const position = positionOnPath(HORIZON + 24, 30);
  currentBonus = {
    ...position,
    type,
    radius: 34,
    age: 0,
  };
}

function updateBonus(dt) {
  magnetFlashTimer = Math.max(0, magnetFlashTimer - dt);
  invisibleTimer = Math.max(0, invisibleTimer - dt);
  megaTailTimer = Math.max(0, megaTailTimer - dt);

  if (magnetFlashTimer > 0) bonusStatusText.textContent = "🧲 PULL!";
  else if (megaTailTimer > 0) bonusStatusText.textContent = `💜 ${Math.ceil(megaTailTimer)}s`;
  else if (invisibleTimer > 0) bonusStatusText.textContent = `👤 ${Math.ceil(invisibleTimer)}s`;
  else bonusStatusText.textContent = "—";

  if (!powersEnabledThisLevel) return;

  if (!currentBonus) {
    bonusSpawnTimer -= dt;
    if (bonusSpawnTimer <= 0) spawnBonus();
    return;
  }

  currentBonus.age += dt;
  currentBonus.y += 34 * dt;
  const usableHalf = Math.max(10, pathWidthAt(currentBonus.y) / 2 - 35);
  currentBonus.x = pathCenter(currentBonus.y) + currentBonus.lane * usableHalf + Math.sin(currentBonus.age * 1.8) * 15;

  const floatingBob = Math.sin(currentBonus.age * 3.2) * 19;
  const bonusInAir = { x: currentBonus.x, y: currentBonus.y - 72 + floatingBob };
  const playerInAir = { x: player.x, y: player.y - player.jumpHeight };
  if (player.jumpHeight > 25 && distance(playerInAir, bonusInAir) < player.radius + currentBonus.radius) {
    if (currentBonus.type === "magnet") {
      magnetFlashTimer = 1.5;
      toys.forEach((toy) => {
        if (toy.caught <= 0) toy.magnetized = true;
      });
      showNotice("MAGNET! One pull brings in every stuffy on the trail!", "ready", 2600);
    } else if (currentBonus.type === "invisible") {
      invisibleTimer = 15;
      showNotice("INVISIBLE! Fruit cannot take points for 15 seconds!", "ready", 2600);
    } else {
      megaTailTimer = 10;
      showNotice("MEGA TAIL! Platy can scoop stuffies from far away for 10 seconds!", "ready", 3000);
    }
    audio.powerUp();
    currentBonus = null;
    bonusSpawnTimer = random(28, 42);
  } else if (currentBonus.y > HEIGHT + 90) {
    currentBonus = null;
    bonusSpawnTimer = random(18, 30);
  }
}

function updateBoss(dt) {
  bossTimer -= dt;
  timerText.textContent = `${Math.max(0, Math.ceil(bossTimer))}s`;

  if (bossTimer <= 3 && !bossTarget) {
    bossTarget = { x: player.x, y: player.y };
    showNotice("Piggy Master is falling! Watch the landing circle!", "danger", 2800);
  }

  if (bossTimer <= 0) {
    earthquake = 1;
    frame.classList.remove("shake");
    void frame.offsetWidth;
    frame.classList.add("shake");
    audio.earthquakeCrash();
    const crackWidth = Math.max(1, pathWidthAt(bossTarget.y) / 2);
    groundCracks.push({
      x: bossTarget.x,
      y: bossTarget.y,
      lane: (bossTarget.x - pathCenter(bossTarget.y)) / crackWidth,
      seed: Math.random() * 1000,
    });

    const wasHit = distance(player, bossTarget) < player.radius * 0.7 + 58;
    if (wasHit && isPlatyReady()) {
      state = "boss-bounce";
      outcomeTimer = 0;
      audio.stopMusic();
      audio.boing();
      window.setTimeout(() => audio.win(), 1050);
      showNotice("BOING! Piggy Master is flying into space!", "ready", 1800);
    } else if (wasHit) {
      state = "crushed";
      outcomeTimer = 0;
      player.jumpHeight = 0;
      audio.stopMusic();
      audio.smash();
      showNotice("SQUASH! Piggy Master crushed Platy!", "danger", 1200);
    } else {
      showNotice(isPlatyReady() ? "She missed! Try to get under her next time." : "Boom! Keep growing before she comes back.", "danger", 2600);
      bossTimer = 20;
      bossTarget = null;
    }
  }
}

function updateOutcome(dt) {
  worldTime += dt;
  outcomeTimer += dt;

  if (state === "boss-bounce" && outcomeTimer > 1.8) {
    state = "level-complete";
    showScreen(
      "Piggy Master flew into space!",
      `Level ${level} Complete!`,
      `Platy was bigger, so Piggy Master bounced right off! Your score is ${score}.`,
      "Next Level",
      startNextLevel,
    );
  }

  if (state === "crushed" && outcomeTimer > 1.15) {
    state = "game-over";
    showScreen(
      "Squashed by Piggy Master!",
      "Game Over",
      `Platy was still too small. You scored ${score} points. Catch more stuffies and try again!`,
      "Play Again",
      startNewGame,
    );
  }
}

function update(dt) {
  worldTime += dt;
  pathDistance += (82 + level * 4) * dt;
  earthquake = Math.max(0, earthquake - dt);
  updatePlayer(dt);
  updateBonus(dt);
  updateToys(dt);
  updateTailCollections(dt);
  updateFruits(dt);
  updateBoss(dt);
  updateCracks(dt);
}

function updateCracks(dt) {
  const travelSpeed = 82 + level * 4;
  groundCracks.forEach((crack) => {
    crack.y += travelSpeed * dt;
    crack.x = pathCenter(crack.y) + crack.lane * pathWidthAt(crack.y) / 2;
  });
  groundCracks = groundCracks.filter((crack) => crack.y < HEIGHT + 100);
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 110);
  sky.addColorStop(0, setting.top);
  sky.addColorStop(1, "#eefaff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Solid land under the trail keeps it connected to the wilderness.
  ctx.fillStyle = setting.ground;
  ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);

  // Distant hills cover the horizon where the sky meets the ground.
  const hillColors = {
    snow: "#b9d6da",
    firefly: "#102d35",
    crystal: "#615b91",
    volcano: "#2b252a",
  };
  ctx.fillStyle = hillColors[setting.kind] || "rgb(42 112 66 / 55%)";
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 32);
  for (let x = 0; x <= WIDTH; x += 60) {
    ctx.lineTo(x, HORIZON - 10 - Math.sin(x * 0.018 + settingIndex) * 24);
  }
  ctx.lineTo(WIDTH, HORIZON + 55);
  ctx.closePath();
  ctx.fill();

  // Wild plants and trees rush past on both sides of the trail.
  for (let i = 0; i < 28; i += 1) {
    const y = HORIZON + ((pathDistance * 1.65 + i * 97) % (HEIGHT - HORIZON + 90));
    const depth = pathDepth(y);
    const center = pathCenter(y);
    const halfPath = pathWidthAt(y) / 2;
    const side = i % 2 === 0 ? -1 : 1;
    const x = center + side * (halfPath + 26 + (i % 4) * 24) * (0.55 + depth * 0.45);
    const size = 5 + depth * (setting.kind === "forest" || setting.kind === "jungle" ? 34 : 20);

    if (setting.kind === "crystal") {
      ctx.fillStyle = i % 2 === 0 ? "#8ff5ff" : "#b7a1ff";
      ctx.beginPath();
      ctx.moveTo(x, y - size * 1.5);
      ctx.lineTo(x + size * 0.65, y);
      ctx.lineTo(x, y + size * 0.35);
      ctx.lineTo(x - size * 0.65, y);
      ctx.closePath();
      ctx.fill();
    } else if (setting.kind === "firefly") {
      ctx.shadowColor = "#fff36b";
      ctx.shadowBlur = 14;
      ctx.fillStyle = i % 3 === 0 ? "#fff36b" : "#1f6a48";
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? Math.max(2, size * 0.28) : size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (setting.kind === "volcano") {
      ctx.fillStyle = i % 4 === 0 ? "#ff773d" : "#292329";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (setting.kind === "snow") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (setting.kind === "autumn") {
      ctx.fillStyle = i % 3 === 0 ? "#e96945" : "#d99a35";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = i % 3 === 0 ? setting.accent : (setting.kind === "jungle" ? "#176c3a" : "#327d43");
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The winding path moves under Platy, making her journey feel automatic.
  const leftEdge = [];
  const rightEdge = [];
  for (let y = HORIZON; y <= HEIGHT + 30; y += 14) {
    const center = pathCenter(y);
    const halfWidth = pathWidthAt(y) / 2;
    leftEdge.push({ x: center - halfWidth, y });
    rightEdge.push({ x: center + halfWidth, y });
  }

  ctx.fillStyle = setting.trail;
  ctx.beginPath();
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  leftEdge.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  rightEdge.reverse().forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fill();

  // Pebbles move down the dirt trail to show Platy running forward.
  for (let i = 0; i < 14; i += 1) {
    const travel = (pathDistance * 2.1 + i * 59) % (HEIGHT - HORIZON);
    const y = HORIZON + travel;
    const depth = pathDepth(y);
    const center = pathCenter(y);
    const lane = ((i * 47) % 100) / 100 - 0.5;
    const x = center + lane * pathWidthAt(y) * 0.7;
    ctx.fillStyle = "rgb(86 61 43 / 35%)";
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + depth * 7, 1 + depth * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgb(255 255 255 / 72%)";
  roundedRect(18, 15, 220, 47, 18);
  ctx.fillStyle = "#4a3269";
  ctx.font = "900 21px Trebuchet MS";
  ctx.fillText(setting.name, 34, 46);
}

function drawSprite(spriteNumber, x, y, size, alpha = 1) {
  if (!sprites.complete || !sprites.naturalWidth) return;
  const columns = 4;
  const rows = 3;
  const sourceWidth = sprites.naturalWidth / columns;
  const sourceHeight = sprites.naturalHeight / rows;
  const column = spriteNumber % columns;
  const row = Math.floor(spriteNumber / columns);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    sprites,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    x - size / 2,
    y - size / 2,
    size,
    size * (sourceHeight / sourceWidth),
  );
  ctx.restore();
}

function drawSpriteRotated(spriteNumber, x, y, size, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  drawSprite(spriteNumber, 0, 0, size);
  ctx.restore();
}

function drawBonus() {
  if (!currentBonus) return;
  const isMegaTail = currentBonus.type === "mega-tail";
  if (isMegaTail && (!megaTailIcon.complete || !megaTailIcon.naturalWidth)) return;
  if (!isMegaTail && (!bonusIcons.complete || !bonusIcons.naturalWidth)) return;
  const depthScale = 0.38 + pathDepth(currentBonus.y) * 0.8;
  const size = 88 * depthScale;
  const y = currentBonus.y - 72 + Math.sin(currentBonus.age * 3.2) * 19;
  const pulse = 1 + Math.sin(currentBonus.age * 5) * 0.12;
  const colors = currentBonus.type === "magnet"
    ? { fill: "rgb(255 226 75 / 28%)", stroke: "#fff06a" }
    : currentBonus.type === "invisible"
      ? { fill: "rgb(90 198 255 / 28%)", stroke: "#8ee7ff" }
      : { fill: "rgb(190 92 255 / 30%)", stroke: "#e5a2ff" };

  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  ctx.arc(currentBonus.x, y, size * 0.72 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(currentBonus.x, y, size * 0.62 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  if (isMegaTail) {
    ctx.drawImage(megaTailIcon, currentBonus.x - size / 2, y - size / 2, size, size);
  } else {
    const sourceWidth = bonusIcons.naturalWidth / 2;
    const sourceHeight = bonusIcons.naturalHeight;
    const iconNumber = currentBonus.type === "magnet" ? 0 : 1;
    ctx.drawImage(
      bonusIcons,
      iconNumber * sourceWidth, 0, sourceWidth, sourceHeight,
      currentBonus.x - size / 2, y - size / 2, size, size * (sourceHeight / sourceWidth),
    );
  }

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#5a347d";
  ctx.lineWidth = 4;
  ctx.font = `900 ${Math.max(13, 18 * depthScale)}px Trebuchet MS`;
  ctx.textAlign = "center";
  ctx.strokeText("BONUS!", currentBonus.x, y - size * 0.7);
  ctx.fillText("BONUS!", currentBonus.x, y - size * 0.7);
  ctx.textAlign = "left";
}

function drawMegaTail() {
  if (megaTailTimer <= 0) return;
  const pulse = 1 + Math.sin(worldTime * 8) * 0.08;
  const width = (player.radius * 3.3 + 125) * pulse;
  const height = player.radius * 1.15 * pulse;
  const y = player.y - player.jumpHeight + player.radius * 0.5;
  ctx.save();
  ctx.shadowColor = "#d881ff";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "rgb(143 71 203 / 72%)";
  ctx.strokeStyle = "#edbdff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(player.x, y, width / 2, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFruits() {
  for (const fruit of fruits) {
    const depthScale = 0.22 + pathDepth(fruit.y) * 0.9;
    ctx.fillStyle = "rgb(52 38 67 / 18%)";
    ctx.beginPath();
    ctx.ellipse(fruit.x, fruit.y + 23, fruit.radius, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(fruit.sprite, fruit.x, fruit.y - 3, fruit.radius * 2.3 * depthScale);
  }
}

function drawCracks() {
  groundCracks.forEach((crack) => {
    const depth = pathDepth(crack.y);
    const size = 12 + depth * 58;
    ctx.save();
    ctx.strokeStyle = "rgb(55 35 28 / 88%)";
    ctx.lineWidth = 1.5 + depth * 3.5;
    ctx.lineCap = "round";

    for (let branch = 0; branch < 9; branch += 1) {
      const angle = (Math.PI * 2 * branch) / 9 + Math.sin(crack.seed + branch) * 0.22;
      let x = crack.x;
      let y = crack.y;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let segment = 1; segment <= 3; segment += 1) {
        const length = size * segment / 3;
        x = crack.x + Math.cos(angle + Math.sin(crack.seed + segment * 3) * 0.12) * length;
        y = crack.y + Math.sin(angle + Math.cos(crack.seed + segment * 2) * 0.1) * length * 0.48;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "rgb(35 23 20 / 82%)";
    ctx.beginPath();
    ctx.ellipse(crack.x, crack.y, size * 0.22, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawToys() {
  for (const toy of toys) {
    if (toy.caught > 0) continue;
    const depthScale = 0.22 + pathDepth(toy.y) * 0.9;
    ctx.fillStyle = "rgb(45 31 58 / 18%)";
    ctx.beginPath();
    ctx.ellipse(toy.x, toy.y + toy.radius * 0.7, toy.radius, toy.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    const groundLift = toy.radius * 0.48 * depthScale;
    drawSprite(toy.sprite, toy.x, toy.y - groundLift, toy.radius * 2.55 * depthScale);
  }
}

function drawBoss() {
  if (!bossTarget) return;

  if (state === "boss-bounce") {
    const t = outcomeTimer;
    const x = bossTarget.x + Math.sin(t * 8) * 55;
    const y = bossTarget.y - 120 * t - 260 * t * t;
    const size = Math.max(38, 150 - t * 35);
    drawSpriteRotated(SPRITE.piggyMaster, x, y, size, t * 5);
    return;
  }

  if (state === "crushed") {
    drawSprite(SPRITE.piggyMaster, player.x, player.y - 70, 165);
    return;
  }
  const progress = Math.min(1, (3 - Math.max(0, bossTimer)) / 3);

  ctx.save();
  ctx.strokeStyle = isPlatyReady() ? "#2bc451" : "#e53e5c";
  ctx.fillStyle = isPlatyReady() ? "rgb(43 196 81 / 22%)" : "rgb(229 62 92 / 24%)";
  ctx.lineWidth = 6;
  ctx.setLineDash([13, 10]);
  ctx.beginPath();
  ctx.arc(bossTarget.x, bossTarget.y, 72 - Math.sin(worldTime * 8) * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const eased = progress * progress;
  const y = -100 + (bossTarget.y + 100) * eased;
  const size = 80 + 70 * progress;
  drawSprite(SPRITE.piggyMaster, bossTarget.x, y, size);
}

function drawPlayer() {
  const shadowScale = Math.max(0.45, 1 - player.jumpHeight / 90);
  ctx.fillStyle = "rgb(45 31 58 / 22%)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + player.radius * 0.55, player.radius * shadowScale, player.radius * 0.35 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fruitHitCooldown > 0 && Math.floor(fruitHitCooldown * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  if (invisibleTimer > 0) ctx.globalAlpha = 0.28 + Math.sin(worldTime * 9) * 0.08;
  const squish = state === "crushed" ? Math.max(0.22, 1 - outcomeTimer * 1.25) : 1;
  if (platyTailAnimation.complete && platyTailAnimation.naturalWidth) {
    const frameNumber = Math.floor(worldTime * 7) % 2;
    const sourceWidth = platyTailAnimation.naturalWidth / 2;
    const sourceHeight = platyTailAnimation.naturalHeight;
    const size = player.radius * 3.25;
    const height = size * (sourceHeight / sourceWidth);
    ctx.save();
    ctx.translate(player.x, player.y - player.jumpHeight);
    ctx.scale(1, squish);
    ctx.drawImage(
      platyTailAnimation,
      frameNumber * sourceWidth, 0, sourceWidth, sourceHeight,
      -size / 2, -height / 2, size, height,
    );
    ctx.restore();
  } else if (platyBack.complete && platyBack.naturalWidth) {
    const size = player.radius * 3.05;
    const ratio = platyBack.naturalHeight / platyBack.naturalWidth;
    ctx.drawImage(platyBack, player.x - size / 2, player.y - player.jumpHeight - size * ratio / 2, size, size * ratio);
  } else {
    drawSprite(SPRITE.platy, player.x, player.y - player.jumpHeight, player.radius * 2.65, ctx.globalAlpha);
  }
  ctx.globalAlpha = 1;

  if (isPlatyReady()) {
    ctx.fillStyle = "#fff8a8";
    ctx.strokeStyle = "#7a4b00";
    ctx.lineWidth = 2;
    ctx.font = "900 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.strokeText("READY!", player.x, player.y - player.jumpHeight - player.radius - 16);
    ctx.fillText("READY!", player.x, player.y - player.jumpHeight - player.radius - 16);
    ctx.textAlign = "left";
  }
}

function drawTailCollections() {
  tailCollections.forEach((collected, index) => {
    const fade = Math.min(1, (1.65 - collected.age) * 2.2);
    const settle = Math.min(1, collected.age * 5);
    const spread = (collected.side * 24 + (index % 2) * 8) * settle;
    const bob = Math.sin(worldTime * 8 + index) * 3;
    const x = player.x + spread;
    const y = player.y - player.jumpHeight + player.radius * 0.55 + bob;
    const size = (collected.small ? 30 : 39) * (0.65 + settle * 0.35);
    drawSprite(collected.sprite, x, y, size, fade);
  });
}

function draw() {
  ctx.save();
  if (earthquake > 0) ctx.translate(random(-5, 5), random(-5, 5));
  drawBackground();
  drawCracks();
  drawFruits();
  drawToys();
  drawBonus();
  drawMegaTail();
  drawPlayer();
  drawTailCollections();
  drawBoss();
  ctx.restore();
}

function gameLoop(time) {
  const dt = Math.min(0.035, (time - lastTime) / 1000 || 0);
  lastTime = time;
  if (state === "playing") update(dt);
  if (state === "boss-bounce" || state === "crushed") updateOutcome(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    keys.add(event.key);
    if (event.key === "ArrowUp" && !event.repeat) jump();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("blur", () => keys.clear());

document.querySelectorAll("[data-key]").forEach((button) => {
  const key = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keys.add(key);
    if (key === "ArrowUp") jump();
  };
  const release = (event) => { event.preventDefault(); keys.delete(key); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

screenButton.onclick = startNewGame;
instructionsButton.addEventListener("click", showInstructions);
soundToggle.addEventListener("click", () => {
  const muted = audio.toggle();
  soundToggle.textContent = muted ? "🔇 Sound Off" : "🔊 Sound On";
  soundToggle.setAttribute("aria-pressed", String(muted));
});
chooseSetting();
buildLevel();
state = "title";
requestAnimationFrame(gameLoop);

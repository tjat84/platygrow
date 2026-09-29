"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const frame = document.querySelector("#game-frame");
const scoreText = document.querySelector("#score");
const coinsText = document.querySelector("#coins");
const levelText = document.querySelector("#level");
const timerText = document.querySelector("#boss-timer");
const bonusStatusText = document.querySelector("#bonus-status");
const notice = document.querySelector("#notice");
const screen = document.querySelector("#screen");
const screenCard = document.querySelector(".screen-card");
const screenKicker = document.querySelector("#screen-kicker");
const screenTitle = document.querySelector("#screen-title");
const screenMessage = document.querySelector("#screen-message");
const screenButton = document.querySelector("#screen-button");
const instructionsButton = document.querySelector("#instructions-button");
const stableButton = document.querySelector("#stable-button");
const customizeButton = document.querySelector("#customize-button");
const homeButton = document.querySelector("#home-button");
const stablePanel = document.querySelector("#stable-panel");
const shopPanel = document.querySelector("#shop-panel");
const customizePanel = document.querySelector("#customize-panel");
const accountPanel = document.querySelector("#account-panel");
const accountList = document.querySelector("#account-list");
const soundToggle = document.querySelector("#sound-toggle");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAY_TOP = 78;
const keys = new Set();
const spriteFiles = [
  "platy", "piggy-master", "deer", "pink-pig",
  "white-dog", "dalmatian", "black-dog", "tiny-pig",
  "orange", "apple", "pear", "banana",
];
const spriteImages = spriteFiles.map((fileName) => {
  const image = new Image();
  image.src = `assets/sprites/${fileName}.png`;
  return image;
});
const platyBack = new Image();
platyBack.src = "assets/platy-back.png";
const platyTailAnimation = new Image();
platyTailAnimation.src = "assets/platy-tail-animation.png";
const bonusIcons = new Image();
bonusIcons.src = "assets/bonus-icons.png";
const megaTailIcon = new Image();
megaTailIcon.src = "assets/mega-tail-power.png";
const flyingPets = new Image();
flyingPets.src = "assets/flying-pets.png";
const platyRidingPets = new Image();
platyRidingPets.src = "assets/platy-riding-pets.png";

const SAVE_KEY = "defeat-piggy-master-save-v1";
const ACCOUNTS_KEY = "defeat-piggy-master-accounts-v1";
const ACCOUNT_RESET_KEY = "defeat-piggy-master-accounts-cleared-2026-09-29";
const PET_FIND_CHANCE = 0.4;
const MAX_UNCARED_ROUNDS = 3;
const PET_NAMES = [
  "Sparky", "Sizzle", "Rosie", "Pinky", "Princess", "Solor", "Ruby",
  "Topaz", "Saffire", "Diamond", "Stormy", "Teddy",
];
const PET_NAME_STARTS = ["Moon", "Star", "Sun", "Fire", "Rain", "Dream", "Snow", "Berry"];
const PET_NAME_ENDS = ["beam", "spark", "shine", "drop", "song", "bell", "heart", "gem"];

function chooseNewPetName(pets, randomChoice = true) {
  const usedNames = new Set(pets.map((pet) => pet.name).filter(Boolean));
  const originalNames = PET_NAMES.filter((name) => !usedNames.has(name));
  if (originalNames.length > 0) {
    return randomChoice
      ? originalNames[Math.floor(Math.random() * originalNames.length)]
      : originalNames[0];
  }

  const madeUpNames = [];
  PET_NAME_STARTS.forEach((start) => {
    PET_NAME_ENDS.forEach((end) => {
      const name = `${start}${end}`;
      if (!usedNames.has(name)) madeUpNames.push(name);
    });
  });
  if (madeUpNames.length > 0) {
    return randomChoice
      ? madeUpNames[Math.floor(Math.random() * madeUpNames.length)]
      : madeUpNames[0];
  }
  return `Wonderpet ${pets.length + 1}`;
}

function defaultPlayerData() {
  return {
    level: 1,
    coins: 0,
    stalls: 3,
    pets: [],
    selectedPetId: null,
    inventory: { unicornFood: 0, dragonFood: 0, water: 0, soap: 0 },
    customization: { color: "rainbow", hat: "none", trail: "none" },
  };
}

function normalizePlayerData(saved) {
  return {
    ...defaultPlayerData(),
    ...(saved || {}),
    level: Math.max(1, Number(saved?.level) || 1),
    pets: Array.isArray(saved?.pets) ? saved.pets : [],
    inventory: { ...defaultPlayerData().inventory, ...(saved?.inventory || {}) },
    customization: { ...defaultPlayerData().customization, ...(saved?.customization || {}) },
  };
}

function clearExistingAccountsOnce() {
  try {
    if (localStorage.getItem(ACCOUNT_RESET_KEY) === "yes") return;
    localStorage.removeItem(ACCOUNTS_KEY);
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(ACCOUNT_RESET_KEY, "yes");
  } catch {
    // The game still opens if browser storage is unavailable.
  }
}

function loadAccountStore() {
  try {
    const savedStore = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
    if (savedStore && Array.isArray(savedStore.accounts)) {
      const accounts = savedStore.accounts.map((account, index) => ({
        id: String(account.id || `account-${index + 1}`),
        name: String(account.name || `Player ${index + 1}`).slice(0, 20),
        data: normalizePlayerData(account.data),
      }));
      const activeAccountId = accounts.some((account) => account.id === savedStore.activeAccountId)
        ? savedStore.activeAccountId
        : accounts[0]?.id || null;
      return { activeAccountId, accounts };
    }

  } catch {
    // A fresh account list is used if browser storage is unavailable or damaged.
  }
  return { activeAccountId: null, accounts: [] };
}

clearExistingAccountsOnce();
const accountStore = loadAccountStore();
let playerData = accountStore.accounts.find((account) => account.id === accountStore.activeAccountId)?.data || defaultPlayerData();
playerData.pets.forEach((pet, index) => {
  if (!Number.isFinite(pet.colorHue)) pet.colorHue = (index * 67) % 360;
  if (!pet.name) pet.name = chooseNewPetName(playerData.pets, false);
  if (!Number.isFinite(pet.uncaredRounds)) pet.uncaredRounds = 0;
  if (!Number.isFinite(pet.levelsUntilNeed)) pet.levelsUntilNeed = 1;
  else pet.levelsUntilNeed = Math.min(2, Math.max(1, pet.levelsUntilNeed));
});

function savePlayerData() {
  playerData.level = Math.max(1, level);
  const account = accountStore.accounts.find((candidate) => candidate.id === accountStore.activeAccountId);
  if (account) account.data = playerData;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountStore));
  } catch {
    // The game still works if a browser has saving turned off.
  }
  coinsText.textContent = playerData.coins;
}

function selectedPet() {
  return playerData.pets.find((pet) => pet.id === playerData.selectedPetId) || null;
}

function selectNextPet(previousPetId) {
  if (playerData.pets.length === 0) {
    playerData.selectedPetId = null;
    return;
  }
  if (playerData.pets.length === 1) {
    playerData.selectedPetId = playerData.pets[0].id;
    return;
  }
  const previousIndex = playerData.pets.findIndex((pet) => pet.id === previousPetId);
  const nextIndex = previousIndex < 0 ? 0 : (previousIndex + 1) % playerData.pets.length;
  playerData.selectedPetId = playerData.pets[nextIndex].id;
}

function openStallCount() {
  return Math.max(0, playerData.stalls - playerData.pets.length);
}

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

const CUSTOM_CHOICES = {
  color: [
    { id: "rainbow", name: "Rainbow", icon: "🌈", unlock: 1, filter: "none" },
    { id: "pink", name: "Rosy Pink", icon: "🌸", unlock: 2, filter: "hue-rotate(300deg) saturate(1.3)" },
    { id: "ocean", name: "Ocean Blue", icon: "🌊", unlock: 3, filter: "hue-rotate(125deg) saturate(1.25)" },
    { id: "golden", name: "Golden", icon: "☀️", unlock: 4, filter: "sepia(.65) saturate(1.7) hue-rotate(350deg)" },
  ],
  hat: [
    { id: "none", name: "No Hat", icon: "✓", unlock: 1 },
    { id: "crown", name: "Crown", icon: "👑", unlock: 2 },
    { id: "flower", name: "Flower", icon: "🌺", unlock: 3 },
    { id: "wizard", name: "Wizard Hat", icon: "🧙", unlock: 4 },
  ],
  trail: [
    { id: "none", name: "No Trail", icon: "✓", unlock: 1 },
    { id: "sparkles", name: "Sparkles", icon: "✨", unlock: 2 },
    { id: "rainbow", name: "Rainbow", icon: "🌈", unlock: 3 },
    { id: "stars", name: "Stars", icon: "⭐", unlock: 4 },
  ],
};

function platyColorFilter() {
  return CUSTOM_CHOICES.color.find((choice) => choice.id === playerData.customization.color)?.filter || "none";
}

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
let level = playerData.level;
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
let lastBonusType = null;
let powersEnabledThisLevel = true;
let skyTime = 0;
let skyBoost = 0;
let skyClouds = [];
let cloudChecks = 0;
let petFoundThisLevel = false;
let skyDoor = null;
let skyDoorDelay = 0;
let lastUpTap = 0;
let shopPurchases = 0;
let coinsEarnedThisLevel = 0;
let stableReturnAction = null;
const HORIZON = 105;
const PATH_NEAR_WIDTH = 690;
const PATH_FAR_WIDTH = 105;

function preparePetData() {
  playerData.pets.forEach((pet, index) => {
    if (!Number.isFinite(pet.colorHue)) pet.colorHue = (index * 67) % 360;
    if (!pet.name) pet.name = chooseNewPetName(playerData.pets, false);
    if (!Number.isFinite(pet.uncaredRounds)) pet.uncaredRounds = 0;
    if (!Number.isFinite(pet.levelsUntilNeed)) pet.levelsUntilNeed = 1;
    else pet.levelsUntilNeed = Math.min(2, Math.max(1, pet.levelsUntilNeed));
  });
}

function renderAccountMenu() {
  accountList.replaceChildren();
  accountStore.accounts.forEach((account) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `account-choice${account.id === accountStore.activeAccountId ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(account.id === accountStore.activeAccountId));
    button.title = `Play as ${account.name}`;
    const circle = document.createElement("span");
    circle.className = "account-circle";
    circle.textContent = account.name.charAt(0).toUpperCase();
    const name = document.createElement("span");
    name.className = "account-name";
    name.textContent = account.name;
    button.append(circle, name);
    button.addEventListener("click", () => switchAccount(account.id));
    accountList.append(button);
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "account-choice add-account";
  addButton.title = "Make a new game account";
  addButton.innerHTML = '<span class="account-circle" aria-hidden="true">+</span><span class="account-name">New</span>';
  addButton.addEventListener("click", createAccount);
  accountList.append(addButton);
}

function switchAccount(accountId) {
  if (accountId === accountStore.activeAccountId) return;
  savePlayerData();
  const account = accountStore.accounts.find((candidate) => candidate.id === accountId);
  if (!account) return;
  accountStore.activeAccountId = account.id;
  playerData = normalizePlayerData(account.data);
  preparePetData();
  level = playerData.level;
  score = 0;
  scoreText.textContent = score;
  levelText.textContent = level;
  savePlayerData();
  showHomeScreen();
  showNotice(`Playing as ${account.name}`, "ready", 1800);
}

function createAccount() {
  const enteredName = window.prompt("What is the player's name?");
  if (enteredName === null) return false;
  const name = enteredName.trim().slice(0, 20);
  if (!name) {
    showNotice("Please enter a name for the new account.", "danger", 2500);
    return false;
  }
  savePlayerData();
  const account = {
    id: `account-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name,
    data: defaultPlayerData(),
  };
  accountStore.accounts.push(account);
  accountStore.activeAccountId = account.id;
  playerData = account.data;
  level = 1;
  score = 0;
  scoreText.textContent = score;
  levelText.textContent = level;
  savePlayerData();
  showHomeScreen();
  showNotice(`${name}'s game account is ready!`, "ready", 2200);
  return true;
}

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

  purchaseDing() {
    // One bright bell note for a successful purchase.
    this.tone(1568, 0.48, "sine", 0.09, 0, 1760);
    this.tone(2352, 0.36, "triangle", 0.035, 0.025, 2520);
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
let runningCoins = [];
let runningCoinTimer = 5;
let skyCoins = [];
let skyCoinTimer = 3;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function difficultyStep() {
  return Math.max(0, level - 1);
}

function trailSpeedForLevel() {
  return 86 + 90 * (1 - Math.exp(-difficultyStep() / 25));
}

function fruitSpeedForLevel() {
  return trailSpeedForLevel() + 45 * (1 - Math.exp(-difficultyStep() / 18));
}

function bossIntervalForLevel() {
  return 9 + 11 * Math.exp(-difficultyStep() / 16);
}

function platyReadySizeForLevel() {
  return 59 + 12 * (1 - Math.exp(-difficultyStep() / 18));
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

function resetPowersForLevel() {
  currentBonus = null;
  magnetFlashTimer = 0;
  invisibleTimer = 0;
  megaTailTimer = 0;
  lastBonusType = null;
  powersEnabledThisLevel = Math.random() < 0.72;
  bonusSpawnTimer = powersEnabledThisLevel ? random(18, 30) : Number.POSITIVE_INFINITY;
  bonusStatusText.textContent = "—";
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
  bossTimer = bossIntervalForLevel();
  bossTarget = null;
  readyMessageShown = false;
  fruitHitCooldown = 0;
  outcomeTimer = 0;
  resetPowersForLevel();
  tailCollections = [];
  groundCracks = [];
  runningCoins = [];
  runningCoinTimer = random(4, 8);

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
      speed: (small ? 81 : 31) + difficultyStep() * (small ? 3 : 1),
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      caught: 0,
      magnetized: false,
    };
  });

  const fruitSprites = [SPRITE.orange, SPRITE.apple, SPRITE.pear, SPRITE.banana];
  const fruitCount = Math.min(8, 4 + Math.floor(difficultyStep() / 2));
  fruits = Array.from({ length: fruitCount }, (_, index) => {
    const sprite = fruitSprites[index % fruitSprites.length];
    return {
      ...positionOnPath(105 + index * 105, 70),
      sprite,
      radius: (sprite === SPRITE.banana ? 36 : 33) + Math.min(6, difficultyStep() * 0.3),
    };
  });

  levelText.textContent = level;
  timerText.textContent = `${Math.ceil(bossIntervalForLevel())}s`;
  showNotice(`${setting.name} — Level ${level}`, "", 2300);
}

function startNewGame() {
  if (!accountStore.activeAccountId) {
    createAccount();
    return;
  }
  const flyer = selectedPet();
  if (playerData.pets.length > 0 && (!flyer || flyer.need)) {
    showStable(showHomeScreen);
    screenMessage.textContent = flyer?.need
      ? `Your selected pet is ${flyer.need}. Care for it before starting.`
      : "Choose a pet before starting.";
    return;
  }
  score = 0;
  level = playerData.level;
  scoreText.textContent = score;
  buildLevel();
  hideScreen();
  state = "playing";
  lastTime = performance.now();
  audio.startMusic();
}

function retryCurrentLevel() {
  score = 0;
  level = playerData.level;
  scoreText.textContent = score;
  buildLevel();
  hideScreen();
  state = "playing";
  lastTime = performance.now();
  audio.startMusic();
}

function startNextLevel() {
  const flyer = selectedPet();
  if (playerData.pets.length > 0 && (!flyer || flyer.need)) {
    showStable(showShop);
    screenMessage.textContent = flyer?.need
      ? `Your selected pet is ${flyer.need}. Care for it before the next level.`
      : "Choose a pet before continuing.";
    return;
  }
  level += 1;
  playerData.level = level;
  savePlayerData();
  score = 0;
  scoreText.textContent = score;
  buildLevel();
  hideScreen();
  state = "playing";
  lastTime = performance.now();
  audio.startMusic();
  if (level <= 4) showNotice("New Platy color, hat, and trail unlocked!", "ready", 3500);
}

function showScreen(kicker, title, message, buttonLabel, action) {
  screenCard.classList.remove("stable-view", "shop-view", "instructions-view", "customize-view");
  screenKicker.textContent = kicker;
  screenTitle.textContent = title;
  screenMessage.textContent = message;
  screenButton.textContent = buttonLabel;
  screenButton.onclick = action;
  instructionsButton.classList.add("hidden");
  stableButton.classList.add("hidden");
  customizeButton.classList.add("hidden");
  homeButton.classList.add("hidden");
  stablePanel.classList.add("hidden");
  shopPanel.classList.add("hidden");
  customizePanel.classList.add("hidden");
  accountPanel.classList.add("hidden");
  screen.classList.add("show");
}

function showHomeScreen() {
  screenCard.classList.remove("stable-view", "shop-view", "instructions-view", "customize-view");
  stableReturnAction = showHomeScreen;
  screenKicker.textContent = "A bouncy adventure";
  screenTitle.textContent = "DEFEAT PIGGY MASTER";
  screenMessage.textContent = accountStore.activeAccountId
    ? "Choose an account, then continue its saved adventure."
    : "Press + to make a named game account and begin your adventure.";
  screenButton.textContent = accountStore.activeAccountId ? "Start Game" : "Create Account";
  screenButton.onclick = accountStore.activeAccountId ? startNewGame : createAccount;
  instructionsButton.classList.remove("hidden");
  stableButton.classList.remove("hidden");
  stableButton.disabled = !accountStore.activeAccountId;
  customizeButton.classList.remove("hidden");
  customizeButton.disabled = !accountStore.activeAccountId;
  homeButton.classList.add("hidden");
  accountPanel.classList.remove("hidden");
  renderAccountMenu();
  stablePanel.classList.add("hidden");
  shopPanel.classList.add("hidden");
  customizePanel.classList.add("hidden");
  coinsText.textContent = playerData.coins;
  screen.classList.add("show");
}

function renderCustomize() {
  const selectedColor = CUSTOM_CHOICES.color.find((choice) => choice.id === playerData.customization.color) || CUSTOM_CHOICES.color[0];
  const selectedHat = CUSTOM_CHOICES.hat.find((choice) => choice.id === playerData.customization.hat) || CUSTOM_CHOICES.hat[0];
  const selectedTrail = CUSTOM_CHOICES.trail.find((choice) => choice.id === playerData.customization.trail) || CUSTOM_CHOICES.trail[0];
  const sections = [
    ["color", "Platy Color"],
    ["hat", "Hat"],
    ["trail", "Trail Effect"],
  ].map(([kind, title]) => {
    const choices = CUSTOM_CHOICES[kind].map((choice) => {
      const unlocked = playerData.level >= choice.unlock;
      const selected = playerData.customization[kind] === choice.id;
      const unlockText = unlocked ? choice.name : `Beat level ${choice.unlock - 1}`;
      return `<button class="custom-choice ${selected ? "selected" : ""}" data-custom-kind="${kind}" data-custom-id="${choice.id}" ${unlocked ? "" : "disabled"}><span>${unlocked ? choice.icon : "🔒"}</span><small>${unlockText}</small></button>`;
    }).join("");
    return `<section class="custom-group"><h3>${title}</h3><div class="custom-options">${choices}</div></section>`;
  }).join("");

  customizePanel.innerHTML = `
    <div class="custom-preview trail-${selectedTrail.id}">
      <div class="preview-trail" aria-hidden="true">${selectedTrail.icon}</div>
      <div class="preview-platy" style="filter:${selectedColor.filter}"></div>
      <div class="preview-hat" aria-hidden="true">${selectedHat.id === "none" ? "" : selectedHat.icon}</div>
      <strong>Level ${playerData.level} Platy</strong>
    </div>
    ${sections}`;

  customizePanel.querySelectorAll("[data-custom-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.customKind;
      const choice = CUSTOM_CHOICES[kind]?.find((item) => item.id === button.dataset.customId);
      if (!choice || playerData.level < choice.unlock) return;
      playerData.customization[kind] = choice.id;
      savePlayerData();
      audio.purchaseDing();
      renderCustomize();
    });
  });
}

function showCustomize() {
  showScreen("Platy's closet", "Customize Platy", "Choose a color, hat, and trail. Beat more levels to unlock everything!", "Back", showHomeScreen);
  screenCard.classList.add("customize-view");
  customizePanel.classList.remove("hidden");
  renderCustomize();
}

function showInstructions() {
  const instructions = [
    "GAME ACCOUNTS\n• Press the + circle on the main menu to create an account and enter the player's name.\n• Press a named circle to use that account. Each account separately saves its level, pets, coins, stalls, inventory, selected pet, and pet-care progress.",
    "RUNNING CONTROLS\n• Use ← and → to steer Platy.\n• Press ↑ to jump over fruit and scoop up stuffies with Platy's tail. Touch controls work the same way.\n• Big stuffies give 1 point. Smaller, harder stuffies give 5 points. Every stuffy makes Platy grow.\n• Touching fruit removes 2 points. Jumping high enough avoids it.",
    "POWERS\n• Magnet: pulls every stuffy currently on the trail toward Platy's tail.\n• Invisibility: protects Platy from fruit for 15 seconds. Piggy Master can still crush her.\n• Mega Tail: makes Platy's tail much larger for 10 seconds.\n• Golden Coin: adds 50 saved coins to the active account.\n• All active power effects reset to normal at the beginning of every level.",
    "COIN TRAILS\n• Trails of golden coins sometimes appear while Platy is running or flying.\n• Steer through them to collect them. Every golden coin adds 1 saved coin for the shop.",
    "PIGGY MASTER\n• Piggy Master starts by falling every 20 seconds and returns sooner on higher levels. Watch the warning and landing circle.\n• If Platy is still small, steer away or she will be crushed.\n• When Platy has grown bigger, move under Piggy Master so she bounces into space.\n• If a level is failed, Retry Level restarts that same level. Account progress, pets, coins, inventory, and care are not reset.",
    "CLOUD FLIGHT AND PETS\n• After Piggy Master flies away, double-tap ↑ to begin flying. Steer with ← and → and press ↑ near a cloud to search it.\n• You may search up to two clouds per round. Each cloud has a 40% chance of containing a unicorn or dragon, and only one pet can be found per round.\n• A pet needs an empty stable stall. When a pet is selected, Platy rides it during cloud flight.",
    "COINS AND THE SHOP\n• Fly through the magic door to enter the shop. Half the round's score, rounded up, becomes saved coins, and the round score resets.\n• You may buy five items per shop visit. Unicorn Food costs 10, Dragon Food costs 10, Water costs 15, Pet Soap costs 15, and a new Stable Stall costs 10 coins.",
    "PET CARE\n• The selected pet automatically rotates to the next saved pet after every completed round.\n• Pets can become hungry, thirsty, or dirty. Hungry unicorns need Unicorn Food, hungry dragons need Dragon Food, thirsty pets need Water, and dirty pets need Soap.\n• A newly adopted pet gets one full round before its first care need. After care, it stays happy for another 1–2 rounds.\n• The stable shows missed care from 0/3 through 3/3. If a fourth round ends without the needed care, the pet leaves permanently.\n• A pet that currently needs care must be helped before it can fly in the next round.",
    "CUSTOMIZE PLATY\n• Open Customize Platy on the home screen to choose her color, hat, and trail effect.\n• Beating levels 1, 2, and 3 unlocks more choices. Each game account saves its own outfit.",
  ].join("\n\n");
  showScreen("How to play", "Instructions", instructions, "Back", showHomeScreen);
  screenCard.classList.add("instructions-view");
}

function petName(pet) {
  return pet.name || "New Friend";
}

function renderStable() {
  const cards = [];
  for (let stall = 0; stall < playerData.stalls; stall += 1) {
    const pet = playerData.pets[stall];
    if (!pet) {
      cards.push(`<article class="stall-card empty-stall"><div class="stall-number">Stall ${stall + 1}</div><div class="hay-pile" aria-hidden="true"></div><div class="pet-icon">🪹</div><h3>Empty Stall</h3><p>Ready for a new pet!</p><div class="stall-gate" aria-hidden="true"></div></article>`);
      continue;
    }
    const selected = pet.id === playerData.selectedPetId;
    const needText = pet.need === "hungry"
      ? "🍽️ Hungry"
      : pet.need === "thirsty"
        ? "💧 Thirsty"
        : pet.need === "dirty"
          ? "🫧 Needs a bath"
          : "😊 Ready to fly";
    const foodKey = pet.type === "unicorn" ? "unicornFood" : "dragonFood";
    const careItem = pet.need === "thirsty" ? "water" : pet.need === "dirty" ? "soap" : foodKey;
    const careCount = playerData.inventory[careItem];
    const careLabel = pet.need === "thirsty" ? "Give Water" : pet.need === "dirty" ? "Wash Pet" : "Give Food";
    const uncaredRounds = Math.max(0, Number(pet.uncaredRounds) || 0);
    const careWarning = pet.need ? `<p class="care-warning">Care missed: ${uncaredRounds}/${MAX_UNCARED_ROUNDS} rounds</p>` : "";
    const petPosition = pet.type === "unicorn" ? "left" : "right";
    cards.push(`
      <article class="stall-card ${selected ? "selected" : ""}">
        <div class="stall-number">Stall ${stall + 1}</div>
        <div class="pet-nameplate">${petName(pet)}</div>
        <div class="hay-pile" aria-hidden="true"></div>
        <div class="pet-preview ${petPosition}" style="filter: hue-rotate(${pet.colorHue}deg) saturate(1.15)" aria-label="${pet.type}"></div>
        <h3>${pet.type === "unicorn" ? "Unicorn" : "Dragon"}</h3>
        <p>${needText}</p>
        ${careWarning}
        <button data-select-pet="${pet.id}" ${selected ? "disabled" : ""}>${selected ? "Selected" : "Choose"}</button>
        ${pet.need ? `<button data-care-pet="${pet.id}" ${careCount <= 0 ? "disabled" : ""}>${careLabel} (${careCount})</button>` : ""}
        <div class="stall-gate" aria-hidden="true"></div>
      </article>`);
  }
  stablePanel.innerHTML = `
    <div class="stable-building walk-in-stable">
      <div class="stable-roof" aria-hidden="true"><span>★</span></div>
      <div class="stable-back-wall" aria-hidden="true">
        <span class="stable-window stable-window-left"></span>
        <span class="stable-window stable-window-right"></span>
        <span class="stable-rafter rafter-left"></span>
        <span class="stable-rafter rafter-right"></span>
      </div>
      <div class="stable-sign">PLATY'S PET STABLE</div>
      <div class="stable-lantern lantern-left" aria-hidden="true">✦</div>
      <div class="stable-lantern lantern-right" aria-hidden="true">✦</div>
      <p class="shop-summary">Stalls: ${playerData.pets.length}/${playerData.stalls} · 🪙 ${playerData.coins} coins · Unicorn food: ${playerData.inventory.unicornFood} · Dragon food: ${playerData.inventory.dragonFood} · Water: ${playerData.inventory.water} · Soap: ${playerData.inventory.soap}</p>
      <div class="stable-grid">${cards.join("")}</div>
      <div class="stable-walkway" aria-hidden="true"><span>WELCOME</span></div>
      <div class="stable-floor" aria-hidden="true"></div>
    </div>`;

  stablePanel.querySelectorAll("[data-select-pet]").forEach((button) => {
    button.addEventListener("click", () => {
      playerData.selectedPetId = button.dataset.selectPet;
      savePlayerData();
      renderStable();
    });
  });
  stablePanel.querySelectorAll("[data-care-pet]").forEach((button) => {
    button.addEventListener("click", () => {
      const pet = playerData.pets.find((candidate) => candidate.id === button.dataset.carePet);
      if (!pet || !pet.need) return;
      const item = pet.need === "thirsty" ? "water" : pet.need === "dirty" ? "soap" : pet.type === "unicorn" ? "unicornFood" : "dragonFood";
      if (playerData.inventory[item] <= 0) return;
      playerData.inventory[item] -= 1;
      pet.need = null;
      pet.uncaredRounds = 0;
      pet.levelsUntilNeed = Math.floor(random(1, 3));
      savePlayerData();
      renderStable();
    });
  });
}

function showStable(returnAction = showHomeScreen) {
  stableReturnAction = returnAction;
  showScreen("Saved pets", "Pet Stable", "Choose a pet and care for anything it needs.", "Back", () => stableReturnAction());
  screenCard.classList.add("stable-view");
  stablePanel.classList.remove("hidden");
  renderStable();
}

function buyShopItem(item) {
  if (shopPurchases >= 5) return;
  const prices = { unicornFood: 10, dragonFood: 10, water: 15, soap: 15, stall: 10 };
  const price = prices[item];
  if (playerData.coins < price) return;
  playerData.coins -= price;
  if (item === "stall") playerData.stalls += 1;
  else playerData.inventory[item] += 1;
  shopPurchases += 1;
  savePlayerData();
  audio.purchaseDing();
  renderShop();
}

function renderShop() {
  const items = [
    ["unicornFood", "🧁", "Unicorn Food", 10, "Moonbeam Treats", "pink"],
    ["dragonFood", "🍖", "Dragon Food", 10, "Dragon Pantry", "orange"],
    ["water", "💧", "Fresh Water", 15, "Crystal Springs", "blue"],
    ["soap", "🧼", "Pet Soap", 15, "Bubble Bath", "purple"],
    ["stall", "🏠", "Stable Stall", 10, "Builder's Booth", "green"],
  ];
  const cards = items.map(([key, icon, name, price, boothName, color]) => `
    <article class="shop-card booth-${color}">
      <div class="booth-awning" aria-hidden="true"></div>
      <div class="booth-sign">${boothName}</div>
      <div class="booth-shelf">
        <div class="pet-icon" aria-hidden="true">${icon}</div>
        <h3>${name}</h3>
      </div>
      <div class="booth-counter">
        <p><span aria-hidden="true">🪙</span> ${price}</p>
        <button data-buy="${key}" ${shopPurchases >= 5 || playerData.coins < price ? "disabled" : ""}>Buy</button>
      </div>
    </article>`).join("");
  shopPanel.innerHTML = `
    <div class="walk-in-shop">
      <div class="shop-back-wall" aria-hidden="true">
        <span class="shop-window left-window"></span>
        <span class="shop-window right-window"></span>
      </div>
      <div class="shop-hanging-sign">PLATY'S SKY MARKET</div>
      <p class="shop-summary"><span>🪙 ${playerData.coins} coins</span><span>Shopping bag: ${shopPurchases}/5</span></p>
      <div class="shop-grid">${cards}</div>
      <div class="shop-aisle" aria-hidden="true"><span>WELCOME</span></div>
    </div>`;
  shopPanel.querySelectorAll("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => buyShopItem(button.dataset.buy));
  });
}

function showShop() {
  showScreen("Magic cloud shop", "Spend Your Coins", `This level earned ${coinsEarnedThisLevel} coins. Buy up to five things.`, "Next Level", startNextLevel);
  screenCard.classList.add("shop-view");
  shopPanel.classList.remove("hidden");
  stableButton.classList.remove("hidden");
  homeButton.classList.remove("hidden");
  stableReturnAction = showShop;
  renderShop();
}

function returnHomeFromShop() {
  level += 1;
  playerData.level = level;
  levelText.textContent = level;
  savePlayerData();
  state = "title";
  audio.stopMusic();
  showHomeScreen();
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
  return player.radius > platyReadySizeForLevel();
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
  const travelSpeed = trailSpeedForLevel();
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
  const travelSpeed = fruitSpeedForLevel();
  for (const fruit of fruits) {
    fruit.y += travelSpeed * dt;
    if (fruit.y > HEIGHT + 75) {
      Object.assign(fruit, positionOnPath(random(-520, -100), 70));
    }
    fruit.x = pathCenter(fruit.y) + fruit.lane * Math.max(10, pathWidthAt(fruit.y) / 2 - 70 * (0.25 + pathDepth(fruit.y) * 0.75));
  }

  fruitHitCooldown = Math.max(0, fruitHitCooldown - dt);
  if (invisibleTimer > 0) return;
  // Any time Platy is airborne, she passes safely over fruit below her.
  if (player.jumpHeight > 0 || player.jumpVelocity !== 0) return;
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

function collectTrailCoin(coin) {
  if (coin.collected) return;
  coin.collected = true;
  playerData.coins += 1;
  savePlayerData();
  audio.collect();
}

function spawnRunningCoinTrail() {
  const centerLane = random(-0.48, 0.48);
  runningCoins = Array.from({ length: 8 }, (_, index) => ({
    y: HORIZON + 20 - index * 52,
    lane: Math.max(-0.78, Math.min(0.78, centerLane + Math.sin(index * 0.8) * 0.16)),
    x: WIDTH / 2,
    radius: 15,
    phase: index * 0.65,
    collected: false,
  }));
  showNotice("A trail of coins appeared!", "ready", 1800);
}

function updateRunningCoins(dt) {
  if (runningCoins.length === 0) {
    runningCoinTimer -= dt;
    if (runningCoinTimer <= 0) spawnRunningCoinTrail();
    return;
  }

  const playerCenter = { x: player.x, y: player.y - player.jumpHeight };
  runningCoins.forEach((coin) => {
    coin.y += trailSpeedForLevel() * dt;
    const usableHalf = Math.max(10, pathWidthAt(coin.y) / 2 - 45);
    coin.x = pathCenter(coin.y) + coin.lane * usableHalf;
    if (!coin.collected && distance(playerCenter, coin) < player.radius * 0.72 + coin.radius) {
      collectTrailCoin(coin);
    }
  });
  runningCoins = runningCoins.filter((coin) => !coin.collected && coin.y < HEIGHT + 70);
  if (runningCoins.length === 0) runningCoinTimer = random(10, 17);
}

function spawnSkyCoinTrail() {
  const centerLane = random(-0.5, 0.5);
  skyCoins = Array.from({ length: 9 }, (_, index) => ({
    x: WIDTH / 2,
    y: 90 - index * 48,
    lane: Math.max(-0.82, Math.min(0.82, centerLane + Math.sin(index * 0.7) * 0.18)),
    radius: 7,
    phase: index * 0.7,
    collected: false,
  }));
  showNotice("Flying coin trail ahead!", "ready", 1800);
}

function updateSkyCoins(dt, skyPlayer) {
  if (skyCoins.length === 0) {
    skyCoinTimer -= dt;
    if (skyCoinTimer <= 0) spawnSkyCoinTrail();
    return;
  }

  skyCoins.forEach((coin) => {
    const depth = Math.max(0, Math.min(1, (coin.y - 80) / (HEIGHT - 140)));
    coin.y += (58 + depth * 112) * dt;
    const spread = 45 + depth * (WIDTH * 0.46);
    coin.x = WIDTH / 2 + coin.lane * spread;
    coin.radius = 7 + depth * 13;
    if (!coin.collected && distance(skyPlayer, coin) < 38 + coin.radius) collectTrailCoin(coin);
  });
  skyCoins = skyCoins.filter((coin) => !coin.collected && coin.y < HEIGHT + 70);
  if (skyCoins.length === 0) skyCoinTimer = random(8, 14);
}

function spawnBonus() {
  const bonusTypes = ["magnet", "invisible", "mega-tail", "coins"];
  const choices = bonusTypes.filter((typeName) => typeName !== lastBonusType);
  const type = choices[Math.floor(Math.random() * choices.length)];
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
    } else if (currentBonus.type === "mega-tail") {
      megaTailTimer = 10;
      showNotice("MEGA TAIL! Platy can scoop stuffies from far away for 10 seconds!", "ready", 3000);
    } else {
      playerData.coins += 50;
      savePlayerData();
      showNotice("COIN POWER! You won 50 coins!", "ready", 3000);
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
      bossTimer = bossIntervalForLevel();
      bossTarget = null;
    }
  }
}

function updateOutcome(dt) {
  worldTime += dt;
  outcomeTimer += dt;

  if (state === "boss-bounce" && outcomeTimer > 1.8) {
    state = "sky-wait";
    bossTarget = null;
    lastUpTap = 0;
    showNotice("Piggy Master is gone! Double-tap UP to fly!", "ready", 6000);
  }

  if (state === "crushed" && outcomeTimer > 1.15) {
    state = "game-over";
    showScreen(
      "Squashed by Piggy Master!",
      `Level ${level} Failed`,
      `Platy was still too small. You scored ${score} points. Retry level ${level}; your account, pets, coins, inventory, and care progress are safe.`,
      `Retry Level ${level}`,
      retryCurrentLevel,
    );
  }
}

function makeSkyCloud(y = random(-320, -80)) {
  return {
    x: WIDTH / 2,
    y,
    radius: random(55, 78),
    lane: random(-0.9, 0.9),
    renderRadius: 24,
    checked: false,
    reveal: null,
    revealAge: 0,
    drift: random(0, Math.PI * 2),
  };
}

function startSkyPhase() {
  const flyer = selectedPet();
  if (playerData.pets.length > 0 && (!flyer || flyer.need)) {
    showNotice("Your flying pet needs care in the stable first!", "danger", 4000);
    return;
  }
  state = "sky";
  skyTime = 0;
  skyBoost = 0;
  cloudChecks = 0;
  petFoundThisLevel = false;
  skyDoor = null;
  skyDoorDelay = 0;
  skyCoins = [];
  skyCoinTimer = 2.5;
  player.x = WIDTH / 2;
  player.y = HEIGHT - 125;
  skyClouds = [makeSkyCloud(105), makeSkyCloud(245), makeSkyCloud(-40), makeSkyCloud(-210)];
  audio.startMusic();
  showNotice("Fly forward into a cloud and press UP to search it!", "", 4000);
}

function triggerSkyBoost() {
  if (skyBoost <= 0) skyBoost = 0.8;
}

function adoptPet(type, cloud) {
  if (openStallCount() <= 0) {
    cloud.reveal = "no-stall";
    showNotice("No empty stall! Buy another stall at the shop.", "danger", 3500);
    return false;
  }
  const chosenName = chooseNewPetName(playerData.pets);
  const pet = {
    id: `pet-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    type,
    need: null,
    // A new pet gets one full adventure before needing its first care item.
    levelsUntilNeed: 1,
    uncaredRounds: 0,
    adoptedLevel: level,
    colorHue: (playerData.pets.length * 67) % 360,
    name: chosenName,
  };
  playerData.pets.push(pet);
  if (!playerData.selectedPetId) playerData.selectedPetId = pet.id;
  cloud.reveal = type;
  cloud.revealHue = pet.colorHue;
  petFoundThisLevel = true;
  savePlayerData();
  showNotice(`You found ${pet.name} the ${type}! Your new pet is waiting in the stable!`, "ready", 4500);
  return true;
}

function searchCloud(cloud) {
  if (cloud.checked || petFoundThisLevel || cloudChecks >= 2) return;
  cloud.checked = true;
  cloudChecks += 1;
  if (Math.random() < PET_FIND_CHANCE) {
    const type = Math.random() < 0.5 ? "unicorn" : "dragon";
    adoptPet(type, cloud);
  } else {
    cloud.reveal = "empty";
    showNotice(cloudChecks < 2 ? "This cloud is empty. You can try one more!" : "Both clouds were empty this time.", "", 3200);
  }
  skyDoorDelay = 4;
}

function advancePetNeeds() {
  const departedPets = [];
  playerData.pets = playerData.pets.filter((pet) => {
    if (pet.adoptedLevel === level) return true;
    if (pet.need) {
      pet.uncaredRounds = (Number(pet.uncaredRounds) || 0) + 1;
      if (pet.uncaredRounds > MAX_UNCARED_ROUNDS) {
        departedPets.push(pet);
        return false;
      }
      return true;
    }
    pet.levelsUntilNeed = (pet.levelsUntilNeed || 3) - 1;
    if (pet.levelsUntilNeed <= 0) {
      const careNeeds = ["hungry", "thirsty", "dirty"];
      pet.need = careNeeds[Math.floor(Math.random() * careNeeds.length)];
      pet.uncaredRounds = 0;
    }
    return true;
  });

  if (departedPets.length > 0) {
    if (!playerData.pets.some((pet) => pet.id === playerData.selectedPetId)) {
      playerData.selectedPetId = playerData.pets[0]?.id || null;
    }
    const names = departedPets.map((pet) => petName(pet)).join(" and ");
    showNotice(`${names} left the stable after going too long without care.`, "danger", 5000);
  }
}

function enterShop() {
  const completedRoundPetId = playerData.selectedPetId;
  state = "shop";
  coinsEarnedThisLevel = Math.ceil(score / 2);
  playerData.coins += coinsEarnedThisLevel;
  score = 0;
  scoreText.textContent = score;
  shopPurchases = 0;
  advancePetNeeds();
  selectNextPet(completedRoundPetId);
  savePlayerData();
  showShop();
}

function updateSky(dt) {
  skyTime += dt;
  worldTime += dt;
  let direction = 0;
  if (keys.has("ArrowLeft")) direction -= 1;
  if (keys.has("ArrowRight")) direction += 1;
  player.x = Math.max(55, Math.min(WIDTH - 55, player.x + direction * 285 * dt));

  skyBoost = Math.max(0, skyBoost - dt);
  const boostHeight = skyBoost > 0 ? Math.sin((skyBoost / 0.8) * Math.PI) * 34 : 0;
  const skyPlayer = { x: player.x, y: player.y - boostHeight };
  updateSkyCoins(dt, skyPlayer);

  skyClouds.forEach((cloud) => {
    const depth = Math.max(0, Math.min(1, (cloud.y - 80) / (HEIGHT - 140)));
    cloud.y += (50 + depth * 105) * dt;
    const spread = 45 + depth * (WIDTH * 0.46);
    cloud.x = WIDTH / 2 + cloud.lane * spread + Math.sin(skyTime * 0.8 + cloud.drift) * (4 + depth * 13);
    cloud.renderRadius = cloud.radius * (0.28 + depth * 0.9);
    if (cloud.reveal) cloud.revealAge += dt;
    if (cloud.y > HEIGHT + 100) Object.assign(cloud, makeSkyCloud(random(75, 115)));
    if (skyBoost > 0 && !cloud.checked && distance(skyPlayer, cloud) < cloud.renderRadius + 42) searchCloud(cloud);
  });

  const searchFinished = petFoundThisLevel || cloudChecks >= 2 || skyTime > 28;
  if (searchFinished && !skyDoor) {
    skyDoorDelay = Math.max(0, skyDoorDelay - dt);
    if (skyDoorDelay <= 0) {
      skyDoor = { x: WIDTH / 2, y: 92, lane: random(-0.45, 0.45), scale: 0.3 };
      showNotice("The magic shop door appeared! Fly through it!", "ready", 3500);
    }
  }

  if (skyDoor) {
    const doorDepth = Math.max(0, Math.min(1, (skyDoor.y - 80) / (HEIGHT - 140)));
    skyDoor.y += (55 + doorDepth * 105) * dt;
    skyDoor.x = WIDTH / 2 + skyDoor.lane * (45 + doorDepth * WIDTH * 0.46);
    skyDoor.scale = 0.28 + doorDepth * 0.92;
    if (distance(skyPlayer, skyDoor) < 48 + 48 * skyDoor.scale) enterShop();
    else if (skyDoor.y > HEIGHT + 100) {
      skyDoor.lane = (player.x - WIDTH / 2) / (WIDTH * 0.46);
      skyDoor.y = 90;
    }
  }
}

function update(dt) {
  worldTime += dt;
  pathDistance += trailSpeedForLevel() * dt;
  earthquake = Math.max(0, earthquake - dt);
  updatePlayer(dt);
  updateBonus(dt);
  updateToys(dt);
  updateTailCollections(dt);
  updateFruits(dt);
  updateRunningCoins(dt);
  updateBoss(dt);
  updateCracks(dt);
}

function updateCracks(dt) {
  const travelSpeed = trailSpeedForLevel();
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
  const sprite = spriteImages[spriteNumber];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return;
  const drawHeight = size * (sprite.naturalHeight / sprite.naturalWidth);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    sprite,
    x - size / 2,
    y - drawHeight / 2,
    size,
    drawHeight,
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

function drawPetSprite(type, x, y, size, alpha = 1, colorHue = 0) {
  if (!flyingPets.complete || !flyingPets.naturalWidth) return;
  const sourceWidth = flyingPets.naturalWidth / 2;
  const sourceHeight = flyingPets.naturalHeight;
  const petColumn = type === "unicorn" ? 0 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = `hue-rotate(${colorHue}deg) saturate(1.15)`;
  ctx.drawImage(
    flyingPets,
    petColumn * sourceWidth, 0, sourceWidth, sourceHeight,
    x - size / 2, y - size * (sourceHeight / sourceWidth) / 2,
    size, size * (sourceHeight / sourceWidth),
  );
  ctx.restore();
}

function drawRidingPetSprite(type, x, y, size, colorHue = 0) {
  if (!platyRidingPets.complete || !platyRidingPets.naturalWidth) return;
  const sourceWidth = platyRidingPets.naturalWidth / 2;
  const sourceHeight = platyRidingPets.naturalHeight;
  const petColumn = type === "unicorn" ? 0 : 1;
  ctx.save();
  ctx.filter = `hue-rotate(${colorHue}deg) saturate(1.1)`;
  ctx.drawImage(
    platyRidingPets,
    petColumn * sourceWidth, 0, sourceWidth, sourceHeight,
    x - size / 2, y - size * (sourceHeight / sourceWidth) / 2,
    size, size * (sourceHeight / sourceWidth),
  );
  ctx.restore();
}

function drawCloud(cloud) {
  const puff = cloud.renderRadius || cloud.radius;
  ctx.save();
  ctx.fillStyle = cloud.checked ? "rgb(222 233 255 / 86%)" : "rgb(255 255 255 / 94%)";
  ctx.shadowColor = "rgb(90 130 190 / 30%)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cloud.x - puff * 0.42, cloud.y + puff * 0.08, puff * 0.52, 0, Math.PI * 2);
  ctx.arc(cloud.x, cloud.y - puff * 0.2, puff * 0.7, 0, Math.PI * 2);
  ctx.arc(cloud.x + puff * 0.48, cloud.y + puff * 0.08, puff * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (cloud.reveal === "unicorn" || cloud.reveal === "dragon") {
    drawPetSprite(cloud.reveal, cloud.x, cloud.y - puff * 0.8 - Math.sin(worldTime * 5) * 8, Math.max(34, puff * 1.15), 1, cloud.revealHue || 0);
  } else if (cloud.reveal === "empty" || cloud.reveal === "no-stall") {
    ctx.fillStyle = "#5d4b78";
    ctx.font = "900 22px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(cloud.reveal === "empty" ? "Empty!" : "No stall!", cloud.x, cloud.y + 8);
    ctx.textAlign = "left";
  }
}

function drawPlatyTrail(x, y, size = 1) {
  const trail = playerData.customization.trail;
  if (trail === "none") return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowBlur = 12 * size;
  for (let index = 1; index <= 10; index += 1) {
    const fade = (11 - index) / 11;
    const trailX = x + Math.sin(worldTime * 7 + index * 1.7) * 23 * size;
    const trailY = y + index * 14 * size;
    ctx.globalAlpha = fade * 0.98;
    if (trail === "rainbow") {
      const colors = ["#ff5e8a", "#ffb52e", "#fff05c", "#67db78", "#56b7ff", "#b778ff"];
      ctx.strokeStyle = colors[index % colors.length];
      ctx.shadowColor = colors[index % colors.length];
      ctx.lineWidth = 12 * size;
      ctx.beginPath();
      ctx.moveTo(trailX - 12 * size, trailY);
      ctx.lineTo(trailX + 12 * size, trailY);
      ctx.stroke();
    } else {
      ctx.fillStyle = trail === "stars" ? "#fff06a" : "#ffffff";
      ctx.shadowColor = trail === "stars" ? "#ff9f1c" : "#c264ff";
      ctx.translate(trailX, trailY);
      ctx.rotate(worldTime * 2 + index);
      const radius = (trail === "stars" ? 9 : 7) * size;
      ctx.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = point * Math.PI / 4;
        const pointRadius = point % 2 === 0 ? radius : radius * 0.35;
        ctx.lineTo(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
  ctx.restore();
}

function drawPlatyHat(x, y, size = 38) {
  const hat = CUSTOM_CHOICES.hat.find((choice) => choice.id === playerData.customization.hat);
  if (!hat || hat.id === "none") return;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 0.72);
  glow.addColorStop(0, "rgb(255 255 210 / 78%)");
  glow.addColorStop(0.5, "rgb(255 231 100 / 42%)");
  glow.addColorStop(1, "rgb(255 231 100 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${size}px "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.filter = "brightness(1.35) saturate(1.4)";
  ctx.shadowColor = "#fff27a";
  ctx.shadowBlur = 16;
  ctx.fillText(hat.icon, x, y);
  ctx.restore();
}

function drawSkyPlayer() {
  const boostHeight = skyBoost > 0 ? Math.sin((skyBoost / 0.8) * Math.PI) * 34 : 0;
  const x = player.x;
  const y = player.y - boostHeight + Math.sin(worldTime * 6) * 4;
  const flyer = selectedPet();
  drawPlatyTrail(x, y + 48, 1.15);
  if (flyer) {
    drawRidingPetSprite(flyer.type, x, y, 195, flyer.colorHue || 0);
  } else if (platyTailAnimation.complete && platyTailAnimation.naturalWidth) {
    const sourceWidth = platyTailAnimation.naturalWidth / 2;
    const sourceHeight = platyTailAnimation.naturalHeight;
    const size = 98;
    const height = size * (sourceHeight / sourceWidth);
    ctx.save();
    ctx.filter = platyColorFilter();
    ctx.drawImage(
      platyTailAnimation,
      (Math.floor(worldTime * 7) % 2) * sourceWidth, 0, sourceWidth, sourceHeight,
      x - size / 2, y - height / 2, size, height,
    );
    ctx.restore();
  }
  drawPlatyHat(x, y - (flyer ? 78 : 53), flyer ? 52 : 50);
}

function drawCoinPickup(coin, radius) {
  const spin = 0.28 + Math.abs(Math.cos(worldTime * 7 + coin.phase)) * 0.72;
  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.scale(spin, 1);
  ctx.shadowColor = "#ffcf33";
  ctx.shadowBlur = Math.max(5, radius * 0.7);
  ctx.fillStyle = "#ffd83d";
  ctx.strokeStyle = "#a96300";
  ctx.lineWidth = Math.max(2, radius * 0.15);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#fff39a";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#9d5b00";
  ctx.font = `900 ${Math.max(8, radius * 1.05)}px Trebuchet MS`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", 0, 1);
  ctx.restore();
}

function drawRunningCoins() {
  runningCoins.forEach((coin) => {
    const depthScale = 0.35 + pathDepth(coin.y) * 0.9;
    drawCoinPickup(coin, coin.radius * depthScale);
  });
}

function drawSkyCoins() {
  skyCoins.forEach((coin) => drawCoinPickup(coin, coin.radius));
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#4ca8ff");
  gradient.addColorStop(0.65, "#9ee7ff");
  gradient.addColorStop(1, "#e5faff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // These shining lines meet at the horizon, making the flight feel forward
  // like the dirt trail does during the running part of the game.
  ctx.save();
  ctx.strokeStyle = "rgb(255 255 255 / 22%)";
  ctx.lineWidth = 3;
  for (let lane = -4; lane <= 4; lane += 1) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + lane * 8, 86);
    ctx.lineTo(WIDTH / 2 + lane * 125, HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 157 + 70) % WIDTH;
    const y = (i * 83 + skyTime * 24) % HEIGHT;
    ctx.fillStyle = "rgb(255 255 255 / 34%)";
    ctx.beginPath();
    ctx.arc(x, y, 12 + (i % 3) * 7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSkyCoins();
  skyClouds.forEach(drawCloud);

  if (skyDoor) {
    const pulse = 1 + Math.sin(worldTime * 5) * 0.06;
    ctx.save();
    ctx.translate(skyDoor.x, skyDoor.y);
    ctx.scale(pulse * skyDoor.scale, pulse * skyDoor.scale);
    ctx.shadowColor = "#ffe77a";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#6b3e9d";
    ctx.strokeStyle = "#ffd85c";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.roundRect(-48, -72, 96, 144, 45);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe77a";
    ctx.beginPath();
    ctx.arc(28, 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSkyPlayer();
  ctx.fillStyle = "rgb(255 255 255 / 82%)";
  roundedRect(18, 15, 305, 47, 18);
  ctx.fillStyle = "#4a3269";
  ctx.font = "900 20px Trebuchet MS";
  ctx.fillText(`Cloud searches: ${cloudChecks}/2`, 34, 46);
}

function drawBonus() {
  if (!currentBonus) return;
  const isMegaTail = currentBonus.type === "mega-tail";
  const isCoinPower = currentBonus.type === "coins";
  if (isMegaTail && (!megaTailIcon.complete || !megaTailIcon.naturalWidth)) return;
  if (!isMegaTail && !isCoinPower && (!bonusIcons.complete || !bonusIcons.naturalWidth)) return;
  const depthScale = 0.38 + pathDepth(currentBonus.y) * 0.8;
  const size = 88 * depthScale;
  const y = currentBonus.y - 72 + Math.sin(currentBonus.age * 3.2) * 19;
  const pulse = 1 + Math.sin(currentBonus.age * 5) * 0.12;
  const colors = currentBonus.type === "magnet"
    ? { fill: "rgb(255 226 75 / 28%)", stroke: "#fff06a" }
    : currentBonus.type === "invisible"
      ? { fill: "rgb(90 198 255 / 28%)", stroke: "#8ee7ff" }
      : isCoinPower
        ? { fill: "rgb(255 199 36 / 35%)", stroke: "#fff28a" }
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
  } else if (isCoinPower) {
    ctx.save();
    ctx.shadowColor = "#ffcf33";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffd447";
    ctx.strokeStyle = "#b86d00";
    ctx.lineWidth = Math.max(3, size * 0.07);
    ctx.beginPath();
    ctx.arc(currentBonus.x, y, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff49b";
    ctx.font = `900 ${Math.max(18, size * 0.42)}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("50", currentBonus.x, y + 1);
    ctx.restore();
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
    // Draw collectibles a little smaller than their game space so their edges
    // have plenty of clear room and never look crowded or clipped.
    drawSprite(fruit.sprite, fruit.x, fruit.y - 3, fruit.radius * 1.95 * depthScale);
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
    drawSprite(toy.sprite, toy.x, toy.y - groundLift, toy.radius * 2.15 * depthScale);
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
  drawPlatyTrail(player.x, player.y - player.jumpHeight + player.radius * 0.4, 0.95);
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
    ctx.filter = platyColorFilter();
    ctx.drawImage(
      platyTailAnimation,
      frameNumber * sourceWidth, 0, sourceWidth, sourceHeight,
      -size / 2, -height / 2, size, height,
    );
    ctx.restore();
  } else if (platyBack.complete && platyBack.naturalWidth) {
    const size = player.radius * 3.05;
    const ratio = platyBack.naturalHeight / platyBack.naturalWidth;
    ctx.save();
    ctx.filter = platyColorFilter();
    ctx.drawImage(platyBack, player.x - size / 2, player.y - player.jumpHeight - size * ratio / 2, size, size * ratio);
    ctx.restore();
  } else {
    ctx.save();
    ctx.filter = platyColorFilter();
    drawSprite(SPRITE.platy, player.x, player.y - player.jumpHeight, player.radius * 2.65, ctx.globalAlpha);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  drawPlatyHat(player.x, player.y - player.jumpHeight - player.radius * 1.5, player.radius * 1.55);

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
    drawSprite(collected.sprite, x, y, size * 0.88, fade);
  });
}

function draw() {
  ctx.save();
  if (state === "sky" || state === "shop") {
    drawSky();
    ctx.restore();
    return;
  }
  if (earthquake > 0) ctx.translate(random(-5, 5), random(-5, 5));
  drawBackground();
  drawCracks();
  drawRunningCoins();
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
  if (state === "sky") updateSky(dt);
  if (state === "boss-bounce" || state === "crushed") updateOutcome(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function handleUpPress() {
  if (state === "playing") {
    jump();
    return;
  }
  if (state === "sky") {
    triggerSkyBoost();
    return;
  }
  if (state === "sky-wait") {
    const now = performance.now();
    if (now - lastUpTap < 430) startSkyPhase();
    else {
      lastUpTap = now;
      showNotice("Tap UP one more time to fly!", "ready", 1200);
    }
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    keys.add(event.key);
    if (event.key === "ArrowUp" && !event.repeat) handleUpPress();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("blur", () => keys.clear());

document.querySelectorAll("[data-key]").forEach((button) => {
  const key = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keys.add(key);
    if (key === "ArrowUp") handleUpPress();
  };
  const release = (event) => { event.preventDefault(); keys.delete(key); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

screenButton.onclick = startNewGame;
instructionsButton.addEventListener("click", showInstructions);
stableButton.addEventListener("click", () => showStable(stableReturnAction || showHomeScreen));
customizeButton.addEventListener("click", showCustomize);
homeButton.addEventListener("click", returnHomeFromShop);
soundToggle.addEventListener("click", () => {
  const muted = audio.toggle();
  soundToggle.textContent = muted ? "🔇 Sound Off" : "🔊 Sound On";
  soundToggle.setAttribute("aria-pressed", String(muted));
});
chooseSetting();
buildLevel();
state = "title";
stableReturnAction = showHomeScreen;
showHomeScreen();
savePlayerData();
requestAnimationFrame(gameLoop);

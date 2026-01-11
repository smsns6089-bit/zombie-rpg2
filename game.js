// Project Game Maker: Zombie RPG FPS (Raycast)
// Adds: Shop Stand (press Q), pause/freeze zombies in shop, audio (gun/hit/zombie), saving (localStorage),
// minimap shop marker, slightly smoother gun + more detailed zombie billboard.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- UI ----------
const ui = {
  hp: document.getElementById("hp"),
  weapon: document.getElementById("weapon"),
  ammo: document.getElementById("ammo"),
  mag: document.getElementById("mag"),
  reserve: document.getElementById("reserve"),
  cash: document.getElementById("cash"),
  wave: document.getElementById("wave"),
  level: document.getElementById("level"),
  xp: document.getElementById("xp"),
  hint: document.getElementById("hint"),

  shop: document.getElementById("shop"),
  shopList: document.getElementById("shopList"),
  closeShop: document.getElementById("closeShop"),

  death: document.getElementById("death"),
  restart: document.getElementById("restart"),
};

function fit() {
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
addEventListener("resize", fit);
fit();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function rand(a, b) { return a + Math.random() * (b - a); }

function setHint(t, ok = false) {
  ui.hint.textContent = t || "";
  ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
}

// ---------- AUDIO (no external files) ----------
let audio = {
  ctx: null,
  master: null,
  enabled: true,
};

function ensureAudio() {
  if (audio.ctx) return true;
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new A();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(audio.ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function playNoiseBurst(duration = 0.06, gain = 0.25, hp = 1400, lp = 80) {
  if (!audio.enabled) return;
  if (!ensureAudio()) return;

  const ac = audio.ctx;
  const len = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * (1 - t); // fade out
  }

  const src = ac.createBufferSource();
  src.buffer = buf;

  const hpF = ac.createBiquadFilter();
  hpF.type = "highpass";
  hpF.frequency.value = hp;

  const lpF = ac.createBiquadFilter();
  lpF.type = "lowpass";
  lpF.frequency.value = lp;

  const g = ac.createGain();
  g.gain.value = gain;

  src.connect(hpF);
  hpF.connect(lpF);
  lpF.connect(g);
  g.connect(audio.master);

  src.start();
}

function playTone(freq = 220, duration = 0.07, gain = 0.18, type = "square") {
  if (!audio.enabled) return;
  if (!ensureAudio()) return;

  const ac = audio.ctx;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;

  const now = ac.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  o.connect(g);
  g.connect(audio.master);
  o.start(now);
  o.stop(now + duration);
}

function sfxGun() {
  // punchy pop + hiss
  playTone(160, 0.05, 0.16, "square");
  playTone(90, 0.05, 0.10, "sawtooth");
  playNoiseBurst(0.05, 0.18, 1200, 9000);
}

function sfxHit() {
  // quick click + tiny thump
  playTone(720, 0.03, 0.11, "triangle");
  playTone(120, 0.05, 0.08, "sine");
}

function sfxZombie(distanceToPlayer = 6) {
  // low groan with distance volume
  const vol = clamp(1 - distanceToPlayer / 10, 0, 1) * 0.20;
  if (vol <= 0.01) return;
  playTone(70 + rand(-6, 6), 0.18, vol, "sawtooth");
  playTone(110 + rand(-10, 10), 0.10, vol * 0.6, "triangle");
}

// ---------- SAVE / LOAD ----------
const SAVE_KEY = "pgm_zombie_rpg2_save_v1";

function xpToNext(level) {
  return Math.floor(60 + (level - 1) * 40 + Math.pow(level - 1, 1.35) * 25);
}

function saveGame() {
  try {
    const owned = player.slots.filter(Boolean).map(w => w.id);
    const slotIds = player.slots.map(w => (w ? w.id : null));

    // store ammo inside weapon objects so swapping preserves
    for (const w of player.slots) {
      if (!w) continue;
      w._mag = w._mag ?? w.magSize;
      w._reserve = w._reserve ?? (w.reserveStart ?? 32);
    }

    const data = {
      cash: player.cash,
      level: player.level,
      xp: player.xp,
      dmgMult: player.dmgMult,
      slotIds,
      activeSlot: player.activeSlot,
      usingKnife: player.usingKnife,
      weaponState: Object.fromEntries(
        player.slots.filter(Boolean).map(w => [w.id, { _mag: w._mag, _reserve: w._reserve }])
      ),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    player.cash = data.cash ?? 0;
    player.level = data.level ?? 1;
    player.xp = data.xp ?? 0;
    player.dmgMult = data.dmgMult ?? 1;

    // rebuild slots from ids
    const slotIds = Array.isArray(data.slotIds) ? data.slotIds : [ "pistol_rusty", null ];
    player.slots = slotIds.map(id => (id ? structuredClone(W(id)) : null));

    // restore weapon ammo states
    const ws = data.weaponState || {};
    for (const w of player.slots) {
      if (!w) continue;
      if (ws[w.id]) {
        w._mag = ws[w.id]._mag;
        w._reserve = ws[w.id]._reserve;
      }
    }

    player.activeSlot = data.activeSlot ?? 0;
    player.usingKnife = !!data.usingKnife;

    // sync active
    if (!player.usingKnife && player.slots[player.activeSlot]) {
      syncAmmoToWeapon(player.slots[player.activeSlot]);
    }

    setHint("Loaded save ✅", true);
    return true;
  } catch {
    return false;
  }
}

// autosave every 10 seconds
let saveTimer = 0;

// ---------- GAME STATE ----------
const game = {
  mode: "play", // play | shop | dead
  pointerLocked: false,
  wave: 1,
  t: 0,
  recoil: 0,
  muzzle: 0,
};

let mouseDown = false;
let lookDelta = 0;

function lockPointer() { canvas.requestPointerLock?.(); }
document.addEventListener("pointerlockchange", () => {
  game.pointerLocked = (document.pointerLockElement === canvas);
});

// any user gesture can unlock audio
function userGesture() {
  ensureAudio();
  if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume().catch(()=>{});
}
addEventListener("mousedown", userGesture, { passive:true });
addEventListener("keydown", userGesture, { passive:true });
addEventListener("touchstart", userGesture, { passive:true });

addEventListener("mousedown", (e) => {
  if (e.button === 0) mouseDown = true;
  if (!game.pointerLocked && game.mode === "play") lockPointer();
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
});

addEventListener("mousemove", (e) => {
  if (!game.pointerLocked) return;
  if (game.mode !== "play") return;
  lookDelta += (e.movementX || 0);
});

const keys = new Set();
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === "r") reload();
  if (k === "escape" && game.mode === "shop") closeShop();

  // shop open/close with Q at stand
  if (k === "q") {
    if (game.mode === "shop") closeShop();
    else if (game.mode === "play" && nearShopStand()) openShop();
    else if (game.mode === "play") setHint("Find the shop stand and press Q.", false);
  }

  // weapon switching
  if (k === "1") equipSlot(0);
  if (k === "2") equipSlot(1);
  if (k === "3") equipKnife();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ---------- MAP ----------
const MAP_W = 24;
const MAP_H = 24;

const map = [
  "111111111111111111111111",
  "100000000000000000000001",
  "101111011111111011111101",
  "101000010000001010000101",
  "101011110111101011110101",
  "101010000100001010000101",
  "101010111101111010111101",
  "101010100001000010100001",
  "101110101111011110101111",
  "100000100000010000100001",
  "101111101111010111101101",
  "101000001000010100001001",
  "101011111011110101111101",
  "101010000010000101000001",
  "101010111110111101011111",
  "101010100000100001010001",
  "101110101111101111010111",
  "100000100000001000000001",
  "101111111011111011111101",
  "101000000010000010000001",
  "101011111110111110111101",
  "101000000000100000000001",
  "100000000000000000000001",
  "111111111111111111111111",
].map(r => r.split("").map(Number));

function isWall(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return true;
  return map[iy][ix] === 1;
}

// ---------- SHOP STAND OBJECT ----------
const shopStand = {
  x: 1.9,
  y: 1.9,
  r: 1.05,  // interaction radius
};

function nearShopStand() {
  return dist(player.x, player.y, shopStand.x, shopStand.y) <= shopStand.r;
}

// ---------- WEAPONS ----------
const WEAPONS = [
  { id:"pistol_rusty", name:"Rusty Pistol", type:"pistol", rarity:"Common", unlockLevel:1, price:0,  dmg:24, fireRate:3.2, magSize:8,  reloadTime:0.95, spread:0.010, range:10.5, reserveStart:32 },
  { id:"pistol_service", name:"Service Pistol", type:"pistol", rarity:"Uncommon", unlockLevel:2, price:60, dmg:28, fireRate:3.6, magSize:10, reloadTime:0.92, spread:0.010, range:11.0, reserveStart:40 },
  { id:"pistol_marksman", name:"Marksman Pistol", type:"pistol", rarity:"Rare", unlockLevel:4, price:140, dmg:36, fireRate:3.2, magSize:12, reloadTime:0.90, spread:0.008, range:12.0, reserveStart:48 },
  { id:"pistol_relic", name:"Relic Pistol", type:"pistol", rarity:"Epic", unlockLevel:7, price:320, dmg:48, fireRate:3.0, magSize:14, reloadTime:0.88, spread:0.007, range:13.0, reserveStart:56 },

  // later:
  { id:"smg_scrap", name:"Scrap SMG (Coming Soon)", type:"smg", rarity:"Common", unlockLevel:3, price:180, dmg:12, fireRate:10.0, magSize:24, reloadTime:1.15, spread:0.020, range:9.0, reserveStart:72, comingSoon:true },
  { id:"shotgun_pipe", name:"Pipe Shotgun (Coming Soon)", type:"shotgun", rarity:"Uncommon", unlockLevel:5, price:280, dmg:10, pellets:7, fireRate:1.0, magSize:5, reloadTime:1.45, spread:0.060, range:8.0, reserveStart:30, comingSoon:true },
];
function W(id){ return WEAPONS.find(w => w.id === id); }

// ---------- PLAYER ----------
const player = {
  x: 1.6, y: 1.6,
  a: 0,
  fov: Math.PI / 3,

  hp: 100, maxHp: 100,
  speed: 2.45,

  cash: 0,
  level: 1,
  xp: 0,

  dmgMult: 1,

  slots: [ structuredClone(W("pistol_rusty")), null ],
  activeSlot: 0,
  usingKnife: false,

  ammo: { mag: 8, reserve: 32, reloading: false, rt: 0, lastShot: 0 },

  knife: { dmg: 55, range: 1.1, cd: 0.45, t: 0, swing: 0 },
};

function currentWeapon() {
  if (player.usingKnife) return null;
  return player.slots[player.activeSlot];
}

function syncAmmoToWeapon(w) {
  if (!w) return;
  if (w._mag == null) w._mag = w.magSize;
  if (w._reserve == null) w._reserve = w.reserveStart ?? 32;

  player.ammo.mag = w._mag;
  player.ammo.reserve = w._reserve;
  player.ammo.reloading = false;
  player.ammo.rt = 0;

  ui.mag.textContent = w.magSize;
}

function saveAmmoFromWeapon(w) {
  if (!w) return;
  w._mag = player.ammo.mag;
  w._reserve = player.ammo.reserve;
}

function equipSlot(i) {
  if (game.mode !== "play") return;
  if (!player.slots[i]) return setHint("No weapon in that slot yet.", false);

  const prev = currentWeapon();
  if (prev) saveAmmoFromWeapon(prev);

  player.activeSlot = i;
  player.usingKnife = false;
  syncAmmoToWeapon(player.slots[i]);
  setHint(`Equipped: ${player.slots[i].name}`, true);
  saveGame();
}

function equipKnife() {
  if (game.mode !== "play") return;
  const prev = currentWeapon();
  if (prev) saveAmmoFromWeapon(prev);

  player.usingKnife = true;
  setHint("Knife equipped. Get close and click.", true);
  saveGame();
}

syncAmmoToWeapon(player.slots[0]);

// try load save once
loadGame();

// ---------- SHOP ----------
function openShop() {
  game.mode = "shop";
  ui.shop.classList.remove("hidden");
  ui.death.classList.add("hidden");
  renderShop();
  setHint("SHOP OPEN: game paused/frozen. Q / ESC to close.", true);
  saveGame();
}
function closeShop() {
  game.mode = "play";
  ui.shop.classList.add("hidden");
  setHint("Back to surviving.", true);
  saveGame();
}
ui.closeShop.addEventListener("click", closeShop);

function canBuyWeapon(w) {
  if (w.comingSoon) return { ok:false, why:"Coming soon" };
  if (player.level < w.unlockLevel) return { ok:false, why:`Requires Lv ${w.unlockLevel}` };
  if (player.cash < w.price) return { ok:false, why:`Need $${w.price}` };
  return { ok:true, why:"Buy" };
}
function ownsWeapon(id) { return player.slots.some(s => s && s.id === id); }

function giveWeapon(id) {
  const w = structuredClone(W(id));
  player.slots[1] = w; // slot 2 for now
  setHint(`Bought: ${w.name}. Slot 2 (press 2).`, true);
  saveGame();
}

function renderShop() {
  ui.shopList.innerHTML = "";

  ui.shopList.appendChild(shopButton({
    title: "Ammo Pack",
    desc: "+16 reserve ammo (current weapon)",
    price: 15,
    onClick: () => {
      if (player.cash < 15) return setHint("Not enough cash.", false);
      player.cash -= 15;
      if (!player.usingKnife) {
        player.ammo.reserve += 16;
        const w = currentWeapon();
        if (w) saveAmmoFromWeapon(w);
      }
      setHint("Bought ammo (+16).", true);
      saveGame();
      renderShop();
    }
  }));

  ui.shopList.appendChild(shopButton({
    title: "Medkit",
    desc: "Heal +35 HP",
    price: 20,
    onClick: () => {
      if (player.cash < 20) return setHint("Not enough cash.", false);
      player.cash -= 20;
      player.hp = clamp(player.hp + 35, 0, player.maxHp);
      setHint("Healed +35 HP.", true);
      saveGame();
      renderShop();
    }
  }));

  for (const w of WEAPONS.filter(x => x.type === "pistol" || x.comingSoon)) {
    const owned = ownsWeapon(w.id) || (w.id === "pistol_rusty");
    const can = canBuyWeapon(w);

    let desc = `${w.rarity} ${w.type.toUpperCase()} | Dmg ${w.dmg} | Mag ${w.magSize} | Lv ${w.unlockLevel}`;
    if (owned) desc = "Owned (equip with 1/2)";

    ui.shopList.appendChild(shopButton({
      title: w.name,
      desc,
      price: w.price,
      locked: (!can.ok && !owned) || w.comingSoon,
      lockText: w.comingSoon ? "Coming soon" : (!owned ? can.why : "Owned"),
      onClick: () => {
        if (owned) return setHint("You already own that.", false);
        if (!can.ok) return setHint(can.why, false);
        player.cash -= w.price;
        giveWeapon(w.id);
        renderShop();
      }
    }));
  }
}

function shopButton({title, desc, price, onClick, locked=false, lockText=""}) {
  const btn = document.createElement("button");
  btn.className = "shop-btn" + (locked ? " locked" : "");
  btn.innerHTML = `
    <span class="title">${title}</span>
    <span class="desc">${desc}${locked && lockText ? ` • ${lockText}` : ""}</span>
    <span class="price">${price ? "$"+price : "$0"}</span>
  `;
  btn.addEventListener("click", () => { if (!locked) onClick(); });
  return btn;
}

// ---------- ZOMBIES + DROPS ----------
let zombies = [];
let drops = [];

function spawnZombie() {
  for (let tries = 0; tries < 80; tries++) {
    const x = rand(1.5, MAP_W - 1.5);
    const y = rand(1.5, MAP_H - 1.5);
    if (isWall(x, y)) continue;
    if (dist(x, y, shopStand.x, shopStand.y) < 3.2) continue; // don't spawn right on shop
    if (dist(x, y, player.x, player.y) < 4.0) continue;

    const hp = 65 + game.wave * 10;
    zombies.push({
      x, y,
      r: 0.28,
      hp, maxHp: hp,
      speed: (0.75 + game.wave * 0.04) * (Math.random() < 0.18 ? 1.35 : 1),
      dmg: 9 + game.wave * 1.6,
      hitCd: 0,
      type: Math.random() < 0.18 ? "runner" : "walker",
      groanT: rand(1.0, 4.0),
    });
    return;
  }
}

function dropCash(x, y, amount) {
  drops.push({ x, y, amount, t: 14, r: 0.22 });
}

// ---------- COMBAT ----------
function reload() {
  if (game.mode !== "play") return;
  if (player.usingKnife) return setHint("Knife doesn't reload 😈", true);

  const w = currentWeapon();
  if (!w) return;

  if (player.ammo.reloading) return;
  if (player.ammo.mag >= w.magSize) return;
  if (player.ammo.reserve <= 0) return setHint("No reserve ammo. Buy ammo at the shop stand.", false);

  player.ammo.reloading = true;
  player.ammo.rt = 0;
  setHint("Reloading...", true);
}

function knifeAttack() {
  if (game.mode !== "play") return;
  if (player.knife.t > 0) return;

  player.knife.t = player.knife.cd;
  player.knife.swing = 0.14;
  setHint("Slash!", true);

  let best = null;
  let bestD = 999;

  for (const z of zombies) {
    const d = dist(player.x, player.y, z.x, z.y);
    if (d > player.knife.range) continue;

    const angTo = Math.atan2(z.y - player.y, z.x - player.x);
    let da = angTo - player.a;
    while (da > Math.PI) da -= Math.PI*2;
    while (da < -Math.PI) da += Math.PI*2;
    if (Math.abs(da) > 0.55) continue;
    if (d < bestD) { bestD = d; best = z; }
  }

  if (best) {
    best.hp -= player.knife.dmg;
    game.recoil = 0.16;
    sfxHit();

    if (best.hp <= 0) {
      const cash = Math.floor(rand(8, 15) + game.wave * 0.9);
      const xp = 18 + game.wave * 2;
      awardKill(best.x, best.y, cash, xp);
      zombies = zombies.filter(z => z !== best);
      setHint(`KNIFE KILL! +$${cash}, +${xp} XP`, true);
    } else {
      setHint(`Knife hit! -${player.knife.dmg}`, true);
    }
  }
}

function shoot() {
  if (game.mode !== "play") return;
  if (!game.pointerLocked) return;
  if (player.usingKnife) return knifeAttack();

  const w = currentWeapon();
  if (!w) return;

  const now = performance.now() / 1000;
  if (player.ammo.reloading) return;
  if (now - player.ammo.lastShot < 1 / w.fireRate) return;
  if (player.ammo.mag <= 0) return setHint("Empty. Press R to reload.", false);

  player.ammo.lastShot = now;
  player.ammo.mag--;

  game.muzzle = 0.06;
  game.recoil = 0.10;

  sfxGun();

  const pellets = w.pellets ?? 1;
  let didHit = false;

  for (let p = 0; p < pellets; p++) {
    const spread = (Math.random() - 0.5) * w.spread;
    const ang = player.a + spread;

    const step = 0.04;
    let hitZ = null;

    for (let d = 0; d <= w.range; d += step) {
      const rx = player.x + Math.cos(ang) * d;
      const ry = player.y + Math.sin(ang) * d;
      if (isWall(rx, ry)) break;

      for (const z of zombies) {
        if (dist(rx, ry, z.x, z.y) < z.r + 0.12) { hitZ = z; break; }
      }
      if (hitZ) break;
    }

    if (hitZ) {
      didHit = true;
      const dmg = w.dmg * player.dmgMult;
      hitZ.hp -= dmg;

      if (hitZ.hp <= 0) {
        const cash = Math.floor(rand(7, 14) + game.wave * 0.8);
        const xp = 14 + game.wave * 2;
        awardKill(hitZ.x, hitZ.y, cash, xp);
        zombies = zombies.filter(z => z !== hitZ);
      }
    }
  }

  if (didHit) {
    sfxHit();
    setHint("Hit!", true);
  }

  const cw = currentWeapon();
  if (cw) saveAmmoFromWeapon(cw);
  saveGame();
}

function awardKill(x, y, cash, xp) {
  dropCash(x, y, cash);
  gainXP(xp);
}

function gainXP(amount) {
  player.xp += amount;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    setHint(`LEVEL UP! Now Lv ${player.level}`, true);
  }
  saveGame();
}

// ---------- RAYCAST ----------
function castRay(angle) {
  const step = 0.02;
  for (let d = 0; d < 20; d += step) {
    const x = player.x + Math.cos(angle) * d;
    const y = player.y + Math.sin(angle) * d;
    if (isWall(x, y)) return d;
  }
  return 20;
}

// ---------- RENDER HELPERS ----------
function drawMinimap() {
  const w = innerWidth;

  const size = 170;
  const pad = 14;
  const x0 = w - size - pad;
  const y0 = pad;
  const cell = size / MAP_W;

  ctx.fillStyle = "rgba(10,12,16,.60)";
  ctx.fillRect(x0 - 8, y0 - 8, size + 16, size + 16);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.strokeRect(x0 - 8, y0 - 8, size + 16, size + 16);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 1) {
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
      }
    }
  }

  // shop marker
  ctx.fillStyle = "rgba(34,197,94,.95)";
  ctx.fillRect(x0 + shopStand.x * cell - 3, y0 + shopStand.y * cell - 3, 6, 6);

  // zombies
  ctx.fillStyle = "rgba(239,68,68,.85)";
  for (const z of zombies) {
    ctx.beginPath();
    ctx.arc(x0 + z.x * cell, y0 + z.y * cell, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // player + facing
  ctx.fillStyle = "rgba(96,165,250,.95)";
  ctx.beginPath();
  ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(96,165,250,.85)";
  ctx.beginPath();
  ctx.moveTo(x0 + player.x * cell, y0 + player.y * cell);
  ctx.lineTo(
    x0 + (player.x + Math.cos(player.a) * 1.3) * cell,
    y0 + (player.y + Math.sin(player.a) * 1.3) * cell
  );
  ctx.stroke();
}

function drawGunModel(dt) {
  const w = innerWidth, h = innerHeight;

  game.recoil = Math.max(0, game.recoil - dt * 2.2);
  game.muzzle = Math.max(0, game.muzzle - dt * 3.2);

  const moving = (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d"));
  const bob = moving ? Math.sin(performance.now() / 85) * 5 : 0;

  const rx = game.recoil * 26;
  const ry = game.recoil * 20;

  const baseX = w * 0.70 + rx;
  const baseY = h * 0.72 + bob + ry;

  ctx.save();
  ctx.globalAlpha = 0.98;

  // arm
  ctx.fillStyle = "rgba(190,150,120,.92)";
  ctx.fillRect(baseX - 34, baseY + 42, 100, 18);

  // glove
  ctx.fillStyle = "rgba(20,22,28,.96)";
  ctx.fillRect(baseX - 10, baseY + 34, 42, 32);

  // gun (a bit cleaner silhouette)
  ctx.fillStyle = "rgba(55,65,80,.96)";
  ctx.fillRect(baseX, baseY + 14, 128, 34);

  ctx.fillStyle = "rgba(28,32,40,.98)";
  ctx.fillRect(baseX + 10, baseY + 18, 98, 10);

  ctx.fillStyle = "rgba(40,45,56,.98)";
  ctx.fillRect(baseX + 22, baseY + 44, 40, 56);

  // barrel
  ctx.fillStyle = "rgba(18,20,26,.98)";
  ctx.fillRect(baseX + 118, baseY + 20, 28, 10);

  // muzzle flash
  if (game.muzzle > 0) {
    const a = 0.72 * (game.muzzle / 0.06);
    ctx.fillStyle = `rgba(255,210,80,${a})`;
    ctx.beginPath();
    ctx.arc(baseX + 150, baseY + 24, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // knife swing overlay
  if (player.usingKnife && player.knife.swing > 0) {
    const t = player.knife.swing / 0.14;
    ctx.fillStyle = `rgba(220,220,230,${0.32 * t})`;
    ctx.fillRect(w * 0.55, h * 0.45, w * 0.45, h * 0.55);
  }

  ctx.restore();
}

function drawShopStandBillboard(screenX, top, size) {
  // little kiosk stand sprite
  const left = screenX - size / 2;

  // pole
  ctx.fillStyle = "rgba(80,90,110,.95)";
  ctx.fillRect(left + size*0.48, top + size*0.20, size*0.04, size*0.62);

  // sign
  ctx.fillStyle = "rgba(34,197,94,.92)";
  ctx.fillRect(left + size*0.18, top + size*0.14, size*0.64, size*0.20);

  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.font = `bold ${Math.max(10, size*0.12)}px system-ui`;
  ctx.fillText("SHOP", left + size*0.26, top + size*0.28);

  // counter box
  ctx.fillStyle = "rgba(30,34,44,.92)";
  ctx.fillRect(left + size*0.20, top + size*0.50, size*0.60, size*0.26);

  // little “light”
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(left + size*0.28, top + size*0.56, size*0.44, size*0.04);
}

// ---------- RENDER ----------
function render(dt) {
  const w = innerWidth, h = innerHeight;

  // sky + floor
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#070a0f";
  ctx.fillRect(0, h / 2, w, h / 2);

  // walls
  const rays = Math.floor(w / 2);
  for (let i = 0; i < rays; i++) {
    const pct = i / (rays - 1);
    const ang = player.a - player.fov / 2 + pct * player.fov;

    let d = castRay(ang);
    d *= Math.cos(ang - player.a);

    const wallH = Math.min(h, (h * 1.2) / (d + 0.0001));
    const x = i * (w / rays);
    const y = (h / 2) - wallH / 2;

    const shade = clamp(1 - d / 9, 0, 1);
    const base = 55;
    const bright = 150 * shade;
    const c = Math.floor(base + bright);

    ctx.fillStyle = `rgb(${c},${c + 10},${c + 25})`;
    ctx.fillRect(x, y, (w / rays) + 1, wallH);

    const fog = clamp((d - 3) / 10, 0, 0.85);
    if (fog > 0) {
      ctx.fillStyle = `rgba(8,10,14,${fog})`;
      ctx.fillRect(x, y, (w / rays) + 1, wallH);
    }
  }

  // sprite list (includes shop stand)
  const sprites = [];
  for (const z of zombies) sprites.push({ kind: "z", ...z, d: dist(player.x, player.y, z.x, z.y) });
  for (const d of drops) sprites.push({ kind: "d", ...d, d: dist(player.x, player.y, d.x, d.y) });
  sprites.push({ kind: "shop", x: shopStand.x, y: shopStand.y, d: dist(player.x, player.y, shopStand.x, shopStand.y) });

  sprites.sort((a, b) => b.d - a.d);

  for (const s of sprites) {
    const dx = s.x - player.x;
    const dy = s.y - player.y;
    const distTo = Math.hypot(dx, dy);

    let ang = Math.atan2(dy, dx) - player.a;
    while (ang > Math.PI) ang -= Math.PI * 2;
    while (ang < -Math.PI) ang += Math.PI * 2;

    if (Math.abs(ang) > player.fov / 2 + 0.35) continue;

    const rayD = castRay(player.a + ang);
    if (rayD + 0.05 < distTo) continue;

    const screenX = (ang / (player.fov / 2)) * (w / 2) + (w / 2);
    const size = clamp((h * 0.90) / (distTo + 0.001), 12, h * 1.25);
    const top = h / 2 - size / 2;

    if (s.kind === "shop") {
      drawShopStandBillboard(screenX, top, size * 0.92);
      continue;
    }

    if (s.kind === "z") {
      // more detailed zombie billboard with tiny animation
      const runner = s.type === "runner";
      const bodyCol = runner ? "rgba(239,68,68,.88)" : "rgba(160,175,190,.88)";
      const darkCol = runner ? "rgba(120,20,20,.9)" : "rgba(70,80,95,.9)";
      const bob = Math.sin(performance.now() / 130 + s.x * 2.1) * (size * 0.02);

      const left = screenX - size / 2;

      // legs
      ctx.fillStyle = darkCol;
      ctx.fillRect(left + size*0.36, top + size*0.72 + bob, size*0.10, size*0.22);
      ctx.fillRect(left + size*0.54, top + size*0.72 + bob, size*0.10, size*0.22);

      // torso
      ctx.fillStyle = bodyCol;
      ctx.fillRect(left + size*0.32, top + size*0.34 + bob, size*0.42, size*0.46);

      // head
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.arc(screenX, top + size*0.24 + bob, size*0.14, 0, Math.PI*2);
      ctx.fill();

      // arms
      ctx.fillStyle = darkCol;
      ctx.fillRect(left + size*0.20, top + size*0.42 + bob, size*0.12, size*0.30);
      ctx.fillRect(left + size*0.72, top + size*0.42 + bob, size*0.12, size*0.30);

      // eyes
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(screenX - size*0.06, top + size*0.22 + bob, size*0.04, size*0.03);
      ctx.fillRect(screenX + size*0.02, top + size*0.22 + bob, size*0.04, size*0.03);

      // health bar
      const pct = clamp(s.hp / s.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(left, top - 10, size, 6);
      ctx.fillStyle = "rgba(34,197,94,.9)";
      ctx.fillRect(left, top - 10, size * pct, 6);
    } else {
      // cash drop
      ctx.fillStyle = "rgba(34,197,94,.9)";
      ctx.beginPath();
      ctx.arc(screenX, h / 2 + size * 0.18, Math.max(6, size * 0.09), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#06120a";
      ctx.font = "bold 14px system-ui";
      ctx.fillText("$", screenX - 4, h / 2 + size * 0.18 + 5);
    }
  }

  // crosshair
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 3, cy);
  ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 3);
  ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  drawMinimap();
  drawGunModel(dt);

  // prompt near shop stand
  if (nearShopStand() && game.mode === "play") {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(w * 0.37, h * 0.62, w * 0.26, 36);
    ctx.fillStyle = "rgba(34,197,94,.95)";
    ctx.font = "bold 16px system-ui";
    ctx.fillText("Press Q to open Shop", w * 0.39, h * 0.645);
  }
}

// ---------- DEATH + RESTART ----------
function die() {
  game.mode = "dead";
  ui.shop.classList.add("hidden");
  ui.death.classList.remove("hidden");
  setHint("You died. Click Restart.", false);
  document.exitPointerLock?.();
  saveGame();
}

ui.restart.addEventListener("click", () => {
  zombies = [];
  drops = [];
  game.wave = 1;
  game.t = 0;
  game.mode = "play";

  ui.shop.classList.add("hidden");
  ui.death.classList.add("hidden");

  player.x = 1.6; player.y = 1.6; player.a = 0;
  player.hp = player.maxHp;

  // keep your save progression, but reset wave pressure
  setHint("Restarted. Progress kept. Click to lock mouse.", true);
  saveGame();
});

// ---------- LOOP ----------
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  // UI
  ui.hp.textContent = Math.max(0, Math.floor(player.hp));
  ui.cash.textContent = player.cash;
  ui.wave.textContent = game.wave;
  ui.level.textContent = player.level;
  ui.xp.textContent = player.xp;

  if (player.usingKnife) {
    ui.weapon.textContent = "Knife";
    ui.ammo.textContent = "-";
    ui.mag.textContent = "-";
    ui.reserve.textContent = "-";
  } else {
    const w = currentWeapon();
    ui.weapon.textContent = w ? w.name : "None";
    ui.ammo.textContent = player.ammo.mag;
    ui.reserve.textContent = player.ammo.reserve;
    ui.mag.textContent = w ? w.magSize : "-";
  }

  render(dt);

  // autosave timer
  saveTimer += dt;
  if (saveTimer >= 10) {
    saveTimer = 0;
    saveGame();
  }

  // timers
  if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
  if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

  if (game.mode !== "play") return;

  // wave timer
  game.t += dt;
  if (game.t > game.wave * 25) game.wave++;

  // reload
  const wpn = currentWeapon();
  if (!player.usingKnife && wpn && player.ammo.reloading) {
    player.ammo.rt += dt;
    if (player.ammo.rt >= wpn.reloadTime) {
      const need = wpn.magSize - player.ammo.mag;
      const take = Math.min(need, player.ammo.reserve);
      player.ammo.reserve -= take;
      player.ammo.mag += take;
      player.ammo.reloading = false;
      setHint("Reloaded.", true);
      saveAmmoFromWeapon(wpn);
      saveGame();
    }
  }

  // look
  player.a += lookDelta * 0.0022;
  lookDelta = 0;

  // move
  let mx = 0, my = 0;
  if (keys.has("w")) { mx += Math.cos(player.a); my += Math.sin(player.a); }
  if (keys.has("s")) { mx -= Math.cos(player.a); my -= Math.sin(player.a); }
  if (keys.has("a")) { mx += Math.cos(player.a - Math.PI / 2); my += Math.sin(player.a - Math.PI / 2); }
  if (keys.has("d")) { mx += Math.cos(player.a + Math.PI / 2); my += Math.sin(player.a + Math.PI / 2); }

  const len = Math.hypot(mx, my) || 1;
  mx /= len; my /= len;

  const nx = player.x + mx * player.speed * dt;
  const ny = player.y + my * player.speed * dt;

  if (!isWall(nx, player.y)) player.x = nx;
  if (!isWall(player.x, ny)) player.y = ny;

  // spawn zombies
  const target = 4 + game.wave * 2;
  if (zombies.length < target && Math.random() < 0.08 + game.wave * 0.002) spawnZombie();

  // zombie AI + groans
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    z.hitCd = Math.max(0, z.hitCd - dt);

    // groan timer
    z.groanT -= dt;
    if (z.groanT <= 0) {
      z.groanT = rand(2.0, 5.5);
      const d = dist(player.x, player.y, z.x, z.y);
      sfxZombie(d);
    }

    const ang = Math.atan2(player.y - z.y, player.x - z.x);
    let spz = z.speed * (z.type === "runner" ? 1.18 : 1);

    const zx = z.x + Math.cos(ang) * spz * dt;
    const zy = z.y + Math.sin(ang) * spz * dt;
    if (!isWall(zx, z.y)) z.x = zx;
    if (!isWall(z.x, zy)) z.y = zy;

    const d = dist(player.x, player.y, z.x, z.y);
    if (d < 0.55 && z.hitCd <= 0) {
      z.hitCd = 0.6;
      player.hp -= z.dmg;
      setHint("You’re getting chewed! Back up!", false);
      if (player.hp <= 0) die();
      saveGame();
    }
  }

  // pickups
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t -= dt;
    if (dist(player.x, player.y, d.x, d.y) < 0.55) {
      player.cash += d.amount;
      drops.splice(i, 1);
      setHint(`Picked up $${d.amount}.`, true);
      saveGame();
      continue;
    }
    if (d.t <= 0) drops.splice(i, 1);
  }

  // shooting
  if (mouseDown) shoot();

  // near shop hint
  if (nearShopStand()) setHint("At Shop Stand: press Q.", true);
}

setHint("Click to play. Find the SHOP stand. Press Q to open it.");
requestAnimationFrame(tick);

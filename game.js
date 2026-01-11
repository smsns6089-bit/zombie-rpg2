// Project Game Maker: Zombie RPG FPS (Raycast)
// Added: gun model + minimap + weapon shop + 2 weapons + knife + 1/2/3 switching + XP/levels + better zombie render

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

// ---------- GAME STATE ----------
const game = {
  mode: "play", // play | shop | dead
  pointerLocked: false,
  wave: 1,
  t: 0,

  // gun effects
  recoil: 0,
  muzzle: 0,
};

let mouseDown = false;
let lookDelta = 0;

function lockPointer() { canvas.requestPointerLock?.(); }
document.addEventListener("pointerlockchange", () => {
  game.pointerLocked = (document.pointerLockElement === canvas);
});

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

  if (k === "e") {
    if (game.mode === "play" && inSafe()) openShop();
    else if (game.mode === "shop") closeShop();
  }
  if (k === "escape" && game.mode === "shop") closeShop();

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

// safe zone moved into open space
const safeZone = { x: 1.6, y: 1.6, r: 2.2 };
function inSafe() { return dist(player.x, player.y, safeZone.x, safeZone.y) <= safeZone.r; }

// ---------- RPG: XP / LEVEL ----------
function xpToNext(level) {
  // smooth but grindy
  return Math.floor(60 + (level - 1) * 40 + Math.pow(level - 1, 1.35) * 25);
}

// ---------- WEAPONS ----------
const WEAPONS = [
  // Pistols (tiered)
  { id:"pistol_rusty", name:"Rusty Pistol", type:"pistol", rarity:"Common", unlockLevel:1, price:0,  dmg:24, fireRate:3.2, magSize:8,  reloadTime:0.95, spread:0.010, range:10.5, reserveStart:32 },
  { id:"pistol_service", name:"Service Pistol", type:"pistol", rarity:"Uncommon", unlockLevel:2, price:60, dmg:28, fireRate:3.6, magSize:10, reloadTime:0.92, spread:0.010, range:11.0, reserveStart:40 },
  { id:"pistol_marksman", name:"Marksman Pistol", type:"pistol", rarity:"Rare", unlockLevel:4, price:140, dmg:36, fireRate:3.2, magSize:12, reloadTime:0.90, spread:0.008, range:12.0, reserveStart:48 },
  { id:"pistol_relic", name:"Relic Pistol", type:"pistol", rarity:"Epic", unlockLevel:7, price:320, dmg:48, fireRate:3.0, magSize:14, reloadTime:0.88, spread:0.007, range:13.0, reserveStart:56 },

  // Preview (locked for later)
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

  // loadout: 2 weapons + knife
  slots: [ W("pistol_rusty"), null ],
  activeSlot: 0,
  usingKnife: false,

  ammo: {
    mag: 8,
    reserve: 32,
    reloading: false,
    rt: 0,
    lastShot: 0,
  },

  knife: {
    dmg: 55,
    range: 1.1,
    cd: 0.45,
    t: 0,
    swing: 0,
  }
};

function currentWeapon() {
  if (player.usingKnife) return null;
  return player.slots[player.activeSlot];
}

function syncAmmoToWeapon(w) {
  if (!w) return;
  // if first time equipping and ammo undefined, set defaults
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
}

function equipKnife() {
  if (game.mode !== "play") return;
  const prev = currentWeapon();
  if (prev) saveAmmoFromWeapon(prev);

  player.usingKnife = true;
  setHint("Knife equipped. Get close and click.", true);
}

syncAmmoToWeapon(player.slots[0]);

// ---------- SHOP ----------
function openShop() {
  game.mode = "shop";
  ui.shop.classList.remove("hidden");
  ui.death.classList.add("hidden");
  renderShop();
  setHint("SHOP OPEN: game paused. E / ESC to close.", true);
}
function closeShop() {
  game.mode = "play";
  ui.shop.classList.add("hidden");
  setHint("Back to surviving.", true);
}
ui.closeShop.addEventListener("click", closeShop);

function canBuyWeapon(w) {
  if (w.comingSoon) return { ok:false, why:"Coming soon" };
  if (player.level < w.unlockLevel) return { ok:false, why:`Requires Lv ${w.unlockLevel}` };
  if (player.cash < w.price) return { ok:false, why:`Need $${w.price}` };
  return { ok:true, why:"Buy" };
}

function ownsWeapon(id) {
  return player.slots.some(s => s && s.id === id);
}

function giveWeapon(id) {
  const w = structuredClone(W(id));
  // put into slot 2 if empty, else replace slot 2
  player.slots[1] = w;
  setHint(`Bought: ${w.name}. Equipped to slot 2 (press 2).`, true);
}

function renderShop() {
  ui.shopList.innerHTML = "";

  // buy ammo
  ui.shopList.appendChild(shopButton({
    title: "Ammo Pack",
    desc: "+16 reserve ammo",
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
      renderShop();
    }
  }));

  // medkit
  ui.shopList.appendChild(shopButton({
    title: "Medkit",
    desc: "Heal +35 HP",
    price: 20,
    onClick: () => {
      if (player.cash < 20) return setHint("Not enough cash.", false);
      player.cash -= 20;
      player.hp = clamp(player.hp + 35, 0, player.maxHp);
      setHint("Healed +35 HP.", true);
      renderShop();
    }
  }));

  // weapon list
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
    if (dist(x, y, safeZone.x, safeZone.y) < safeZone.r + 2.5) continue;
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
  if (player.ammo.reserve <= 0) return setHint("No reserve ammo. Buy ammo in shop.", false);

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

  // hit nearest zombie in front-ish
  let best = null;
  let bestD = 999;

  for (const z of zombies) {
    const d = dist(player.x, player.y, z.x, z.y);
    if (d > player.knife.range) continue;

    const angTo = Math.atan2(z.y - player.y, z.x - player.x);
    let da = angTo - player.a;
    while (da > Math.PI) da -= Math.PI*2;
    while (da < -Math.PI) da += Math.PI*2;

    if (Math.abs(da) > 0.55) continue; // cone
    if (d < bestD) { bestD = d; best = z; }
  }

  if (best) {
    best.hp -= player.knife.dmg;
    game.recoil = 0.16;

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

  // gun effects
  game.muzzle = 0.06;
  game.recoil = 0.10;

  // hitscan with small spread
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

  if (didHit) setHint("Hit!", true);
}

// reward handler
function awardKill(x, y, cash, xp) {
  dropCash(x, y, cash);
  gainXP(xp);
}

function gainXP(amount) {
  player.xp += amount;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    setHint(`LEVEL UP! You are now Lv ${player.level}`, true);
  }
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
  const w = innerWidth, h = innerHeight;

  const size = 170;
  const pad = 14;
  const x0 = w - size - pad;
  const y0 = pad;
  const cell = size / MAP_W;

  // background
  ctx.fillStyle = "rgba(10,12,16,.60)";
  ctx.fillRect(x0 - 8, y0 - 8, size + 16, size + 16);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.strokeRect(x0 - 8, y0 - 8, size + 16, size + 16);

  // map
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 1) {
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
      }
    }
  }

  // safe zone circle
  ctx.strokeStyle = "rgba(34,197,94,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + safeZone.x * cell, y0 + safeZone.y * cell, safeZone.r * cell, 0, Math.PI * 2);
  ctx.stroke();

  // zombies dots
  ctx.fillStyle = "rgba(239,68,68,.85)";
  for (const z of zombies) {
    ctx.beginPath();
    ctx.arc(x0 + z.x * cell, y0 + z.y * cell, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // player dot + facing
  ctx.fillStyle = "rgba(34,197,94,.95)";
  ctx.beginPath();
  ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(34,197,94,.85)";
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

  // recoil smoothing
  game.recoil = Math.max(0, game.recoil - dt * 1.8);
  game.muzzle = Math.max(0, game.muzzle - dt * 2.8);

  const bob = (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d"))
    ? Math.sin(performance.now() / 90) * 6
    : 0;

  const rx = game.recoil * 28;
  const ry = game.recoil * 24;

  const baseX = w * 0.70 + rx;
  const baseY = h * 0.72 + bob + ry;

  // arm
  ctx.fillStyle = "rgba(180,140,110,.92)";
  ctx.fillRect(baseX - 30, baseY + 40, 95, 20);

  // glove
  ctx.fillStyle = "rgba(25,28,34,.95)";
  ctx.fillRect(baseX - 10, baseY + 34, 38, 32);

  // gun body
  ctx.fillStyle = "rgba(60,70,85,.95)";
  ctx.fillRect(baseX, baseY + 10, 120, 40);

  // slide detail
  ctx.fillStyle = "rgba(30,34,42,.95)";
  ctx.fillRect(baseX + 10, baseY + 16, 90, 12);

  // grip
  ctx.fillStyle = "rgba(40,45,56,.98)";
  ctx.fillRect(baseX + 20, baseY + 40, 38, 55);

  // barrel
  ctx.fillStyle = "rgba(25,28,34,.98)";
  ctx.fillRect(baseX + 110, baseY + 18, 26, 12);

  // muzzle flash
  if (game.muzzle > 0) {
    ctx.fillStyle = `rgba(255,210,80,${0.70 * (game.muzzle / 0.06)})`;
    ctx.beginPath();
    ctx.arc(baseX + 140, baseY + 24, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // knife swing overlay (if knife)
  if (player.usingKnife && player.knife.swing > 0) {
    const t = player.knife.swing / 0.14;
    ctx.fillStyle = `rgba(220,220,230,${0.35 * t})`;
    ctx.fillRect(w * 0.55, h * 0.45, w * 0.45, h * 0.55);
  }
}

// ---------- RENDER ----------
function render(dt) {
  const w = innerWidth, h = innerHeight;

  // sky + floor
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#070a0f";
  ctx.fillRect(0, h / 2, w, h / 2);

  // walls (solid + dark)
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

  // sprites
  const sprites = [];
  for (const z of zombies) sprites.push({ kind: "z", ...z, d: dist(player.x, player.y, z.x, z.y) });
  for (const d of drops) sprites.push({ kind: "d", ...d, d: dist(player.x, player.y, d.x, d.y) });
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
    const size = clamp((h * 0.90) / (distTo + 0.001), 10, h * 1.25);
    const top = h / 2 - size / 2;
    const left = screenX - size / 2;

    if (s.kind === "z") {
      // better zombie model: body + head + arms (billboard)
      const runner = s.type === "runner";
      const bodyCol = runner ? "rgba(239,68,68,.88)" : "rgba(148,163,184,.88)";
      const darkCol = runner ? "rgba(120,20,20,.9)" : "rgba(60,70,85,.9)";

      // body
      ctx.fillStyle = bodyCol;
      ctx.fillRect(left + size*0.30, top + size*0.28, size*0.40, size*0.52);

      // head
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.arc(screenX, top + size*0.22, size*0.14, 0, Math.PI*2);
      ctx.fill();

      // arms
      ctx.fillStyle = darkCol;
      ctx.fillRect(left + size*0.18, top + size*0.36, size*0.14, size*0.22);
      ctx.fillRect(left + size*0.68, top + size*0.36, size*0.14, size*0.22);

      // eyes
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(screenX - size*0.06, top + size*0.20, size*0.04, size*0.03);
      ctx.fillRect(screenX + size*0.02, top + size*0.20, size*0.04, size*0.03);

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

  // safe zone tint
  if (inSafe()) {
    ctx.fillStyle = "rgba(34,197,94,.06)";
    ctx.fillRect(0, 0, w, h);
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

  // minimap
  drawMinimap();

  // gun overlay
  drawGunModel(dt);
}

// ---------- DEATH + RESTART ----------
function die() {
  game.mode = "dead";
  ui.shop.classList.add("hidden");
  ui.death.classList.remove("hidden");
  setHint("You died. Click Restart.", false);
  document.exitPointerLock?.();
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
  player.cash = 0;
  player.level = 1;
  player.xp = 0;
  player.dmgMult = 1;

  // reset weapons
  player.slots = [ W("pistol_rusty"), null ];
  player.activeSlot = 0;
  player.usingKnife = false;
  syncAmmoToWeapon(player.slots[0]);

  setHint("Restarted. Click to lock mouse.", true);
});

// ---------- LOOP ----------
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  // UI update
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

  // always render
  render(dt);

  // timers
  if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
  if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

  if (game.mode !== "play") return;

  // wave timer
  game.t += dt;
  if (game.t > game.wave * 25) game.wave++;

  // reload tick
  const w = currentWeapon();
  if (!player.usingKnife && w && player.ammo.reloading) {
    player.ammo.rt += dt;
    if (player.ammo.rt >= w.reloadTime) {
      const need = w.magSize - player.ammo.mag;
      const take = Math.min(need, player.ammo.reserve);
      player.ammo.reserve -= take;
      player.ammo.mag += take;
      player.ammo.reloading = false;
      setHint("Reloaded.", true);

      saveAmmoFromWeapon(w);
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

  const sp = player.speed * (inSafe() ? 1.08 : 1);
  const nx = player.x + mx * sp * dt;
  const ny = player.y + my * sp * dt;

  if (!isWall(nx, player.y)) player.x = nx;
  if (!isWall(player.x, ny)) player.y = ny;

  // spawn zombies
  const target = 4 + game.wave * 2;
  if (zombies.length < target && Math.random() < 0.08 + game.wave * 0.002) spawnZombie();

  // zombie AI
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    z.hitCd = Math.max(0, z.hitCd - dt);

    const ang = Math.atan2(player.y - z.y, player.x - z.x);
    let spz = z.speed * (z.type === "runner" ? 1.18 : 1);
    if (dist(z.x, z.y, safeZone.x, safeZone.y) < safeZone.r) spz *= 0.25;

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
      continue;
    }
    if (d.t <= 0) drops.splice(i, 1);
  }

  // shooting
  if (mouseDown) shoot();

  // safe hint
  if (inSafe()) setHint("SAFE ZONE: press E to shop.", true);

  // keep weapon ammo synced
  if (!player.usingKnife) {
    const cw = currentWeapon();
    if (cw) saveAmmoFromWeapon(cw);
  }
}

setHint("Click to play. Survive. Loot cash. Shop + level up.");
requestAnimationFrame(tick);

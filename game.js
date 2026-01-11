// Project Game Maker: Zombie FPS (Raycasting) - FULL VERSION (DARK WALL FIX INCLUDED)
// Controls: Click to lock mouse | WASD | R reload | E shop (safe zone) | ESC close shop

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- UI ----------
const ui = {
  hp: document.getElementById("hp"),
  ammo: document.getElementById("ammo"),
  mag: document.getElementById("mag"),
  reserve: document.getElementById("reserve"),
  cash: document.getElementById("cash"),
  wave: document.getElementById("wave"),
  hint: document.getElementById("hint"),

  shop: document.getElementById("shop"),
  closeShop: document.getElementById("closeShop"),
  buyAmmo: document.getElementById("buyAmmo"),
  buyMed: document.getElementById("buyMed"),
  buyDmg: document.getElementById("buyDmg"),

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
};

let mouseDown = false;
let lookDelta = 0;

function lockPointer() {
  canvas.requestPointerLock?.();
}
document.addEventListener("pointerlockchange", () => {
  game.pointerLocked = (document.pointerLockElement === canvas);
});

addEventListener("mousedown", () => {
  mouseDown = true;
  if (!game.pointerLocked && game.mode === "play") lockPointer();
});
addEventListener("mouseup", () => (mouseDown = false));

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
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ---------- SHOP OVERLAYS ----------
function openShop() {
  game.mode = "shop";
  ui.shop.classList.remove("hidden");
  ui.death.classList.add("hidden"); // prevent stacking
  setHint("SHOP OPEN: game paused. E or ESC to close.", true);
}
function closeShop() {
  game.mode = "play";
  ui.shop.classList.add("hidden");
  setHint("Back to surviving.", true);
}
ui.closeShop.addEventListener("click", closeShop);

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

const safeZone = { x: 2.5, y: 2.5, r: 2.2 };
function inSafe() {
  return dist(player.x, player.y, safeZone.x, safeZone.y) <= safeZone.r;
}

// ---------- PLAYER ----------
const player = {
  x: 2.6, y: 2.6,
  a: 0,
  fov: Math.PI / 3,
  hp: 100, maxHp: 100,
  speed: 2.4,
  cash: 0,
  dmgMult: 1,
  gun: {
    magSize: 8,
    ammo: 8,
    reserve: 32,
    fireRate: 3.2,
    lastShot: 0,
    reloadTime: 0.95,
    reloading: false,
    rt: 0,
    dmg: 30,
    range: 10.5,
  }
};
ui.mag.textContent = player.gun.magSize;

// ---------- SHOP BUYS ----------
ui.buyAmmo.addEventListener("click", () => {
  if (player.cash < 15) return setHint("Not enough cash.", false);
  player.cash -= 15;
  player.gun.reserve += 16;
  setHint("Bought ammo (+16).", true);
});
ui.buyMed.addEventListener("click", () => {
  if (player.cash < 20) return setHint("Not enough cash.", false);
  player.cash -= 20;
  player.hp = clamp(player.hp + 35, 0, player.maxHp);
  setHint("Healed +35 HP.", true);
});
ui.buyDmg.addEventListener("click", () => {
  if (player.cash < 40) return setHint("Not enough cash.", false);
  player.cash -= 40;
  player.dmgMult *= 1.2;
  setHint("Damage up (+20%).", true);
});

// ---------- ENEMIES + DROPS ----------
let zombies = [];
let drops = [];

function spawnZombie() {
  for (let tries = 0; tries < 60; tries++) {
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
  const g = player.gun;
  if (g.reloading) return;
  if (g.ammo >= g.magSize) return;
  if (g.reserve <= 0) return setHint("No reserve ammo. Buy ammo in shop.", false);
  g.reloading = true;
  g.rt = 0;
  setHint("Reloading...", true);
}

function shoot() {
  if (game.mode !== "play") return;
  if (!game.pointerLocked) return;

  const g = player.gun;
  const now = performance.now() / 1000;
  if (g.reloading) return;
  if (now - g.lastShot < 1 / g.fireRate) return;
  if (g.ammo <= 0) return setHint("Empty. Press R to reload.", false);

  g.lastShot = now;
  g.ammo--;

  const step = 0.04;
  let hitZ = null;

  for (let d = 0; d <= g.range; d += step) {
    const rx = player.x + Math.cos(player.a) * d;
    const ry = player.y + Math.sin(player.a) * d;
    if (isWall(rx, ry)) break;

    for (const z of zombies) {
      if (dist(rx, ry, z.x, z.y) < z.r + 0.12) {
        hitZ = z;
        break;
      }
    }
    if (hitZ) break;
  }

  if (hitZ) {
    const dmg = g.dmg * player.dmgMult;
    hitZ.hp -= dmg;

    if (hitZ.hp <= 0) {
      const amt = Math.floor(rand(7, 14) + game.wave * 0.8);
      dropCash(hitZ.x, hitZ.y, amt);
      zombies = zombies.filter(z => z !== hitZ);
      setHint(`Zombie down. Dropped $${amt}.`, true);
    } else {
      setHint(`Hit! -${Math.floor(dmg)}`, true);
    }
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

// ---------- RENDER (DARK WALL FIX) ----------
function render() {
  const w = innerWidth, h = innerHeight;

  // sky + floor
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#070a0f";
  ctx.fillRect(0, h / 2, w, h / 2);

  // walls (SOLID + DARK so it never turns white)
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
    const base = 50;
    const bright = 150 * shade;
    const c = Math.floor(base + bright);

    ctx.fillStyle = `rgb(${c},${c + 10},${c + 25})`;
    ctx.fillRect(x, y, (w / rays) + 1, wallH);

    // fog overlay
    const fog = clamp((d - 3) / 10, 0, 0.85);
    if (fog > 0) {
      ctx.fillStyle = `rgba(8,10,14,${fog})`;
      ctx.fillRect(x, y, (w / rays) + 1, wallH);
    }
  }

  // sprites (zombies + drops) sorted far -> near
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
    const size = clamp((h * 0.85) / (distTo + 0.001), 10, h * 1.2);
    const top = h / 2 - size / 2;
    const left = screenX - size / 2;

    if (s.kind === "z") {
      ctx.fillStyle = s.type === "runner" ? "rgba(239,68,68,.9)" : "rgba(148,163,184,.9)";
      ctx.fillRect(left, top, size, size);

      const pct = clamp(s.hp / s.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(left, top - 10, size, 6);
      ctx.fillStyle = "rgba(34,197,94,.9)";
      ctx.fillRect(left, top - 10, size * pct, 6);
    } else {
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
}

// ---------- DEATH + RESTART ----------
function die() {
  game.mode = "dead";
  ui.shop.classList.add("hidden"); // force close shop always
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

  player.x = 2.6; player.y = 2.6; player.a = 0;
  player.hp = player.maxHp;
  player.cash = 0;
  player.dmgMult = 1;
  player.gun.ammo = player.gun.magSize;
  player.gun.reserve = 32;
  player.gun.reloading = false;

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
  ui.ammo.textContent = player.gun.ammo;
  ui.reserve.textContent = player.gun.reserve;
  ui.cash.textContent = player.cash;
  ui.wave.textContent = game.wave;

  // always draw
  render();

  if (game.mode !== "play") return;

  game.t += dt;
  if (game.t > game.wave * 25) game.wave++;

  // reload tick
  const g = player.gun;
  if (g.reloading) {
    g.rt += dt;
    if (g.rt >= g.reloadTime) {
      const need = g.magSize - g.ammo;
      const take = Math.min(need, g.reserve);
      g.reserve -= take;
      g.ammo += take;
      g.reloading = false;
      setHint("Reloaded.", true);
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

  // pick up drops
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

  // shoot
  if (mouseDown) shoot();

  if (inSafe()) setHint("SAFE ZONE: press E to shop.", true);
}

setHint("Click to play. Survive. Loot cash. Shop in SAFE ZONE.");
requestAnimationFrame(tick);

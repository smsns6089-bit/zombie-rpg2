// Project Game Maker: Zombie FPS (Raycasting Prototype)
// No libraries. Click to lock mouse. WASD move. R reload. E shop in safe zone.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  hp: document.getElementById("hp"),
  ammo: document.getElementById("ammo"),
  mag: document.getElementById("mag"),
  reserve: document.getElementById("reserve"),
  cash: document.getElementById("cash"),
  wave: document.getElementById("wave"),
  hint: document.getElementById("hint"),
  shop: document.getElementById("shop"),
  death: document.getElementById("death"),
  restart: document.getElementById("restart"),
  closeShop: document.getElementById("closeShop"),
  buyAmmo: document.getElementById("buyAmmo"),
  buyMed: document.getElementById("buyMed"),
  buyDmg: document.getElementById("buyDmg"),
};

function fit() {
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize", fit);
fit();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function rand(a,b){ return a + Math.random()*(b-a); }

function setHint(t, ok=false){
  ui.hint.textContent = t || "";
  ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
}
setHint("Click to start. Survive, loot cash, shop in SAFE ZONE.");

const keys = new Set();
addEventListener("keydown", e=>{
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase()==="r") reload();
  if (e.key.toLowerCase()==="e") toggleShop();
});
addEventListener("keyup", e=> keys.delete(e.key.toLowerCase()));

let mouseDown = false;
addEventListener("mousedown", e=>{
  mouseDown = true;
  if (!state.pointerLocked) lockPointer();
});
addEventListener("mouseup", ()=> mouseDown=false);

// Pointer lock for mouse look
const state = {
  pointerLocked: false,
  alive: true,
  shopOpen: false,
  t: 0,
  wave: 1,
};

function lockPointer(){
  canvas.requestPointerLock?.();
}
document.addEventListener("pointerlockchange", ()=>{
  state.pointerLocked = (document.pointerLockElement === canvas);
});

let lookDelta = 0;
addEventListener("mousemove", (e)=>{
  if (!state.pointerLocked || state.shopOpen || !state.alive) return;
  lookDelta += e.movementX || 0;
});

// Map (0 = empty, 1 = wall)
const MAP_W = 24;
const MAP_H = 24;

// Handmade map so it feels like a tiny neighborhood
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
].map(r=> r.split("").map(c=> Number(c)));

const safeZone = { x: 2.5, y: 2.5, r: 2.2 }; // in map units

function isWall(x,y){
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix<0||iy<0||ix>=MAP_W||iy>=MAP_H) return true;
  return map[iy][ix] === 1;
}
function inSafe(){
  return dist(player.x, player.y, safeZone.x, safeZone.y) <= safeZone.r;
}

// Player
const player = {
  x: 2.6, y: 2.6,
  a: 0, // angle
  fov: Math.PI/3,
  hp: 100, maxHp: 100,
  speed: 2.4,
  cash: 0,
  dmgMult: 1,
  gun: {
    magSize: 8,
    ammo: 8,
    reserve: 32,
    fireRate: 3.2, // shots/sec
    lastShot: 0,
    reloadTime: 0.95,
    reloading: false,
    rt: 0,
    dmg: 30,
    range: 10.5,
  }
};

ui.mag.textContent = player.gun.magSize;

function reload(){
  const g = player.gun;
  if (g.reloading) return;
  if (g.ammo >= g.magSize) return;
  if (g.reserve <= 0) return setHint("No reserve ammo. Buy ammo in shop.");
  g.reloading = true; g.rt = 0;
  setHint("Reloading...");
}

function toggleShop(){
  if (!state.alive) return;
  if (!inSafe()) return;
  state.shopOpen = !state.shopOpen;
  ui.shop.classList.toggle("hidden", !state.shopOpen);
  setHint(state.shopOpen ? "Shopping time." : "Back to surviving.", true);
}

ui.closeShop.addEventListener("click", ()=>{
  state.shopOpen = false;
  ui.shop.classList.add("hidden");
});
ui.buyAmmo.addEventListener("click", ()=>{
  if (player.cash < 15) return setHint("Not enough cash.");
  player.cash -= 15;
  player.gun.reserve += 16;
  setHint("Bought ammo (+16).", true);
});
ui.buyMed.addEventListener("click", ()=>{
  if (player.cash < 20) return setHint("Not enough cash.");
  player.cash -= 20;
  player.hp = clamp(player.hp + 35, 0, player.maxHp);
  setHint("Healed +35 HP.", true);
});
ui.buyDmg.addEventListener("click", ()=>{
  if (player.cash < 40) return setHint("Not enough cash.");
  player.cash -= 40;
  player.dmgMult *= 1.2;
  setHint("Damage up! (+20%)", true);
});

// Enemies + drops
let zombies = [];
let drops = [];

function spawnZombie(){
  // Spawn in empty cell away from safe zone
  for (let tries=0; tries<50; tries++){
    const x = rand(1.5, MAP_W-1.5);
    const y = rand(1.5, MAP_H-1.5);
    if (isWall(x,y)) continue;
    if (dist(x,y, safeZone.x, safeZone.y) < safeZone.r + 2.5) continue;
    if (dist(x,y, player.x, player.y) < 4.0) continue;

    const hp = 65 + state.wave*10;
    zombies.push({
      x,y,
      r: 0.28,
      hp, maxHp: hp,
      speed: (0.75 + state.wave*0.04) * (Math.random()<0.18 ? 1.35 : 1),
      dmg: 9 + state.wave*1.6,
      hitCd: 0,
      type: Math.random()<0.18 ? "runner" : "walker",
    });
    return;
  }
}

function dropCash(x,y, amount){
  drops.push({ x, y, amount, t: 14, r: 0.22 });
}

// Shooting uses hitscan (ray)
function shoot(){
  const g = player.gun;
  const now = performance.now()/1000;
  if (g.reloading || state.shopOpen) return;
  if (now - g.lastShot < 1/g.fireRate) return;
  if (g.ammo <= 0) return setHint("Empty. Press R to reload.");
  g.lastShot = now;
  g.ammo--;

  // Ray march until wall or range, check zombie line-of-sight hit
  const step = 0.04;
  let hitZ = null, hitDist = Infinity;

  for (let d=0; d<=g.range; d+=step){
    const rx = player.x + Math.cos(player.a)*d;
    const ry = player.y + Math.sin(player.a)*d;
    if (isWall(rx,ry)) break;

    for (const z of zombies){
      const dz = dist(rx, ry, z.x, z.y);
      if (dz < z.r + 0.12){
        hitZ = z;
        hitDist = d;
        break;
      }
    }
    if (hitZ) break;
  }

  if (hitZ){
    const dmg = g.dmg * player.dmgMult;
    hitZ.hp -= dmg;
    setHint(`Hit! -${Math.floor(dmg)}`, true);
    if (hitZ.hp <= 0){
      const amt = Math.floor(rand(7, 14) + state.wave*0.8);
      dropCash(hitZ.x, hitZ.y, amt);
      zombies = zombies.filter(z=> z!==hitZ);
      setHint(`Zombie down. Dropped $${amt}.`, true);
    }
  }
}

// Rendering (raycasting)
function castRay(angle){
  const step = 0.02;
  for (let d=0; d<20; d+=step){
    const x = player.x + Math.cos(angle)*d;
    const y = player.y + Math.sin(angle)*d;
    if (isWall(x,y)) return d;
  }
  return 20;
}

function render(){
  const w = innerWidth, h = innerHeight;

  // sky + floor
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0,0,w,h/2);
  ctx.fillStyle = "#070a0f";
  ctx.fillRect(0,h/2,w,h/2);

  // walls
  const rays = Math.floor(w/2); // quality/perf
  const fov = player.fov;
  for (let i=0; i<rays; i++){
    const pct = i/(rays-1);
    const ang = player.a - fov/2 + pct*fov;

    let d = castRay(ang);
    // fish-eye correction
    d *= Math.cos(ang - player.a);

    const wallH = Math.min(h, (h*1.2)/(d+0.0001));
    const x = (i*(w/rays));
    const y = (h/2) - wallH/2;

    const shade = clamp(1 - d/10, 0.08, 1);
    ctx.fillStyle = `rgba(160,170,190,${0.12 + 0.55*shade})`;
    ctx.fillRect(x, y, (w/rays)+1, wallH);
  }

  // sprites (zombies + drops) sorted far to near
  const sprites = [];

  for (const z of zombies){
    sprites.push({ kind:"z", x:z.x, y:z.y, r:z.r, type:z.type, hp:z.hp, maxHp:z.maxHp });
  }
  for (const d of drops){
    sprites.push({ kind:"d", x:d.x, y:d.y, r:d.r, amount:d.amount });
  }

  sprites.sort((a,b)=>{
    const da = dist(player.x,player.y,a.x,a.y);
    const db = dist(player.x,player.y,b.x,b.y);
    return db-da;
  });

  for (const s of sprites){
    const dx = s.x - player.x;
    const dy = s.y - player.y;
    const distTo = Math.hypot(dx,dy);

    // angle from player to sprite
    let ang = Math.atan2(dy,dx) - player.a;
    while (ang > Math.PI) ang -= Math.PI*2;
    while (ang < -Math.PI) ang += Math.PI*2;

    // inside view
    if (Math.abs(ang) > player.fov/2 + 0.35) continue;

    // occlusion: if wall is closer than sprite center
    const rayD = castRay(player.a + ang);
    if (rayD + 0.05 < distTo) continue;

    // project to screen
    const screenX = (ang/(player.fov/2))*(innerWidth/2) + innerWidth/2;
    const size = clamp((innerHeight*0.85)/(distTo+0.001), 10, innerHeight*1.2);

    const top = innerHeight/2 - size/2;
    const left = screenX - size/2;

    if (s.kind === "z"){
      ctx.fillStyle = s.type === "runner" ? "rgba(239,68,68,.9)" : "rgba(148,163,184,.9)";
      ctx.fillRect(left, top, size, size);

      // hp bar
      const pct = clamp(s.hp/s.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(left, top - 10, size, 6);
      ctx.fillStyle = "rgba(34,197,94,.9)";
      ctx.fillRect(left, top - 10, size*pct, 6);
    } else {
      ctx.fillStyle = "rgba(34,197,94,.9)";
      ctx.beginPath();
      ctx.arc(screenX, innerHeight/2 + size*0.18, Math.max(6, size*0.09), 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#06120a";
      ctx.font = "bold 14px system-ui";
      ctx.fillText("$", screenX - 4, innerHeight/2 + size*0.18 + 5);
    }
  }

  // safe zone indicator (subtle)
  if (inSafe()){
    ctx.fillStyle = "rgba(34,197,94,.08)";
    ctx.fillRect(0,0,innerWidth,innerHeight);
  }

  // crosshair
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  const cx = innerWidth/2, cy = innerHeight/2;
  ctx.beginPath();
  ctx.moveTo(cx-10, cy); ctx.lineTo(cx-3, cy);
  ctx.moveTo(cx+3, cy); ctx.lineTo(cx+10, cy);
  ctx.moveTo(cx, cy-10); ctx.lineTo(cx, cy-3);
  ctx.moveTo(cx, cy+3); ctx.lineTo(cx, cy+10);
  ctx.stroke();
}

function die(){
  state.alive = false;
  ui.death.classList.remove("hidden");
  document.exitPointerLock?.();
}

ui.restart.addEventListener("click", ()=>{
  zombies = [];
  drops = [];
  state.wave = 1;
  state.t = 0;
  state.alive = true;
  state.shopOpen = false;
  ui.shop.classList.add("hidden");
  ui.death.classList.add("hidden");

  player.x = 2.6; player.y = 2.6; player.a = 0;
  player.hp = player.maxHp;
  player.cash = 0;
  player.dmgMult = 1;
  player.gun.ammo = player.gun.magSize;
  player.gun.reserve = 32;
  player.gun.reloading = false;
  setHint("Back in. Click to lock mouse.");
});

// Update loop
let last = performance.now();
function tick(now){
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now-last)/1000);
  last = now;

  if (!state.alive) { render(); syncUI(); return; }
  state.t += dt;

  // waves scale over time
  if (state.t > state.wave * 25) state.wave++;

  // reload
  const g = player.gun;
  if (g.reloading){
    g.rt += dt;
    if (g.rt >= g.reloadTime){
      const need = g.magSize - g.ammo;
      const take = Math.min(need, g.reserve);
      g.reserve -= take;
      g.ammo += take;
      g.reloading = false;
      setHint("Reloaded.", true);
    }
  }

  // look
  if (!state.shopOpen){
    player.a += lookDelta * 0.0022;
    lookDelta = 0;
  }

  // movement
  if (!state.shopOpen){
    let mx = 0, my = 0;
    if (keys.has("w")) { mx += Math.cos(player.a); my += Math.sin(player.a); }
    if (keys.has("s")) { mx -= Math.cos(player.a); my -= Math.sin(player.a); }
    if (keys.has("a")) { mx += Math.cos(player.a - Math.PI/2); my += Math.sin(player.a - Math.PI/2); }
    if (keys.has("d")) { mx += Math.cos(player.a + Math.PI/2); my += Math.sin(player.a + Math.PI/2); }

    const len = Math.hypot(mx,my) || 1;
    mx /= len; my /= len;

    let sp = player.speed * (inSafe() ? 1.08 : 1);
    const nx = player.x + mx*sp*dt;
    const ny = player.y + my*sp*dt;

    // simple collision
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }

  // spawn zombies up to target
  if (!state.shopOpen){
    const target = 4 + state.wave * 2;
    if (zombies.length < target && Math.random() < 0.08 + state.wave*0.002){
      spawnZombie();
    }
  }

  // zombie AI + attacks
  for (let i=zombies.length-1; i>=0; i--){
    const z = zombies[i];
    z.hitCd = Math.max(0, z.hitCd - dt);

    if (!state.shopOpen){
      // chase player
      const ang = Math.atan2(player.y - z.y, player.x - z.x);
      let sp = z.speed * (z.type==="runner" ? 1.18 : 1);
      if (dist(z.x,z.y, safeZone.x,safeZone.y) < safeZone.r) sp *= 0.25;

      const nx = z.x + Math.cos(ang)*sp*dt;
      const ny = z.y + Math.sin(ang)*sp*dt;
      if (!isWall(nx, z.y)) z.x = nx;
      if (!isWall(z.x, ny)) z.y = ny;

      // attack
      const d = dist(player.x,player.y, z.x,z.y);
      if (d < 0.55 && z.hitCd <= 0){
        z.hitCd = 0.6;
        player.hp -= z.dmg;
        setHint("You’re getting chewed! Back up!", false);
        if (player.hp <= 0) die();
      }
    }
  }

  // pick up drops
  for (let i=drops.length-1; i>=0; i--){
    const d = drops[i];
    if (!state.shopOpen) d.t -= dt;
    if (dist(player.x,player.y, d.x,d.y) < 0.55){
      player.cash += d.amount;
      drops.splice(i,1);
      setHint(`Picked up $${d.amount}.`, true);
      continue;
    }
    if (d.t <= 0) drops.splice(i,1);
  }

  // shooting
  if (mouseDown && state.pointerLocked && !state.shopOpen) shoot();

  // safe zone hint
  if (inSafe() && !state.shopOpen) setHint("SAFE ZONE: press E to shop.", true);

  render();
  syncUI();
}
requestAnimationFrame(tick);

function syncUI(){
  ui.hp.textContent = Math.max(0, Math.floor(player.hp));
  ui.ammo.textContent = player.gun.ammo;
  ui.reserve.textContent = player.gun.reserve;
  ui.cash.textContent = player.cash;
  ui.wave.textContent = state.wave;
}

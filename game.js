/* Project Game Maker: Zombie RPG FPS (single-file, GitHub Pages friendly)
   Controls:
   - Click canvas to lock mouse
   - WASD move, Space jump, Ctrl crouch
   - Mouse look
   - LMB shoot, R reload
   - 1/2 switch guns, 3 knife
   - Walk to wall shop stand, press Q to open (freezes zombies)
*/

(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const minimap = document.getElementById("minimap");
  const mctx = minimap.getContext("2d");

  const hpPill = document.getElementById("hpPill");
  const wepPill = document.getElementById("wepPill");
  const ammoPill = document.getElementById("ammoPill");
  const cashPill = document.getElementById("cashPill");
  const wavePill = document.getElementById("wavePill");
  const lvlPill = document.getElementById("lvlPill");
  const msgPill = document.getElementById("msgPill");

  const overlay = document.getElementById("overlay");
  const closeShopBtn = document.getElementById("closeShopBtn");
  const resetBtn = document.getElementById("resetBtn");
  const shopPrompt = document.getElementById("shopPrompt");

  const shopWeapons = document.getElementById("shopWeapons");
  const shopUpgrades = document.getElementById("shopUpgrades");
  const slot1Name = document.getElementById("slot1Name");
  const slot2Name = document.getElementById("slot2Name");
  const shopCash = document.getElementById("shopCash");
  const shopLvl = document.getElementById("shopLvl");
  const shopXp = document.getElementById("shopXp");

  // ---------- UTIL ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- RESIZE ----------
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  // ---------- INPUT ----------
  const keys = new Set();
  let mouseLocked = false;
  let mx = 0, my = 0;

  addEventListener("keydown", (e) => {
    if (["Tab"].includes(e.code)) e.preventDefault();
    keys.add(e.code);

    if (e.code === "KeyQ") toggleShop();
    if (e.code === "Digit1") equipSlot(1);
    if (e.code === "Digit2") equipSlot(2);
    if (e.code === "Digit3") equipKnife();
    if (e.code === "KeyR") reload();
  });

  addEventListener("keyup", (e) => keys.delete(e.code));

  canvas.addEventListener("click", async () => {
    if (isShopOpen()) return;
    await canvas.requestPointerLock?.();
  });

  document.addEventListener("pointerlockchange", () => {
    mouseLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener("mousemove", (e) => {
    if (!mouseLocked) return;
    mx += e.movementX;
    my += e.movementY;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (isShopOpen()) return;
    shoot();
  });

  // ---------- AUDIO (WebAudio synth so no external files needed) ----------
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playGunPop() {
    const ac = getAudio();
    const t0 = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.06);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(600, t0 + 0.08);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  function playHitTick() {
    const ac = getAudio();
    const t0 = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.05);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.10, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(t0);
    osc.stop(t0 + 0.09);
  }

  // Less “robot”, more “groan”: filtered noise + slow wobble
  function playZombieGroan() {
    const ac = getAudio();
    const t0 = ac.currentTime;

    // noise buffer
    const bufferSize = Math.floor(ac.sampleRate * 0.35);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

    const src = ac.createBufferSource();
    src.buffer = buffer;

    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(220, t0);
    band.Q.setValueAtTime(1.6, t0);

    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(2.2, t0);
    lfoGain.gain.setValueAtTime(70, t0);
    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);

    src.connect(band);
    band.connect(gain);
    gain.connect(ac.destination);

    lfo.start(t0);
    src.start(t0);
    src.stop(t0 + 0.36);
    lfo.stop(t0 + 0.36);
  }

  // ---------- SAVE ----------
  const SAVE_KEY = "pgm_zombie_rpg_save_v1";
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function save() {
    const data = {
      cash: state.cash,
      xp: state.xp,
      level: state.level,
      upgrades: state.upgrades,
      owned: Array.from(state.owned),
      slot1: state.slot1,
      slot2: state.slot2,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  // ---------- GAME DATA ----------
  const WEAPONS = {
    rusty_pistol: {
      id: "rusty_pistol",
      name: "Rusty Pistol",
      rarity: "Common",
      cost: 0,
      minLevel: 1,
      mag: 8,
      reserve: 24,
      fireDelay: 0.22,
      damage: 18,
      spread: 0.010,
      range: 30,
      model: "pistol"
    },
    makeshift_smg: {
      id: "makeshift_smg",
      name: "Makeshift SMG",
      rarity: "Uncommon",
      cost: 120,
      minLevel: 2,
      mag: 18,
      reserve: 72,
      fireDelay: 0.09,
      damage: 11,
      spread: 0.020,
      range: 26,
      model: "smg"
    },
    old_shotgun: {
      id: "old_shotgun",
      name: "Old Shotgun",
      rarity: "Rare",
      cost: 260,
      minLevel: 4,
      mag: 5,
      reserve: 25,
      fireDelay: 0.65,
      damage: 10, // per pellet
      pellets: 7,
      spread: 0.060,
      range: 22,
      model: "shotgun"
    }
  };

  const UPGRADES = [
    { id:"hp", name:"Max HP +15", cost: 80, max: 6, desc:"More survivability." },
    { id:"dmg", name:"Bullet Damage +10%", cost: 90, max: 10, desc:"Stacks. Feels spicy." },
    { id:"spd", name:"Move Speed +6%", cost: 75, max: 10, desc:"Kite better." },
    { id:"cash", name:"Cash Gain +10%", cost: 110, max: 10, desc:"More $$$ per kill." }
  ];

  // ---------- STATE ----------
  const state = {
    // player
    px: 2.5, py: 0, pz: 2.5,
    vy: 0,
    yaw: 0,
    pitch: 0,
    crouch: 0,
    hp: 100,
    maxHp: 100,

    // progression
    cash: 0,
    xp: 0,
    level: 1,
    wave: 1,

    upgrades: { hp:0, dmg:0, spd:0, cash:0 },
    owned: new Set(["rusty_pistol"]),
    slot1: "rusty_pistol",
    slot2: null,
    equippedSlot: 1, // 1/2 guns, 3 knife

    // gun runtime
    ammoInMag: 8,
    ammoReserve: 24,
    lastShotAt: 0,
    reloading: false,

    // world
    paused: false,
    msg: "Ready.",
    zombies: [],
    zombieSpawnTimer: 0,

    // shop stand
    shopX: 14.6,
    shopZ: 3.0,

    // visuals
    hitmarker: 0
  };

  // apply save if exists
  const saved = loadSave();
  if (saved) {
    state.cash = saved.cash ?? state.cash;
    state.xp = saved.xp ?? state.xp;
    state.level = saved.level ?? state.level;
    state.upgrades = saved.upgrades ?? state.upgrades;
    state.owned = new Set(saved.owned ?? Array.from(state.owned));
    state.slot1 = saved.slot1 ?? state.slot1;
    state.slot2 = saved.slot2 ?? state.slot2;
  }

  // clamp/save-derived correctness
  if (!state.slot1) state.slot1 = "rusty_pistol";
  if (!state.owned.has(state.slot1)) state.owned.add(state.slot1);

  // ---------- MAP (simple corridors) ----------
  // Grid size
  const MAP_W = 18, MAP_H = 10;
  // 0 = floor, 1 = wall
  const map = [
    "111111111111111111",
    "100000000000000001",
    "101111011111011101",
    "101000010000010001",
    "101011110111110101",
    "101010000100000101",
    "101010111101111101",
    "100010000000000001",
    "101111111111111101",
    "111111111111111111",
  ].map(row => row.split("").map(c => c === "1" ? 1 : 0));

  function isWall(x, z) {
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    if (gx < 0 || gz < 0 || gx >= MAP_W || gz >= MAP_H) return true;
    return map[gz][gx] === 1;
  }

  // ---------- SHOP ----------
  function isShopOpen() { return !overlay.classList.contains("hidden"); }

  function shopNearPlayer() {
    const dx = state.px - state.shopX;
    const dz = state.pz - state.shopZ;
    return (dx*dx + dz*dz) < 2.2*2.2;
  }

  function toggleShop() {
    if (isShopOpen()) {
      overlay.classList.add("hidden");
      state.paused = false;
      state.msg = "Back to work.";
      if (mouseLocked) document.exitPointerLock?.();
      save();
      return;
    }
    if (!shopNearPlayer()) return; // only open when near
    overlay.classList.remove("hidden");
    state.paused = true;
    state.msg = "Shop open. Zombies frozen.";
    if (mouseLocked) document.exitPointerLock?.();
    rebuildShopUI();
  }

  closeShopBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    state.paused = false;
    state.msg = "Closed shop.";
    save();
  });

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });

  function rebuildShopUI() {
    shopCash.textContent = `$${state.cash}`;
    shopLvl.textContent = `${state.level}`;
    shopXp.textContent = `${state.xp}`;

    slot1Name.textContent = WEAPONS[state.slot1]?.name ?? "Empty";
    slot2Name.textContent = state.slot2 ? WEAPONS[state.slot2]?.name : "Empty";

    // weapons
    shopWeapons.innerHTML = "";
    Object.values(WEAPONS).forEach(w => {
      const owned = state.owned.has(w.id);
      const locked = state.level < w.minLevel;
      const canBuy = !owned && !locked && state.cash >= w.cost;

      const div = document.createElement("div");
      div.className = "shopItem";
      div.innerHTML = `
        <div>
          <b>${w.name}</b>
          <div class="meta">${w.rarity} • Lv ${w.minLevel}+ • $${w.cost} • ${w.model.toUpperCase()}</div>
          <div class="meta">DMG ${w.damage} • MAG ${w.mag} • Spread ${(w.spread*100).toFixed(2)}%</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn buy" ${(!canBuy ? "disabled" : "")} data-buy="${w.id}">
            ${owned ? "Owned" : (locked ? `Locked (Lv ${w.minLevel})` : `Buy $${w.cost}`)}
          </button>
          <button class="btn" ${(!owned ? "disabled" : "")} data-eq1="${w.id}">Equip to 1</button>
          <button class="btn" ${(!owned ? "disabled" : "")} data-eq2="${w.id}">Equip to 2</button>
        </div>
      `;
      shopWeapons.appendChild(div);
    });

    // upgrades
    shopUpgrades.innerHTML = "";
    UPGRADES.forEach(u => {
      const lvl = state.upgrades[u.id] ?? 0;
      const cost = Math.floor(u.cost * (1 + lvl * 0.22));
      const maxed = lvl >= u.max;
      const can = !maxed && state.cash >= cost;

      const div = document.createElement("div");
      div.className = "shopItem";
      div.innerHTML = `
        <div>
          <b>${u.name}</b>
          <div class="meta">${u.desc}</div>
          <div class="meta">Level ${lvl}/${u.max} • Next: $${cost}</div>
        </div>
        <div>
          <button class="btn buy" ${(!can ? "disabled" : "")} data-up="${u.id}">
            ${maxed ? "Maxed" : `Upgrade $${cost}`}
          </button>
        </div>
      `;
      shopUpgrades.appendChild(div);
    });

    // wire clicks
    shopWeapons.querySelectorAll("[data-buy]").forEach(btn => {
      btn.addEventListener("click", () => buyWeapon(btn.getAttribute("data-buy")));
    });
    shopWeapons.querySelectorAll("[data-eq1]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-eq1");
        if (state.owned.has(id)) state.slot1 = id;
        if (state.equippedSlot === 1) loadWeaponStats(getCurrentWeaponId());
        rebuildShopUI(); save();
      });
    });
    shopWeapons.querySelectorAll("[data-eq2]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-eq2");
        if (state.owned.has(id)) state.slot2 = id;
        if (state.equippedSlot === 2) loadWeaponStats(getCurrentWeaponId());
        rebuildShopUI(); save();
      });
    });
    shopUpgrades.querySelectorAll("[data-up]").forEach(btn => {
      btn.addEventListener("click", () => buyUpgrade(btn.getAttribute("data-up")));
    });
  }

  function buyWeapon(id) {
    const w = WEAPONS[id];
    if (!w) return;
    if (state.owned.has(id)) return;
    if (state.level < w.minLevel) return;
    if (state.cash < w.cost) return;

    state.cash -= w.cost;
    state.owned.add(id);
    state.msg = `Bought ${w.name}.`;

    // auto put in slot2 if empty
    if (!state.slot2 && id !== state.slot1) state.slot2 = id;

    rebuildShopUI();
    save();
  }

  function buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return;
    const lvl = state.upgrades[id] ?? 0;
    if (lvl >= u.max) return;
    const cost = Math.floor(u.cost * (1 + lvl * 0.22));
    if (state.cash < cost) return;

    state.cash -= cost;
    state.upgrades[id] = lvl + 1;

    // apply immediate effects
    applyUpgradeEffects();
    state.msg = `Upgraded: ${u.name}.`;

    rebuildShopUI();
    save();
  }

  function applyUpgradeEffects() {
    const hpLvl = state.upgrades.hp ?? 0;
    const newMax = 100 + hpLvl * 15;
    const ratio = state.hp / state.maxHp;
    state.maxHp = newMax;
    state.hp = clamp(Math.round(ratio * state.maxHp), 1, state.maxHp);
  }
  applyUpgradeEffects();

  // ---------- WEAPON LOADOUT / STATS ----------
  function getCurrentWeaponId() {
    if (state.equippedSlot === 1) return state.slot1;
    if (state.equippedSlot === 2) return state.slot2;
    return null;
  }

  function getCurrentWeapon() {
    const id = getCurrentWeaponId();
    return id ? WEAPONS[id] : null;
  }

  function equipSlot(n) {
    if (isShopOpen()) return;
    if (n === 2 && !state.slot2) { state.msg = "No secondary equipped."; return; }
    state.equippedSlot = n;
    const id = getCurrentWeaponId();
    if (id) {
      loadWeaponStats(id);
      state.msg = `Equipped: ${WEAPONS[id].name}`;
    }
  }

  function equipKnife() {
    if (isShopOpen()) return;
    state.equippedSlot = 3;
    state.msg = "Knife equipped.";
  }

  function loadWeaponStats(id) {
    const w = WEAPONS[id];
    if (!w) return;
    // keep reserve if same weapon, else reset reserve defaults
    state.ammoInMag = Math.min(w.mag, state.ammoInMag || w.mag);
    state.ammoReserve = Math.max(0, state.ammoReserve || w.reserve);
    // if swapping weapons, give sensible defaults
    state.ammoInMag = w.mag;
    state.ammoReserve = w.reserve;
    state.reloading = false;
  }

  loadWeaponStats(state.slot1);

  function reload() {
    if (state.equippedSlot === 3) return;
    const w = getCurrentWeapon();
    if (!w) return;
    if (state.reloading) return;
    if (state.ammoInMag >= w.mag) { state.msg = "Mag full."; return; }
    if (state.ammoReserve <= 0) { state.msg = "No reserve ammo."; return; }

    state.reloading = true;
    state.msg = "Reloading...";

    const reloadTime = w.model === "shotgun" ? 0.95 : 0.75;
    setTimeout(() => {
      const need = w.mag - state.ammoInMag;
      const take = Math.min(need, state.ammoReserve);
      state.ammoInMag += take;
      state.ammoReserve -= take;
      state.reloading = false;
      state.msg = "Reloaded.";
    }, reloadTime * 1000);
  }

  // ---------- ZOMBIES ----------
  function spawnZombie() {
    // pick a spawn point in a floor cell far enough
    for (let tries = 0; tries < 50; tries++) {
      const x = 1 + Math.random() * (MAP_W - 2);
      const z = 1 + Math.random() * (MAP_H - 2);
      if (isWall(x, z)) continue;
      const dx = x - state.px, dz = z - state.pz;
      if (dx*dx + dz*dz < 10) continue;

      state.zombies.push({
        x, z,
        y: 0,                 // ON THE GROUND ✅
        h: 1.75,              // total height for hit zones
        r: 0.32,
        hp: 55 + state.wave * 8,
        speed: 0.65 + state.wave * 0.05,
        groanAt: 0,
        hurtFlash: 0
      });
      return;
    }
  }

  function startWave() {
    // increase difficulty a bit
    const count = 3 + state.wave * 2;
    for (let i = 0; i < count; i++) spawnZombie();
    state.msg = `Wave ${state.wave}!`;
  }
  startWave();

  function giveKillRewards() {
    const cashMult = 1 + (state.upgrades.cash ?? 0) * 0.10;
    const cashGain = Math.round((10 + state.wave * 2) * cashMult);
    const xpGain = 12 + state.wave * 2;

    state.cash += cashGain;
    state.xp += xpGain;

    // level up curve
    const need = 60 + (state.level - 1) * 45;
    if (state.xp >= need) {
      state.xp -= need;
      state.level += 1;
      state.msg = `Level up! Now Lv ${state.level}.`;
    }
  }

  // ---------- SHOOT / HITSCAN / HITZONES ----------
  function shoot() {
    if (state.paused) return;
    if (state.equippedSlot === 3) { knifeAttack(); return; }
    const w = getCurrentWeapon();
    if (!w) return;

    if (state.reloading) return;
    const now = performance.now() / 1000;
    if (now - state.lastShotAt < w.fireDelay) return;

    if (state.ammoInMag <= 0) {
      state.msg = "Click. Reload (R).";
      return;
    }

    state.lastShotAt = now;
    state.ammoInMag -= 1;

    playGunPop();

    // spread applied to aim direction
    const ax = (Math.random() * 2 - 1) * w.spread;
    const ay = (Math.random() * 2 - 1) * w.spread;

    // build a ray direction from yaw/pitch with spread
    const yaw = state.yaw + ax;
    const pitch = state.pitch + ay;

    const dir = {
      x: Math.cos(pitch) * Math.cos(yaw),
      y: Math.sin(pitch),
      z: Math.cos(pitch) * Math.sin(yaw),
    };

    const origin = { x: state.px, y: 1.55 - state.crouch * 0.45, z: state.pz };

    // shotgun pellets
    const pellets = w.pellets ?? 1;
    let hitAny = false;

    for (let p = 0; p < pellets; p++) {
      const jx = (Math.random() * 2 - 1) * (w.spread * 1.2);
      const jy = (Math.random() * 2 - 1) * (w.spread * 1.2);

      const y2 = yaw + jx;
      const p2 = pitch + jy;
      const d = {
        x: Math.cos(p2) * Math.cos(y2),
        y: Math.sin(p2),
        z: Math.cos(p2) * Math.sin(y2),
      };

      const hit = raycastZombie(origin, d, w.range);
      if (hit) {
        hitAny = true;
        applyDamage(hit.zombie, w, hit.hitY);
      }
    }

    state.hitmarker = hitAny ? 0.12 : 0;

    if (state.ammoInMag === 0 && state.ammoReserve > 0) {
      state.msg = "Mag empty. Reload (R).";
    }
  }

  function knifeAttack() {
    if (state.paused) return;
    const now = performance.now() / 1000;
    if (now - state.lastShotAt < 0.35) return;
    state.lastShotAt = now;

    // short range cone
    const origin = { x: state.px, y: 1.45 - state.crouch * 0.45, z: state.pz };
    const dir = {
      x: Math.cos(state.pitch) * Math.cos(state.yaw),
      y: Math.sin(state.pitch),
      z: Math.cos(state.pitch) * Math.sin(state.yaw),
    };

    const hit = raycastZombie(origin, dir, 2.0);
    if (hit) {
      playHitTick();
      hit.zombie.hurtFlash = 0.12;
      hit.zombie.hp -= 35;
      state.hitmarker = 0.12;
      if (hit.zombie.hp <= 0) {
        removeZombie(hit.zombie);
        giveKillRewards();
      }
    }
  }

  function applyDamage(z, w, hitY) {
    const dmgMultLvl = 1 + (state.upgrades.dmg ?? 0) * 0.10;

    // hit zones by height:
    // head: top 20%, legs: bottom 28%, body: middle
    const rel = clamp(hitY / z.h, 0, 1);
    let zoneMult = 1.0;
    if (rel > 0.80) zoneMult = 1.8;   // headshot
    else if (rel < 0.28) zoneMult = 0.65; // legs
    else zoneMult = 1.0;

    const base = w.damage * dmgMultLvl;
    const dmg = Math.max(1, Math.round(base * zoneMult));

    z.hp -= dmg;
    z.hurtFlash = 0.10;

    playHitTick();

    if (z.hp <= 0) {
      removeZombie(z);
      giveKillRewards();
    }
  }

  function removeZombie(z) {
    const idx = state.zombies.indexOf(z);
    if (idx >= 0) state.zombies.splice(idx, 1);

    // wave complete?
    if (state.zombies.length === 0) {
      state.wave += 1;
      state.msg = `Wave cleared! Incoming: ${state.wave}`;
      startWave();
      save();
    }
  }

  function raycastZombie(origin, dir, maxDist) {
    // check each zombie as a vertical capsule-ish cylinder:
    // project ray onto XZ plane for radius hit; then compute hitY
    let best = null;

    for (const z of state.zombies) {
      // simple ray-cylinder intersection in XZ
      const ox = origin.x - z.x;
      const oz = origin.z - z.z;

      const dx = dir.x;
      const dz = dir.z;

      const a = dx*dx + dz*dz;
      const b = 2*(ox*dx + oz*dz);
      const c = ox*ox + oz*oz - z.r*z.r;

      const disc = b*b - 4*a*c;
      if (disc < 0) continue;

      const sqrt = Math.sqrt(disc);
      const t1 = (-b - sqrt) / (2*a);
      const t2 = (-b + sqrt) / (2*a);

      const t = (t1 > 0 ? t1 : (t2 > 0 ? t2 : null));
      if (t === null) continue;
      if (t > maxDist) continue;

      // compute Y at hit and ensure within zombie height
      const hitY = origin.y + dir.y * t - z.y;
      if (hitY < 0 || hitY > z.h) continue;

      if (!best || t < best.t) best = { t, zombie: z, hitY };
    }

    return best;
  }

  // ---------- MOVEMENT + COLLISION ----------
  function move(dt) {
    if (state.paused) return;

    // mouse look (fix “reversed up/down”)
    const sens = 0.0022;
    state.yaw += mx * sens;
    state.pitch -= my * sens; // subtract = normal FPS look ✅
    state.pitch = clamp(state.pitch, -1.35, 1.35);
    mx = 0; my = 0;

    // crouch
    const crouching = keys.has("ControlLeft") || keys.has("ControlRight");
    state.crouch = lerp(state.crouch, crouching ? 1 : 0, 12 * dt);

    // speed upgrades
    const spdMult = 1 + (state.upgrades.spd ?? 0) * 0.06;
    let speed = 3.2 * spdMult * (crouching ? 0.78 : 1);

    // direction
    let f = 0, s = 0;
    if (keys.has("KeyW")) f += 1;
    if (keys.has("KeyS")) f -= 1;
    if (keys.has("KeyA")) s -= 1;
    if (keys.has("KeyD")) s += 1;

    const len = Math.hypot(f, s) || 1;
    f /= len; s /= len;

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);

    const vx = (cos * f - sin * s) * speed;
    const vz = (sin * f + cos * s) * speed;

    // jump + gravity (adds the “up/down movement” you asked for)
    const onGround = state.py <= 0.0001;
    if (onGround) {
      state.py = 0;
      state.vy = Math.max(0, state.vy);
      if (keys.has("Space")) {
        state.vy = 6.2;
      }
    } else {
      state.vy -= 16.0 * dt;
    }

    // apply
    const nx = state.px + vx * dt;
    const nz = state.pz + vz * dt;

    // collision (slide)
    const rad = 0.20;
    if (!isWall(nx + rad, state.pz) && !isWall(nx - rad, state.pz)) state.px = nx;
    if (!isWall(state.px, nz + rad) && !isWall(state.px, nz - rad)) state.pz = nz;

    state.py += state.vy * dt;
    if (state.py < 0) { state.py = 0; state.vy = 0; }
  }

  // ---------- ZOMBIE AI ----------
  function updateZombies(dt) {
    if (state.paused) return;

    const playerY = 1.55 - state.crouch * 0.45;

    for (const z of state.zombies) {
      // occasional groan
      z.groanAt -= dt;
      if (z.groanAt <= 0 && Math.random() < 0.02) {
        playZombieGroan();
        z.groanAt = 2.2 + Math.random() * 2.5;
      }

      // chase player
      const dx = state.px - z.x;
      const dz = state.pz - z.z;
      const dist = Math.hypot(dx, dz) || 1;

      // attack if close
      if (dist < 0.70 && state.hp > 0) {
        // damage tick
        if (Math.random() < 0.35) {
          state.hp -= 6 + state.wave;
          state.hp = clamp(state.hp, 0, state.maxHp);
          state.msg = state.hp <= 0 ? "You died. Refresh to restart (save kept unless reset)." : "Ouch!";
        }
      }

      // move toward
      const step = z.speed * dt;
      const nx = z.x + (dx / dist) * step;
      const nz = z.z + (dz / dist) * step;

      // simple wall avoidance
      if (!isWall(nx, z.z)) z.x = nx;
      if (!isWall(z.x, nz)) z.z = nz;

      // hurt flash fade
      z.hurtFlash = Math.max(0, z.hurtFlash - dt);
    }
  }

  // ---------- RENDER (simple raycaster) ----------
  function render() {
    const W = innerWidth, H = innerHeight;

    // background
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0, 0, W, H);

    // draw world via basic raycast columns
    const fov = 1.05; // ~60deg
    const halfFov = fov / 2;

    const camX = state.px;
    const camY = 1.55 + state.py - state.crouch * 0.45;
    const camZ = state.pz;

    const sky = "#0b1220";
    const floor = "#070a0f";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H/2);
    ctx.fillStyle = floor;
    ctx.fillRect(0, H/2, W, H/2);

    // walls
    const cols = Math.floor(W / 2); // quality knob
    for (let i = 0; i < cols; i++) {
      const x = i / (cols - 1);
      const angle = (state.yaw - halfFov) + x * fov;

      // ray step
      let rx = camX;
      let rz = camZ;

      const step = 0.03;
      let dist = 0;
      let hit = false;

      for (let t = 0; t < 1200; t++) {
        rx += Math.cos(angle) * step;
        rz += Math.sin(angle) * step;
        dist += step;
        if (isWall(rx, rz)) { hit = true; break; }
        if (dist > 40) break;
      }

      if (!hit) continue;

      // perspective wall height
      const corrected = dist * Math.cos(angle - state.yaw);
      const wallH = (H * 1.12) / Math.max(0.0001, corrected);

      const top = (H/2) - wallH/2 + (state.pitch * 120); // pitch look
      const colW = W / cols + 1;

      // shading
      const shade = clamp(1 - corrected / 22, 0.12, 1);
      const base = 235 * shade;
      ctx.fillStyle = `rgb(${base|0},${base|0},${base|0})`;
      ctx.fillRect(i * (W/cols), top, colW, wallH);
    }

    // draw shop stand on wall (simple marker)
    drawBillboard(camX, camY, camZ, state.shopX, 0, state.shopZ, 1.2, 1.4, "#22c55e", "SHOP");

    // draw zombies as billboards with hit flash + legs (simple)
    for (const z of state.zombies) {
      drawZombieBillboard(camX, camY, camZ, z);
    }

    // crosshair
    ctx.save();
    ctx.translate(W/2, H/2);
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(-2, 0);
    ctx.moveTo(8, 0); ctx.lineTo(2, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, -2);
    ctx.moveTo(0, 8); ctx.lineTo(0, 2);
    ctx.stroke();

    // hitmarker
    if (state.hitmarker > 0) {
      ctx.strokeStyle = "rgba(34,197,94,.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, -14); ctx.lineTo(-6, -6);
      ctx.moveTo(14, -14); ctx.lineTo(6, -6);
      ctx.moveTo(-14, 14); ctx.lineTo(-6, 6);
      ctx.moveTo(14, 14); ctx.lineTo(6, 6);
      ctx.stroke();
    }
    ctx.restore();

    // weapon model (2D overlay) - fixed: bottom-right, points forward ✅
    drawWeaponModel(W, H);

    // shop prompt
    if (!isShopOpen() && shopNearPlayer()) shopPrompt.classList.remove("hidden");
    else shopPrompt.classList.add("hidden");

    // HUD updates
    updateHUD();
    drawMinimap();
  }

  function updateHUD() {
    hpPill.textContent = `HP: ${state.hp}/${state.maxHp}`;
    cashPill.textContent = `Cash: $${state.cash}`;
    wavePill.textContent = `Wave: ${state.wave}`;
    lvlPill.textContent = `Lv: ${state.level} (${state.xp} XP)`;
    msgPill.textContent = state.msg;

    if (state.equippedSlot === 3) {
      wepPill.textContent = `Weapon: Knife`;
      ammoPill.textContent = `Ammo: —`;
    } else {
      const w = getCurrentWeapon();
      wepPill.textContent = `Weapon: ${w ? w.name : "None"}`;
      const mag = w ? w.mag : 0;
      ammoPill.textContent = `Ammo: ${state.ammoInMag}/${mag} | Reserve: ${state.ammoReserve}`;
    }
  }

  // billboard helper
  function projectWorldPoint(camX, camY, camZ, wx, wy, wz) {
    // camera space
    const dx = wx - camX;
    const dy = wy - camY;
    const dz = wz - camZ;

    // rotate by yaw
    const sinY = Math.sin(-state.yaw);
    const cosY = Math.cos(-state.yaw);
    const x1 = dx * cosY - dz * sinY;
    const z1 = dx * sinY + dz * cosY;

    // rotate by pitch
    const sinP = Math.sin(-state.pitch);
    const cosP = Math.cos(-state.pitch);
    const y2 = dy * cosP - z1 * sinP;
    const z2 = dy * sinP + z1 * cosP;

    return { x: x1, y: y2, z: z2 };
  }

  function drawBillboard(camX, camY, camZ, wx, wy, wz, w, h, color, label) {
    const p = projectWorldPoint(camX, camY, camZ, wx, wy + h/2, wz);
    if (p.z <= 0.2) return;

    const W = innerWidth, H = innerHeight;
    const scale = 520 / p.z;
    const sx = (W/2) + (p.x * scale);
    const sy = (H/2) - (p.y * scale);

    const bw = w * scale;
    const bh = h * scale;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(sx - bw/2, sy - bh/2, bw, bh);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(sx - bw/2, sy - bh/2, bw, 22);

    ctx.fillStyle = "white";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(label, sx - bw/2 + 8, sy - bh/2 + 16);
  }

  function drawZombieBillboard(camX, camY, camZ, z) {
    // zombie center position
    const p = projectWorldPoint(camX, camY, camZ, z.x, z.y + z.h/2, z.z);
    if (p.z <= 0.2) return;

    const W = innerWidth, H = innerHeight;
    const scale = 560 / p.z;
    const sx = (W/2) + (p.x * scale);
    const sy = (H/2) - (p.y * scale);

    const bw = 0.9 * scale;
    const bh = z.h * scale;

    // body
    let bodyCol = `rgba(210,210,210,0.92)`;
    if (z.hurtFlash > 0) bodyCol = `rgba(255,120,120,0.95)`;

    ctx.fillStyle = bodyCol;
    ctx.fillRect(sx - bw/2, sy - bh/2 + 16, bw, bh - 16);

    // head
    ctx.fillStyle = z.hurtFlash > 0 ? "rgba(255,160,160,.95)" : "rgba(240,240,240,.92)";
    ctx.beginPath();
    ctx.arc(sx, sy - bh/2 + 28, 22, 0, Math.PI*2);
    ctx.fill();

    // eyes
    ctx.fillStyle = "rgba(30,30,30,.75)";
    ctx.fillRect(sx - 12, sy - bh/2 + 22, 8, 6);
    ctx.fillRect(sx + 4, sy - bh/2 + 22, 8, 6);

    // legs (so they clearly touch ground)
    ctx.fillStyle = "rgba(180,180,180,.92)";
    ctx.fillRect(sx - 22, sy + bh/2 - 32, 14, 32);
    ctx.fillRect(sx + 8, sy + bh/2 - 32, 14, 32);

    // health bar
    const hpPct = clamp(z.hp / (55 + state.wave * 8), 0, 1);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(sx - bw/2, sy - bh/2 - 12, bw, 8);
    ctx.fillStyle = "rgba(34,197,94,.95)";
    ctx.fillRect(sx - bw/2, sy - bh/2 - 12, bw * hpPct, 8);
  }

  function drawWeaponModel(W, H) {
    // Position: bottom-right. Rotation: face forward (barrel toward center).
    // This fixes your “points to sky” / “points sideways” drama.
    const slot = state.equippedSlot;
    ctx.save();

    // anchor
    const ax = W - 260;
    const ay = H - 190;

    // slight bob for life
    const bob = Math.sin(performance.now()/120) * 2;

    ctx.translate(ax, ay + bob);

    // choose model
    let model = "pistol";
    if (slot === 3) model = "knife";
    else {
      const w = getCurrentWeapon();
      model = w?.model ?? "pistol";
    }

    // draw
    if (model === "knife") {
      ctx.rotate(-0.25);
      ctx.fillStyle = "rgba(20,20,20,.9)";
      ctx.fillRect(20, 60, 90, 18); // handle
      ctx.fillStyle = "rgba(220,220,220,.95)";
      ctx.fillRect(100, 52, 120, 10); // blade
      ctx.fillRect(100, 66, 120, 6);  // blade edge
      ctx.fillStyle = "rgba(255,200,120,.95)";
      ctx.fillRect(0, 80, 40, 60); // hand-ish block
      ctx.restore();
      return;
    }

    // Weapon should point toward screen center: barrel "up-left" from weapon.
    // We draw it angled slightly left

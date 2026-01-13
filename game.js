// Project Game Maker: Zombie RPG FPS (Raycast) - FULL REWRITE v5.2
// Based on your v5.1, keeps everything the same + ADDS:
// A) Better zombie "moan" using WebAudio (no external files, unlocked on first input)
// C) Wall impacts (hit puffs + tiny spark flecks) when bullets hit walls
// D) Zombie visual upgrades (outline + shading + a bit more shape), still NO images

(() => {
  "use strict";

  // ---------- Canvas ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ---------- UI ----------
  const ui = {
    hp: document.getElementById("hp"),
    hpMax: document.getElementById("hpMax"),
    armor: document.getElementById("armor"),
    weapon: document.getElementById("weapon"),
    ammo: document.getElementById("ammo"),
    mag: document.getElementById("mag"),
    reserve: document.getElementById("reserve"),
    cash: document.getElementById("cash"),
    round: document.getElementById("round"),
    alive: document.getElementById("alive"),
    level: document.getElementById("level"),
    xp: document.getElementById("xp"),
    hint: document.getElementById("hint"),
    controlsLine: document.getElementById("controlsLine"),
    stamFill: document.getElementById("stamFill"),
    chasers: document.getElementById("chasers"),
    scrap: document.getElementById("scrap"),
    essence: document.getElementById("essence"),

    btnSettings: document.getElementById("btnSettings"),

    shop: document.getElementById("shop"),
    shopList: document.getElementById("shopList"),
    closeShop: document.getElementById("closeShop"),

    armorMenu: document.getElementById("armorMenu"),
    armorList: document.getElementById("armorList"),
    closeArmor: document.getElementById("closeArmor"),

    settingsMenu: document.getElementById("settingsMenu"),
    closeSettings: document.getElementById("closeSettings"),
    inputMode: document.getElementById("inputMode"),
    sens: document.getElementById("sens"),
    sensVal: document.getElementById("sensVal"),
    autoSprint: document.getElementById("autoSprint"),
    btnReset: document.getElementById("btnReset"),

    death: document.getElementById("death"),
    restart: document.getElementById("restart"),

    mobileUI: document.getElementById("mobileUI"),
    joyBase: document.getElementById("joyBase"),
    joyStick: document.getElementById("joyStick"),
    btnReload: document.getElementById("btnReload"),
    btnUse: document.getElementById("btnUse"),
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

  // ---------- Smart Hints ----------
  let hintState = { text:"", until:0, prio:0 };
  function setHint(t, ok=false, prio=1, hold=1.25) {
    const now = performance.now() / 1000;
    if (now < hintState.until && prio < hintState.prio) return;
    hintState = { text:t||"", until: now + hold, prio };
    ui.hint.textContent = hintState.text;
    ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
  }

  // ---------- SETTINGS (saved) ----------
  const SAVE_KEY = "pgm_zombie_rpg_save_v5";
  const SETTINGS_KEY = "pgm_zombie_rpg_settings_v5";

  const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  const settings = {
    inputMode: "auto", // auto | pc | mobile
    sens: 1.0,         // look sensitivity multiplier
    autoSprint: true,  // mobile: stick hard -> sprint
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === "object") {
          settings.inputMode = s.inputMode ?? settings.inputMode;
          settings.sens = clamp(Number(s.sens ?? settings.sens), 0.6, 2.5);
          settings.autoSprint = !!(s.autoSprint ?? settings.autoSprint);
        }
      }
    } catch {}
    ui.inputMode.value = settings.inputMode;
    ui.sens.value = String(settings.sens);
    ui.sensVal.textContent = settings.sens.toFixed(2);
    ui.autoSprint.checked = settings.autoSprint;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  loadSettings();

  function effectiveMobile() {
    if (settings.inputMode === "mobile") return true;
    if (settings.inputMode === "pc") return false;
    return isTouchDevice; // auto
  }

  // ---------- Input State ----------
  const input = {
    mobile: effectiveMobile(),
    joy: { active:false, id:null, cx:0, cy:0, dx:0, dy:0 },
    look: { active:false, id:null, lastX:0, lastY:0 },
    firing: false,
  };

  function applyInputModeUI() {
    input.mobile = effectiveMobile();
    if (input.mobile) {
      ui.mobileUI.classList.remove("hidden");
      ui.controlsLine.textContent = "Mobile: Left joystick move | Right drag look | Tap right shoots | RELOAD button | USE near stations/machines";
    } else {
      ui.mobileUI.classList.add("hidden");
      ui.controlsLine.textContent = "Click to play | Move WASD | Reload R | Shop Q | Use/Buy E | Sprint Shift";
    }
  }
  applyInputModeUI();

  // ---------- XP ----------
  function xpToNext(level) {
    return Math.floor(70 + (level - 1) * 45 + Math.pow(level - 1, 1.25) * 20);
  }

  // ---------- MAP ----------
  const world = {
    mapW: 24,
    mapH: 24,
    map: [
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
    ].map(r => r.split("").map(Number)),
  };

  function inBounds(ix, iy) {
    return ix >= 0 && iy >= 0 && ix < world.mapW && iy < world.mapH;
  }

  function isWall(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= world.mapW || iy >= world.mapH) return true;
    return world.map[iy][ix] === 1;
  }

  // ---------- Stations ----------
  const shopKiosk = { x: 2.05, y: 1.25, r: 1.15 };
  const armorStation = { x: 21.2, y: 22.0, r: 1.25 };

  function nearShopKiosk() { return dist(player.x, player.y, shopKiosk.x, shopKiosk.y) <= shopKiosk.r; }
  function nearArmorStation() { return dist(player.x, player.y, armorStation.x, armorStation.y) <= armorStation.r; }

  // ---------- Perk Machines ----------
  const PERKS = [
    { id:"jug", name:"Juggernog", price:250, desc:"+60 Max HP", color:"rgba(255,80,80,.95)",
      apply: () => { player.maxHp += 60; player.hp = Math.min(player.maxHp, player.hp + 60); } },
    { id:"stam", name:"Stamin-Up", price:220, desc:"+35 stamina, +regen", color:"rgba(80,255,140,.95)",
      apply: () => { player.staminaMax += 35; player.stamina = player.staminaMax; player.staminaRegen += 10; } },
    { id:"speed", name:"Speed Cola", price:240, desc:"Reload faster", color:"rgba(80,160,255,.95)",
      apply: () => { player.perkReloadMult *= 0.78; } },
    { id:"tap", name:"Double Tap", price:260, desc:"Faster fire rate", color:"rgba(255,210,80,.95)",
      apply: () => { player.perkFireRateMult *= 1.22; } },
    { id:"dead", name:"Deadshot", price:230, desc:"Less spread", color:"rgba(200,80,255,.95)",
      apply: () => { player.perkSpreadMult *= 0.80; } },
  ];
  const perkMachines = [
    { perkId:"jug",   x: 21.3, y: 2.2,  r: 1.05 },
    { perkId:"stam",  x: 21.2, y: 21.1, r: 1.05 },
    { perkId:"speed", x: 2.3,  y: 21.2, r: 1.05 },
    { perkId:"tap",   x: 12.1, y: 12.1, r: 1.05 },
    { perkId:"dead",  x: 17.5, y: 9.2,  r: 1.05 },
  ];
  function perkById(id){ return PERKS.find(p => p.id === id); }

  function nearAnyMachine() {
    if (nearShopKiosk()) return { type:"shop" };
    if (nearArmorStation()) return { type:"armor" };
    for (const m of perkMachines) {
      if (dist(player.x, player.y, m.x, m.y) <= m.r) return { type:"perk", ref:m };
    }
    return null;
  }

  // ---------- Weapons ----------
  const WEAPONS = [
    { id:"pistol_rusty",    name:"Rusty Pistol",    rarity:"Common",   unlockLevel:1, price:0,   dmg:22, fireRate:3.2, magSize:8,  reloadTime:0.95, spread:0.012, bulletSpeed:18, range:16, reserveStart:32 },
    { id:"pistol_service",  name:"Service Pistol",  rarity:"Uncommon", unlockLevel:2, price:75,  dmg:26, fireRate:3.6, magSize:10, reloadTime:0.92, spread:0.011, bulletSpeed:19, range:18, reserveStart:44 },
    { id:"pistol_marksman", name:"Marksman Pistol", rarity:"Rare",     unlockLevel:4, price:160, dmg:34, fireRate:3.2, magSize:12, reloadTime:0.90, spread:0.009, bulletSpeed:20, range:20, reserveStart:52 },
    { id:"pistol_relic",    name:"Relic Pistol",    rarity:"Epic",     unlockLevel:7, price:340, dmg:46, fireRate:3.0, magSize:14, reloadTime:0.88, spread:0.008, bulletSpeed:21, range:22, reserveStart:60 },
  ];
  function W(id){ return WEAPONS.find(w => w.id === id); }

  // ---------- Armor System ----------
  const RARITIES = [
    { name:"Common",    mult:1.0,  color:"rgba(200,200,210,.90)" },
    { name:"Uncommon",  mult:1.2,  color:"rgba(80,210,120,.92)" },
    { name:"Rare",      mult:1.45, color:"rgba(80,160,255,.92)" },
    { name:"Epic",      mult:1.75, color:"rgba(200,80,255,.92)" },
    { name:"Legendary", mult:2.10, color:"rgba(255,190,80,.95)" },
  ];
  const ARMOR_SLOTS = ["helmet","chest","legs","boots"];
  const ARMOR_BASE = { helmet:4, chest:7, legs:5, boots:3 };

  function makeArmorPiece(slot, rarityIndex) {
    const base = ARMOR_BASE[slot];
    const armor = Math.max(1, Math.round(base * RARITIES[rarityIndex].mult));
    const prettySlot = slot === "helmet" ? "Helmet" : slot === "chest" ? "Chest" : slot === "legs" ? "Leggings" : "Boots";
    return {
      id: `armor_${slot}_${Date.now()}_${(Math.random()*9999)|0}`,
      slot,
      rarityIndex,
      rarity: RARITIES[rarityIndex].name,
      armor,
      name: `${RARITIES[rarityIndex].name} ${prettySlot}`,
    };
  }

  function getTotalArmor() {
    let sum = 0;
    for (const s of ARMOR_SLOTS) {
      const it = player.equip[s];
      if (it && typeof it.armor === "number") sum += it.armor;
    }
    return sum;
  }

  function addArmorToInventory(piece) {
    player.armorInv.push(piece);
    if (player.armorInv.length > 28) player.armorInv.shift();
  }

  // ---------- Player ----------
  const player = {
    x: 1.6, y: 1.6,
    a: 0,
    pitch: 0,
    fov: Math.PI / 3,

    hp: 100, maxHp: 100,
    speed: 2.45,

    cash: 0,
    level: 1,
    xp: 0,

    slots: [ structuredClone(W("pistol_rusty")), null ],
    activeSlot: 0,
    usingKnife: false,

    ammo: { mag: 8, reserve: 32, reloading: false, rt: 0, lastShot: 0 },

    knife: { dmg: 55, range: 1.1, cd: 0.45, t: 0, swing: 0 },

    stamina: 100,
    staminaMax: 100,
    sprintMult: 1.55,
    staminaDrain: 45,
    staminaRegen: 28,

    medkits: 0,

    scrap: 0,
    essence: 0,

    equip: { helmet:null, chest:null, legs:null, boots:null },
    armorInv: [],

    ownedPerks: {},
    perkReloadMult: 1.0,
    perkFireRateMult: 1.0,
    perkSpreadMult: 1.0,

    lastHurtTime: 0,
    regenDelay: 4.0,
    regenRate: 4.0,
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
    if (!player.slots[i]) return setHint("No weapon in that slot yet.", false, 2);

    const prev = currentWeapon();
    if (prev) saveAmmoFromWeapon(prev);

    player.activeSlot = i;
    player.usingKnife = false;
    syncAmmoToWeapon(player.slots[i]);
    setHint(`Equipped: ${player.slots[i].name}`, true, 2);
    saveGame();
  }

  function equipKnife() {
    if (game.mode !== "play") return;
    const prev = currentWeapon();
    if (prev) saveAmmoFromWeapon(prev);
    player.usingKnife = true;
    setHint("Knife equipped. Get close and tap/click.", true, 2);
    saveGame();
  }

  // ---------- Game State ----------
  const game = {
    mode: "play",
    pointerLocked: false,

    round: 1,
    alive: 0,
    toSpawn: 0,
    spawnBudget: 0,
    betweenT: 0,

    recoil: 0,
    muzzle: 0,

    flow: null,
    flowTimer: 0,
  };

  // ---------- Save / Load ----------
  function saveGame() {
    try {
      for (const w of player.slots) {
        if (!w) continue;
        w._mag = w._mag ?? w.magSize;
        w._reserve = w._reserve ?? (w.reserveStart ?? 32);
      }

      const data = {
        cash: player.cash, level: player.level, xp: player.xp,
        round: game.round,

        slotIds: player.slots.map(w => (w ? w.id : null)),
        activeSlot: player.activeSlot,
        usingKnife: player.usingKnife,
        weaponState: Object.fromEntries(
          player.slots.filter(Boolean).map(w => [w.id, { _mag: w._mag, _reserve: w._reserve }])
        ),

        scrap: player.scrap,
        essence: player.essence,

        equip: player.equip,
        armorInv: player.armorInv,

        ownedPerks: player.ownedPerks,
        perkReloadMult: player.perkReloadMult,
        perkFireRateMult: player.perkFireRateMult,
        perkSpreadMult: player.perkSpreadMult,

        staminaMax: player.staminaMax,
        staminaRegen: player.staminaRegen,

        hp: player.hp,
        maxHp: player.maxHp,
        medkits: player.medkits,
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

      game.round = data.round ?? 1;

      const ids = Array.isArray(data.slotIds) ? data.slotIds : ["pistol_rusty", null];
      player.slots = ids.map(id => (id ? structuredClone(W(id)) : null));

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

      player.scrap = data.scrap ?? 0;
      player.essence = data.essence ?? 0;

      player.equip = data.equip ?? player.equip;
      player.armorInv = Array.isArray(data.armorInv) ? data.armorInv : [];

      player.ownedPerks = data.ownedPerks ?? {};
      player.perkReloadMult = data.perkReloadMult ?? 1.0;
      player.perkFireRateMult = data.perkFireRateMult ?? 1.0;
      player.perkSpreadMult = data.perkSpreadMult ?? 1.0;

      player.staminaMax = data.staminaMax ?? player.staminaMax;
      player.staminaRegen = data.staminaRegen ?? player.staminaRegen;

      player.maxHp = data.maxHp ?? player.maxHp;
      player.hp = clamp(data.hp ?? player.hp, 1, player.maxHp);
      player.medkits = data.medkits ?? 0;

      if (!player.usingKnife && player.slots[player.activeSlot]) {
        syncAmmoToWeapon(player.slots[player.activeSlot]);
      }

      setHint("Loaded save ✅", true, 3);
      return true;
    } catch {
      return false;
    }
  }

  function hardResetSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
    } catch {}
    location.reload();
  }

  // ---------- Audio (procedural moan) ----------
  const audio = {
    ctx: null,
    master: null,
    unlocked: false,
    lastMoanT: 0,
  };

  function ensureAudio() {
    if (audio.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.55;
    audio.master.connect(audio.ctx.destination);
    return true;
  }

  function unlockAudio() {
    if (audio.unlocked) return;
    if (!ensureAudio()) return;
    audio.ctx.resume?.().catch(()=>{});
    // tiny silent tick to fully unlock on iOS
    try {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      g.gain.value = 0.00001;
      o.frequency.value = 80;
      o.connect(g); g.connect(audio.master);
      o.start();
      o.stop(audio.ctx.currentTime + 0.03);
    } catch {}
    audio.unlocked = true;
  }

  function playZombieMoan(distanceToPlayer, isRunner=false, isChaser=false) {
    if (!audio.unlocked || !audio.ctx || audio.ctx.state !== "running") return;

    // distance attenuation (0..1)
    const d = clamp(distanceToPlayer, 0.1, 18);
    const vol = clamp(1 - (d / 18), 0, 1) * 0.8;

    // slight variation
    const rate = rand(0.92, 1.10) * (isRunner ? 1.08 : 1.0);
    const baseF = (isRunner ? 86 : 74) * rate + (isChaser ? 6 : 0);

    const t0 = audio.ctx.currentTime;
    const dur = rand(0.55, 0.95) * (isRunner ? 0.85 : 1.0);

    // voice osc
    const osc = audio.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(baseF, t0);
    osc.frequency.exponentialRampToValueAtTime(baseF * rand(0.75, 0.9), t0 + dur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(baseF * rand(0.45, 0.65), t0 + dur);

    // "throat" filter
    const bp = audio.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(rand(260, 420), t0);
    bp.Q.setValueAtTime(rand(0.8, 1.4), t0);

    // growl layer (low sine)
    const low = audio.ctx.createOscillator();
    low.type = "sine";
    low.frequency.setValueAtTime(baseF * 0.5, t0);
    low.frequency.exponentialRampToValueAtTime(baseF * 0.35, t0 + dur);

    // noise breath
    const noiseBuf = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * dur), audio.ctx.sampleRate);
    {
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        // soft noise with a bit of shape
        const n = (Math.random() * 2 - 1);
        ch[i] = n * (0.25 + 0.75 * Math.sin((i / ch.length) * Math.PI));
      }
    }
    const noise = audio.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const hp = audio.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 450;

    // envelope
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6 * vol, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.25 * vol, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const g2 = audio.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.22 * vol, t0 + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    // chain
    osc.connect(bp);
    low.connect(bp);

    bp.connect(g);
    g.connect(audio.master);

    noise.connect(hp);
    hp.connect(g2);
    g2.connect(audio.master);

    // start/stop
    osc.start(t0);
    low.start(t0);
    noise.start(t0);

    osc.stop(t0 + dur + 0.02);
    low.stop(t0 + dur + 0.02);
    noise.stop(t0 + dur + 0.02);
  }

  // ---------- Controls ----------
  let mouseDown = false;
  let lookDelta = 0;
  const keys = new Set();

  function lockPointer() { canvas.requestPointerLock?.(); }
  document.addEventListener("pointerlockchange", () => {
    game.pointerLocked = (document.pointerLockElement === canvas);
  });

  addEventListener("mousedown", (e) => {
    unlockAudio();
    if (input.mobile) return;
    if (e.button === 0) mouseDown = true;
    if (!game.pointerLocked && game.mode === "play") lockPointer();
  });
  addEventListener("mouseup", (e) => {
    if (input.mobile) return;
    if (e.button === 0) mouseDown = false;
  });

  addEventListener("mousemove", (e) => {
    if (input.mobile) return;
    if (!game.pointerLocked) return;
    if (game.mode !== "play") return;
    lookDelta += (e.movementX || 0);
    const my = (e.movementY || 0);
    player.pitch = clamp(player.pitch - my * 0.0022, -0.9, 0.9);
  });

  addEventListener("keydown", () => unlockAudio(), { passive:true });

  function tryUse() {
    if (game.mode !== "play") return;
    const near = nearAnyMachine();
    if (!near) return setHint("Nothing to use here.", false, 1);
    if (near.type === "perk") return buyPerk(near.ref);
    if (near.type === "armor") return openArmor();
    if (near.type === "shop") return openShop();
  }

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);

    if (k === "r") reload();
    if (k === "escape") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "armor") closeArmor();
      else if (game.mode === "settings") closeSettings();
    }

    if (k === "q") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "play" && nearShopKiosk()) openShop();
      else if (game.mode === "play") setHint("Find the green SHOP kiosk and press Q.", false, 1);
    }

    if (k === "e") {
      if (game.mode === "armor") closeArmor();
      else if (game.mode === "play") tryUse();
    }

    if (k === "1") equipSlot(0);
    if (k === "2") equipSlot(1);
    if (k === "3") equipKnife();

    if (k === "h") useMedkit();
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // ---------- Mobile: joystick + look + tap-to-fire ----------
  function setupMobileControls() {
    const joy = input.joy;
    const look = input.look;

    function joyCenterFromRect() {
      const r = ui.joyBase.getBoundingClientRect();
      joy.cx = r.left + r.width / 2;
      joy.cy = r.top + r.height / 2;
    }

    function setStickVisual(nx, ny) {
      const max = 44;
      const x = clamp(nx * max, -max, max);
      const y = clamp(ny * max, -max, max);
      ui.joyStick.style.transform = `translate(${x}px, ${y}px)`;
    }

    function resetStick() {
      joy.active = false; joy.id = null;
      joy.dx = joy.dy = 0;
      setStickVisual(0, 0);
    }

    joyCenterFromRect();
    addEventListener("resize", joyCenterFromRect);

    ui.joyBase.addEventListener("pointerdown", (e) => {
      unlockAudio();
      joyCenterFromRect();
      joy.active = true;
      joy.id = e.pointerId;
      ui.joyBase.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    ui.joyBase.addEventListener("pointermove", (e) => {
      if (!joy.active || e.pointerId !== joy.id) return;
      const dx = (e.clientX - joy.cx);
      const dy = (e.clientY - joy.cy);
      const max = 56;
      joy.dx = clamp(dx / max, -1, 1);
      joy.dy = clamp(dy / max, -1, 1);
      const mag = Math.hypot(joy.dx, joy.dy) || 1;
      const nx = joy.dx / Math.max(1, mag);
      const ny = joy.dy / Math.max(1, mag);
      setStickVisual(nx, ny);
      e.preventDefault();
    });

    ui.joyBase.addEventListener("pointerup", (e) => {
      if (e.pointerId !== joy.id) return;
      resetStick();
      e.preventDefault();
    });
    ui.joyBase.addEventListener("pointercancel", resetStick);

    canvas.addEventListener("pointerdown", (e) => {
      unlockAudio();
      if (!input.mobile) return;

      const x = e.clientX;
      const y = e.clientY;
      const joyRect = ui.joyBase.getBoundingClientRect();
      if (x >= joyRect.left && x <= joyRect.right && y >= joyRect.top && y <= joyRect.bottom) return;

      look.active = true;
      look.id = e.pointerId;
      look.lastX = x;
      look.lastY = y;
      canvas.setPointerCapture(e.pointerId);

      input.firing = true;
      e.preventDefault();
    }, { passive:false });

    canvas.addEventListener("pointermove", (e) => {
      if (!input.mobile) return;
      if (!look.active || e.pointerId !== look.id) return;
      const dx = e.clientX - look.lastX;
      const dy = e.clientY - look.lastY;
      look.lastX = e.clientX;
      look.lastY = e.clientY;

      lookDelta += dx * 1.2;
      player.pitch = clamp(player.pitch - dy * 0.0028, -0.9, 0.9);
      e.preventDefault();
    }, { passive:false });

    canvas.addEventListener("pointerup", (e) => {
      if (!input.mobile) return;
      if (e.pointerId !== look.id) return;
      look.active = false;
      look.id = null;
      input.firing = false;
      e.preventDefault();
    }, { passive:false });

    ui.btnReload.addEventListener("click", () => { unlockAudio(); reload(); });
    ui.btnUse.addEventListener("click", () => { unlockAudio(); tryUse(); });
  }
  setupMobileControls();

  // ---------- Menu Buttons ----------
  ui.btnSettings.addEventListener("click", () => {
    unlockAudio();
    if (game.mode === "settings") closeSettings();
    else openSettings();
  });

  ui.inputMode.addEventListener("change", () => {
    settings.inputMode = ui.inputMode.value;
    saveSettings();
    applyInputModeUI();
  });

  ui.sens.addEventListener("input", () => {
    settings.sens = clamp(Number(ui.sens.value), 0.6, 2.5);
    ui.sensVal.textContent = settings.sens.toFixed(2);
    saveSettings();
  });

  ui.autoSprint.addEventListener("change", () => {
    settings.autoSprint = ui.autoSprint.checked;
    saveSettings();
  });

  ui.btnReset.addEventListener("click", () => {
    unlockAudio();
    if (confirm("Reset ALL progress + settings?")) hardResetSave();
  });

  ui.closeSettings.addEventListener("click", () => { unlockAudio(); closeSettings(); });
  ui.closeShop.addEventListener("click", () => { unlockAudio(); closeShop(); });
  ui.closeArmor.addEventListener("click", () => { unlockAudio(); closeArmor(); });

  // ---------- Weapon init ----------
  syncAmmoToWeapon(player.slots[0]);
  loadGame();

  // ---------- SHOP ----------
  function shopHeader(text) {
    const div = document.createElement("div");
    div.style.gridColumn = "1 / -1";
    div.style.padding = "10px 10px 2px";
    div.style.fontWeight = "900";
    div.style.opacity = "0.92";
    div.textContent = text;
    return div;
  }
  function shopInfo(text) {
    const div = document.createElement("div");
    div.style.gridColumn = "1 / -1";
    div.style.padding = "0 10px 10px";
    div.style.opacity = "0.78";
    div.style.fontSize = "13px";
    div.textContent = text;
    return div;
  }
  function shopButton({title, desc, price, onClick, locked=false, lockText=""}) {
    const btn = document.createElement("button");
    btn.className = "shop-btn" + (locked ? " locked" : "");
    btn.innerHTML = `
      <span class="title">${title}</span>
      <span class="desc">${desc}${locked && lockText ? ` • ${lockText}` : ""}</span>
      <span class="price">${price ? "$"+price : "$0"}</span>
    `;
    btn.addEventListener("click", () => { unlockAudio(); if (!locked) onClick(); });
    return btn;
  }

  function openShop() {
    game.mode = "shop";
    ui.shop.classList.remove("hidden");
    ui.death.classList.add("hidden");
    ui.settingsMenu.classList.add("hidden");
    ui.armorMenu.classList.add("hidden");
    renderShop();
    setHint("SHOP OPEN (paused). Q / ESC to close.", true, 4, 2.0);
    saveGame();
  }
  function closeShop() {
    if (game.mode !== "shop") return;
    game.mode = "play";
    ui.shop.classList.add("hidden");
    setHint("Back to surviving.", true, 2);
    saveGame();
  }

  function ownsWeapon(id) {
    return player.slots.some(s => s && s.id === id) || id === "pistol_rusty";
  }
  function canBuyWeapon(w) {
    if (player.level < w.unlockLevel) return { ok:false, why:`Requires Lv ${w.unlockLevel}` };
    if (player.cash < w.price) return { ok:false, why:`Need $${w.price}` };
    return { ok:true, why:"Buy" };
  }
  function giveWeapon(id) {
    const w = structuredClone(W(id));
    player.slots[1] = w;
    setHint(`Bought: ${w.name}. Slot 2 (press 2).`, true, 3);
    saveGame();
  }

  function renderShop() {
    ui.shopList.innerHTML = "";

    ui.shopList.appendChild(shopInfo(
      `Medkits ${player.medkits} | Scrap ${player.scrap} | Essence ${player.essence} | Armor ${getTotalArmor()}`
    ));

    ui.shopList.appendChild(shopHeader("Utility"));

    ui.shopList.appendChild(shopButton({
      title: "Ammo Pack",
      desc: "+20 reserve ammo (current weapon)",
      price: 18,
      locked: player.cash < 18,
      lockText: "Not enough cash",
      onClick: () => {
        player.cash -= 18;
        if (!player.usingKnife) {
          player.ammo.reserve += 20;
          const w = currentWeapon();
          if (w) saveAmmoFromWeapon(w);
        }
        setHint("Bought ammo (+20).", true, 3);
        saveGame();
        renderShop();
      }
    }));

    ui.shopList.appendChild(shopButton({
      title: "Medkit",
      desc: "+1 Medkit (press H to use)",
      price: 22,
      locked: player.cash < 22,
      lockText: "Not enough cash",
      onClick: () => {
        player.cash -= 22;
        player.medkits += 1;
        setHint("Bought 1 medkit. Press H to heal.", true, 3);
        saveGame();
        renderShop();
      }
    }));

    ui.shopList.appendChild(shopHeader("Weapons"));
    for (const w of WEAPONS) {
      const owned = ownsWeapon(w.id);
      const can = canBuyWeapon(w);
      ui.shopList.appendChild(shopButton({
        title: w.name,
        desc: owned ? "Owned (equip with 1/2)" : `${w.rarity} | Dmg ${w.dmg} | Mag ${w.magSize} | Lv ${w.unlockLevel}`,
        price: w.price,
        locked: (!can.ok && !owned),
        lockText: owned ? "Owned" : can.why,
        onClick: () => {
          if (owned) return setHint("You already own that.", false, 2);
          if (!can.ok) return setHint(can.why, false, 2);
          player.cash -= w.price;
          giveWeapon(w.id);
          renderShop();
        }
      }));
    }

    ui.shopList.appendChild(shopHeader("Tip"));
    ui.shopList.appendChild(shopInfo("Armor crafting is at the ARMOR station (blue). Perks are separate machines."));
  }

  // ---------- ARMOR MENU ----------
  function openArmor() {
    game.mode = "armor";
    ui.armorMenu.classList.remove("hidden");
    ui.shop.classList.add("hidden");
    ui.settingsMenu.classList.add("hidden");
    ui.death.classList.add("hidden");
    renderArmorMenu();
    setHint("ARMOR STATION OPEN (paused). E / ESC to close.", true, 4, 2.0);
    saveGame();
  }
  function closeArmor() {
    if (game.mode !== "armor") return;
    game.mode = "play";
    ui.armorMenu.classList.add("hidden");
    setHint("Armor station closed.", true, 2);
    saveGame();
  }

  function craftArmorRoll(kind) {
    const r = game.round;
    let costScrap = 0, costEss = 0;
    let chances = null;

    if (kind === "basic") {
      costScrap = 18 + Math.floor(r * 1.2);
      costEss = 2 + Math.floor(r * 0.25);
      chances = [0.60, 0.25, 0.11, 0.035, 0.005];
    } else if (kind === "advanced") {
      costScrap = 35 + Math.floor(r * 1.8);
      costEss = 6 + Math.floor(r * 0.50);
      chances = [0.35, 0.30, 0.22, 0.10, 0.03];
    } else {
      costScrap = 60 + Math.floor(r * 2.2);
      costEss = 12 + Math.floor(r * 0.80);
      chances = [0.18, 0.28, 0.28, 0.18, 0.08];
    }

    if (player.scrap < costScrap || player.essence < costEss) {
      setHint(`Need ${costScrap} scrap + ${costEss} essence.`, false, 3, 1.2);
      return;
    }

    player.scrap -= costScrap;
    player.essence -= costEss;

    const roll = Math.random();
    let acc = 0, ri = 0;
    for (let i = 0; i < chances.length; i++) {
      acc += chances[i];
      if (roll <= acc) { ri = i; break; }
    }

    const slot = ARMOR_SLOTS[(Math.random() * ARMOR_SLOTS.length) | 0];
    const piece = makeArmorPiece(slot, ri);
    addArmorToInventory(piece);

    setHint(`Crafted: ${piece.name} (+${piece.armor})`, true, 4, 1.5);
    saveGame();
    renderArmorMenu();
  }

  function equipArmorFromInv(index) {
    const piece = player.armorInv[index];
    if (!piece) return;
    const cur = player.equip[piece.slot];

    player.equip[piece.slot] = piece;
    player.armorInv.splice(index, 1);

    if (!cur) setHint(`Equipped ${piece.name}`, true, 3, 1.2);
    else setHint(`Equipped ${piece.name} (replaced ${cur.name})`, true, 3, 1.4);

    saveGame();
    renderArmorMenu();
  }

  function upgradeEquippedArmor(slot) {
    const it = player.equip[slot];
    if (!it) return setHint(`No ${slot} equipped.`, false, 3, 1.1);
    if (it.rarityIndex >= 4) return setHint("Already Legendary.", true, 2, 1.0);

    const next = it.rarityIndex + 1;
    const costScrap = 28 + next * 22 + Math.floor(game.round * 1.1);
    const costEss = 6 + next * 5 + Math.floor(game.round * 0.35);

    if (player.scrap < costScrap || player.essence < costEss) {
      return setHint(`Need ${costScrap} scrap + ${costEss} essence.`, false, 3, 1.2);
    }

    player.scrap -= costScrap;
    player.essence -= costEss;

    it.rarityIndex = next;
    it.rarity = RARITIES[next].name;

    const base = ARMOR_BASE[it.slot];
    it.armor = Math.max(1, Math.round(base * RARITIES[next].mult));
    it.name = `${it.rarity} ${it.slot === "helmet" ? "Helmet" : it.slot === "chest" ? "Chest" : it.slot === "legs" ? "Leggings" : "Boots"}`;

    setHint(`Upgraded: ${it.name} (+${it.armor})`, true, 4, 1.5);
    saveGame();
    renderArmorMenu();
  }

  function renderArmorMenu() {
    ui.armorList.innerHTML = "";

    ui.armorList.appendChild(shopInfo(
      `Scrap ${player.scrap} | Essence ${player.essence} | Total Armor ${getTotalArmor()}`
    ));

    ui.armorList.appendChild(shopHeader("Craft"));
    ui.armorList.appendChild(shopButton({
      title: "Craft: Basic Roll",
      desc: "Cheaper, mostly Common/Uncommon",
      price: 0,
      locked: false,
      onClick: () => craftArmorRoll("basic"),
    }));
    ui.armorList.appendChild(shopButton({
      title: "Craft: Advanced Roll",
      desc: "Better odds, costs more",
      price: 0,
      locked: false,
      onClick: () => craftArmorRoll("advanced"),
    }));
    ui.armorList.appendChild(shopButton({
      title: "Craft: Elite Roll",
      desc: "Best odds, expensive",
      price: 0,
      locked: false,
      onClick: () => craftArmorRoll("elite"),
    }));

    ui.armorList.appendChild(shopHeader("Equipped"));
    for (const slot of ARMOR_SLOTS) {
      const it = player.equip[slot];
      const name = it ? `${it.name} (+${it.armor})` : `Empty (${slot})`;

      let lockText = "";
      let locked = false;
      if (!it) { locked = true; lockText = "Equip a piece first"; }
      else if (it.rarityIndex >= 4) { locked = true; lockText = "Max"; }
      else {
        const next = it.rarityIndex + 1;
        const costScrap = 28 + next * 22 + Math.floor(game.round * 1.1);
        const costEss = 6 + next * 5 + Math.floor(game.round * 0.35);
        lockText = `Upgrade costs ${costScrap} scrap + ${costEss} essence`;
        if (player.scrap < costScrap || player.essence < costEss) locked = true;
      }

      ui.armorList.appendChild(shopButton({
        title: `Upgrade ${slot}`,
        desc: name,
        price: 0,
        locked,
        lockText,
        onClick: () => { upgradeEquippedArmor(slot); },
      }));
    }

    ui.armorList.appendChild(shopHeader("Inventory"));
    if (player.armorInv.length === 0) {
      ui.armorList.appendChild(shopInfo("No armor crafted yet. Roll some armor above."));
    } else {
      const inv = [...player.armorInv].reverse();
      for (let i = 0; i < inv.length; i++) {
        const piece = inv[i];
        const realIndex = player.armorInv.length - 1 - i;
        const col = RARITIES[piece.rarityIndex].color;
        ui.armorList.appendChild(shopButton({
          title: piece.name,
          desc: `Slot: ${piece.slot} | Armor +${piece.armor} | Click to equip`,
          price: 0,
          locked: false,
          onClick: () => equipArmorFromInv(realIndex),
        }));
        ui.armorList.lastChild.style.borderColor = col.replace(")", ",.35)").replace("rgba","rgba");
      }
    }
  }

  // ---------- SETTINGS MENU ----------
  function openSettings() {
    game.mode = "settings";
    ui.settingsMenu.classList.remove("hidden");
    ui.shop.classList.add("hidden");
    ui.armorMenu.classList.add("hidden");
    ui.death.classList.add("hidden");
    setHint("SETTINGS OPEN (paused).", true, 3, 1.2);
  }
  function closeSettings() {
    if (game.mode !== "settings") return;
    game.mode = "play";
    ui.settingsMenu.classList.add("hidden");
    setHint("Settings closed.", true, 2, 1.0);
  }

  // ---------- Perks ----------
  function buyPerk(machine) {
    const perk = perkById(machine.perkId);
    if (!perk) return;
    if (player.ownedPerks[perk.id]) return setHint(`${perk.name} already owned.`, true, 2);
    if (player.cash < perk.price) return setHint(`Need $${perk.price} for ${perk.name}.`, false, 3);
    player.cash -= perk.price;
    player.ownedPerks[perk.id] = true;
    perk.apply();
    setHint(`PERK BOUGHT: ${perk.name} ✅`, true, 4, 1.6);
    saveGame();
  }

  // ---------- Enemies + Drops + Bullets + Impacts ----------
  let zombies = [];
  let drops = [];
  let bullets = [];
  let impacts = []; // wall impact puffs

  const MAX_CHASERS = 4;

  function countChasers(){
    let c = 0;
    for (const z of zombies) if (z.role === "chaser") c++;
    return c;
  }

  function assignChasers() {
    const chasers = zombies.filter(z => z.role === "chaser");
    if (chasers.length > MAX_CHASERS) {
      chasers.sort((a,b) => dist(player.x,player.y,b.x,b.y) - dist(player.x,player.y,a.x,a.y));
      for (let i = MAX_CHASERS; i < chasers.length; i++) chasers[i].role = "wander";
    }
    let need = MAX_CHASERS - zombies.filter(z => z.role === "chaser").length;
    if (need <= 0) return;

    const candidates = zombies
      .filter(z => z.role !== "chaser")
      .map(z => ({ z, d: dist(player.x, player.y, z.x, z.y) }))
      .sort((a,b) => a.d - b.d);

    for (let i = 0; i < candidates.length && need > 0; i++) {
      candidates[i].z.role = "chaser";
      need--;
    }
  }

  function spawnZombie() {
    for (let tries = 0; tries < 100; tries++) {
      const x = rand(1.5, world.mapW - 1.5);
      const y = rand(1.5, world.mapH - 1.5);
      if (isWall(x, y)) continue;
      if (dist(x, y, shopKiosk.x, shopKiosk.y) < 3.0) continue;
      if (dist(x, y, armorStation.x, armorStation.y) < 3.0) continue;
      if (dist(x, y, player.x, player.y) < 4.0) continue;

      const hp = 65 + game.round * 14;
      const dmg = 8 + game.round * 1.7;

      zombies.push({
        id: `z_${Date.now()}_${(Math.random()*9999)|0}`,
        x, y,
        r: 0.28,
        hp, maxHp: hp,
        speed: (0.72 + game.round * 0.035) * (Math.random() < 0.18 ? 1.35 : 1),
        dmg,
        hitCd: 0,
        type: Math.random() < 0.18 ? "runner" : "walker",

        role: "wander",
        thinkT: rand(0.4, 1.2),
        wanderA: rand(-Math.PI, Math.PI),
        animSeed: rand(0, 1000),

        // moan scheduling (staggered)
        moanT: rand(1.5, 4.5),
      });

      game.alive++;
      return true;
    }
    return false;
  }

  function spawnWallImpact(x, y) {
    // puff + tiny flecks
    impacts.push({
      x, y,
      t: 0,
      life: rand(0.18, 0.32),
      s: rand(0.15, 0.30),
      seed: rand(0, 9999),
      // flecks
      p: Array.from({length: 5 + ((Math.random()*4)|0)}, () => ({
        a: rand(0, Math.PI*2),
        v: rand(0.8, 2.2),
        r: rand(0.004, 0.012),
      })),
    });
    if (impacts.length > 40) impacts.shift();
  }

  function dropCash(x, y, amount) {
    drops.push({ kind:"cash", x, y, amount, t: 14, r: 0.22 });
  }
  function dropMats(x, y) {
    if (Math.random() < 0.85) drops.push({ kind:"scrap", x, y, amount: 1 + (Math.random()<0.40 ? 1 : 0), t: 14, r: 0.22 });
    if (Math.random() < 0.22) drops.push({ kind:"ess", x, y, amount: 1, t: 14, r: 0.22 });
  }

  function gainXP(amount) {
    player.xp += amount;
    while (player.xp >= xpToNext(player.level)) {
      player.xp -= xpToNext(player.level);
      player.level++;
      setHint(`LEVEL UP! Now Lv ${player.level}`, true, 4, 1.6);
    }
    saveGame();
  }

  function handleZombieDeath(z) {
    const cash = Math.floor(rand(7, 14) + game.round * 0.9);
    const xp = 14 + game.round * 2;
    dropCash(z.x, z.y, cash);
    dropMats(z.x, z.y);
    gainXP(xp);

    game.alive = Math.max(0, game.alive - 1);
  }

  // ---------- Items ----------
  function useMedkit() {
    if (game.mode !== "play") return;
    if (player.medkits <= 0) return setHint("No medkits.", false, 2);
    if (player.hp >= player.maxHp) return setHint("Already full HP.", true, 2);

    player.medkits--;
    player.hp = clamp(player.hp + 45, 0, player.maxHp);
    setHint("Used medkit +45 HP 🩹", true, 3);
    saveGame();
  }

  // ---------- Combat ----------
  function reload() {
    if (game.mode !== "play") return;
    if (player.usingKnife) return setHint("Knife doesn't reload.", true, 2);

    const w = currentWeapon();
    if (!w) return;

    if (player.ammo.reloading) return;
    if (player.ammo.mag >= w.magSize) return;
    if (player.ammo.reserve <= 0) return setHint("No reserve ammo. Buy ammo at the shop.", false, 2);

    player.ammo.reloading = true;
    player.ammo.rt = 0;
    setHint("Reloading...", true, 2);
  }

  function knifeAttack() {
    if (game.mode !== "play") return;
    if (player.knife.t > 0) return;

    player.knife.t = player.knife.cd;
    player.knife.swing = 0.14;

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

      if (best.hp <= 0) {
        handleZombieDeath(best);
        zombies = zombies.filter(z => z !== best);
        setHint(`KNIFE KILL!`, true, 3);
      } else {
        setHint("Knife hit!", true, 2);
      }
    } else {
      setHint("Swing!", true, 1);
    }
  }

  function spawnBullet(ang, wpn) {
    bullets.push({
      x: player.x + Math.cos(ang) * 0.45,
      y: player.y + Math.sin(ang) * 0.45,
      vx: Math.cos(ang) * wpn.bulletSpeed,
      vy: Math.sin(ang) * wpn.bulletSpeed,
      life: wpn.range / wpn.bulletSpeed,
      r: 0.06,
      dmg: wpn.dmg,
    });
  }

  function shoot() {
    if (game.mode !== "play") return;
    if (!input.mobile && !game.pointerLocked) return;

    if (player.usingKnife) return knifeAttack();

    const w = currentWeapon();
    if (!w) return;

    const now = performance.now() / 1000;
    if (player.ammo.reloading) return;

    const fireRate = w.fireRate * player.perkFireRateMult;
    if (now - player.ammo.lastShot < 1 / fireRate) return;
    if (player.ammo.mag <= 0) return setHint("Empty. Reload.", false, 2);

    player.ammo.lastShot = now;
    player.ammo.mag--;

    game.muzzle = 0.06;
    game.recoil = 0.10;

    const spread = (Math.random() - 0.5) * w.spread * player.perkSpreadMult;
    const ang = player.a + spread;

    spawnBullet(ang, w);

    saveAmmoFromWeapon(w);
    saveGame();
  }

  // ---------- Pathfinding (BFS flow field) ----------
  function buildFlowFieldFromPlayer() {
    const w = world.mapW, h = world.mapH;
    const distMap = Array.from({ length: h }, () => Array(w).fill(9999));

    const sx = Math.floor(player.x);
    const sy = Math.floor(player.y);

    if (!inBounds(sx, sy) || world.map[sy][sx] === 1) return distMap;

    distMap[sy][sx] = 0;
    const q = [[sx, sy]];
    let qi = 0;

    while (qi < q.length) {
      const [x, y] = q[qi++];
      const d = distMap[y][x] + 1;

      const neigh = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      for (const [nx, ny] of neigh) {
        if (!inBounds(nx, ny)) continue;
        if (world.map[ny][nx] === 1) continue;
        if (distMap[ny][nx] <= d) continue;
        distMap[ny][nx] = d;
        q.push([nx, ny]);
      }
    }
    return distMap;
  }

  // ---------- Raycast ----------
  function castRay(angle) {
    const step = 0.02;
    for (let d = 0; d < 22; d += step) {
      const x = player.x + Math.cos(angle) * d;
      const y = player.y + Math.sin(angle) * d;
      if (isWall(x, y)) return d;
    }
    return 22;
  }

  // ---------- Minimap ----------
  function drawMinimap() {
    const w = innerWidth;
    const size = 170;
    const pad = 14;
    const x0 = w - size - pad;
    const y0 = pad;
    const cell = size / world.mapW;

    ctx.fillStyle = "rgba(10,12,16,.60)";
    ctx.fillRect(x0 - 8, y0 - 8, size + 16, size + 16);
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.strokeRect(x0 - 8, y0 - 8, size + 16, size + 16);

    for (let y = 0; y < world.mapH; y++) {
      for (let x = 0; x < world.mapW; x++) {
        if (world.map[y][x] === 1) {
          ctx.fillStyle = "rgba(255,255,255,.18)";
          ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
        }
      }
    }

    ctx.fillStyle = "rgba(34,197,94,.95)";
    ctx.fillRect(x0 + shopKiosk.x * cell - 3, y0 + shopKiosk.y * cell - 3, 6, 6);

    ctx.fillStyle = "rgba(80,160,255,.95)";
    ctx.fillRect(x0 + armorStation.x * cell - 3, y0 + armorStation.y * cell - 3, 6, 6);

    for (const m of perkMachines) {
      const perk = perkById(m.perkId);
      ctx.fillStyle = perk ? perk.color : "rgba(255,255,255,.7)";
      ctx.fillRect(x0 + m.x * cell - 2.5, y0 + m.y * cell - 2.5, 5, 5);
    }

    ctx.fillStyle = "rgba(239,68,68,.85)";
    for (const z of zombies) {
      ctx.beginPath();
      ctx.arc(x0 + z.x * cell, y0 + z.y * cell, (z.role==="chaser"?2.6:2.0), 0, Math.PI * 2);
      ctx.fill();
    }

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

  // ---------- Gun Model (forward-facing) ----------
  function gunStyleFor(id) {
    if (id === "pistol_rusty")    return { body:"rgba(70,78,92,.97)",  dark:"rgba(18,20,26,.98)", accent:"rgba(170,120,60,.80)", glass:"rgba(80,200,140,.20)", scale:1.00, optic:true };
    if (id === "pistol_service")  return { body:"rgba(62,72,88,.97)",  dark:"rgba(14,16,20,.98)", accent:"rgba(80,160,255,.80)", glass:"rgba(80,160,255,.18)", scale:1.03, optic:true };
    if (id === "pistol_marksman") return { body:"rgba(55,64,78,.97)",  dark:"rgba(12,14,18,.98)", accent:"rgba(220,220,230,.80)", glass:"rgba(160,255,200,.16)", scale:1.06, optic:true };
    if (id === "pistol_relic")    return { body:"rgba(46,54,66,.97)",  dark:"rgba(10,12,16,.98)", accent:"rgba(200,80,255,.78)", glass:"rgba(200,80,255,.16)", scale:1.10, optic:true };
    return { body:"rgba(62,72,88,.97)", dark:"rgba(14,16,20,.98)", accent:"rgba(34,197,94,.80)", glass:"rgba(80,200,140,.18)", scale:1.00, optic:true };
  }

  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawGunModel(dt) {
    const w = innerWidth, h = innerHeight;

    game.recoil = Math.max(0, game.recoil - dt * 2.4);
    game.muzzle = Math.max(0, game.muzzle - dt * 3.4);

    const moving = (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d")) ||
      (input.mobile && (Math.hypot(input.joy.dx, input.joy.dy) > 0.12));

    const t = performance.now() / 1000;
    const bob = moving ? Math.sin(t * 7.0) * 3.0 : 0;
    const sway = moving ? Math.sin(t * 3.5) * 2.0 : 0;

    const rx = game.recoil * 22;
    const ry = game.recoil * 16;

    const baseX = w * 0.73 + rx;
    const baseY = h * 0.84 + bob + ry;

    const cw = currentWeapon();
    const sid = cw ? cw.id : "knife";
    const style = gunStyleFor(sid);

    const S = style.scale;

    ctx.save();
    ctx.translate(baseX, baseY);

    const roll = (-0.010 * (sway / 2)) + (game.recoil * 0.05);
    ctx.rotate(roll);

    ctx.globalAlpha = 0.985;

    const skin = "rgba(190,150,120,.92)";
    const glove = "rgba(16,18,24,.97)";

    ctx.fillStyle = skin;
    rr(-150, 40, 140, 26, 10); ctx.fill();
    ctx.fillStyle = glove;
    rr(-48, 22, 60, 52, 12); ctx.fill();

    ctx.fillStyle = skin;
    rr(10, 52, 150, 26, 10); ctx.fill();
    ctx.fillStyle = glove;
    rr(6, 34, 70, 58, 12); ctx.fill();

    if (player.usingKnife) {
      ctx.fillStyle = "rgba(20,20,20,.92)";
      rr(-22, 10, 44, 70, 10); ctx.fill();
      ctx.fillStyle = "rgba(220,220,230,.96)";
      rr(-8, -120, 16, 140, 6); ctx.fill();

      if (player.knife.swing > 0) {
        const a = clamp(player.knife.swing / 0.14, 0, 1);
        ctx.fillStyle = `rgba(220,220,230,${0.20 * a})`;
        rr(-w * 0.18, -h * 0.25, w * 0.36, h * 0.40, 30);
        ctx.fill();
      }

      ctx.restore();
      return;
    }

    const gunW = 210 * S;
    const bodyY = -10 * S;
    const bodyH = 110 * S;

    ctx.fillStyle = style.body;
    rr(-gunW * 0.30, bodyY, gunW * 0.60, bodyH, 14 * S);
    ctx.fill();

    ctx.fillStyle = style.dark;
    rr(-gunW * 0.26, bodyY + 10 * S, gunW * 0.52, 22 * S, 10 * S);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.05)";
    rr(-gunW * 0.24, bodyY + 40 * S, gunW * 0.48, 10 * S, 6 * S);
    ctx.fill();

    ctx.fillStyle = style.dark;
    rr(-gunW * 0.12, bodyY + bodyH - 4 * S, gunW * 0.24, 120 * S, 14 * S);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 6 * S;
    ctx.beginPath();
    ctx.ellipse(0, bodyY + bodyH + 30 * S, 34 * S, 22 * S, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = style.dark;
    rr(-gunW * 0.10, bodyY - 150 * S, gunW * 0.20, 150 * S, 10 * S);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,.65)";
    ctx.lineWidth = 6 * S;
    ctx.beginPath();
    ctx.arc(0, bodyY - 154 * S, 18 * S, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,.70)";
    rr(-8 * S, bodyY - 188 * S, 16 * S, 26 * S, 5 * S);
    ctx.fill();

    if (style.optic) {
      ctx.fillStyle = style.dark;
      rr(-58 * S, bodyY - 34 * S, 116 * S, 44 * S, 10 * S);
      ctx.fill();

      ctx.fillStyle = "rgba(26,30,40,.96)";
      rr(-64 * S, bodyY - 96 * S, 128 * S, 70 * S, 12 * S);
      ctx.fill();

      ctx.fillStyle = style.glass;
      rr(-42 * S, bodyY - 82 * S, 84 * S, 42 * S, 10 * S);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 3 * S;
      rr(-42 * S, bodyY - 82 * S, 84 * S, 42 * S, 10 * S);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,80,80,.35)";
      ctx.beginPath();
      ctx.arc(0, bodyY - 61 * S, 4.2 * S, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = style.accent;
    rr(-gunW * 0.22, bodyY + 68 * S, gunW * 0.44, 7 * S, 4 * S);
    ctx.fill();

    if (game.muzzle > 0) {
      const a = 0.75 * (game.muzzle / 0.06);
      ctx.fillStyle = `rgba(255,210,80,${a})`;
      ctx.beginPath();
      ctx.arc(0, bodyY - 198 * S, 26 * S, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255,255,255,${a * 0.45})`;
      ctx.beginPath();
      ctx.arc(0, bodyY - 198 * S, 12 * S, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,.12)";
    rr(-gunW * 0.30, bodyY + 8 * S, gunW * 0.60, bodyH, 14 * S);
    ctx.fill();

    ctx.restore();
  }

  // ---------- Billboard helper ----------
  function drawBillboard(screenX, top, size, title, color, sub="") {
    const left = screenX - size / 2;

    ctx.fillStyle = "rgba(30,34,44,.94)";
    ctx.fillRect(left + size*0.10, top + size*0.16, size*0.80, size*0.68);

    ctx.fillStyle = color;
    ctx.fillRect(left + size*0.14, top + size*0.18, size*0.72, size*0.18);

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = `900 ${Math.max(10, size*0.11)}px system-ui`;
    ctx.fillText(title, left + size*0.18, top + size*0.31);

    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(left + size*0.16, top + size*0.42, size*0.68, size*0.04);
    ctx.fillRect(left + size*0.16, top + size*0.50, size*0.54, size*0.04);
    ctx.fillRect(left + size*0.16, top + size*0.58, size*0.60, size*0.04);

    if (sub) {
      ctx.fillStyle = "rgba(255,255,255,.70)";
      ctx.font = `800 ${Math.max(10, size*0.085)}px system-ui`;
      ctx.fillText(sub, left + size*0.18, top + size*0.70);
    }

    ctx.fillStyle = color.replace(")", ",.14)").replace("rgba", "rgba");
    ctx.fillRect(left + size*0.12, top + size*0.18, size*0.76, size*0.66);
  }

  // ---------- Render ----------
  function render(dt) {
    const w = innerWidth, h = innerHeight;
    const horizon = (h / 2) + (player.pitch * (h * 0.35));

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = "#070a0f";
    ctx.fillRect(0, horizon, w, h - horizon);

    const rays = Math.floor(w / 2);
    for (let i = 0; i < rays; i++) {
      const pct = i / (rays - 1);
      const ang = player.a - player.fov / 2 + pct * player.fov;

      let d = castRay(ang);
      d *= Math.cos(ang - player.a);

      const wallH = Math.min(h, (h * 1.2) / (d + 0.0001));
      const x = i * (w / rays);
      const y = horizon - wallH / 2;

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

    const sprites = [];

    for (const b of bullets) sprites.push({ kind:"bullet", ref:b, x:b.x, y:b.y, d: dist(player.x, player.y, b.x, b.y) });
    for (const im of impacts) sprites.push({ kind:"impact", ref:im, x:im.x, y:im.y, d: dist(player.x, player.y, im.x, im.y) });
    for (const z of zombies) sprites.push({ kind:"z", ref:z, x:z.x, y:z.y, d: dist(player.x, player.y, z.x, z.y) });
    for (const d0 of drops) sprites.push({ kind:"drop", ref:d0, x:d0.x, y:d0.y, d: dist(player.x, player.y, d0.x, d0.y) });

    sprites.push({ kind:"shop", x:shopKiosk.x, y:shopKiosk.y, d: dist(player.x, player.y, shopKiosk.x, shopKiosk.y) });
    sprites.push({ kind:"armor", x:armorStation.x, y:armorStation.y, d: dist(player.x, player.y, armorStation.x, armorStation.y) });
    for (const pm of perkMachines) sprites.push({ kind:"perk", ref:pm, x:pm.x, y:pm.y, d: dist(player.x, player.y, pm.x, pm.y) });

    sprites.sort((a,b) => b.d - a.d);

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

      const spriteBottom = horizon + size * 0.35;
      const top = spriteBottom - size;
      const left = screenX - size / 2;

      if (s.kind === "shop") {
        drawBillboard(screenX, top, size * 0.92, "SHOP", "rgba(34,197,94,.95)", "Press Q");
        continue;
      }
      if (s.kind === "armor") {
        drawBillboard(screenX, top, size * 0.92, "ARMOR", "rgba(80,160,255,.95)", "Press E");
        continue;
      }
      if (s.kind === "perk") {
        const perk = perkById(s.ref.perkId);
        const owned = perk && player.ownedPerks[perk.id];
        const title = perk ? perk.name : "PERK";
        const sub = perk ? (owned ? "Owned" : `$${perk.price} • Press E`) : "Press E";
        drawBillboard(screenX, top, size * 0.92, title, perk ? perk.color : "rgba(255,255,255,.9)", sub);
        continue;
      }
      if (s.kind === "drop") {
        const d0 = s.ref;
        let col = "rgba(34,197,94,.9)";
        let label = "$";
        if (d0.kind === "scrap") { col = "rgba(160,175,190,.92)"; label = "S"; }
        if (d0.kind === "ess")   { col = "rgba(200,80,255,.92)";  label = "E"; }

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.10, Math.max(6, size * 0.09), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.font = "900 14px system-ui";
        ctx.fillText(label, screenX - 5, horizon + size * 0.10 + 5);
        continue;
      }
      if (s.kind === "bullet") {
        const bsz = Math.max(2, size * 0.08);
        ctx.fillStyle = "rgba(0,0,0,.70)";
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.05, bsz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (s.kind === "impact") {
        const im = s.ref;
        const a = clamp(1 - (im.t / im.life), 0, 1);
        const puff = size * (0.10 + im.s * 0.30) * (0.8 + im.t * 2.0);

        // smoke puff
        ctx.fillStyle = `rgba(210,220,235,${0.16 * a})`;
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.08, puff, 0, Math.PI * 2);
        ctx.fill();

        // darker core
        ctx.fillStyle = `rgba(20,22,28,${0.18 * a})`;
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.08, puff * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // spark flecks
        for (const p of im.p) {
          const sx = screenX + Math.cos(p.a) * (p.v * size * 0.18) * im.t;
          const sy = (horizon + size * 0.08) + Math.sin(p.a) * (p.v * size * 0.10) * im.t;
          const rr0 = Math.max(1, size * p.r);
          ctx.fillStyle = `rgba(255,210,80,${0.22 * a})`;
          ctx.fillRect(sx - rr0*0.5, sy - rr0*0.5, rr0, rr0);
        }
        continue;
      }
      if (s.kind === "z") {
        const z = s.ref;

        const runner = z.type === "runner";
        const chaser = z.role === "chaser";

        const baseBody = runner ? [239,68,68] : [155,170,185];
        const baseDark = runner ? [120,20,20] : [65,78,92];

        const t = (performance.now() / 1000) + z.animSeed;
        const pace = (runner ? 9.0 : 6.0) * (chaser ? 1.18 : 1.0);

        const walk = Math.sin(t * pace);
        const walk2 = Math.sin(t * pace + Math.PI/2);
        const sway = Math.sin(t * pace * 0.5);
        const bob = Math.abs(walk) * (size * 0.018);
        const lean = sway * (size * 0.03);

        const shade = clamp(1 - distTo / 11, 0.2, 1);
        const bc = `rgba(${Math.floor(baseBody[0]*shade)},${Math.floor(baseBody[1]*shade)},${Math.floor(baseBody[2]*shade)},.92)`;
        const dc = `rgba(${Math.floor(baseDark[0]*shade)},${Math.floor(baseDark[1]*shade)},${Math.floor(baseDark[2]*shade)},.92)`;

        // silhouette outline color
        const oc = `rgba(0,0,0,${0.22 * shade})`;

        const headR = size * 0.12;
        const torsoW = size * 0.44;
        const torsoH = size * 0.48;

        const torsoX = left + size*0.28 + lean*0.08;
        const torsoY = top + size*0.34 + bob;

        const legSwing = walk * (size * 0.06);
        const legW = size * 0.11;
        const legH = size * 0.27;
        const legY = top + size*0.70 + bob;

        const armSwing = -walk * (size * 0.07);
        const armW = size * 0.13;
        const armH = size * 0.36;
        const armY = top + size*0.41 + bob;

        // shadow
        ctx.fillStyle = "rgba(0,0,0,.22)";
        ctx.beginPath();
        ctx.ellipse(screenX, horizon + size*0.34, size*0.18, size*0.07, 0, 0, Math.PI*2);
        ctx.fill();

        // OUTLINE pass (slightly bigger shapes behind)
        ctx.fillStyle = oc;
        ctx.fillRect(left + size*0.35 + legSwing - 2, legY - 2, legW + 4, legH + 4);
        ctx.fillRect(left + size*0.54 - legSwing - 2, legY - 2, legW + 4, legH + 4);
        ctx.fillRect(torsoX - 3, torsoY - 3, torsoW + 6, torsoH + 6);
        ctx.fillRect(left + size*0.17 + armSwing - 2, armY - 2, armW + 4, armH + 4);
        ctx.fillRect(left + size*0.70 - armSwing - 2, armY - 2, armW + 4, armH + 4);

        // legs
        ctx.fillStyle = dc;
        ctx.fillRect(left + size*0.36 + legSwing, legY, legW, legH);
        ctx.fillRect(left + size*0.54 - legSwing, legY, legW, legH);

        // torso (two-tone shading for depth)
        ctx.fillStyle = bc;
        ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        ctx.fillRect(torsoX + torsoW*0.55, torsoY, torsoW*0.45, torsoH);

        // arms
        ctx.fillStyle = dc;
        ctx.fillRect(left + size*0.18 + armSwing, armY, armW, armH);
        ctx.fillRect(left + size*0.70 - armSwing, armY, armW, armH);

        // head + outline
        const headX = screenX + lean*0.10;
        const headY = top + size*0.24 + bob + walk2 * (size*0.02);

        ctx.fillStyle = oc;
        ctx.beginPath();
        ctx.arc(headX, headY, headR * 1.10, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = bc;
        ctx.beginPath();
        ctx.arc(headX, headY, headR, 0, Math.PI*2);
        ctx.fill();

        // face shadow
        ctx.fillStyle = "rgba(0,0,0,.22)";
        ctx.beginPath();
        ctx.arc(headX + headR*0.18, headY + headR*0.15, headR*0.85, 0, Math.PI*2);
        ctx.fill();

        // eyes
        ctx.fillStyle = "rgba(0,0,0,.48)";
        ctx.fillRect(headX - headR*0.55, headY - headR*0.10, headR*0.35, headR*0.22);
        ctx.fillRect(headX + headR*0.20, headY - headR*0.10, headR*0.35, headR*0.22);

        // chaser aura
        if (chaser) {
          ctx.fillStyle = "rgba(255,80,80,.16)";
          ctx.beginPath();
          ctx.arc(headX, headY, headR*1.55, 0, Math.PI*2);
          ctx.fill();
        }

        // HP bar
        const pct = clamp(z.hp / z.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(left, top - 10, size, 6);
        ctx.fillStyle = "rgba(34,197,94,.9)";
        ctx.fillRect(left, top - 10, size * pct, 6);
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

    const near = nearAnyMachine();
    if (near && game.mode === "play") {
      if (near.type === "shop") setHint("At SHOP: Q (or USE on mobile).", true, 0, 0.25);
      if (near.type === "armor") setHint("At ARMOR: E (or USE on mobile).", true, 0, 0.25);
      if (near.type === "perk") setHint("Perk machine: E (or USE on mobile).", true, 0, 0.25);
    }
  }

  // ---------- Death ----------
  function die() {
    game.mode = "dead";
    ui.shop.classList.add("hidden");
    ui.armorMenu.classList.add("hidden");
    ui.settingsMenu.classList.add("hidden");
    ui.death.classList.remove("hidden");
    setHint("You died. Click Restart.", false, 5, 2.0);
    document.exitPointerLock?.();
    saveGame();
  }

  ui.restart.addEventListener("click", () => {
    unlockAudio();
    zombies = [];
    drops = [];
    bullets = [];
    impacts = [];

    game.mode = "play";
    ui.shop.classList.add("hidden");
    ui.armorMenu.classList.add("hidden");
    ui.settingsMenu.classList.add("hidden");
    ui.death.classList.add("hidden");

    player.x = 1.6; player.y = 1.6; player.a = 0;
    player.hp = player.maxHp;
    player.stamina = player.staminaMax;

    startRound(game.round, true);

    setHint("Restarted. Progress kept.", true, 4, 1.6);
    saveGame();
  });

  // ---------- Round System ----------
  function startRound(r, restart=false) {
    game.round = r;
    game.toSpawn = 8 + r * 3;
    game.spawnBudget = game.toSpawn;
    game.alive = 0;
    game.betweenT = restart ? 0.6 : 2.2;

    setHint(restart ? `Round ${r} restarted.` : `Round ${r} starting...`, true, 4, 1.4);
  }

  startRound(game.round || 1, true);

  // ---------- Loop ----------
  let last = performance.now();
  let saveTimer = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    ui.hp.textContent = Math.max(0, Math.floor(player.hp));
    ui.hpMax.textContent = Math.floor(player.maxHp);
    ui.armor.textContent = String(getTotalArmor());
    ui.cash.textContent = player.cash;
    ui.round.textContent = game.round;
    ui.alive.textContent = String(game.alive);
    ui.level.textContent = player.level;
    ui.xp.textContent = player.xp;
    ui.scrap.textContent = player.scrap;
    ui.essence.textContent = player.essence;

    ui.stamFill.style.width = `${clamp(player.stamina / player.staminaMax, 0, 1) * 100}%`;
    ui.chasers.textContent = String(countChasers());

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

    if (input.mobile) {
      const near = nearAnyMachine();
      if (near && game.mode === "play") ui.btnUse.classList.remove("hidden");
      else ui.btnUse.classList.add("hidden");
    }

    // impacts update (wall puffs)
    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].t += dt;
      if (impacts[i].t >= impacts[i].life) impacts.splice(i, 1);
    }

    render(dt);

    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; saveGame(); }

    if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
    if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

    if (game.mode !== "play") return;

    const wpn = currentWeapon();
    if (!player.usingKnife && wpn && player.ammo.reloading) {
      player.ammo.rt += dt;
      const reloadTime = wpn.reloadTime * player.perkReloadMult;
      if (player.ammo.rt >= reloadTime) {
        const need = wpn.magSize - player.ammo.mag;
        const take = Math.min(need, player.ammo.reserve);
        player.ammo.reserve -= take;
        player.ammo.mag += take;
        player.ammo.reloading = false;
        setHint("Reloaded.", true, 2);
        saveAmmoFromWeapon(wpn);
        saveGame();
      }
    }

    player.a += lookDelta * 0.0022 * settings.sens;
    lookDelta = 0;

    let mxv = 0, myv = 0;

    if (!input.mobile) {
      if (keys.has("w")) { mxv += Math.cos(player.a); myv += Math.sin(player.a); }
      if (keys.has("s")) { mxv -= Math.cos(player.a); myv -= Math.sin(player.a); }
      if (keys.has("a")) { mxv += Math.cos(player.a - Math.PI / 2); myv += Math.sin(player.a - Math.PI / 2); }
      if (keys.has("d")) { mxv += Math.cos(player.a + Math.PI / 2); myv += Math.sin(player.a + Math.PI / 2); }
    } else {
      const jx = input.joy.dx;
      const jy = input.joy.dy;
      const f = -jy;
      const s = jx;
      mxv += Math.cos(player.a) * f + Math.cos(player.a + Math.PI/2) * s;
      myv += Math.sin(player.a) * f + Math.sin(player.a + Math.PI/2) * s;
    }

    const len = Math.hypot(mxv, myv) || 1;
    mxv /= len; myv /= len;

    const moving = (Math.abs(mxv) + Math.abs(myv)) > 0.01;

    const wantsSprintPC = (!input.mobile && keys.has("shift"));
    const wantsSprintMobile = (input.mobile && settings.autoSprint && (Math.hypot(input.joy.dx, input.joy.dy) > 0.85));
    const wantsSprint = wantsSprintPC || wantsSprintMobile;

    let moveSpeed = player.speed;
    if (wantsSprint && player.stamina > 1 && moving) {
      moveSpeed *= player.sprintMult;
      player.stamina = Math.max(0, player.stamina - player.staminaDrain * dt);
    } else {
      player.stamina = Math.min(player.staminaMax, player.stamina + player.staminaRegen * dt);
    }

    const nx = player.x + mxv * moveSpeed * dt;
    const ny = player.y + myv * moveSpeed * dt;
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;

    if (!input.mobile) {
      if (mouseDown) shoot();
    } else {
      if (input.firing) shoot();
    }

    if (game.betweenT > 0) {
      game.betweenT -= dt;
      if (game.betweenT <= 0) {
        setHint(`ROUND ${game.round} LIVE. Survive.`, true, 3, 1.2);
      }
    }

    if (game.betweenT <= 0) {
      if (game.spawnBudget > 0) {
        const spawnChance = 0.10 + game.round * 0.004;
        if (Math.random() < spawnChance) {
          const ok = spawnZombie();
          if (ok) game.spawnBudget--;
        }
      }
    }

    if (game.spawnBudget <= 0 && game.alive <= 0 && game.betweenT <= 0) {
      startRound(game.round + 1, false);
      saveGame();
    }

    assignChasers();

    game.flowTimer -= dt;
    if (game.flowTimer <= 0) {
      game.flowTimer = 0.25;
      game.flow = buildFlowFieldFromPlayer();
    }
    const flow = game.flow;

    // bullets update + WALL IMPACTS
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }

      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;

      if (isWall(nx, ny)) {
        // spawn impact at last safe-ish point toward the wall
        const back = 0.03;
        spawnWallImpact(b.x + (b.vx * dt) * (1 - back), b.y + (b.vy * dt) * (1 - back));
        bullets.splice(i, 1);
        continue;
      }

      b.x = nx; b.y = ny;

      let hit = null;
      for (const z of zombies) {
        if (dist(b.x, b.y, z.x, z.y) < (z.r + b.r)) { hit = z; break; }
      }
      if (hit) {
        hit.hp -= b.dmg;
        bullets.splice(i, 1);

        if (hit.hp <= 0) {
          handleZombieDeath(hit);
          zombies = zombies.filter(z => z !== hit);
        }
      }
    }

    // zombies update + MOANS
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.hitCd = Math.max(0, z.hitCd - dt);

      const spBase = z.speed * (z.type === "runner" ? 1.18 : 1);

      if (z.role === "chaser") {
        const zx0 = Math.floor(z.x);
        const zy0 = Math.floor(z.y);

        let bestCell = [zx0, zy0];
        let bestVal = (flow && flow[zy0] && flow[zy0][zx0] != null) ? flow[zy0][zx0] : 9999;

        const opts = [[zx0+1,zy0],[zx0-1,zy0],[zx0,zy0+1],[zx0,zy0-1]];
        for (const [cx, cy] of opts) {
          if (!inBounds(cx, cy)) continue;
          if (world.map[cy][cx] === 1) continue;
          const v = flow && flow[cy] ? flow[cy][cx] : 9999;
          if (v < bestVal) { bestVal = v; bestCell = [cx, cy]; }
        }

        const tx = bestCell[0] + 0.5;
        const ty = bestCell[1] + 0.5;

        const ang = Math.atan2(ty - z.y, tx - z.x);
        const zx = z.x + Math.cos(ang) * spBase * dt;
        const zy = z.y + Math.sin(ang) * spBase * dt;
        if (!isWall(zx, z.y)) z.x = zx;
        if (!isWall(z.x, zy)) z.y = zy;

      } else {
        z.thinkT -= dt;
        if (z.thinkT <= 0) {
          z.thinkT = rand(0.6, 1.4);
          z.wanderA += rand(-1.2, 1.2);
        }

        const ang = z.wanderA;
        const step = spBase * 0.55 * dt;
        const zx = z.x + Math.cos(ang) * step;
        const zy = z.y + Math.sin(ang) * step;

        if (isWall(zx, z.y) || isWall(z.x, zy)) {
          z.wanderA += rand(1.2, 2.6);
        } else {
          z.x = zx; z.y = zy;
        }
      }

      // moan scheduling (only if close-ish + not spammy)
      z.moanT -= dt;
      if (z.moanT <= 0) {
        const d = dist(player.x, player.y, z.x, z.y);
        if (d < 14.5) {
          const isRunner = (z.type === "runner");
          const isChaser = (z.role === "chaser");
          // probability based on proximity
          const p = clamp(1 - d / 14.5, 0, 1);
          if (Math.random() < (0.35 + p * 0.55)) {
           // pan based on where the zombie is relative to your view
const angTo = Math.atan2(z.y - player.y, z.x - player.x);
let da = angTo - player.a;
while (da > Math.PI) da -= Math.PI * 2;
while (da < -Math.PI) da += Math.PI * 2;

// map angle to stereo pan (-1 left, +1 right)
const pan = clamp(da / (player.fov * 0.75), -1, 1);

playZombieGroan(d, pan);

          }
        }
        // next moan time
        z.moanT = rand(2.2, 5.8) * (z.type === "runner" ? 0.85 : 1.0) * (z.role === "chaser" ? 0.85 : 1.0);
      }

      const d = dist(player.x, player.y, z.x, z.y);
      if (d < 0.55 && z.hitCd <= 0) {
        z.hitCd = 0.6;

        const armor = getTotalArmor();
        const reduction = clamp(armor * 0.02, 0, 0.60);
        const finalDmg = Math.max(1, Math.round(z.dmg * (1 - reduction)));

        player.hp -= finalDmg;
        player.lastHurtTime = performance.now() / 1000;

        setHint(`You're getting chewed! (-${finalDmg})`, false, 4, 0.8);
        if (player.hp <= 0) die();
        saveGame();
      }
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d0 = drops[i];
      d0.t -= dt;

      if (dist(player.x, player.y, d0.x, d0.y) < 0.55) {
        if (d0.kind === "cash") {
          player.cash += d0.amount;
          setHint(`Picked up $${d0.amount}.`, true, 2, 0.75);
        } else if (d0.kind === "scrap") {
          player.scrap += d0.amount;
          setHint(`Picked up Scrap +${d0.amount}.`, true, 2, 0.75);
        } else if (d0.kind === "ess") {
          player.essence += d0.amount;
          setHint(`Picked up Essence +${d0.amount}.`, true, 2, 0.75);
        }
        drops.splice(i, 1);
        saveGame();
        continue;
      }
      if (d0.t <= 0) drops.splice(i, 1);
    }

    const secondsNow = performance.now() / 1000;
    if (player.hp > 0 && player.hp < player.maxHp) {
      if (secondsNow - player.lastHurtTime >= player.regenDelay) {
        player.hp = Math.min(player.maxHp, player.hp + player.regenRate * dt);
      }
    }
  }

  // ---------- Start ----------
  setHint("Survive rounds. Shop = Q (green). Armor = E (blue). Perks = E. Sprint = Shift. Medkit = H.", true, 3, 2.2);
  requestAnimationFrame(tick);

})();

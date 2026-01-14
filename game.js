// Project Game Maker: Zombie RPG FPS (Raycast) - FULL REWRITE v6 (Mystery Box Edition)
// Keeps: raycast, stamina sprint, perks, armor station, drops, save/load, mobile controls,
// procedural zombie moan (WebAudio), wall impacts, improved zombie drawing (no images).
//
// Adds:
// - Weapon database (30+ weapons) + weapon categories/types
// - Mystery Box station + roll/spin overlay animation
// - Pack-a-Punch hooks (wired, stubbed for you to extend)

(() => {
  "use strict";

  // =========================
  // Canvas
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

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

  // =========================
  // UI (existing IDs from your HTML)
  // =========================
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

  // =========================
  // Mystery Box Overlay (created in JS so you don't need HTML edits)
  // =========================
  function ensureMysteryBoxOverlay() {
    if (document.getElementById("mbOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "mbOverlay";
    overlay.className = "overlay hidden";
    overlay.innerHTML = `
      <div class="mbPanel">
        <div class="mbTop">
          <div>
            <div class="mbTitle">MYSTERY BOX</div>
            <div class="mbSpinLine" id="mbSpinLine">Roll a random weapon into Slot 2.</div>
          </div>
          <div class="mbCost" id="mbCost">$150</div>
        </div>

        <div class="mbRoll">
          <div class="mbGlow"></div>
          <div class="mbWindow">
            <div class="mbLabel">ROLLING RESULT</div>
            <div class="mbName" id="mbName">---</div>
            <div class="mbMeta" id="mbMeta">
              <span class="badge">Type: ---</span>
              <span class="badge">Rarity: ---</span>
              <span class="badge">Dmg: ---</span>
              <span class="badge">Mag: ---</span>
            </div>
          </div>
        </div>

        <div class="mbActions">
          <button id="mbClose">Close</button>
          <button class="primary" id="mbSpin">SPIN</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    mb.ui.overlay = overlay;
    mb.ui.name = document.getElementById("mbName");
    mb.ui.meta = document.getElementById("mbMeta");
    mb.ui.cost = document.getElementById("mbCost");
    mb.ui.spinLine = document.getElementById("mbSpinLine");
    mb.ui.btnClose = document.getElementById("mbClose");
    mb.ui.btnSpin = document.getElementById("mbSpin");

    mb.ui.btnClose.addEventListener("click", () => { unlockAudio(); closeMysteryBox(); });
    mb.ui.btnSpin.addEventListener("click", () => { unlockAudio(); spinMysteryBox(); });
  }

  // =========================
  // Utils
  // =========================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const rand = (a, b) => a + Math.random() * (b - a);

  // =========================
  // Smart Hints
  // =========================
  let hintState = { text:"", until:0, prio:0 };
  function setHint(t, ok=false, prio=1, hold=1.25) {
    const now = performance.now() / 1000;
    if (now < hintState.until && prio < hintState.prio) return;
    hintState = { text:t||"", until: now + hold, prio };
    if (ui.hint) {
      ui.hint.textContent = hintState.text;
      ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
    }
  }

  // =========================
  // Settings (saved)
  // =========================
  const SAVE_KEY = "pgm_zombie_rpg_save_v6";
  const SETTINGS_KEY = "pgm_zombie_rpg_settings_v6";
  const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  const settings = {
    inputMode: "auto", // auto | pc | mobile
    sens: 1.0,
    autoSprint: true,
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
    if (ui.inputMode) ui.inputMode.value = settings.inputMode;
    if (ui.sens) ui.sens.value = String(settings.sens);
    if (ui.sensVal) ui.sensVal.textContent = settings.sens.toFixed(2);
    if (ui.autoSprint) ui.autoSprint.checked = settings.autoSprint;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }
  loadSettings();

  function effectiveMobile() {
    if (settings.inputMode === "mobile") return true;
    if (settings.inputMode === "pc") return false;
    return isTouchDevice;
  }

  // =========================
  // Input
  // =========================
  const input = {
    mobile: effectiveMobile(),
    joy: { active:false, id:null, cx:0, cy:0, dx:0, dy:0 },
    look: { active:false, id:null, lastX:0, lastY:0 },
    firing: false,
  };

  function applyInputModeUI() {
    input.mobile = effectiveMobile();
    if (ui.mobileUI && ui.controlsLine) {
      if (input.mobile) {
        ui.mobileUI.classList.remove("hidden");
        ui.controlsLine.textContent =
          "Mobile: Left joystick move | Right drag look | Tap right shoots | RELOAD button | USE near stations/machines";
      } else {
        ui.mobileUI.classList.add("hidden");
        ui.controlsLine.textContent =
          "Click to play | Move WASD | Reload R | Shop Q | Use/Buy E | Sprint Shift | Mystery Box E";
      }
    }
  }
  applyInputModeUI();

  // =========================
  // XP
  // =========================
  function xpToNext(level) {
    return Math.floor(70 + (level - 1) * 45 + Math.pow(level - 1, 1.25) * 20);
  }

  // =========================
  // World / Map
  // =========================
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

  function inBounds(ix, iy) { return ix >= 0 && iy >= 0 && ix < world.mapW && iy < world.mapH; }
  function isWall(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (!inBounds(ix, iy)) return true;
    return world.map[iy][ix] === 1;
  }

  // =========================
  // Stations
  // =========================
  const shopKiosk = { x: 2.05, y: 1.25, r: 1.15 };
  const armorStation = { x: 21.2, y: 22.0, r: 1.25 };

  // NEW: Mystery Box station (place it somewhere open)
  const mysteryBoxStation = { x: 12.1, y: 2.2, r: 1.10, cost: 150 };

  const PERKS = [
    { id:"jug",   name:"Juggernog", price:250, desc:"+60 Max HP", color:"rgba(255,80,80,.95)",
      apply: () => { player.maxHp += 60; player.hp = Math.min(player.maxHp, player.hp + 60); } },
    { id:"stam",  name:"Stamin-Up", price:220, desc:"+35 stamina, +regen", color:"rgba(80,255,140,.95)",
      apply: () => { player.staminaMax += 35; player.stamina = player.staminaMax; player.staminaRegen += 10; } },
    { id:"speed", name:"Speed Cola", price:240, desc:"Reload faster", color:"rgba(80,160,255,.95)",
      apply: () => { player.perkReloadMult *= 0.78; } },
    { id:"tap",   name:"Double Tap", price:260, desc:"Faster fire rate", color:"rgba(255,210,80,.95)",
      apply: () => { player.perkFireRateMult *= 1.22; } },
    { id:"dead",  name:"Deadshot", price:230, desc:"Less spread", color:"rgba(200,80,255,.95)",
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

  function nearShopKiosk() { return dist(player.x, player.y, shopKiosk.x, shopKiosk.y) <= shopKiosk.r; }
  function nearArmorStation() { return dist(player.x, player.y, armorStation.x, armorStation.y) <= armorStation.r; }
  function nearMysteryBox() { return dist(player.x, player.y, mysteryBoxStation.x, mysteryBoxStation.y) <= mysteryBoxStation.r; }

  function nearAnyMachine() {
    if (nearShopKiosk()) return { type:"shop" };
    if (nearArmorStation()) return { type:"armor" };
    if (nearMysteryBox()) return { type:"box" };
    for (const m of perkMachines) {
      if (dist(player.x, player.y, m.x, m.y) <= m.r) return { type:"perk", ref:m };
    }
    return null;
  }

  // =========================
  // Weapon Database (30+)
  // =========================
  const RARITY = [
    { name:"Common",    w: 55, mult:1.00, color:"rgba(200,200,210,.90)" },
    { name:"Uncommon",  w: 25, mult:1.10, color:"rgba(80,210,120,.92)" },
    { name:"Rare",      w: 13, mult:1.22, color:"rgba(80,160,255,.92)" },
    { name:"Epic",      w: 6,  mult:1.40, color:"rgba(200,80,255,.92)" },
    { name:"Legendary", w: 1,  mult:1.65, color:"rgba(255,190,80,.95)" },
  ];

  const TYPES = {
    pistol:   "Pistol",
    smg:      "SMG",
    ar:       "AR",
    shotgun:  "Shotgun",
    lmg:      "LMG",
    marksman: "Marksman",
    sniper:   "Sniper",
    special:  "Special",
  };

  // Base stats are tuned for your raycast feel.
  // Pack-a-Punch hooks can multiply these later.
  const WEAPONS = [
    // Pistols
    mkW("pistol_rusty",   "Rusty Pistol",   "pistol",   0,  1, 22, 3.2,  8, 0.95, 0.012, 18, 16, 32),
    mkW("pistol_service", "Service Pistol", "pistol",  75,  2, 26, 3.6, 10, 0.92, 0.011, 19, 18, 44),
    mkW("pistol_marks",   "Marks Pistol",   "pistol", 160,  4, 34, 3.2, 12, 0.90, 0.010, 20, 20, 52),
    mkW("pistol_relic",   "Relic Pistol",   "pistol", 340,  7, 46, 3.0, 14, 0.88, 0.009, 21, 22, 60),

    // SMGs
    mkW("smg_stinger",    "Stinger SMG",    "smg",     210,  3, 19, 9.5, 26, 1.15, 0.020, 19, 16, 78),
    mkW("smg_wasp",       "Wasp SMG",       "smg",     320,  5, 21, 10.4,28, 1.18, 0.021, 19, 16, 90),
    mkW("smg_vector",     "Vector Bite",    "smg",     510,  8, 23, 12.0,30, 1.20, 0.022, 19, 16, 96),
    mkW("smg_surge",      "Surge SMG",      "smg",     680, 10, 26, 11.0,34, 1.25, 0.020, 20, 17, 110),

    // ARs
    mkW("ar_carbine",     "Carbine AR",     "ar",      260,  3, 28, 7.2, 30, 1.35, 0.016, 21, 21, 120),
    mkW("ar_ranger",      "Ranger AR",      "ar",      410,  6, 31, 7.6, 30, 1.32, 0.015, 22, 22, 135),
    mkW("ar_nova",        "Nova AR",        "ar",      560,  9, 35, 7.0, 32, 1.40, 0.014, 22, 22, 150),
    mkW("ar_sentinel",    "Sentinel AR",    "ar",      820, 12, 39, 7.4, 34, 1.45, 0.013, 23, 23, 165),

    // Shotguns
    mkW("sg_pump",        "Pump Shotgun",   "shotgun", 320,  4, 12, 1.35, 6, 1.55, 0.060, 17, 9,  36,  7),
    mkW("sg_trench",      "Trench Sweeper", "shotgun", 520,  7, 10, 1.75, 8, 1.75, 0.064, 17, 10, 48,  7),
    mkW("sg_auto",        "Auto Shotgun",   "shotgun", 770, 11,  9, 2.30,10, 1.90, 0.068, 17, 10, 60,  7),
    mkW("sg_reaper",      "Reaper Shotgun", "shotgun", 980, 14, 13, 2.05,10, 1.85, 0.060, 18, 11, 70,  8),

    // LMG
    mkW("lmg_brick",      "Brick LMG",      "lmg",     690, 10, 26, 8.2, 60, 2.30, 0.019, 21, 20, 220),
    mkW("lmg_mammoth",    "Mammoth LMG",    "lmg",     980, 14, 30, 8.0, 75, 2.50, 0.020, 21, 20, 260),
    mkW("lmg_bastion",    "Bastion LMG",    "lmg",    1200, 17, 34, 8.4, 80, 2.55, 0.019, 22, 21, 280),

    // Marksman / Sniper
    mkW("mk_dmr",         "DMR-7",          "marksman",540,  8, 52, 2.6,  12, 1.65, 0.008, 24, 26, 60),
    mkW("mk_longshot",    "Longshot DMR",   "marksman",840, 12, 64, 2.3,  10, 1.70, 0.007, 25, 28, 55),
    mkW("sn_bolt",        "Bolt Sniper",    "sniper",  900, 13, 92, 1.2,   5, 2.05, 0.004, 28, 32, 25),
    mkW("sn_warden",      "Warden Sniper",  "sniper", 1300, 18, 110,1.0,   5, 2.15, 0.0035,28, 34, 25),

    // Specials (fun)
    mkW("sp_burst",       "Burst Cannon",   "special", 880, 12, 18, 16.0, 24, 1.55, 0.022, 18, 15, 120),
    mkW("sp_shredder",    "Shredder",       "special",1200, 16, 16, 18.0, 40, 1.90, 0.026, 18, 14, 160),
    mkW("sp_piercer",     "Piercer",        "special",1500, 20, 55, 3.8,  14, 1.65, 0.010, 25, 24, 84),
  ];

  // Helper: build weapon objects consistently
  function mkW(id, name, type, price, unlockLevel, dmg, fireRate, magSize, reloadTime, spread, bulletSpeed, range, reserveStart, pellets=1){
    return {
      id, name, type,
      price: price|0,
      unlockLevel: unlockLevel|0,
      rarity: rarityFromLevel(unlockLevel),
      dmg, fireRate, magSize, reloadTime, spread, bulletSpeed, range,
      reserveStart: reserveStart|0,
      pellets: pellets|0,
      papLevel: 0, // Pack-a-Punch level
    };
  }

  // rarity heuristic for shop labeling + box weighting “feel”
  function rarityFromLevel(lv){
    if (lv >= 18) return "Legendary";
    if (lv >= 14) return "Epic";
    if (lv >= 9)  return "Rare";
    if (lv >= 4)  return "Uncommon";
    return "Common";
  }

  function weaponById(id){ return WEAPONS.find(w => w.id === id) || null; }
  function cloneWeapon(id){
    const base = weaponById(id);
    if (!base) return null;
    const w = structuredClone(base);
    // runtime ammo state
    w._mag = null;
    w._reserve = null;
    return w;
  }

  // =========================
  // Armor System (same as your v5.x)
  // =========================
  const ARMOR_RARITIES = [
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
    const armor = Math.max(1, Math.round(base * ARMOR_RARITIES[rarityIndex].mult));
    const prettySlot = slot === "helmet" ? "Helmet" : slot === "chest" ? "Chest" : slot === "legs" ? "Leggings" : "Boots";
    return {
      id: `armor_${slot}_${Date.now()}_${(Math.random()*9999)|0}`,
      slot, rarityIndex,
      rarity: ARMOR_RARITIES[rarityIndex].name,
      armor,
      name: `${ARMOR_RARITIES[rarityIndex].name} ${prettySlot}`,
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

  // =========================
  // Player
  // =========================
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

    slots: [ cloneWeapon("pistol_rusty"), null ],
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
    if (ui.mag) ui.mag.textContent = w.magSize;
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

  // =========================
  // Game State
  // =========================
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

  // =========================
  // Save / Load
  // =========================
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
          player.slots.filter(Boolean).map(w => [w.id, { _mag: w._mag, _reserve: w._reserve, papLevel: w.papLevel||0 }])
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
      player.slots = ids.map(id => (id ? cloneWeapon(id) : null));

      const ws = data.weaponState || {};
      for (const w of player.slots) {
        if (!w) continue;
        if (ws[w.id]) {
          w._mag = ws[w.id]._mag;
          w._reserve = ws[w.id]._reserve;
          w.papLevel = ws[w.id].papLevel || 0;
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

      if (!player.usingKnife && player.slots[player.activeSlot]) syncAmmoToWeapon(player.slots[player.activeSlot]);

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

  // =========================
  // Audio (procedural moan)
  // =========================
  const audio = { ctx:null, master:null, unlocked:false, lastMoanT:0 };

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

    const d = clamp(distanceToPlayer, 0.1, 18);
    const vol = clamp(1 - (d / 18), 0, 1) * 0.8;

    const rate = rand(0.92, 1.10) * (isRunner ? 1.08 : 1.0);
    const baseF = (isRunner ? 86 : 74) * rate + (isChaser ? 6 : 0);

    const t0 = audio.ctx.currentTime;
    const dur = rand(0.55, 0.95) * (isRunner ? 0.85 : 1.0);

    const osc = audio.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(baseF, t0);
    osc.frequency.exponentialRampToValueAtTime(baseF * rand(0.75, 0.9), t0 + dur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(baseF * rand(0.45, 0.65), t0 + dur);

    const bp = audio.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(rand(260, 420), t0);
    bp.Q.setValueAtTime(rand(0.8, 1.4), t0);

    const low = audio.ctx.createOscillator();
    low.type = "sine";
    low.frequency.setValueAtTime(baseF * 0.5, t0);
    low.frequency.exponentialRampToValueAtTime(baseF * 0.35, t0 + dur);

    const noiseBuf = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * dur), audio.ctx.sampleRate);
    {
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const n = (Math.random() * 2 - 1);
        ch[i] = n * (0.25 + 0.75 * Math.sin((i / ch.length) * Math.PI));
      }
    }
    const noise = audio.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const hp = audio.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 450;

    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6 * vol, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.25 * vol, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const g2 = audio.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.22 * vol, t0 + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(bp);
    low.connect(bp);
    bp.connect(g);
    g.connect(audio.master);

    noise.connect(hp);
    hp.connect(g2);
    g2.connect(audio.master);

    osc.start(t0);
    low.start(t0);
    noise.start(t0);

    osc.stop(t0 + dur + 0.02);
    low.stop(t0 + dur + 0.02);
    noise.stop(t0 + dur + 0.02);
  }

  // =========================
  // Controls
  // =========================
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

  // =========================
  // Mobile controls
  // =========================
  function setupMobileControls() {
    if (!ui.joyBase || !ui.joyStick || !ui.btnReload || !ui.btnUse) return;
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

  // =========================
  // Menu Buttons
  // =========================
  if (ui.btnSettings) ui.btnSettings.addEventListener("click", () => {
    unlockAudio();
    if (game.mode === "settings") closeSettings();
    else openSettings();
  });

  if (ui.inputMode) ui.inputMode.addEventListener("change", () => {
    settings.inputMode = ui.inputMode.value;
    saveSettings();
    applyInputModeUI();
  });

  if (ui.sens) ui.sens.addEventListener("input", () => {
    settings.sens = clamp(Number(ui.sens.value), 0.6, 2.5);
    if (ui.sensVal) ui.sensVal.textContent = settings.sens.toFixed(2);
    saveSettings();
  });

  if (ui.autoSprint) ui.autoSprint.addEventListener("change", () => {
    settings.autoSprint = ui.autoSprint.checked;
    saveSettings();
  });

  if (ui.btnReset) ui.btnReset.addEventListener("click", () => {
    unlockAudio();
    if (confirm("Reset ALL progress + settings?")) hardResetSave();
  });

  if (ui.closeSettings) ui.closeSettings.addEventListener("click", () => { unlockAudio(); closeSettings(); });
  if (ui.closeShop) ui.closeShop.addEventListener("click", () => { unlockAudio(); closeShop(); });
  if (ui.closeArmor) ui.closeArmor.addEventListener("click", () => { unlockAudio(); closeArmor(); });

  // =========================
  // Mystery Box State
  // =========================
  const mb = {
    open: false,
    rolling: false,
    rollT: 0,
    lastPick: null,
    ui: { overlay:null, name:null, meta:null, cost:null, spinLine:null, btnClose:null, btnSpin:null },
  };

  function openMysteryBox() {
    ensureMysteryBoxOverlay();
    if (game.mode !== "play") return;

    game.mode = "box";
    mb.open = true;
    mb.rolling = false;
    mb.rollT = 0;

    mb.ui.overlay.classList.remove("hidden");
    mb.ui.cost.textContent = `$${mysteryBoxStation.cost}`;
    mb.ui.spinLine.textContent = "Roll a random weapon into Slot 2.";
    mb.ui.btnSpin.classList.remove("locked");
    mb.ui.btnSpin.disabled = false;

    setMysteryBoxDisplay(null);
    setHint("MYSTERY BOX OPEN (paused). E / ESC to close.", true, 4, 1.6);
    saveGame();
  }

  function closeMysteryBox() {
    if (!mb.open) return;
    mb.open = false;
    mb.rolling = false;
    mb.rollT = 0;
    if (mb.ui.overlay) mb.ui.overlay.classList.add("hidden");

    game.mode = "play";
    setHint("Back to surviving.", true, 2);
    saveGame();
  }

  function setMysteryBoxDisplay(w) {
    if (!mb.ui.name || !mb.ui.meta) return;

    if (!w) {
      mb.ui.name.textContent = "---";
      mb.ui.meta.innerHTML = `
        <span class="badge">Type: ---</span>
        <span class="badge">Rarity: ---</span>
        <span class="badge">Dmg: ---</span>
        <span class="badge">Mag: ---</span>
      `;
      return;
    }

    mb.ui.name.textContent = w.name;
    mb.ui.meta.innerHTML = `
      <span class="badge">Type: ${TYPES[w.type] || w.type}</span>
      <span class="badge">Rarity: ${w.rarity}</span>
      <span class="badge">Dmg: ${w.dmg}</span>
      <span class="badge">Mag: ${w.magSize}</span>
    `;
  }

  function spinMysteryBox() {
    if (!mb.open || mb.rolling) return;

    const cost = mysteryBoxStation.cost;
    if (player.cash < cost) {
      setHint(`Need $${cost} to spin.`, false, 4, 1.2);
      return;
    }

    player.cash -= cost;
    saveGame();

    mb.rolling = true;
    mb.rollT = 0;
    mb.ui.spinLine.textContent = "Spinning...";
    mb.ui.btnSpin.classList.add("locked");
    mb.ui.btnSpin.disabled = true;

    // Visual roulette (fast name flicker)
    const rollDur = 2.35;
    const start = performance.now();
    const ticker = setInterval(() => {
      if (!mb.rolling) { clearInterval(ticker); return; }
      const pick = weightedBoxPick();
      setMysteryBoxDisplay(pick);
      if ((performance.now() - start) / 1000 >= rollDur) {
        clearInterval(ticker);
        const finalW = weightedBoxPick(true);
        mb.lastPick = finalW;
        awardMysteryWeapon(finalW);
        setMysteryBoxDisplay(finalW);
        mb.ui.spinLine.textContent = "You got it! Equipped into Slot 2.";
        mb.rolling = false;
        mb.ui.btnSpin.classList.remove("locked");
        mb.ui.btnSpin.disabled = false;
        setHint(`Mystery Box: ${finalW.name} (Slot 2)`, true, 4, 1.6);
      }
    }, 70);
  }

  function weightedBoxPick(avoidSame=false) {
    // Box gives you anything you are high enough level to “see”
    // (still can roll a bit above level for spice, capped).
    const maxLv = Math.max(3, player.level + 4);

    const pool = WEAPONS.filter(w => w.id !== "pistol_rusty" && w.unlockLevel <= maxLv);
    if (pool.length === 0) return structuredClone(WEAPONS[0]);

    // weighted by rarity
    const weights = pool.map(w => {
      const r = RARITY.find(rr => rr.name === w.rarity) || RARITY[0];
      let weight = r.w;

      // tiny preference for not repeating the last roll
      if (avoidSame && mb.lastPick && w.id === mb.lastPick.id) weight *= 0.15;

      // shotguns feel rarer in box (optional tweak)
      if (w.type === "shotgun") weight *= 0.85;

      return weight;
    });

    let sum = 0;
    for (const ww of weights) sum += ww;

    let roll = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return structuredClone(pool[i]);
    }
    return structuredClone(pool[pool.length - 1]);
  }

  function awardMysteryWeapon(wBase) {
    // Put weapon into Slot 2, replacing whatever is there.
    // Keep Slot 1 as your “starter / safety”.
    const w = structuredClone(wBase);

    // fresh ammo state
    w._mag = w.magSize;
    w._reserve = w.reserveStart ?? 60;

    player.slots[1] = w;
    // auto-equip slot 2
    const prev = currentWeapon();
    if (prev) saveAmmoFromWeapon(prev);
    player.activeSlot = 1;
    player.usingKnife = false;
    syncAmmoToWeapon(player.slots[1]);

    saveGame();
  }

  // Pack-a-Punch HOOK (wired, but simple by design)
  function packAPunchWeapon(w) {
    if (!w) return false;

    // You can decide later how PAP is purchased (station, scrap/essence, etc).
    // This is a hook that upgrades stats consistently.
    w.papLevel = (w.papLevel || 0) + 1;

    const lvl = w.papLevel;
    const dmgMult = 1 + lvl * 0.35;
    const magBonus = Math.floor(lvl * 0.15 * w.magSize);

    w.dmg = Math.round(w.dmg * dmgMult);
    w.magSize = Math.max(1, w.magSize + magBonus);
    w.spread = Math.max(0.0025, w.spread * (1 - lvl * 0.06));

    // refill ammo on upgrade (feels good)
    w._mag = w.magSize;
    w._reserve = (w._reserve ?? w.reserveStart) + Math.floor(30 + lvl * 10);

    return true;
  }

  // =========================
  // Try Use (Shop/Armor/Perk/Box)
  // =========================
  function tryUse() {
    if (game.mode !== "play") return;
    const near = nearAnyMachine();
    if (!near) return setHint("Nothing to use here.", false, 1);

    if (near.type === "perk") return buyPerk(near.ref);
    if (near.type === "armor") return openArmor();
    if (near.type === "shop") return openShop();
    if (near.type === "box") return openMysteryBox();
  }

  // Keyboard
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);

    if (k === "r") reload();

    if (k === "escape") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "armor") closeArmor();
      else if (game.mode === "settings") closeSettings();
      else if (game.mode === "box") closeMysteryBox();
    }

    if (k === "q") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "play" && nearShopKiosk()) openShop();
      else if (game.mode === "play") setHint("Find the green SHOP kiosk and press Q.", false, 1);
    }

    if (k === "e") {
      if (game.mode === "armor") closeArmor();
      else if (game.mode === "box") closeMysteryBox();
      else if (game.mode === "play") tryUse();
    }

    if (k === "1") equipSlot(0);
    if (k === "2") equipSlot(1);
    if (k === "3") equipKnife();

    if (k === "h") useMedkit();

    // (Optional) quick PAP test: press P to pap current weapon (you can remove later)
    if (k === "p" && game.mode === "play") {
      const w = currentWeapon();
      if (w) {
        packAPunchWeapon(w);
        syncAmmoToWeapon(w);
        setHint(`Pack-a-Punched: ${w.name} (Lv ${w.papLevel})`, true, 4, 1.4);
        saveGame();
      }
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // =========================
  // SHOP (rewired to DB by type)
  // =========================
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
    if (ui.shop) ui.shop.classList.remove("hidden");
    if (ui.death) ui.death.classList.add("hidden");
    if (ui.settingsMenu) ui.settingsMenu.classList.add("hidden");
    if (ui.armorMenu) ui.armorMenu.classList.add("hidden");
    ensureMysteryBoxOverlay();
    if (mb.ui.overlay) mb.ui.overlay.classList.add("hidden");
    mb.open = false;

    renderShop();
    setHint("SHOP OPEN (paused). Q / ESC to close.", true, 4, 2.0);
    saveGame();
  }
  function closeShop() {
    if (game.mode !== "shop") return;
    game.mode = "play";
    if (ui.shop) ui.shop.classList.add("hidden");
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
    const w = cloneWeapon(id);
    if (!w) return;
    player.slots[1] = w;
    setHint(`Bought: ${w.name}. Slot 2 (press 2).`, true, 3);
    saveGame();
  }

  function renderShop() {
    if (!ui.shopList) return;
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

    ui.shopList.appendChild(shopHeader("Weapons (by Type)"));

    const typeOrder = ["pistol","smg","ar","shotgun","lmg","marksman","sniper","special"];
    for (const t of typeOrder) {
      const list = WEAPONS.filter(w => w.type === t && w.id !== "pistol_rusty");
      if (!list.length) continue;

      ui.shopList.appendChild(shopHeader(TYPES[t] || t));

      for (const w of list) {
        const owned = ownsWeapon(w.id);
        const can = canBuyWeapon(w);

        const extra = w.type === "shotgun" ? ` | Pellets ${w.pellets}` : "";
        ui.shopList.appendChild(shopButton({
          title: w.name,
          desc: owned
            ? "Owned (equip with 1/2)"
            : `${w.rarity} | Dmg ${w.dmg}${extra} | Mag ${w.magSize} | Lv ${w.unlockLevel}`,
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
    }

    ui.shopList.appendChild(shopHeader("Tip"));
    ui.shopList.appendChild(shopInfo("Mystery Box is a separate station. Armor crafting is at the ARMOR station (blue)."));
  }

  // =========================
  // ARMOR MENU (same logic)
  // =========================
  function openArmor() {
    game.mode = "armor";
    if (ui.armorMenu) ui.armorMenu.classList.remove("hidden");
    if (ui.shop) ui.shop.classList.add("hidden");
    if (ui.settingsMenu) ui.settingsMenu.classList.add("hidden");
    if (ui.death) ui.death.classList.add("hidden");
    closeMysteryBox();
    renderArmorMenu();
    setHint("ARMOR STATION OPEN (paused). E / ESC to close.", true, 4, 2.0);
    saveGame();
  }
  function closeArmor() {
    if (game.mode !== "armor") return;
    game.mode = "play";
    if (ui.armorMenu) ui.armorMenu.classList.add("hidden");
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
    it.rarity = ARMOR_RARITIES[next].name;

    const base = ARMOR_BASE[it.slot];
    it.armor = Math.max(1, Math.round(base * ARMOR_RARITIES[next].mult));
    it.name = `${it.rarity} ${it.slot === "helmet" ? "Helmet" : it.slot === "chest" ? "Chest" : it.slot === "legs" ? "Leggings" : "Boots"}`;

    setHint(`Upgraded: ${it.name} (+${it.armor})`, true, 4, 1.5);
    saveGame();
    renderArmorMenu();
  }

  function renderArmorMenu() {
    if (!ui.armorList) return;
    ui.armorList.innerHTML = "";

    ui.armorList.appendChild(shopInfo(
      `Scrap ${player.scrap} | Essence ${player.essence} | Total Armor ${getTotalArmor()}`
    ));

    ui.armorList.appendChild(shopHeader("Craft"));
    ui.armorList.appendChild(shopButton({ title:"Craft: Basic Roll", desc:"Cheaper, mostly Common/Uncommon", price:0, onClick:()=>craftArmorRoll("basic") }));
    ui.armorList.appendChild(shopButton({ title:"Craft: Advanced Roll", desc:"Better odds, costs more", price:0, onClick:()=>craftArmorRoll("advanced") }));
    ui.armorList.appendChild(shopButton({ title:"Craft: Elite Roll", desc:"Best odds, expensive", price:0, onClick:()=>craftArmorRoll("elite") }));

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
        onClick: () => upgradeEquippedArmor(slot),
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
        ui.armorList.appendChild(shopButton({
          title: piece.name,
          desc: `Slot: ${piece.slot} | Armor +${piece.armor} | Click to equip`,
          price: 0,
          locked: false,
          onClick: () => equipArmorFromInv(realIndex),
        }));
        ui.armorList.lastChild.style.borderColor =
          (ARMOR_RARITIES[piece.rarityIndex].color || "rgba(255,255,255,.10)")
            .replace(")", ",.35)")
            .replace("rgba","rgba");
      }
    }
  }

  // =========================
  // SETTINGS
  // =========================
  function openSettings() {
    game.mode = "settings";
    if (ui.settingsMenu) ui.settingsMenu.classList.remove("hidden");
    if (ui.shop) ui.shop.classList.add("hidden");
    if (ui.armorMenu) ui.armorMenu.classList.add("hidden");
    if (ui.death) ui.death.classList.add("hidden");
    closeMysteryBox();
    setHint("SETTINGS OPEN (paused).", true, 3, 1.2);
  }
  function closeSettings() {
    if (game.mode !== "settings") return;
    game.mode = "play";
    if (ui.settingsMenu) ui.settingsMenu.classList.add("hidden");
    setHint("Settings closed.", true, 2, 1.0);
  }

  // =========================
  // Perks
  // =========================
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

  // =========================
  // Combat: reload, knife, bullets
  // =========================
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

  let bullets = [];
  let impacts = [];

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

  function spawnWallImpact(x, y) {
    impacts.push({
      x, y, t:0,
      life: rand(0.18, 0.32),
      s: rand(0.15, 0.30),
      seed: rand(0, 9999),
      p: Array.from({length: 5 + ((Math.random()*4)|0)}, () => ({
        a: rand(0, Math.PI*2),
        v: rand(0.8, 2.2),
        r: rand(0.004, 0.012),
      })),
    });
    if (impacts.length > 40) impacts.shift();
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

    // shotgun pellets support
    const pellets = Math.max(1, w.pellets || 1);
    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * w.spread * player.perkSpreadMult;
      const ang = player.a + spread;
      spawnBullet(ang, w);
    }

    saveAmmoFromWeapon(w);
    saveGame();
  }

  // =========================
  // Enemies / Drops
  // =========================
  let zombies = [];
  let drops = [];
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
      if (dist(x, y, mysteryBoxStation.x, mysteryBoxStation.y) < 3.0) continue;
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

        moanT: rand(1.5, 4.5),
      });

      game.alive++;
      return true;
    }
    return false;
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

  // =========================
  // Items
  // =========================
  function useMedkit() {
    if (game.mode !== "play") return;
    if (player.medkits <= 0) return setHint("No medkits.", false, 2);
    if (player.hp >= player.maxHp) return setHint("Already full HP.", true, 2);

    player.medkits--;
    player.hp = clamp(player.hp + 45, 0, player.maxHp);
    setHint("Used medkit +45 HP 🩹", true, 3);
    saveGame();
  }

  // =========================
  // Pathfinding (BFS flow field)
  // =========================
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

  // =========================
  // Raycast
  // =========================
  function castRay(angle) {
    const step = 0.02;
    for (let d = 0; d < 22; d += step) {
      const x = player.x + Math.cos(angle) * d;
      const y = player.y + Math.sin(angle) * d;
      if (isWall(x, y)) return d;
    }
    return 22;
  }

  // =========================
  // Minimap
  // =========================
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

    // Mystery box marker
    ctx.fillStyle = "rgba(255,190,80,.95)";
    ctx.fillRect(x0 + mysteryBoxStation.x * cell - 3, y0 + mysteryBoxStation.y * cell - 3, 6, 6);

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

  // =========================
  // Billboard helper (for stations)
  // =========================
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

  // =========================
  // Render (raycast + sprites)
  // =========================
  // =========================
  // Gun Viewmodel (2D overlay)
  // =========================
function drawWeaponViewmodel(w, dt) {
  const W = innerWidth, H = innerHeight;

  // Smooth recoil/muzzle back to 0
  game.recoil = Math.max(0, game.recoil - dt * 2.6);
  game.muzzle = Math.max(0, game.muzzle - dt * 5.5);

  const s = Math.min(W, H);

  // Base scale + big COD-ish size
  const baseScale = clamp(s / 900, 0.85, 1.25);
  const scale = baseScale * 1.85;

  // -------- Viewmodel placement --------
  const baseX = W * 0.72;
  const baseY = H * 0.94;

  // -------- Recoil behavior --------
  const kick = game.recoil * 60;
  const mx = -kick * 0.10;    // little left kick
  const my =  kick * 0.65;    // push down (gun goes up visually b/c we pivot)
  const back = kick * 0.55;   // slide backward

  // -------- Subtle idle sway --------
  const t = performance.now() / 1000;
  const swayX = Math.sin(t * 1.8) * 1.2;
  const swayY = Math.cos(t * 2.1) * 0.9;

  // A tiny “hand bob” to feel alive
  const bob = Math.sin(t * 3.2) * 0.9;

  const x = baseX + mx + swayX;
  const y = baseY + my + swayY + bob;

  ctx.save();
  ctx.translate(x, y);

  // ✅ COD-style: FIXED forward-facing rotation (no aiming at crosshair)
  // Slight inward cant + tiny idle roll + recoil “snap”
  const idleRoll = Math.sin(t * 1.8) * 0.015;
  const recoilRot = game.recoil * 0.055;
  const rot = (-0.10) + idleRoll - recoilRot; // tweak -0.10 to taste
  ctx.rotate(rot);

  // ✅ One clean pivot so it doesn't orbit
  // Think of this as your “hand grip point”
  const pivotX = -210 * baseScale;
  const pivotY = -165 * baseScale;
  ctx.translate(pivotX - back, pivotY);

  // weapon type
  const type = w ? w.type : "pistol";

  // colors
  const edge = "rgba(255,255,255,.12)";

  // helper
  function rr(x,y,w,h,r){
    r = Math.max(2, r);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function fillPart(x,y,w,h, r, baseA=0.92){
    const g = ctx.createLinearGradient(0, y, 0, y+h);
    g.addColorStop(0, `rgba(35,38,48,${baseA})`);
    g.addColorStop(0.55, `rgba(20,22,28,${baseA})`);
    g.addColorStop(1, `rgba(10,12,16,${baseA})`);
    ctx.fillStyle = g;
    rr(x,y,w,h,r); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.08)";
    rr(x+2, y+2, w-4, Math.max(3, h*0.20), Math.max(2, r*0.7));
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,.28)";
    rr(x+2, y+h - Math.max(4, h*0.18), w-4, Math.max(4, h*0.18), Math.max(2, r*0.7));
    ctx.fill();
  }

  function fillMetal(x,y,w,h, r){
    const g = ctx.createLinearGradient(x, y, x+w, y);
    g.addColorStop(0, "rgba(170,180,205,.65)");
    g.addColorStop(0.35, "rgba(90,105,130,.55)");
    g.addColorStop(0.7, "rgba(210,220,245,.55)");
    g.addColorStop(1, "rgba(70,85,110,.55)");
    ctx.fillStyle = g;
    rr(x,y,w,h,r); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(x+2, y+2, w-4, Math.max(2, h*0.25));
  }

  function boltScrews(x,y,w,h){
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (let i=0;i<4;i++){
      ctx.beginPath();
      ctx.arc(x + (i+1)*(w/5), y + h*0.55, Math.max(1.2, h*0.12), 0, Math.PI*2);
      ctx.fill();
    }
  }

  // We'll store muzzle position in LOCAL gun coords (so flash stays glued to barrel)
  let muzzleLX = 260, muzzleLY = 62;

  // ---- silhouettes ----
  if (player.usingKnife) {
    const swing = player.knife.swing > 0 ? (1 - (player.knife.swing / 0.14)) : 1;
    const ang = 0.9 - swing * 1.8;
    ctx.rotate(ang);
    ctx.translate(40 * scale, 40 * scale);

    fillPart(-30*scale, 45*scale, 70*scale, 26*scale, 10*scale);
    fillMetal(10*scale, 32*scale, 155*scale, 16*scale, 8*scale);

    muzzleLX = 160; muzzleLY = 42;

  } else if (type === "ar" || type === "special" || type === "marksman" || type === "sniper") {
    fillPart(-20*scale, 56*scale, 290*scale, 62*scale, 18*scale);
    boltScrews(-20*scale, 56*scale, 290*scale, 62*scale);

    fillMetal(40*scale, 44*scale, 170*scale, 12*scale, 6*scale);
    fillMetal(220*scale, 52*scale, 185*scale, 16*scale, 8*scale);

    ctx.fillStyle = "rgba(0,0,0,.26)";
    rr(170*scale, 62*scale, 90*scale, 34*scale, 12*scale);
    ctx.fill();

    ctx.save();
    ctx.translate(105*scale, 110*scale);
    ctx.rotate(0.18);
    fillPart(-10*scale, -10*scale, 60*scale, 88*scale, 12*scale);
    ctx.restore();

    ctx.save();
    ctx.translate(65*scale, 115*scale);
    ctx.rotate(0.45);
    fillPart(-10*scale, -10*scale, 48*scale, 70*scale, 14*scale);
    ctx.restore();

    fillPart(-60*scale, 60*scale, 70*scale, 44*scale, 14*scale);

    // longer muzzle for rifles
    muzzleLX = 390; muzzleLY = 62;

  } else {
    // pistol fallback
    fillPart(-10*scale, 88*scale, 190*scale, 48*scale, 18*scale);
    fillMetal(120*scale, 82*scale, 130*scale, 16*scale, 10*scale);

    ctx.save();
    ctx.translate(35*scale, 138*scale);
    ctx.rotate(0.42);
    fillPart(-10*scale, -10*scale, 60*scale, 86*scale, 16*scale);
    ctx.restore();

    muzzleLX = 260; muzzleLY = 102;
  }

  // outline (only outlines the most recent rr path; looks fine as a subtle edge)
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();

  // muzzle flash (glued to barrel tip now)
  if (game.muzzle > 0.001) {
    const a = clamp(game.muzzle / 0.06, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.75 * a;
    ctx.fillStyle = "rgba(255,210,80,.88)";
    ctx.beginPath();
    ctx.ellipse(muzzleLX*scale, muzzleLY*scale, 18*scale, 10*scale, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.ellipse((muzzleLX-10)*scale, (muzzleLY)*scale, 10*scale, 6*scale, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

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
    sprites.push({ kind:"box", x:mysteryBoxStation.x, y:mysteryBoxStation.y, d: dist(player.x, player.y, mysteryBoxStation.x, mysteryBoxStation.y) });

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
      if (s.kind === "box") {
        drawBillboard(screenX, top, size * 0.92, "MYSTERY", "rgba(255,190,80,.95)", `Press E • $${mysteryBoxStation.cost}`);
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

        ctx.fillStyle = `rgba(210,220,235,${0.16 * a})`;
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.08, puff, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(20,22,28,${0.18 * a})`;
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.08, puff * 0.45, 0, Math.PI * 2);
        ctx.fill();

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

        ctx.fillStyle = "rgba(0,0,0,.22)";
        ctx.beginPath();
        ctx.ellipse(screenX, horizon + size*0.34, size*0.18, size*0.07, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = oc;
        ctx.fillRect(left + size*0.35 + legSwing - 2, legY - 2, legW + 4, legH + 4);
        ctx.fillRect(left + size*0.54 - legSwing - 2, legY - 2, legW + 4, legH + 4);
        ctx.fillRect(torsoX - 3, torsoY - 3, torsoW + 6, torsoH + 6);
        ctx.fillRect(left + size*0.17 + armSwing - 2, armY - 2, armW + 4, armH + 4);
        ctx.fillRect(left + size*0.70 - armSwing - 2, armY - 2, armW + 4, armH + 4);

        ctx.fillStyle = dc;
        ctx.fillRect(left + size*0.36 + legSwing, legY, legW, legH);
        ctx.fillRect(left + size*0.54 - legSwing, legY, legW, legH);

        ctx.fillStyle = bc;
        ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        ctx.fillRect(torsoX + torsoW*0.55, torsoY, torsoW*0.45, torsoH);

        ctx.fillStyle = dc;
        ctx.fillRect(left + size*0.18 + armSwing, armY, armW, armH);
        ctx.fillRect(left + size*0.70 - armSwing, armY, armW, armH);

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

        ctx.fillStyle = "rgba(0,0,0,.22)";
        ctx.beginPath();
        ctx.arc(headX + headR*0.18, headY + headR*0.15, headR*0.85, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,0,0,.48)";
        ctx.fillRect(headX - headR*0.55, headY - headR*0.10, headR*0.35, headR*0.22);
        ctx.fillRect(headX + headR*0.20, headY - headR*0.10, headR*0.35, headR*0.22);

        if (chaser) {
          ctx.fillStyle = "rgba(255,80,80,.16)";
          ctx.beginPath();
          ctx.arc(headX, headY, headR*1.55, 0, Math.PI*2);
          ctx.fill();
        }

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
    drawWeaponViewmodel(currentWeapon(), dt);

    const near = nearAnyMachine();
    if (near && game.mode === "play") {
      if (near.type === "shop") setHint("At SHOP: Q (or USE on mobile).", true, 0, 0.25);
      if (near.type === "armor") setHint("At ARMOR: E (or USE on mobile).", true, 0, 0.25);
      if (near.type === "perk") setHint("Perk machine: E (or USE on mobile).", true, 0, 0.25);
      if (near.type === "box") setHint(`Mystery Box: E • $${mysteryBoxStation.cost}`, true, 0, 0.25);
    }
  }

  // =========================
  // Death
  // =========================
  function die() {
    game.mode = "dead";
    if (ui.shop) ui.shop.classList.add("hidden");
    if (ui.armorMenu) ui.armorMenu.classList.add("hidden");
    if (ui.settingsMenu) ui.settingsMenu.classList.add("hidden");
    closeMysteryBox();
    if (ui.death) ui.death.classList.remove("hidden");
    setHint("You died. Click Restart.", false, 5, 2.0);
    document.exitPointerLock?.();
    saveGame();
  }

  if (ui.restart) ui.restart.addEventListener("click", () => {
    unlockAudio();
    zombies = [];
    drops = [];
    bullets = [];
    impacts = [];

    game.mode = "play";
    if (ui.shop) ui.shop.classList.add("hidden");
    if (ui.armorMenu) ui.armorMenu.classList.add("hidden");
    if (ui.settingsMenu) ui.settingsMenu.classList.add("hidden");
    if (ui.death) ui.death.classList.add("hidden");
    closeMysteryBox();

    player.x = 1.6; player.y = 1.6; player.a = 0;
    player.hp = player.maxHp;
    player.stamina = player.staminaMax;

    startRound(game.round, true);

    setHint("Restarted. Progress kept.", true, 4, 1.6);
    saveGame();
  });

  // =========================
  // Round System
  // =========================
  function startRound(r, restart=false) {
    game.round = r;
    game.toSpawn = 8 + r * 3;
    game.spawnBudget = game.toSpawn;
    game.alive = 0;
    game.betweenT = restart ? 0.6 : 2.2;

    setHint(restart ? `Round ${r} restarted.` : `Round ${r} starting...`, true, 4, 1.4);
  }

  // =========================
  // Init
  // =========================
  syncAmmoToWeapon(player.slots[0]);
  loadGame();
  ensureMysteryBoxOverlay();
  startRound(game.round || 1, true);

  // =========================
  // Main Loop
  // =========================
  let last = performance.now();
  let saveTimer = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // HUD
    if (ui.hp) ui.hp.textContent = Math.max(0, Math.floor(player.hp));
    if (ui.hpMax) ui.hpMax.textContent = Math.floor(player.maxHp);
    if (ui.armor) ui.armor.textContent = String(getTotalArmor());
    if (ui.cash) ui.cash.textContent = player.cash;
    if (ui.round) ui.round.textContent = game.round;
    if (ui.alive) ui.alive.textContent = String(game.alive);
    if (ui.level) ui.level.textContent = player.level;
    if (ui.xp) ui.xp.textContent = player.xp;
    if (ui.scrap) ui.scrap.textContent = player.scrap;
    if (ui.essence) ui.essence.textContent = player.essence;

    if (ui.stamFill) ui.stamFill.style.width = `${clamp(player.stamina / player.staminaMax, 0, 1) * 100}%`;
    if (ui.chasers) ui.chasers.textContent = String(countChasers());

    if (player.usingKnife) {
      if (ui.weapon) ui.weapon.textContent = "Knife";
      if (ui.ammo) ui.ammo.textContent = "-";
      if (ui.mag) ui.mag.textContent = "-";
      if (ui.reserve) ui.reserve.textContent = "-";
    } else {
      const w = currentWeapon();
      if (ui.weapon) ui.weapon.textContent = w ? `${w.name}${w.papLevel?` (PAP ${w.papLevel})`:``}` : "None";
      if (ui.ammo) ui.ammo.textContent = player.ammo.mag;
      if (ui.reserve) ui.reserve.textContent = player.ammo.reserve;
      if (ui.mag) ui.mag.textContent = w ? w.magSize : "-";
    }

    if (input.mobile && ui.btnUse) {
      const near = nearAnyMachine();
      if (near && game.mode === "play") ui.btnUse.classList.remove("hidden");
      else ui.btnUse.classList.add("hidden");
    }

    // impacts update
    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].t += dt;
      if (impacts[i].t >= impacts[i].life) impacts.splice(i, 1);
    }

    render(dt);

    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; saveGame(); }

    if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
    if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

    // Pause when in menus
    if (game.mode !== "play") return;

    // Reload tick
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

    // Look
    player.a += lookDelta * 0.0022 * settings.sens;
    lookDelta = 0;

    // Move vector
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

    // Fire
    if (!input.mobile) {
      if (mouseDown) shoot();
    } else {
      if (input.firing) shoot();
    }

    // Spawning
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

    // Flow field
    game.flowTimer -= dt;
    if (game.flowTimer <= 0) {
      game.flowTimer = 0.25;
      game.flow = buildFlowFieldFromPlayer();
    }

    // Bullets + impacts + zombie hits
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }

      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;

      if (isWall(nx, ny)) {
        spawnWallImpact(b.x, b.y);
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

    // Zombies update + moans + attacks
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];

      z.hitCd = Math.max(0, z.hitCd - dt);

      const isRunner = (z.type === "runner");
      const isChaser = (z.role === "chaser");
      const spBase = z.speed * (isRunner ? 1.18 : 1);

      if (isChaser) {
        const zx0 = Math.floor(z.x);
        const zy0 = Math.floor(z.y);

        let bestCell = [zx0, zy0];
        let bestVal =
          (game.flow && game.flow[zy0] && game.flow[zy0][zx0] != null)
            ? game.flow[zy0][zx0]
            : 9999;

        const opts = [[zx0+1,zy0],[zx0-1,zy0],[zx0,zy0+1],[zx0,zy0-1]];
        for (const [cx, cy] of opts) {
          if (!inBounds(cx, cy)) continue;
          if (world.map[cy][cx] === 1) continue;
          const v =
            (game.flow && game.flow[cy] && game.flow[cy][cx] != null)
              ? game.flow[cy][cx]
              : 9999;
          if (v < bestVal) { bestVal = v; bestCell = [cx, cy]; }
        }

        const tx = bestCell[0] + 0.5;
        const ty = bestCell[1] + 0.5;

        const ang = Math.atan2(ty - z.y, tx - z.x);
        const nx = z.x + Math.cos(ang) * spBase * dt;
        const ny = z.y + Math.sin(ang) * spBase * dt;
        if (!isWall(nx, z.y)) z.x = nx;
        if (!isWall(z.x, ny)) z.y = ny;

      } else {
        z.thinkT -= dt;
        if (z.thinkT <= 0) {
          z.thinkT = rand(0.6, 1.4);
          z.wanderA += rand(-1.2, 1.2);
        }

        const ang = z.wanderA;
        const step = spBase * 0.55 * dt;
        const nx = z.x + Math.cos(ang) * step;
        const ny = z.y + Math.sin(ang) * step;

        if (isWall(nx, z.y) || isWall(z.x, ny)) {
          z.wanderA += rand(1.2, 2.6);
        } else {
          z.x = nx;
          z.y = ny;
        }
      }

      // Moans
      z.moanT -= dt;
      if (z.moanT <= 0) {
        const d = dist(player.x, player.y, z.x, z.y);
        if (d < 14.5 && audio.unlocked) {
          const pClose = clamp(1 - d / 14.5, 0, 1);
          const chance = 0.28 + pClose * 0.62;

          const nowS = performance.now() / 1000;
          const okGlobal = (nowS - (audio.lastMoanT || 0)) > 0.20;

          if (okGlobal && Math.random() < chance) {
            audio.lastMoanT = nowS;
            playZombieMoan(d, isRunner, isChaser);
          }
        }
        z.moanT = rand(2.2, 5.8) * (isRunner ? 0.85 : 1.0) * (isChaser ? 0.85 : 1.0);
      }

      // Attack
      const dToPlayer = dist(player.x, player.y, z.x, z.y);
      if (dToPlayer < 0.55 && z.hitCd <= 0) {
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

    // Drops pickup
    for (let i = drops.length - 1; i >= 0; i--) {
      const d0 = drops[i];
      d0.t -= dt;
      if (d0.t <= 0) { drops.splice(i, 1); continue; }

      if (dist(player.x, player.y, d0.x, d0.y) < 0.65) {
        if (d0.kind === "cash") player.cash += d0.amount;
        if (d0.kind === "scrap") player.scrap += d0.amount;
        if (d0.kind === "ess") player.essence += d0.amount;
        drops.splice(i, 1);
        saveGame();
      }
    }
  }

  // Start
  setHint(
    "Survive rounds. Shop = Q (green). Armor = E (blue). Mystery Box = E (gold). Perks = E. Sprint = Shift. Medkit = H.",
    true, 3, 2.2
  );
  requestAnimationFrame(tick);
})();

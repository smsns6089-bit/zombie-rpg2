// Project Game Maker: Zombie RPG FPS (Raycast) - FULL REWRITE v4
// GitHub Pages friendly. No libraries.
//
// ADDS:
// - Settings button (top-right) + overlay menu
// - Input Mode: Auto / PC / Mobile (saved)
// - Mobile aim + tap-to-fire + optional FIRE button
// - Clean drop rendering (no sprite overwrite confusion)
//
// KEEPS:
// - Normal pitch (not inverted)
// - Sprint (Shift) + Stamina
// - Slow HP regen (after not being hit for a bit)
// - Medkits inventory (buy in shop, press H to use)
// - Mines (buy in shop, press G to place, AOE explode)
// - Zombies pathfind around maze (BFS flow field)
// - Armor drops + equip slots + simple crafting upgrade
// - Shop kiosk pause (Q)

(() => {
  "use strict";

  // ---------- Canvas ----------
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

  // ---------- Helpers ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function setHint(t, ok = false) {
    ui.hint.textContent = t || "";
    ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
  }

  // ---------- SETTINGS (UI + Save) ----------
  const SETTINGS_KEY = "pgm_zombie_rpg_settings_v4";

  function isTouchDevice() {
    return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  }

  const settings = {
    inputMode: "auto",      // "auto" | "pc" | "mobile"
    mobileTapToFire: true,
    mobileShowFireBtn: true,
    mobileRightSideAim: true,
    sensX: 0.0042,
    sensY: 0.0042,
    invertY: false,
    audioEnabled: true,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.assign(settings, data || {});
    } catch {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }
  loadSettings();

  function effectiveInputMode() {
    if (settings.inputMode === "pc") return "pc";
    if (settings.inputMode === "mobile") return "mobile";
    return isTouchDevice() ? "mobile" : "pc"; // auto
  }

  // Inject small CSS for settings + mobile buttons (so you don't have to edit CSS)
  const style = document.createElement("style");
  style.textContent = `
    #pgm_settings_btn{
      position:fixed; top:12px; right:12px; z-index:30;
      pointer-events:auto;
      width:40px; height:40px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(17,24,39,.72);
      color:#e5e7eb; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      font-size:18px;
    }
    #pgm_settings_btn:hover{ border-color: rgba(34,197,94,.40); }

    #pgm_settings_overlay{
      position:fixed; inset:0; z-index:40;
      display:none;
      align-items:center; justify-content:center;
      background:rgba(0,0,0,.72);
      pointer-events:auto;
    }
    #pgm_settings_panel{
      width:min(760px, 92vw);
      background:rgba(17,24,39,.96);
      border:1px solid rgba(255,255,255,.10);
      border-radius:16px;
      padding:16px;
      box-shadow:0 18px 80px rgba(0,0,0,.55);
      color:#e5e7eb;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    }
    #pgm_settings_panel h2{ margin:0 0 10px 0; }
    .pgm_row{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:10px 0; }
    .pgm_label{ opacity:.8; min-width:160px; }
    .pgm_select, .pgm_btn{
      padding:10px 12px; border-radius:12px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      color:#e5e7eb;
    }
    .pgm_btn{ cursor:pointer; }
    .pgm_btn:hover{ border-color: rgba(34,197,94,.40); }
    .pgm_small{ font-size:12px; opacity:.75; line-height:1.3; }

    #pgm_fire_btn{
      position:fixed;
      right:18px;
      bottom:18px;
      z-index:25;
      display:none;
      pointer-events:auto;
      width:84px; height:84px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(34,197,94,.22);
      color:#e5e7eb;
      font-weight:800;
      letter-spacing:.5px;
      cursor:pointer;
      user-select:none;
      -webkit-user-select:none;
      touch-action:none;
    }
    #pgm_fire_btn:active{ transform:scale(.98); }

    #pgm_touch_hint{
      position:fixed;
      left:12px;
      bottom:12px;
      z-index:24;
      pointer-events:none;
      padding:8px 10px;
      border-radius:12px;
      background:rgba(17,24,39,.58);
      border:1px solid rgba(255,255,255,.10);
      color:#e5e7eb;
      font-size:12px;
      opacity:0;
      transition:opacity .2s;
    }
  `;
  document.head.appendChild(style);

  // Settings button + overlay
  const settingsBtn = document.createElement("button");
  settingsBtn.id = "pgm_settings_btn";
  settingsBtn.title = "Settings";
  settingsBtn.textContent = "⚙️";
  document.body.appendChild(settingsBtn);

  const settingsOverlay = document.createElement("div");
  settingsOverlay.id = "pgm_settings_overlay";
  settingsOverlay.innerHTML = `
    <div id="pgm_settings_panel">
      <h2>Settings</h2>

      <div class="pgm_row">
        <div class="pgm_label">Input Mode</div>
        <select id="pgm_input_mode" class="pgm_select">
          <option value="auto">Auto (detect)</option>
          <option value="pc">PC (mouse/keyboard)</option>
          <option value="mobile">Mobile (touch)</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Mobile: Tap to fire</div>
        <select id="pgm_tap_fire" class="pgm_select">
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Mobile: FIRE button</div>
        <select id="pgm_fire_btn_toggle" class="pgm_select">
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Mobile: Aim area</div>
        <select id="pgm_right_aim" class="pgm_select">
          <option value="true">Right half only</option>
          <option value="false">Anywhere</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Aim sensitivity</div>
        <select id="pgm_sens" class="pgm_select">
          <option value="0.0032">Low</option>
          <option value="0.0042">Normal</option>
          <option value="0.0054">High</option>
          <option value="0.0066">Insane</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Invert Y</div>
        <select id="pgm_invert_y" class="pgm_select">
          <option value="false">Off</option>
          <option value="true">On</option>
        </select>
      </div>

      <div class="pgm_row">
        <div class="pgm_label">Audio</div>
        <select id="pgm_audio" class="pgm_select">
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
      </div>

      <div class="pgm_row">
        <button id="pgm_close_settings" class="pgm_btn">Close (ESC)</button>
      </div>

      <div class="pgm_small">
        Mobile tip: drag to aim. Tap to fire (if enabled). FIRE button can hold for auto-fire. 🔫📱
      </div>
    </div>
  `;
  document.body.appendChild(settingsOverlay);

  const fireBtn = document.createElement("button");
  fireBtn.id = "pgm_fire_btn";
  fireBtn.textContent = "FIRE";
  document.body.appendChild(fireBtn);

  const touchHint = document.createElement("div");
  touchHint.id = "pgm_touch_hint";
  touchHint.textContent = "Drag to aim • Tap to fire";
  document.body.appendChild(touchHint);

  function openSettings() {
    settingsOverlay.style.display = "flex";
    syncSettingsUI();
    setHint("Settings open (paused).", true);
    // pause like shop
    if (game.mode === "play") game.mode = "settings";
    document.exitPointerLock?.();
  }
  function closeSettings() {
    settingsOverlay.style.display = "none";
    if (game.mode === "settings") game.mode = "play";
    applySettings();
    setHint("Back to surviving.", true);
  }

  function el(id) { return document.getElementById(id); }

  function syncSettingsUI() {
    el("pgm_input_mode").value = settings.inputMode;
    el("pgm_tap_fire").value = String(!!settings.mobileTapToFire);
    el("pgm_fire_btn_toggle").value = String(!!settings.mobileShowFireBtn);
    el("pgm_right_aim").value = String(!!settings.mobileRightSideAim);
    el("pgm_invert_y").value = String(!!settings.invertY);
    el("pgm_audio").value = String(!!settings.audioEnabled);

    // pick closest sens option
    const options = ["0.0032", "0.0042", "0.0054", "0.0066"];
    const best = options.reduce((acc, v) => {
      const dv = Math.abs(parseFloat(v) - settings.sensX);
      const da = Math.abs(parseFloat(acc) - settings.sensX);
      return dv < da ? v : acc;
    }, "0.0042");
    el("pgm_sens").value = best;
  }

  function applySettings() {
    const modeNow = effectiveInputMode();
    // show/hide fire button
    const showFire = (modeNow === "mobile" && settings.mobileShowFireBtn);
    fireBtn.style.display = showFire ? "block" : "none";

    // show hint for mobile briefly
    if (modeNow === "mobile") {
      touchHint.style.opacity = "1";
      clearTimeout(applySettings._t);
      applySettings._t = setTimeout(() => { touchHint.style.opacity = "0"; }, 2200);
    } else {
      touchHint.style.opacity = "0";
    }

    // keep sens in sync
    settings.sensX = clamp(settings.sensX, 0.0015, 0.02);
    settings.sensY = clamp(settings.sensY, 0.0015, 0.02);

    // audio toggle
    audio.enabled = !!settings.audioEnabled;

    saveSettings();
  }

  settingsBtn.addEventListener("click", openSettings);
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });
  el("pgm_close_settings").addEventListener("click", closeSettings);

  // Save changes live
  el("pgm_input_mode").addEventListener("change", (e) => {
    settings.inputMode = e.target.value;
    applySettings();
  });
  el("pgm_tap_fire").addEventListener("change", (e) => {
    settings.mobileTapToFire = (e.target.value === "true");
    applySettings();
  });
  el("pgm_fire_btn_toggle").addEventListener("change", (e) => {
    settings.mobileShowFireBtn = (e.target.value === "true");
    applySettings();
  });
  el("pgm_right_aim").addEventListener("change", (e) => {
    settings.mobileRightSideAim = (e.target.value === "true");
    applySettings();
  });
  el("pgm_sens").addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    settings.sensX = v;
    settings.sensY = v;
    applySettings();
  });
  el("pgm_invert_y").addEventListener("change", (e) => {
    settings.invertY = (e.target.value === "true");
    applySettings();
  });
  el("pgm_audio").addEventListener("change", (e) => {
    settings.audioEnabled = (e.target.value === "true");
    applySettings();
  });

  // ---------- AUDIO ----------
  // Uses: synth for gun/hit + your mp3 for groan (zombie_groan.mp3)
  let audio = { ctx: null, master: null, enabled: true };
  let groanAudio = null;

  function ensureAudio() {
    if (!audio.enabled) return false;
    if (audio.ctx) return true;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new A();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);

      groanAudio = new Audio("./zombie_groan.mp3");
      groanAudio.preload = "auto";
      groanAudio.volume = 0.45;
      return true;
    } catch {
      return false;
    }
  }
  function userGesture() {
    ensureAudio();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume().catch(()=>{});
    if (groanAudio) {
      // unlock on iOS
      try {
        const v = groanAudio.volume;
        groanAudio.volume = 0.0001;
        groanAudio.currentTime = 0;
        groanAudio.play().then(() => {
          groanAudio.pause();
          groanAudio.currentTime = 0;
          groanAudio.volume = v;
        }).catch(()=>{ groanAudio.volume = v; });
      } catch {}
    }
  }
  addEventListener("mousedown", userGesture, { passive:true });
  addEventListener("keydown", userGesture, { passive:true });
  addEventListener("touchstart", userGesture, { passive:true });

  function playNoise(duration = 0.06, gain = 0.12, hp = 900, lp = 9000) {
    if (!audio.enabled || !ensureAudio()) return;
    const ac = audio.ctx;
    const len = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = ac.createBufferSource();
    src.buffer = buf;

    const hpF = ac.createBiquadFilter();
    hpF.type = "highpass"; hpF.frequency.value = hp;

    const lpF = ac.createBiquadFilter();
    lpF.type = "lowpass"; lpF.frequency.value = lp;

    const g = ac.createGain();
    g.gain.value = gain;

    src.connect(hpF);
    hpF.connect(lpF);
    lpF.connect(g);
    g.connect(audio.master);
    src.start();
  }

  function playTone(freq = 120, duration = 0.06, gain = 0.12, type = "square") {
    if (!audio.enabled || !ensureAudio()) return;
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
    playTone(170, 0.05, 0.16, "square");
    playTone(98,  0.05, 0.10, "sawtooth");
    playNoise(0.05, 0.14, 1200, 9000);
  }

  function sfxHit() {
    playTone(760, 0.03, 0.10, "triangle");
    playTone(120, 0.05, 0.08, "sine");
  }

  function sfxZombieGroan(dToPlayer = 6) {
    if (!audio.enabled) return;
    if (!groanAudio) return;
    const vol = clamp(1 - dToPlayer / 12, 0, 1);
    if (vol < 0.05) return;
    try {
      groanAudio.volume = 0.18 + vol * 0.35;
      groanAudio.currentTime = 0;
      groanAudio.play().catch(()=>{});
    } catch {}
  }

  // ---------- SAVE ----------
  const SAVE_KEY = "pgm_zombie_rpg_save_v4";

  function xpToNext(level) {
    return Math.floor(70 + (level - 1) * 45 + Math.pow(level - 1, 1.25) * 20);
  }

  // ---------- GAME STATE ----------
  const game = {
    mode: "play",            // "play" | "shop" | "dead" | "settings"
    pointerLocked: false,
    wave: 1,
    t: 0,
    recoil: 0,
    muzzle: 0,
    flow: null,
    flowTimer: 0,
  };

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

  // ---------- Shop kiosk (WALL-MOUNTED) ----------
  const shopKiosk = { x: 2.05, y: 1.25, r: 1.15 };
  function nearShopKiosk() {
    return dist(player.x, player.y, shopKiosk.x, shopKiosk.y) <= shopKiosk.r;
  }

  // ---------- WEAPONS ----------
  const WEAPONS = [
    { id:"pistol_rusty",    name:"Rusty Pistol",    type:"pistol", rarity:"Common",   unlockLevel:1, price:0,   dmg:24, fireRate:3.2, magSize:8,  reloadTime:0.95, spread:0.010, range:10.5, reserveStart:32 },
    { id:"pistol_service",  name:"Service Pistol",  type:"pistol", rarity:"Uncommon", unlockLevel:2, price:60,  dmg:28, fireRate:3.6, magSize:10, reloadTime:0.92, spread:0.010, range:11.0, reserveStart:40 },
    { id:"pistol_marksman", name:"Marksman Pistol", type:"pistol", rarity:"Rare",     unlockLevel:4, price:140, dmg:36, fireRate:3.2, magSize:12, reloadTime:0.90, spread:0.008, range:12.0, reserveStart:48 },
    { id:"pistol_relic",    name:"Relic Pistol",    type:"pistol", rarity:"Epic",     unlockLevel:7, price:320, dmg:48, fireRate:3.0, magSize:14, reloadTime:0.88, spread:0.007, range:13.0, reserveStart:56 },
  ];
  function W(id){ return WEAPONS.find(w => w.id === id); }

  // ---------- ARMOR ----------
  const RARITIES = [
    { name:"Common",    mult:1.0,  color:"rgba(200,200,210,.90)" },
    { name:"Uncommon",  mult:1.2,  color:"rgba(80,210,120,.92)" },
    { name:"Rare",      mult:1.45, color:"rgba(80,160,255,.92)" },
    { name:"Epic",      mult:1.75, color:"rgba(200,80,255,.92)" },
    { name:"Legendary", mult:2.10, color:"rgba(255,190,80,.95)" },
  ];

  const ARMOR_SLOTS = ["helmet","chest","legs","boots"];
  const ARMOR_BASE = { helmet:4, chest:7, legs:5, boots:3 };

  function rollArmorPiece() {
    const wv = game.wave;
    const r = Math.random();
    let ri = 0;
    const bump = clamp((wv - 1) / 14, 0, 1);

    const tCommon = 0.58 - bump * 0.28;
    const tUnc    = 0.28 + bump * 0.10;
    const tRare   = 0.10 + bump * 0.10;
    const tEpic   = 0.035 + bump * 0.06;
    const tLeg    = 0.005 + bump * 0.02;

    const cuts = [tCommon, tCommon+tUnc, tCommon+tUnc+tRare, tCommon+tUnc+tRare+tEpic, 1];
    if (r < cuts[0]) ri = 0;
    else if (r < cuts[1]) ri = 1;
    else if (r < cuts[2]) ri = 2;
    else if (r < cuts[3]) ri = 3;
    else ri = 4;

    const slot = ARMOR_SLOTS[(Math.random() * ARMOR_SLOTS.length) | 0];
    const base = ARMOR_BASE[slot];
    const armor = Math.max(1, Math.round(base * RARITIES[ri].mult));
    const pretty = slot === "helmet" ? "Helmet" : slot === "chest" ? "Chest" : slot === "legs" ? "Leggings" : "Boots";

    return {
      id: `armor_${slot}_${Date.now()}_${(Math.random()*9999)|0}`,
      slot,
      rarityIndex: ri,
      rarity: RARITIES[ri].name,
      armor,
      name: `${RARITIES[ri].name} ${pretty}`,
    };
  }

  // ---------- PLAYER ----------
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
    mineCount: 0,

    lastHurtTime: 0,
    regenDelay: 4.0,
    regenRate: 4.0,

    scrap: 0,
    essence: 0,

    equip: { helmet:null, chest:null, legs:null, boots:null },
  };

  function getTotalArmor() {
    let sum = 0;
    for (const s of ARMOR_SLOTS) {
      const it = player.equip[s];
      if (it && typeof it.armor === "number") sum += it.armor;
    }
    return sum;
  }

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

  function saveGame() {
    try {
      for (const w of player.slots) {
        if (!w) continue;
        w._mag = w._mag ?? w.magSize;
        w._reserve = w._reserve ?? (w.reserveStart ?? 32);
      }
      const data = {
        cash: player.cash,
        level: player.level,
        xp: player.xp,
        slotIds: player.slots.map(w => (w ? w.id : null)),
        activeSlot: player.activeSlot,
        usingKnife: player.usingKnife,
        weaponState: Object.fromEntries(
          player.slots.filter(Boolean).map(w => [w.id, { _mag: w._mag, _reserve: w._reserve }])
        ),
        medkits: player.medkits,
        mineCount: player.mineCount,
        scrap: player.scrap,
        essence: player.essence,
        equip: player.equip,
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

      player.medkits = data.medkits ?? 0;
      player.mineCount = data.mineCount ?? 0;

      player.scrap = data.scrap ?? 0;
      player.essence = data.essence ?? 0;
      player.equip = data.equip ?? player.equip;

      if (!player.usingKnife && player.slots[player.activeSlot]) {
        syncAmmoToWeapon(player.slots[player.activeSlot]);
      }

      setHint("Loaded save ✅", true);
      return true;
    } catch {
      return false;
    }
  }

  // init ammo + load
  syncAmmoToWeapon(player.slots[0]);
  loadGame();

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
    setHint("Knife equipped. Get close and tap/click.", true);
    saveGame();
  }

  // ---------- SHOP ----------
  function shopHeader(text) {
    const div = document.createElement("div");
    div.style.gridColumn = "1 / -1";
    div.style.padding = "10px 10px 2px";
    div.style.fontWeight = "800";
    div.style.opacity = "0.92";
    div.textContent = text;
    return div;
  }

  function shopInfo(text) {
    const div = document.createElement("div");
    div.style.gridColumn = "1 / -1";
    div.style.padding = "0 10px 10px";
    div.style.opacity = "0.75";
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
    btn.addEventListener("click", () => { if (!locked) onClick(); });
    return btn;
  }

  function openShop() {
    game.mode = "shop";
    ui.shop.classList.remove("hidden");
    ui.death.classList.add("hidden");
    renderShop();
    setHint("SHOP OPEN (paused). Q / ESC to close.", true);
    saveGame();
    document.exitPointerLock?.();
  }

  function closeShop() {
    game.mode = "play";
    ui.shop.classList.add("hidden");
    setHint("Back to surviving.", true);
    saveGame();
  }
  ui.closeShop.addEventListener("click", closeShop);

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
    setHint(`Bought: ${w.name}. Slot 2 (press 2).`, true);
    saveGame();
  }

  let shopArmorRoll = null;

  function equipArmor(piece) {
    if (!piece || !piece.slot) return;
    player.equip[piece.slot] = piece;
    setHint(`Equipped: ${piece.name} (+${piece.armor} armor)`, true);
    saveGame();
  }

  function upgradeEquippedArmor(slot) {
    const it = player.equip[slot];
    if (!it) return setHint(`No ${slot} equipped.`, false);
    if (it.rarityIndex >= 4) return setHint("Already Legendary.", true);

    const next = it.rarityIndex + 1;
    const costScrap = 12 + next * 10;
    const costEss  = 3 + next * 2;

    if (player.scrap < costScrap || player.essence < costEss) {
      return setHint(`Need ${costScrap} scrap + ${costEss} essence.`, false);
    }

    player.scrap -= costScrap;
    player.essence -= costEss;
    it.rarityIndex = next;
    it.rarity = RARITIES[next].name;

    const base = ARMOR_BASE[it.slot];
    it.armor = Math.max(1, Math.round(base * RARITIES[next].mult));

    const pretty = it.slot === "helmet" ? "Helmet" : it.slot === "chest" ? "Chest" : it.slot === "legs" ? "Leggings" : "Boots";
    it.name = `${it.rarity} ${pretty}`;

    setHint(`Upgraded armor: ${it.name} (+${it.armor})`, true);
    saveGame();
  }

  function renderShop() {
    ui.shopList.innerHTML = "";

    const armorTotal = getTotalArmor();
    ui.shopList.appendChild(shopInfo(
      `You have: Medkits ${player.medkits} | Mines ${player.mineCount} | Scrap ${player.scrap} | Essence ${player.essence} | Armor ${armorTotal}`
    ));

    ui.shopList.appendChild(shopHeader("Utility"));

    ui.shopList.appendChild(shopButton({
      title: "Ammo Pack",
      desc: "+16 reserve ammo (current weapon)",
      price: 15,
      locked: player.cash < 15,
      lockText: "Not enough cash",
      onClick: () => {
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
      desc: "+1 Medkit (press H to use)",
      price: 20,
      locked: player.cash < 20,
      lockText: "Not enough cash",
      onClick: () => {
        player.cash -= 20;
        player.medkits += 1;
        setHint("Bought 1 medkit. Press H to heal.", true);
        saveGame();
        renderShop();
      }
    }));

    ui.shopList.appendChild(shopButton({
      title: "Land Mine",
      desc: "+1 Mine (press G to place)",
      price: 35,
      locked: player.cash < 35,
      lockText: "Not enough cash",
      onClick: () => {
        player.cash -= 35;
        player.mineCount += 1;
        setHint("Bought 1 mine. Press G to place.", true);
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
          if (owned) return setHint("You already own that.", false);
          if (!can.ok) return setHint(can.why, false);
          player.cash -= w.price;
          giveWeapon(w.id);
          renderShop();
        }
      }));
    }

    ui.shopList.appendChild(shopHeader("Armor"));
    if (!shopArmorRoll) shopArmorRoll = rollArmorPiece();
    const ar = shopArmorRoll;

    const armorPrice = Math.max(25, Math.floor((18 + ar.armor * 6) * (1 + game.wave * 0.04)));
    ui.shopList.appendChild(shopButton({
      title: ar.name,
      desc: `Slot: ${ar.slot} | Armor +${ar.armor} | Equip to replace current`,
      price: armorPrice,
      locked: player.cash < armorPrice,
      lockText: "Not enough cash",
      onClick: () => {
        player.cash -= armorPrice;
        equipArmor(ar);
        shopArmorRoll = rollArmorPiece();
        saveGame();
        renderShop();
      }
    }));

    ui.shopList.appendChild(shopHeader("Crafting"));
    ui.shopList.appendChild(shopInfo("Upgrade equipped armor using Scrap + Essence (earned from kills/drops)."));

    for (const slot of ARMOR_SLOTS) {
      const it = player.equip[slot];
      const name = it ? `${it.name} (+${it.armor})` : `Empty (${slot})`;
      const next = it ? it.rarityIndex + 1 : 0;

      let costScrap = 0, costEss = 0, lockText = "";
      let locked = false;

      if (!it) { locked = true; lockText = "Equip armor first"; }
      else if (it.rarityIndex >= 4) { locked = true; lockText = "Max"; }
      else {
        costScrap = 12 + next * 10;
        costEss = 3 + next * 2;
        if (player.scrap < costScrap || player.essence < costEss) {
          locked = true;
          lockText = `Need ${costScrap} scrap + ${costEss} essence`;
        } else lockText = `${costScrap} scrap + ${costEss} essence`;
      }

      ui.shopList.appendChild(shopButton({
        title: `Upgrade ${slot}`,
        desc: name,
        price: 0,
        locked,
        lockText,
        onClick: () => {
          upgradeEquippedArmor(slot);
          renderShop();
        }
      }));
    }
  }

  // ---------- Enemies + Drops + Mines ----------
  let zombies = [];
  let drops = [];
  let mines = [];

  function spawnZombie() {
    for (let tries = 0; tries < 90; tries++) {
      const x = rand(1.5, world.mapW - 1.5);
      const y = rand(1.5, world.mapH - 1.5);
      if (isWall(x, y)) continue;
      if (dist(x, y, shopKiosk.x, shopKiosk.y) < 3.0) continue;
      if (dist(x, y, player.x, player.y) < 4.0) continue;

      const hp = 70 + game.wave * 12;
      zombies.push({
        x, y,
        r: 0.28,
        hp, maxHp: hp,
        speed: (0.75 + game.wave * 0.04) * (Math.random() < 0.18 ? 1.35 : 1),
        dmg: 9 + game.wave * 1.6,
        hitCd: 0,
        type: Math.random() < 0.18 ? "runner" : "walker",
        groanT: rand(2.0, 5.5),
      });
      return;
    }
  }

  function dropCash(x, y, amount) {
    drops.push({ kind:"cash", x, y, amount, t: 14, r: 0.22 });
  }

  function dropMats(x, y) {
    const s = Math.random();
    if (s < 0.70) drops.push({ kind:"scrap", x, y, amount: 1 + (Math.random()<0.35 ? 1 : 0), t: 14, r: 0.22 });
    if (s < 0.25) drops.push({ kind:"ess", x, y, amount: 1, t: 14, r: 0.22 });
    const arChance = clamp(0.06 + game.wave * 0.004, 0.06, 0.18);
    if (Math.random() < arChance) {
      const piece = rollArmorPiece();
      drops.push({ kind:"armor", x, y, piece, t: 18, r: 0.26 });
    }
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

  function handleZombieDeath(z) {
    const cash = Math.floor(rand(7, 14) + game.wave * 0.8);
    const xp = 14 + game.wave * 2;
    dropCash(z.x, z.y, cash);
    dropMats(z.x, z.y);
    gainXP(xp);
  }

  // ---------- Items ----------
  function useMedkit() {
    if (game.mode !== "play") return;
    if (player.medkits <= 0) return setHint("No medkits.", false);
    if (player.hp >= player.maxHp) return setHint("Already full HP.", true);

    player.medkits--;
    player.hp = clamp(player.hp + 45, 0, player.maxHp);
    setHint("Used medkit +45 HP 🩹", true);
    saveGame();
  }

  function placeMine() {
    if (game.mode !== "play") return;
    if (player.mineCount <= 0) return setHint("No mines. Buy some.", false);

    const mx = player.x + Math.cos(player.a) * 0.55;
    const my = player.y + Math.sin(player.a) * 0.55;
    if (isWall(mx, my)) return setHint("Can't place a mine on a wall.", false);

    player.mineCount--;
    mines.push({ x: mx, y: my, r: 0.25, t: 40 });
    setHint("Mine placed 💣", true);
    saveGame();
  }

  // ---------- Combat ----------
  function reload() {
    if (game.mode !== "play") return;
    if (player.usingKnife) return setHint("Knife doesn't reload 😈", true);

    const w = currentWeapon();
    if (!w) return;

    if (player.ammo.reloading) return;
    if (player.ammo.mag >= w.magSize) return;
    if (player.ammo.reserve <= 0) return setHint("No reserve ammo. Buy ammo at the shop.", false);

    player.ammo.reloading = true;
    player.ammo.rt = 0;
    setHint("Reloading...", true);
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
      sfxHit();

      if (best.hp <= 0) {
        handleZombieDeath(best);
        zombies = zombies.filter(z => z !== best);
        setHint("KNIFE KILL!", true);
      } else {
        setHint("Knife hit!", true);
      }
    } else {
      setHint("Slash!", true);
    }
  }

  function shoot() {
    if (game.mode !== "play") return;

    const modeNow = effectiveInputMode();
    // PC requires pointer lock. Mobile does not.
    if (modeNow === "pc" && !game.pointerLocked) return;

    if (player.usingKnife) return knifeAttack();

    const w = currentWeapon();
    if (!w) return;

    const now = performance.now() / 1000;
    if (player.ammo.reloading) return;
    if (now - player.ammo.lastShot < 1 / w.fireRate) return;
    if (player.ammo.mag <= 0) return setHint("Empty. Reload or buy ammo.", false);

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

        // hitzones based on crosshair Y against projected sprite
        const hgt = innerHeight;
        const horizon = (hgt / 2) + (player.pitch * (hgt * 0.35));
        const spriteSize = clamp((hgt * 0.90) / (dist(player.x, player.y, hitZ.x, hitZ.y) + 0.001), 12, hgt * 1.25);
        const spriteBottom = horizon + spriteSize * 0.35;
        const spriteTop = spriteBottom - spriteSize;

        const crossY = hgt / 2;
        const yRel = (crossY - spriteTop) / spriteSize;

        let mult = 1.0;
        if (yRel < 0.28) mult = 1.8;
        else if (yRel > 0.78) mult = 0.65;

        const dmg = w.dmg * mult;
        hitZ.hp -= dmg;

        if (hitZ.hp <= 0) {
          handleZombieDeath(hitZ);
          zombies = zombies.filter(z => z !== hitZ);
        }
      }
    }

    if (didHit) sfxHit();

    const cw = currentWeapon();
    if (cw) saveAmmoFromWeapon(cw);
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
    for (let d = 0; d < 20; d += step) {
      const x = player.x + Math.cos(angle) * d;
      const y = player.y + Math.sin(angle) * d;
      if (isWall(x, y)) return d;
    }
    return 20;
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

    ctx.fillStyle = "rgba(255,210,80,.9)";
    for (const m of mines) {
      ctx.beginPath();
      ctx.arc(x0 + m.x * cell, y0 + m.y * cell, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(239,68,68,.85)";
    for (const z of zombies) {
      ctx.beginPath();
      ctx.arc(x0 + z.x * cell, y0 + z.y * cell, 2.2, 0, Math.PI * 2);
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

  // ---------- Gun model ----------
  function gunStyleFor(id) {
    if (id === "pistol_rusty")    return { body:"rgba(60,70,85,.96)",  dark:"rgba(22,26,34,.98)", accent:"rgba(170,120,60,.85)",  bodyLen:118, barrelLen:22 };
    if (id === "pistol_service")  return { body:"rgba(55,65,80,.96)",  dark:"rgba(18,20,26,.98)", accent:"rgba(80,160,255,.85)",  bodyLen:132, barrelLen:26 };
    if (id === "pistol_marksman") return { body:"rgba(48,58,72,.96)",  dark:"rgba(15,18,24,.98)", accent:"rgba(210,210,220,.85)", bodyLen:145, barrelLen:30 };
    if (id === "pistol_relic")    return { body:"rgba(40,48,60,.96)",  dark:"rgba(10,12,16,.98)", accent:"rgba(200,80,255,.85)",  bodyLen:156, barrelLen:34 };
    return { body:"rgba(55,65,80,.96)", dark:"rgba(18,20,26,.98)", accent:"rgba(34,197,94,.85)", bodyLen:126, barrelLen:24 };
  }

  function drawGunModel(dt) {
    const w = innerWidth, h = innerHeight;

    game.recoil = Math.max(0, game.recoil - dt * 2.2);
    game.muzzle = Math.max(0, game.muzzle - dt * 3.2);

    const moving = (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d"));
    const bob = moving ? Math.sin(performance.now() / 90) * 4 : 0;

    const rx = game.recoil * 22;
    const ry = game.recoil * 16;

    const baseX = w * 0.56 + rx;
    const baseY = h * 0.74 + bob + ry;

    const cw = currentWeapon();
    const sid = cw ? cw.id : "knife";
    const style = gunStyleFor(sid);

    ctx.save();
    ctx.globalAlpha = 0.98;

    ctx.translate(baseX, baseY);
    ctx.rotate(-0.06);

    ctx.fillStyle = "rgba(190,150,120,.92)";
    ctx.fillRect(-42, 46, 120, 18);

    ctx.fillStyle = "rgba(18,20,26,.96)";
    ctx.fillRect(-14, 36, 44, 34);

    if (player.usingKnife) {
      ctx.fillStyle = "rgba(220,220,230,.95)";
      ctx.fillRect(40, 22, 150, 10);
      ctx.fillStyle = "rgba(20,20,20,.9)";
      ctx.fillRect(0, 30, 60, 26);
    } else {
      ctx.fillStyle = style.body;
      ctx.fillRect(0, 18, style.bodyLen, 34);

      ctx.fillStyle = style.dark;
      ctx.fillRect(10, 22, style.bodyLen - 30, 10);

      ctx.fillStyle = style.dark;
      ctx.fillRect(22, 46, 40, 56);

      ctx.fillStyle = style.dark;
      ctx.fillRect(style.bodyLen - 10, 24, style.barrelLen, 10);

      ctx.fillStyle = style.accent;
      ctx.fillRect(8, 40, Math.max(18, style.bodyLen * 0.45), 4);

      if (game.muzzle > 0) {
        const a = 0.75 * (game.muzzle / 0.06);
        ctx.fillStyle = `rgba(255,210,80,${a})`;
        ctx.beginPath();
        ctx.arc(style.bodyLen + style.barrelLen + 8, 28, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (player.usingKnife && player.knife.swing > 0) {
      const t = player.knife.swing / 0.14;
      ctx.fillStyle = `rgba(220,220,230,${0.28 * t})`;
      ctx.fillRect(-w * 0.05, -h * 0.05, w * 0.40, h * 0.40);
    }

    ctx.restore();
  }

  // ---------- Kiosk billboard ----------
  function drawShopKioskBillboard(screenX, top, size) {
    const left = screenX - size / 2;

    ctx.fillStyle = "rgba(30,34,44,.94)";
    ctx.fillRect(left + size*0.12, top + size*0.20, size*0.76, size*0.60);

    ctx.fillStyle = "rgba(34,197,94,.95)";
    ctx.fillRect(left + size*0.18, top + size*0.22, size*0.64, size*0.18);

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = `bold ${Math.max(10, size*0.12)}px system-ui`;
    ctx.fillText("SHOP", left + size*0.28, top + size*0.34);

    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(left + size*0.24, top + size*0.52, size*0.52, size*0.06);

    ctx.fillStyle = "rgba(34,197,94,.18)";
    ctx.fillRect(left + size*0.18, top + size*0.22, size*0.64, size*0.58);
  }

  // ---------- Render ----------
  function render(dt) {
    const w = innerWidth, h = innerHeight;
    const horizon = (h / 2) + (player.pitch * (h * 0.35));

    // sky + floor
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = "#070a0f";
    ctx.fillRect(0, horizon, w, h - horizon);

    // walls
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

    // ----- build sprite list for depth sort (zombies, mines, kiosk) -----
    const sprites = [];
    for (const z of zombies) sprites.push({ kind:"z", x:z.x, y:z.y, ref:z, d:dist(player.x, player.y, z.x, z.y) });
    for (const m of mines)  sprites.push({ kind:"mine", x:m.x, y:m.y, ref:m, d:dist(player.x, player.y, m.x, m.y) });
    sprites.push({ kind:"kiosk", x:shopKiosk.x, y:shopKiosk.y, ref:shopKiosk, d:dist(player.x, player.y, shopKiosk.x, shopKiosk.y) });

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
      const size = clamp((h * 0.90) / (distTo + 0.001), 12, h * 1.25);

      const spriteBottom = horizon + size * 0.35;
      const top = spriteBottom - size;

      if (s.kind === "kiosk") {
        drawShopKioskBillboard(screenX, top, size * 0.92);
        continue;
      }

      if (s.kind === "mine") {
        ctx.fillStyle = "rgba(255,210,80,.92)";
        ctx.beginPath();
        ctx.arc(screenX, horizon + size * 0.10, Math.max(5, size * 0.07), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (s.kind === "z") {
        const z = s.ref;
        const runner = z.type === "runner";
        const bodyCol = runner ? "rgba(239,68,68,.90)" : "rgba(160,175,190,.90)";
        const darkCol = runner ? "rgba(120,20,20,.92)" : "rgba(70,80,95,.92)";
        const bob = Math.sin(performance.now() / 130 + z.x * 2.1) * (size * 0.02);
        const left = screenX - size / 2;

        ctx.fillStyle = darkCol;
        ctx.fillRect(left + size*0.36, top + size*0.72 + bob, size*0.10, size*0.24);
        ctx.fillRect(left + size*0.54, top + size*0.72 + bob, size*0.10, size*0.24);

        ctx.fillStyle = bodyCol;
        ctx.fillRect(left + size*0.32, top + size*0.34 + bob, size*0.42, size*0.48);

        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.arc(screenX, top + size*0.24 + bob, size*0.14, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = darkCol;
        ctx.fillRect(left + size*0.20, top + size*0.42 + bob, size*0.12, size*0.32);
        ctx.fillRect(left + size*0.72, top + size*0.42 + bob, size*0.12, size*0.32);

        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(screenX - size*0.06, top + size*0.22 + bob, size*0.04, size*0.03);
        ctx.fillRect(screenX + size*0.02, top + size*0.22 + bob, size*0.04, size*0.03);

        const pct = clamp(z.hp / z.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(left, top - 10, size, 6);
        ctx.fillStyle = "rgba(34,197,94,.9)";
        ctx.fillRect(left, top - 10, size * pct, 6);
      }
    }

    // ----- drops pass (clean) -----
    for (const d of drops) {
      const dx = d.x - player.x;
      const dy = d.y - player.y;
      const distTo = Math.hypot(dx, dy);

      let ang = Math.atan2(dy, dx) - player.a;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      if (Math.abs(ang) > player.fov / 2 + 0.35) continue;

      const rayD = castRay(player.a + ang);
      if (rayD + 0.05 < distTo) continue;

      const screenX = (ang / (player.fov / 2)) * (w / 2) + (w / 2);
      const size = clamp((h * 0.90) / (distTo + 0.001), 12, h * 1.25);

      let col = "rgba(34,197,94,.9)";
      let label = "$";
      if (d.kind === "scrap") { col = "rgba(160,175,190,.92)"; label = "S"; }
      if (d.kind === "ess")   { col = "rgba(200,80,255,.92)";  label = "E"; }
      if (d.kind === "armor") { col = RARITIES[d.piece.rarityIndex].color; label = "A"; }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(screenX, horizon + size * 0.10, Math.max(6, size * 0.09), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.font = "bold 14px system-ui";
      ctx.fillText(label, screenX - 5, horizon + size * 0.10 + 5);
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

    if (nearShopKiosk() && game.mode === "play") {
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(w * 0.30, h * 0.62, w * 0.40, 42);
      ctx.fillStyle = "rgba(34,197,94,.95)";
      ctx.font = "bold 16px system-ui";
      ctx.fillText("Press Q to open Shop", w * 0.35, h * 0.645);

      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = "14px system-ui";
      ctx.fillText(
        `Medkits ${player.medkits} | Mines ${player.mineCount} | Scrap ${player.scrap} | Essence ${player.essence} | Armor ${getTotalArmor()}`,
        w * 0.315, h * 0.675
      );
    }
  }

  // ---------- Death ----------
  function die() {
    game.mode = "dead";
    ui.shop.classList.add("hidden");
    ui.death.classList.remove("hidden");
    setHint("You died. Tap Restart.", false);
    document.exitPointerLock?.();
    saveGame();
  }

  ui.restart.addEventListener("click", () => {
    zombies = [];
    drops = [];
    mines = [];
    game.wave = 1;
    game.t = 0;
    game.mode = "play";

    ui.shop.classList.add("hidden");
    ui.death.classList.add("hidden");

    player.x = 1.6; player.y = 1.6; player.a = 0;
    player.hp = player.maxHp;
    player.stamina = player.staminaMax;

    setHint("Restarted. Progress kept.", true);
    saveGame();
  });

  // ---------- Controls (PC + Mobile) ----------
  let mouseDown = false;
  let lookDelta = 0;

  function lockPointer() { canvas.requestPointerLock?.(); }
  document.addEventListener("pointerlockchange", () => {
    game.pointerLocked = (document.pointerLockElement === canvas);
  });

  const keys = new Set();

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);

    if (k === "escape") {
      if (game.mode === "shop") closeShop();
      if (game.mode === "settings") closeSettings();
    }

    if (k === "r") reload();

    if (k === "q") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "play" && nearShopKiosk()) openShop();
      else if (game.mode === "play") setHint("Find the green SHOP kiosk and press Q.", false);
    }

    if (k === "1") equipSlot(0);
    if (k === "2") equipSlot(1);
    if (k === "3") equipKnife();

    if (k === "g") placeMine();
    if (k === "h") useMedkit();
  });

  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // PC mouse
  addEventListener("mousedown", (e) => {
    if (e.button === 0) mouseDown = true;
    if (game.mode !== "play") return;

    const modeNow = effectiveInputMode();
    if (modeNow === "pc" && !game.pointerLocked) lockPointer();
  });
  addEventListener("mouseup", (e) => { if (e.button === 0) mouseDown = false; });

  addEventListener("mousemove", (e) => {
    if (game.mode !== "play") return;
    const modeNow = effectiveInputMode();
    if (modeNow !== "pc") return;
    if (!game.pointerLocked) return;

    lookDelta += (e.movementX || 0);

    const my = (e.movementY || 0);
    const dir = settings.invertY ? 1 : -1; // normal: up looks up => pitch -= my*...
    player.pitch = clamp(player.pitch + dir * (my * 0.0022), -0.9, 0.9);
  });

  // Mobile touch aim + tap-to-fire
  canvas.style.touchAction = "none";

  const mobile = {
    aiming: false,
    pointerId: null,
    sx: 0, sy: 0,
    lastX: 0, lastY: 0,
    moved: false,
    dead: 8,
  };

  function touchToAim(dx, dy) {
    player.a += dx * settings.sensX;

    const yDir = settings.invertY ? 1 : -1;
    player.pitch = clamp(player.pitch + yDir * (-dy * settings.sensY), -0.9, 0.9);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (game.mode !== "play") return;

    const modeNow = effectiveInputMode();
    if (modeNow !== "mobile") return;
    if (e.pointerType !== "touch") return;

    if (settings.mobileRightSideAim && e.clientX < innerWidth * 0.5) return;

    mobile.aiming = true;
    mobile.pointerId = e.pointerId;
    mobile.sx = mobile.lastX = e.clientX;
    mobile.sy = mobile.lastY = e.clientY;
    mobile.moved = false;

    try { canvas.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }, { passive:false });

  canvas.addEventListener("pointermove", (e) => {
    if (!mobile.aiming) return;
    if (e.pointerId !== mobile.pointerId) return;
    if (game.mode !== "play") return;

    const dx = e.clientX - mobile.lastX;
    const dy = e.clientY - mobile.lastY;

    const totalDx = e.clientX - mobile.sx;
    const totalDy = e.clientY - mobile.sy;
    if (!mobile.moved && Math.hypot(totalDx, totalDy) > mobile.dead) mobile.moved = true;

    mobile.lastX = e.clientX;
    mobile.lastY = e.clientY;

    touchToAim(dx, dy);
    e.preventDefault();
  }, { passive:false });

  canvas.addEventListener("pointerup", (e) => {
    if (!mobile.aiming) return;
    if (e.pointerId !== mobile.pointerId) return;

    const modeNow = effectiveInputMode();
    if (modeNow === "mobile" && settings.mobileTapToFire && !mobile.moved && game.mode === "play") {
      shoot(); // tap = one shot
    }

    mobile.aiming = false;
    mobile.pointerId = null;
    e.preventDefault();
  }, { passive:false });

  canvas.addEventListener("pointercancel", (e) => {
    if (e.pointerId !== mobile.pointerId) return;
    mobile.aiming = false;
    mobile.pointerId = null;
  }, { passive:true });

  // FIRE button: hold to auto-fire
  let fireHeld = false;
  fireBtn.addEventListener("pointerdown", (e) => {
    if (game.mode !== "play") return;
    if (effectiveInputMode() !== "mobile") return;
    fireHeld = true;
    try { fireBtn.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }, { passive:false });
  fireBtn.addEventListener("pointerup", (e) => {
    fireHeld = false;
    e.preventDefault();
  }, { passive:false });
  fireBtn.addEventListener("pointercancel", () => { fireHeld = false; }, { passive:true });

  // ---------- Gameplay systems ----------
  function useSprintAndMove(dt) {
    let mxv = 0, myv = 0;
    if (keys.has("w")) { mxv += Math.cos(player.a); myv += Math.sin(player.a); }
    if (keys.has("s")) { mxv -= Math.cos(player.a); myv -= Math.sin(player.a); }
    if (keys.has("a")) { mxv += Math.cos(player.a - Math.PI / 2); myv += Math.sin(player.a - Math.PI / 2); }
    if (keys.has("d")) { mxv += Math.cos(player.a + Math.PI / 2); myv += Math.sin(player.a + Math.PI / 2); }

    const len = Math.hypot(mxv, myv) || 1;
    mxv /= len; myv /= len;

    const wantsSprint = keys.has("shift");
    let moveSpeed = player.speed;

    if (wantsSprint && player.stamina > 1 && (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d"))) {
      moveSpeed *= player.sprintMult;
      player.stamina = Math.max(0, player.stamina - player.staminaDrain * dt);
    } else {
      player.stamina = Math.min(player.staminaMax, player.stamina + player.staminaRegen * dt);
    }

    const nx = player.x + mxv * moveSpeed * dt;
    const ny = player.y + myv * moveSpeed * dt;
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }

  // ---------- Loop ----------
  let last = performance.now();
  let saveTimer = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // UI sync
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

    // autosave
    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; saveGame(); }

    // timers
    if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
    if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

    if (game.mode !== "play") return;

    // wave pacing
    game.t += dt;
    if (game.t > game.wave * 25) game.wave++;

    // reload timing
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

    // yaw from mouse
    player.a += lookDelta * 0.0022;
    lookDelta = 0;

    // movement
    useSprintAndMove(dt);

    // spawn zombies
    const target = 4 + game.wave * 2;
    if (zombies.length < target && Math.random() < 0.08 + game.wave * 0.002) spawnZombie();

    // build flow field
    game.flowTimer -= dt;
    if (game.flowTimer <= 0) {
      game.flowTimer = 0.25;
      game.flow = buildFlowFieldFromPlayer();
    }
    const flow = game.flow;

    // zombie AI
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.hitCd = Math.max(0, z.hitCd - dt);

      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = rand(2.2, 5.6);
        const d0 = dist(player.x, player.y, z.x, z.y);
        sfxZombieGroan(d0);
      }

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
      const spz = z.speed * (z.type === "runner" ? 1.18 : 1);

      const zx = z.x + Math.cos(ang) * spz * dt;
      const zy = z.y + Math.sin(ang) * spz * dt;
      if (!isWall(zx, z.y)) z.x = zx;
      if (!isWall(z.x, zy)) z.y = zy;

      const d = dist(player.x, player.y, z.x, z.y);
      if (d < 0.55 && z.hitCd <= 0) {
        z.hitCd = 0.6;

        const armor = getTotalArmor();
        const reduction = clamp(armor * 0.02, 0, 0.60);
        const finalDmg = Math.max(1, Math.round(z.dmg * (1 - reduction)));

        player.hp -= finalDmg;
        player.lastHurtTime = performance.now() / 1000;

        setHint(`You're getting chewed! (-${finalDmg})`, false);
        if (player.hp <= 0) die();
        saveGame();
      }
    }

    // mines explode
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.t -= dt;

      let triggered = false;
      for (const z of zombies) {
        if (dist(m.x, m.y, z.x, z.y) < 0.45) { triggered = true; break; }
      }

      if (triggered) {
        const R = 1.6;
        for (let zi = zombies.length - 1; zi >= 0; zi--) {
          const z = zombies[zi];
          const d = dist(m.x, m.y, z.x, z.y);
          if (d <= R) {
            const dmg = 140 * (1 - d / R);
            z.hp -= dmg;
            if (z.hp <= 0) {
              handleZombieDeath(z);
              zombies.splice(zi, 1);
            }
          }
        }
        setHint("💥 Mine exploded!", true);
        mines.splice(i, 1);
        continue;
      }

      if (m.t <= 0) mines.splice(i, 1);
    }

    // pickups
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t -= dt;

      if (dist(player.x, player.y, d.x, d.y) < 0.55) {
        if (d.kind === "cash") {
          player.cash += d.amount;
          setHint(`Picked up $${d.amount}.`, true);
        } else if (d.kind === "scrap") {
          player.scrap += d.amount;
          setHint(`Picked up Scrap +${d.amount}.`, true);
        } else if (d.kind === "ess") {
          player.essence += d.amount;
          setHint(`Picked up Essence +${d.amount}.`, true);
        } else if (d.kind === "armor") {
          const slot = d.piece.slot;
          const cur = player.equip[slot];
          if (!cur || d.piece.armor > cur.armor) {
            player.equip[slot] = d.piece;
            setHint(`Equipped drop: ${d.piece.name} (+${d.piece.armor})`, true);
          } else {
            setHint(`Found armor: ${d.piece.name} (not better)`, true);
          }
        }
        drops.splice(i, 1);
        saveGame();
        continue;
      }
      if (d.t <= 0) drops.splice(i, 1);
    }

    // slow regen
    const secondsNow = performance.now() / 1000;
    if (player.hp > 0 && player.hp < player.maxHp) {
      if (secondsNow - player.lastHurtTime >= player.regenDelay) {
        player.hp = Math.min(player.maxHp, player.hp + player.regenRate * dt);
      }
    }

    // shooting: PC hold click OR Mobile FIRE button hold
    const modeNow = effectiveInputMode();
    if (modeNow === "pc") {
      if (mouseDown) shoot();
    } else {
      if (fireHeld) shoot();
    }

    // kiosk hint
    if (nearShopKiosk()) setHint("At SHOP kiosk: press Q.", true);
  }

  // ---------- Misc ----------
  // Esc closes settings/shop
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (game.mode === "shop") closeShop();
      if (game.mode === "settings") closeSettings();
    }
  });

  // Apply settings now
  applySettings();

  // Starting hint
  const startMode = effectiveInputMode();
  if (startMode === "mobile") {
    setHint("Mobile: drag to aim. Tap to fire (if enabled). SHOP = stand near kiosk, press Q.", true);
  } else {
    setHint("Click to play (pointer lock). SHOP kiosk = Q. Sprint = Shift. Medkit = H. Mine = G.", true);
  }

  requestAnimationFrame(tick);
})();

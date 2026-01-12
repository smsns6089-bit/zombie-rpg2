// Project Game Maker: Zombie RPG FPS (Raycast) - FULL UPDATED VERSION
// Includes:
// - Normal FPS mouse look (fixed inverted Y)
// - Weapon XP + Weapon Levels (saved forever)
// - Perk Vending Machines (saved forever)
// - Multi-currency: Cash + Scrap + Essence (saved)
// - Map system framework + Exit Gate (Map 1 fully playable; Map 2/3 placeholders)
// - Zombie groan MP3: assets/sfx/zombie_groan.mp3 (single file OK)

(() => {
  // ---------- Canvas ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  // ---------- UI ----------
  const ui = {
    hud: document.getElementById("hud"),
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

  // Extra HUD pills (injected so you don't need to edit index.html)
  const hudTopRow = ui.hud?.querySelector(".row");
  const hudExtraRow = ui.hud?.querySelector(".row.small");
  function makePill(label, id) {
    const d = document.createElement("div");
    d.className = "pill";
    d.innerHTML = `<b>${label}</b>: <span id="${id}">0</span>`;
    return d;
  }
  const pillScrap = makePill("Scrap", "scrap");
  const pillEss = makePill("Essence", "essence");
  const pillWpnLv = makePill("WpnLv", "wpnlv");
  const pillMap = makePill("Map", "mapname");

  if (hudTopRow) {
    hudTopRow.appendChild(pillScrap);
    hudTopRow.appendChild(pillEss);
    hudTopRow.appendChild(pillWpnLv);
    hudTopRow.appendChild(pillMap);
  }

  const uiExtra = {
    scrap: document.getElementById("scrap"),
    essence: document.getElementById("essence"),
    wpnLv: document.getElementById("wpnlv"),
    mapname: document.getElementById("mapname"),
  };

  // ---------- Resize ----------
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const rand = (a, b) => a + Math.random() * (b - a);

  function setHint(t, ok = false) {
    ui.hint.textContent = t || "";
    ui.hint.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)";
  }

  // ---------- AUDIO ----------
  // Gun/Hit are synth (WebAudio). Zombie uses your MP3 file.
  let audio = { ctx: null, master: null, enabled: true, unlocked: false };
  let groanAudio = null;

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

  function unlockAudio() {
    if (audio.unlocked) return;
    ensureAudio();
    if (audio.ctx && audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(() => {});
    }
    // Prep MP3 groan (must be after user gesture)
    try {
      groanAudio = new Audio("./assets/sfx/zombie_groan.mp3");
      groanAudio.preload = "auto";
      groanAudio.volume = 0.0;
      // iOS sometimes needs play() once then pause
      groanAudio.play().then(() => {
        groanAudio.pause();
        groanAudio.currentTime = 0;
      }).catch(() => {});
    } catch {}
    audio.unlocked = true;
  }

  addEventListener("mousedown", unlockAudio, { passive: true });
  addEventListener("keydown", unlockAudio, { passive: true });
  addEventListener("touchstart", unlockAudio, { passive: true });

  function playNoise(duration = 0.18, gain = 0.18, hp = 50, lp = 800) {
    if (!audio.enabled || !ensureAudio()) return;
    const ac = audio.ctx;
    const len = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const r = (Math.random() * 2 - 1);
      data[i] = r * (0.9 - t) * 0.9;
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

  function playTone(freq = 120, duration = 0.14, gain = 0.12, type = "sawtooth") {
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
    playTone(165, 0.05, 0.16, "square");
    playTone(95, 0.05, 0.10, "sawtooth");
    playNoise(0.05, 0.14, 1200, 9000);
  }
  function sfxHit() {
    playTone(760, 0.03, 0.10, "triangle");
    playTone(120, 0.05, 0.08, "sine");
  }

  // Real groan from your MP3 (single file), distance-based volume
  function sfxZombieGroanMP3(distanceToPlayer) {
    if (!audio.enabled) return;
    if (!audio.unlocked) return;
    if (!groanAudio) return;

    const vol = clamp(1 - distanceToPlayer / 10, 0, 1) * 0.55;
    if (vol <= 0.02) return;

    try {
      // Clone so multiple groans can overlap without cutting each other off
      const a = groanAudio.cloneNode(true);
      a.volume = vol;
      a.playbackRate = rand(0.88, 1.08);
      a.play().catch(() => {});
    } catch {}
  }

  // ---------- SAVE ----------
  const SAVE_KEY = "pgm_zombie_rpg_save_v3";
  function xpToNext(level) {
    return Math.floor(60 + (level - 1) * 40 + Math.pow(level - 1, 1.35) * 25);
  }

  function saveGame() {
    try {
      // store current weapon ammo inside slot obj
      const w = currentWeapon();
      if (w && !player.usingKnife) saveAmmoToWeapon(w);

      const data = {
        // player progression
        cash: player.cash,
        scrap: player.scrap,
        essence: player.essence,
        level: player.level,
        xp: player.xp,

        // weapon slots
        slotIds: player.slots.map(s => (s ? s.id : null)),
        activeSlot: player.activeSlot,
        usingKnife: player.usingKnife,

        // weapon XP + levels (forever progression)
        weaponProg: weaponProg,

        // perks purchased (forever progression)
        perks: perksState,

        // map unlocks
        mapIndex: world.mapIndex,
        unlockedMaps: world.unlockedMaps,
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
      player.scrap = data.scrap ?? 0;
      player.essence = data.essence ?? 0;

      player.level = data.level ?? 1;
      player.xp = data.xp ?? 0;

      const ids = Array.isArray(data.slotIds) ? data.slotIds : ["pistol_rusty", null];
      player.slots = ids.map(id => (id ? structuredClone(W(id)) : null));
      if (!player.slots[0]) player.slots[0] = structuredClone(W("pistol_rusty"));

      player.activeSlot = data.activeSlot ?? 0;
      player.usingKnife = !!data.usingKnife;

      // weapon progression
      weaponProg = data.weaponProg && typeof data.weaponProg === "object" ? data.weaponProg : weaponProg;

      // perks
      perksState = data.perks && typeof data.perks === "object" ? data.perks : perksState;

      // maps
      world.mapIndex = clamp(data.mapIndex ?? 0, 0, MAPS.length - 1);
      world.unlockedMaps = Array.isArray(data.unlockedMaps) ? data.unlockedMaps : world.unlockedMaps;

      // set map
      setMap(world.mapIndex, true);

      // sync ammo UI
      if (!player.usingKnife && player.slots[player.activeSlot]) {
        syncAmmoToWeapon(player.slots[player.activeSlot]);
      }

      applyPerks(); // apply perk effects to player
      setHint("Loaded save ✅", true);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- GAME CORE ----------
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

  // ---------- Controls ----------
  function lockPointer() {
    canvas.requestPointerLock?.();
  }

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

  // NORMAL FPS LOOK: invert fix is HERE (subtract my)
  addEventListener("mousemove", (e) => {
    if (!game.pointerLocked) return;
    if (game.mode !== "play") return;

    lookDelta += (e.movementX || 0);

    const my = (e.movementY || 0);
    player.pitch = clamp(player.pitch - my * 0.0022, -0.9, 0.9); // ✅ fixed
  });

  const keys = new Set();
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);

    if (k === "r") reload();
    if (k === "escape" && game.mode === "shop") closeShop();

    if (k === "q") {
      if (game.mode === "shop") closeShop();
      else if (game.mode === "play") {
        // Priority: weapon kiosk > perk machine > map gate
        if (nearInteractable()) {
          openShop(nearestInteractable().kind);
        } else {
          setHint("Find a KIOSK / PERK machine / EXIT gate and press Q.", false);
        }
      }
    }

    if (k === "1") equipSlot(0);
    if (k === "2") equipSlot(1);
    if (k === "3") equipKnife();
  });

  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // ---------- MAP SYSTEM ----------
  // Maps are "walls as 1" in strings. We swap them per map.
  // Map 1 is playable. Map 2/3 are starter templates you can expand later.
  const MAPS = [
    {
      name: "Streets",
      grid: [
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
      ],
      // Interactables:
      weaponKiosk: { x: 2.05, y: 1.25, r: 1.15 },
      perkMachines: [
        { x: 10.0, y: 3.0, r: 1.05, perkPool: "starter" },
        { x: 19.0, y: 18.0, r: 1.05, perkPool: "starter" },
      ],
      exitGate: { x: 22.0, y: 22.0, r: 1.10, unlockWave: 6, toMapIndex: 1 }, // beat wave 6 then you can exit
      playerSpawn: { x: 1.6, y: 1.6, a: 0 },
      difficultyMult: 1.0,
      lootMult: 1.0,
    },
    {
      name: "Warehouse",
      grid: [
        "111111111111111111111111",
        "100000000000000000000001",
        "101111111111011111111101",
        "101000000001010000000101",
        "101011111101011111110101",
        "101010000001000000010101",
        "101010111111111110010101",
        "101010100000000010010101",
        "101110101111111010010111",
        "100000100000001010000001",
        "101111101111101011111101",
        "101000001000001000000001",
        "101011111011111111111101",
        "101000000010000000000001",
        "101111111110111111111101",
        "101000000000100000000001",
        "100000000000000000000001",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
      ],
      weaponKiosk: { x: 2.2, y: 2.2, r: 1.15 },
      perkMachines: [
        { x: 12.0, y: 5.0, r: 1.05, perkPool: "starter" },
        { x: 20.0, y: 10.0, r: 1.05, perkPool: "starter" },
      ],
      exitGate: { x: 21.5, y: 2.0, r: 1.10, unlockWave: 10, toMapIndex: 2 },
      playerSpawn: { x: 2.0, y: 2.0, a: 0 },
      difficultyMult: 1.25,
      lootMult: 1.15,
    },
    {
      name: "Lab",
      grid: [
        "111111111111111111111111",
        "100000000000000000000001",
        "101111111111111111111101",
        "101000000000000000000101",
        "101011111011111011110101",
        "101010001010001010010101",
        "101010111010111010110101",
        "101010000010000010000101",
        "101011111110111111110101",
        "101000000000100000000001",
        "101111111111111111111101",
        "100000000000000000000001",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
        "111111111111111111111111",
      ],
      weaponKiosk: { x: 2.2, y: 2.2, r: 1.15 },
      perkMachines: [{ x: 10.0, y: 10.0, r: 1.05, perkPool: "starter" }],
      exitGate: { x: 2.0, y: 10.0, r: 1.10, unlockWave: 9999, toMapIndex: 0 },
      playerSpawn: { x: 2.0, y: 2.0, a: 0 },
      difficultyMult: 1.6,
      lootMult: 1.35,
    },
  ];

  const world = {
    mapIndex: 0,
    mapName: MAPS[0].name,
    unlockedMaps: [0], // index list
    mapW: 24,
    mapH: 24,
    map: [],
  };

  function setMap(mapIndex, silent = false) {
    world.mapIndex = clamp(mapIndex, 0, MAPS.length - 1);
    const m = MAPS[world.mapIndex];
    world.mapName = m.name;
    world.mapW = m.grid[0].length;
    world.mapH = m.grid.length;
    world.map = m.grid.map(r => r.split("").map(Number));

    // reset wave pressure a bit on travel
    zombies = [];
    drops = [];
    if (!silent) {
      game.wave = Math.max(1, game.wave);
      game.t = 0;
    }

    // spawn player
    player.x = m.playerSpawn.x;
    player.y = m.playerSpawn.y;
    player.a = m.playerSpawn.a;

    if (!silent) setHint(`Entered ${m.name}. Survive and push waves.`, true);
    saveGame();
  }

  function isWall(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= world.mapW || iy >= world.mapH) return true;
    return world.map[iy][ix] === 1;
  }

  // ---------- INTERACTABLES ----------
  function nearestInteractable() {
    const m = MAPS[world.mapIndex];
    const list = [];

    list.push({ kind: "weapons", x: m.weaponKiosk.x, y: m.weaponKiosk.y, r: m.weaponKiosk.r });

    for (const pm of m.perkMachines) {
      list.push({ kind: "perks", x: pm.x, y: pm.y, r: pm.r, perkPool: pm.perkPool });
    }

    list.push({ kind: "exit", x: m.exitGate.x, y: m.exitGate.y, r: m.exitGate.r, unlockWave: m.exitGate.unlockWave, toMapIndex: m.exitGate.toMapIndex });

    let best = null;
    let bestD = 999;
    for (const it of list) {
      const d = dist(player.x, player.y, it.x, it.y);
      if (d <= it.r && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  function nearInteractable() {
    return !!nearestInteractable();
  }

  // ---------- WEAPONS ----------
  // Start with pistols. You can extend into SMG/AR/Shotgun/Sniper next.
  const WEAPONS = [
    { id:"pistol_rusty", name:"Rusty Pistol",   type:"pistol", rarity:"Common",   unlockLevel:1, price:0,   dmg:24, fireRate:3.2, magSize:8,  reloadTime:0.95, spread:0.010, range:10.5, reserveStart:32 },
    { id:"pistol_service", name:"Service Pistol", type:"pistol", rarity:"Uncommon", unlockLevel:2, price:60,  dmg:28, fireRate:3.6, magSize:10, reloadTime:0.92, spread:0.010, range:11.0, reserveStart:40 },
    { id:"pistol_marksman", name:"Marksman Pistol", type:"pistol", rarity:"Rare", unlockLevel:4, price:140, dmg:36, fireRate:3.2, magSize:12, reloadTime:0.90, spread:0.008, range:12.0, reserveStart:48 },
    { id:"pistol_relic", name:"Relic Pistol",   type:"pistol", rarity:"Epic",     unlockLevel:7, price:320, dmg:48, fireRate:3.0, magSize:14, reloadTime:0.88, spread:0.007, range:13.0, reserveStart:56 },
  ];
  function W(id){ return WEAPONS.find(w => w.id === id); }

  // Weapon progression saved forever:
  // weaponProg[id] = { xp, level }
  let weaponProg = {};
  function wpnXPToNext(wLevel) {
    // smooth curve: 50, 80, 120, 170, ...
    return Math.floor(50 + (wLevel - 1) * 30 + Math.pow(wLevel - 1, 1.25) * 20);
  }
  function ensureWeaponProg(id) {
    if (!weaponProg[id]) weaponProg[id] = { xp: 0, level: 1 };
    return weaponProg[id];
  }

  // Effective weapon stats based on weapon level
  function weaponLevelBonusStats(base, wLevel) {
    const lv = Math.max(1, wLevel || 1);
    const dmgMult = 1 + (lv - 1) * 0.06;        // +6% dmg per weapon level
    const spreadMult = 1 / (1 + (lv - 1) * 0.05); // -spread scaling
    const reloadMult = 1 / (1 + (lv - 1) * 0.03); // -reload scaling
    const magBonus = Math.floor((lv - 1) / 4);    // +1 mag every 4 levels
    return {
      dmg: base.dmg * dmgMult,
      spread: base.spread * spreadMult,
      reloadTime: base.reloadTime * reloadMult,
      magSize: base.magSize + magBonus,
      fireRate: base.fireRate, // keep for now (later add perk/attachments)
      range: base.range,
      reserveStart: base.reserveStart,
    };
  }

  // ---------- PERKS ----------
  // Bought perks are permanent (saved forever) and always active.
  const PERKS = [
    { id: "jugger",  name: "Juggernaut",  desc: "+25 Max HP",               baseCostCash: 120, baseCostEss: 0, max: 8, pool: "starter" },
    { id: "quick",   name: "Quick Hands", desc: "Reload -12% per level",    baseCostCash: 140, baseCostEss: 0, max: 10, pool: "starter" },
    { id: "deadeye", name: "Deadeye",     desc: "Headshot bonus +0.25",     baseCostCash: 160, baseCostEss: 0, max: 10, pool: "starter" },
    { id: "greed",   name: "Greed",       desc: "More cash drops +10%",     baseCostCash: 170, baseCostEss: 0, max: 10, pool: "starter" },
    { id: "scav",    name: "Scavenger",   desc: "More scrap drops +12%",    baseCostCash: 190, baseCostEss: 0, max: 10, pool: "starter" },
    { id: "essense", name: "Essence Tap", desc: "More essence chance +8%",  baseCostCash: 220, baseCostEss: 0, max: 10, pool: "starter" },
  ];

  // perksState[id] = level purchased
  let perksState = {
    jugger: 0,
    quick: 0,
    deadeye: 0,
    greed: 0,
    scav: 0,
    essense: 0,
  };

  function perkCost(perk) {
    const lv = perksState[perk.id] || 0;
    // scaling cost
    const cash = Math.floor(perk.baseCostCash * (1 + lv * 0.22));
    const ess = Math.floor(perk.baseCostEss * (1 + lv * 0.22));
    return { cash, ess };
  }

  // Apply perk effects to player runtime stats
  function applyPerks() {
    // Reset to base first
    player.maxHp = 100;
    player.speed = 2.45;
    player.headshotBonus = 0.0;     // added to headshot multiplier
    player.cashDropMult = 1.0;
    player.scrapDropMult = 1.0;
    player.essenceChanceMult = 1.0;
    player.reloadMult = 1.0;

    const j = perksState.jugger || 0;
    player.maxHp += j * 25;

    const q = perksState.quick || 0;
    player.reloadMult *= (1 / (1 + q * 0.12)); // reload faster

    const d = perksState.deadeye || 0;
    player.headshotBonus = d * 0.25;

    const g = perksState.greed || 0;
    player.cashDropMult *= (1 + g * 0.10);

    const s = perksState.scav || 0;
    player.scrapDropMult *= (1 + s * 0.12);

    const e = perksState.essense || 0;
    player.essenceChanceMult *= (1 + e * 0.08);

    // Keep HP within new max
    player.hp = clamp(player.hp, 0, player.maxHp);
  }

  function buyPerk(perkId) {
    const perk = PERKS.find(p => p.id === perkId);
    if (!perk) return;

    const lv = perksState[perkId] || 0;
    if (lv >= perk.max) return setHint("That perk is maxed.", false);

    const { cash, ess } = perkCost(perk);
    if (player.cash < cash) return setHint(`Need $${cash} for ${perk.name}.`, false);
    if (player.essence < ess) return setHint(`Need ${ess} essence for ${perk.name}.`, false);

    player.cash -= cash;
    player.essence -= ess;
    perksState[perkId] = lv + 1;

    applyPerks();
    setHint(`Bought ${perk.name} Lv ${perksState[perkId]} ✅`, true);
    saveGame();
    renderShop(currentShopMode);
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
    scrap: 0,
    essence: 0,

    level: 1,
    xp: 0,

    headshotBonus: 0,
    cashDropMult: 1,
    scrapDropMult: 1,
    essenceChanceMult: 1,
    reloadMult: 1,

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

  function effectiveWeapon(w) {
    if (!w) return null;
    const prog = ensureWeaponProg(w.id);
    const eff = weaponLevelBonusStats(w, prog.level);

    // apply perks affecting reload
    eff.reloadTime *= player.reloadMult;

    return { ...w, ...eff, _wLevel: prog.level, _wXp: prog.xp, _wXpNext: wpnXPToNext(prog.level) };
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

  function saveAmmoToWeapon(w) {
    if (!w) return;
    w._mag = player.ammo.mag;
    w._reserve = player.ammo.reserve;
  }

  function equipSlot(i) {
    if (game.mode !== "play") return;
    if (!player.slots[i]) return setHint("No weapon in that slot yet.", false);

    const prev = currentWeapon();
    if (prev) saveAmmoToWeapon(prev);

    player.activeSlot = i;
    player.usingKnife = false;
    syncAmmoToWeapon(player.slots[i]);

    const ew = effectiveWeapon(player.slots[i]);
    setHint(`Equipped: ${player.slots[i].name} (WpnLv ${ew? ew._wLevel : 1})`, true);
    saveGame();
  }

  function equipKnife() {
    if (game.mode !== "play") return;
    const prev = currentWeapon();
    if (prev) saveAmmoToWeapon(prev);

    player.usingKnife = true;
    setHint("Knife equipped. Get close and click.", true);
    saveGame();
  }

  // ---------- SHOP ----------
  let currentShopMode = "weapons"; // weapons | perks | exit
  function openShop(mode) {
    currentShopMode = mode;
    game.mode = "shop";
    ui.shop.classList.remove("hidden");
    ui.death.classList.add("hidden");
    renderShop(mode);
    setHint(`${mode.toUpperCase()} MENU (paused). Q / ESC to close.`, true);
    document.exitPointerLock?.();
    saveGame();
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
    if (player.level < w.unlockLevel) return { ok: false, why: `Requires Lv ${w.unlockLevel}` };
    if (player.cash < w.price) return { ok: false, why: `Need $${w.price}` };
    return { ok: true, why: "Buy" };
  }

  function giveWeapon(id) {
    const w = structuredClone(W(id));
    // Put into slot 2 (for now)
    player.slots[1] = w;
    // Create weapon prog entry
    ensureWeaponProg(id);
    setHint(`Bought: ${w.name}. Slot 2 (press 2).`, true);
    saveGame();
  }

  function shopButton({ title, desc, priceText, onClick, locked = false, lockText = "" }) {
    const btn = document.createElement("button");
    btn.className = "shop-btn" + (locked ? " locked" : "");
    btn.innerHTML = `
      <span class="title">${title}</span>
      <span class="desc">${desc}${locked && lockText ? ` • ${lockText}` : ""}</span>
      <span class="price">${priceText}</span>
    `;
    btn.addEventListener("click", () => { if (!locked) onClick(); });
    return btn;
  }

  function renderShop(mode) {
    ui.shopList.innerHTML = "";

    if (mode === "weapons") {
      ui.shop.querySelector("h2").textContent = "Weapon Shop";
      ui.shop.querySelector("p.muted").innerHTML = `Walk up to the kiosk, press <b>Q</b>. Game pauses while shopping.`;

      ui.shopList.appendChild(shopButton({
        title: "Ammo Pack",
        desc: "+16 reserve ammo (current weapon)",
        priceText: "$15",
        locked: player.cash < 15,
        lockText: player.cash < 15 ? "Not enough cash" : "",
        onClick: () => {
          player.cash -= 15;
          if (!player.usingKnife) {
            player.ammo.reserve += 16;
            const w = currentWeapon();
            if (w) saveAmmoToWeapon(w);
          }
          setHint("Bought ammo (+16).", true);
          saveGame();
          renderShop(mode);
        }
      }));

      ui.shopList.appendChild(shopButton({
        title: "Medkit",
        desc: "Heal +35 HP",
        priceText: "$20",
        locked: player.cash < 20,
        lockText: player.cash < 20 ? "Not enough cash" : "",
        onClick: () => {
          player.cash -= 20;
          player.hp = clamp(player.hp + 35, 0, player.maxHp);
          setHint("Healed +35 HP.", true);
          saveGame();
          renderShop(mode);
        }
      }));

      for (const w of WEAPONS) {
        const owned = ownsWeapon(w.id);
        const can = canBuyWeapon(w);
        const prog = ensureWeaponProg(w.id);

        ui.shopList.appendChild(shopButton({
          title: `${w.name} (${w.rarity})`,
          desc: owned ? `Owned • Weapon Lv ${prog.level}` : `${w.type.toUpperCase()} | Dmg ${w.dmg} | Mag ${w.magSize} | Lv ${w.unlockLevel}`,
          priceText: `$${w.price}`,
          locked: (!can.ok && !owned),
          lockText: owned ? "Owned" : can.why,
          onClick: () => {
            if (owned) return setHint("You already own that.", false);
            if (!can.ok) return setHint(can.why, false);
            player.cash -= w.price;
            giveWeapon(w.id);
            renderShop(mode);
          }
        }));
      }

      return;
    }

    if (mode === "perks") {
      ui.shop.querySelector("h2").textContent = "Perk Vending Machine";
      ui.shop.querySelector("p.muted").innerHTML = `Perks are <b>permanent</b> (saved forever). Buy upgrades and stack them.`;

      // Show perks
      for (const perk of PERKS) {
        const lv = perksState[perk.id] || 0;
        const { cash, ess } = perkCost(perk);
        const maxed = lv >= perk.max;

        const locked = maxed || player.cash < cash || player.essence < ess;
        const lockText = maxed ? "Maxed" : (player.cash < cash ? `Need $${cash}` : (player.essence < ess ? `Need ${ess} essence` : ""));

        ui.shopList.appendChild(shopButton({
          title: `${perk.name} (Lv ${lv}/${perk.max})`,
          desc: perk.desc,
          priceText: ess > 0 ? `$${cash} + ${ess}E` : `$${cash}`,
          locked,
          lockText,
          onClick: () => buyPerk(perk.id)
        }));
      }
      return;
    }

    if (mode === "exit") {
      const m = MAPS[world.mapIndex];
      ui.shop.querySelector("h2").textContent = "Exit Gate";
      const canExit = game.wave >= m.exitGate.unlockWave;

      ui.shop.querySelector("p.muted").innerHTML =
        canExit
          ? `Gate unlocked ✅ Travel to the next map.`
          : `Gate locked. Reach <b>Wave ${m.exitGate.unlockWave}</b> to unlock.`;

      ui.shopList.appendChild(shopButton({
        title: `Travel to: ${MAPS[m.exitGate.toMapIndex]?.name || "???"}`,
        desc: `Switch maps. Difficulty increases. New unlocks later.`,
        priceText: canExit ? "FREE" : "LOCKED",
        locked: !canExit,
        lockText: !canExit ? `Need Wave ${m.exitGate.unlockWave}` : "",
        onClick: () => {
          // Unlock next map
          const next = m.exitGate.toMapIndex;
          if (!world.unlockedMaps.includes(next)) world.unlockedMaps.push(next);
          setMap(next);
          closeShop();
        }
      }));

      return;
    }
  }

  // ---------- Enemies + Drops ----------
  let zombies = [];
  let drops = [];

  function spawnZombie() {
    const m = MAPS[world.mapIndex];
    for (let tries = 0; tries < 90; tries++) {
      const x = rand(1.5, world.mapW - 1.5);
      const y = rand(1.5, world.mapH - 1.5);
      if (isWall(x, y)) continue;
      // avoid interactables
      const wks = m.weaponKiosk;
      if (dist(x, y, wks.x, wks.y) < 3.0) continue;
      for (const pm of m.perkMachines) if (dist(x, y, pm.x, pm.y) < 3.0) continue;
      if (dist(x, y, player.x, player.y) < 4.0) continue;

      const diff = m.difficultyMult;

      const hp = (65 + game.wave * 10) * diff;
      zombies.push({
        x, y,
        r: 0.28,
        hp, maxHp: hp,
        speed: (0.75 + game.wave * 0.04) * diff * (Math.random() < 0.18 ? 1.35 : 1),
        dmg: (9 + game.wave * 1.6) * diff,
        hitCd: 0,
        type: Math.random() < 0.18 ? "runner" : "walker",
        groanT: rand(1.2, 4.8),
      });
      return;
    }
  }

  function dropItem(x, y, kind, amount) {
    drops.push({ x, y, kind, amount, t: 14, r: 0.22 });
  }

  function dropLoot(z) {
    const m = MAPS[world.mapIndex];

    // base currency: cash always-ish
    const cashBase = Math.floor(rand(7, 14) + game.wave * 0.85);
    const cash = Math.floor(cashBase * player.cashDropMult * m.lootMult);
    dropItem(z.x, z.y, "cash", cash);

    // scrap chance
    const scrapChance = clamp(0.22 + game.wave * 0.005, 0.22, 0.50);
    if (Math.random() < scrapChance) {
      const scrapAmt = Math.floor((1 + rand(0, 2) + game.wave * 0.15) * player.scrapDropMult * m.lootMult);
      dropItem(z.x, z.y, "scrap", Math.max(1, scrapAmt));
    }

    // essence rare chance
    const essenceChance = clamp(0.05 + game.wave * 0.002, 0.05, 0.16) * player.essenceChanceMult * m.lootMult;
    if (Math.random() < essenceChance) {
      dropItem(z.x, z.y, "essence", 1);
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

  function gainWeaponXP(weaponId, amount) {
    if (!weaponId) return;
    const prog = ensureWeaponProg(weaponId);
    prog.xp += amount;

    let leveled = false;
    while (prog.xp >= wpnXPToNext(prog.level)) {
      prog.xp -= wpnXPToNext(prog.level);
      prog.level++;
      leveled = true;
    }

    if (leveled) {
      setHint(`Weapon leveled up! ${W(weaponId)?.name || weaponId} is now WpnLv ${prog.level} 🔥`, true);
    }
    saveGame();
  }

  // ---------- Combat ----------
  function reload() {
    if (game.mode !== "play") return;
    if (player.usingKnife) return setHint("Knife doesn't reload 😈", true);

    const base = currentWeapon();
    if (!base) return;
    const w = effectiveWeapon(base);

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
    setHint("Slash!", true);

    let best = null;
    let bestD = 999;

    for (const z of zombies) {
      const d = dist(player.x, player.y, z.x, z.y);
      if (d > player.knife.range) continue;

      const angTo = Math.atan2(z.y - player.y, z.x - player.x);
      let da = angTo - player.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 0.55) continue;

      if (d < bestD) { bestD = d; best = z; }
    }

    if (best) {
      best.hp -= player.knife.dmg;
      game.recoil = 0.16;
      sfxHit();

      if (best.hp <= 0) {
        // rewards
        dropLoot(best);
        gainXP(18 + game.wave * 2);
        zombies = zombies.filter(z => z !== best);
        setHint(`KNIFE KILL! Loot dropped.`, true);
      } else {
        setHint("Knife hit!", true);
      }
    }
  }

  function shoot() {
    if (game.mode !== "play") return;
    if (!game.pointerLocked) return;
    if (player.usingKnife) return knifeAttack();

    const base = currentWeapon();
    if (!base) return;

    const w = effectiveWeapon(base);

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

        // Hit zones based on crosshair Y
        const hgt = innerHeight;
        const horizon = (hgt / 2) + (player.pitch * (hgt * 0.35));
        const spriteSize = clamp((hgt * 0.90) / (dist(player.x, player.y, hitZ.x, hitZ.y) + 0.001), 12, hgt * 1.25);
        const spriteBottom = horizon + spriteSize * 0.35;
        const spriteTop = spriteBottom - spriteSize;

        const crossY = hgt / 2;
        const yRel = (crossY - spriteTop) / spriteSize; // 0 top -> 1 bottom

        // base multipliers
        let mult = 1.0;
        let label = "";
        const headMult = 1.8 + player.headshotBonus; // perk makes headshots hotter
        if (yRel < 0.28) { mult = headMult; label = "HEADSHOT"; }
        else if (yRel > 0.78) { mult = 0.65; label = "Leg shot"; }

        const dmg = w.dmg * mult;
        hitZ.hp -= dmg;

        if (label) setHint(label + "!", true);

        if (hitZ.hp <= 0) {
          // kill rewards
          dropLoot(hitZ);

          // player xp
          gainXP(14 + game.wave * 2);

          // weapon xp (forever)
          gainWeaponXP(base.id, 10 + Math.floor(game.wave * 0.8));

          zombies = zombies.filter(z => z !== hitZ);
        }
      }
    }

    if (didHit) sfxHit();

    // Save ammo state to weapon
    saveAmmoToWeapon(base);
    saveGame();
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
    const h = innerHeight;

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

    const m = MAPS[world.mapIndex];

    // weapon kiosk
    ctx.fillStyle = "rgba(34,197,94,.95)";
    ctx.fillRect(x0 + m.weaponKiosk.x * cell - 3, y0 + m.weaponKiosk.y * cell - 3, 6, 6);

    // perk machines
    ctx.fillStyle = "rgba(250,204,21,.95)";
    for (const pm of m.perkMachines) {
      ctx.fillRect(x0 + pm.x * cell - 3, y0 + pm.y * cell - 3, 6, 6);
    }

    // exit gate
    ctx.fillStyle = "rgba(96,165,250,.95)";
    ctx.fillRect(x0 + m.exitGate.x * cell - 3, y0 + m.exitGate.y * cell - 3, 6, 6);

    // zombies
    ctx.fillStyle = "rgba(239,68,68,.85)";
    for (const z of zombies) {
      ctx.beginPath();
      ctx.arc(x0 + z.x * cell, y0 + z.y * cell, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // player
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.moveTo(x0 + player.x * cell, y0 + player.y * cell);
    ctx.lineTo(
      x0 + (player.x + Math.cos(player.a) * 1.3) * cell,
      y0 + (player.y + Math.sin(player.a) * 1.3) * cell
    );
    ctx.stroke();
  }

  // ---------- Gun model (forward + per weapon) ----------
  function gunStyleFor(id) {
    if (id === "pistol_rusty")   return { body:"rgba(60,70,85,.96)", dark:"rgba(22,26,34,.98)", accent:"rgba(170,120,60,.85)", bodyLen:118, barrelLen:22 };
    if (id === "pistol_service") return { body:"rgba(55,65,80,.96)", dark:"rgba(18,20,26,.98)", accent:"rgba(80,160,255,.85)", bodyLen:132, barrelLen:26 };
    if (id === "pistol_marksman")return { body:"rgba(48,58,72,.96)", dark:"rgba(15,18,24,.98)", accent:"rgba(210,210,220,.85)", bodyLen:145, barrelLen:30 };
    if (id === "pistol_relic")   return { body:"rgba(40,48,60,.96)", dark:"rgba(10,12,16,.98)", accent:"rgba(200,80,255,.85)", bodyLen:156, barrelLen:34 };
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

    const base = currentWeapon();
    const sid = player.usingKnife ? "knife" : (base ? base.id : "pistol_rusty");
    const style = gunStyleFor(sid);

    ctx.save();
    ctx.globalAlpha = 0.98;

    ctx.translate(baseX, baseY);
    ctx.rotate(-0.06);

    // arm
    ctx.fillStyle = "rgba(190,150,120,.92)";
    ctx.fillRect(-42, 46, 120, 18);

    // glove
    ctx.fillStyle = "rgba(18,20,26,.96)";
    ctx.fillRect(-14, 36, 44, 34);

    if (player.usingKnife) {
      // knife
      ctx.fillStyle = "rgba(20,20,20,.9)";
      ctx.fillRect(20, 60, 90, 18); // handle
      ctx.fillStyle = "rgba(220,220,220,.95)";
      ctx.fillRect(100, 52, 120, 10); // blade
      ctx.fillRect(100, 66, 120, 6);  // blade edge
    } else {
      // gun body
      ctx.fillStyle = style.body;
      ctx.fillRect(0, 18, style.bodyLen, 34);

      // top rail
      ctx.fillStyle = style.dark;
      ctx.fillRect(10, 22, style.bodyLen - 30, 10);

      // grip
      ctx.fillStyle = style.dark;
      ctx.fillRect(22, 46, 40, 56);

      // barrel
      ctx.fillStyle = style.dark;
      ctx.fillRect(style.bodyLen - 10, 24, style.barrelLen, 10);

      // accent stripe
      ctx.fillStyle = style.accent;
      ctx.fillRect(8, 40, Math.max(18, style.bodyLen * 0.45), 4);

      // muzzle flash
      if (game.muzzle > 0) {
        const a = 0.75 * (game.muzzle / 0.06);
        ctx.fillStyle = `rgba(255,210,80,${a})`;
        ctx.beginPath();
        ctx.arc(style.bodyLen + style.barrelLen + 8, 28, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // knife swing overlay
    if (player.usingKnife && player.knife.swing > 0) {
      const t = player.knife.swing / 0.14;
      ctx.fillStyle = `rgba(220,220,230,${0.28 * t})`;
      ctx.fillRect(-w * 0.05, -h * 0.05, w * 0.40, h * 0.40);
    }

    ctx.restore();
  }

  // ---------- Billboards ----------
  function drawBillboard(screenX, top, size, color, label) {
    const left = screenX - size / 2;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(left, top + size * 0.18, size, size * 0.56);

    ctx.fillStyle = color;
    ctx.fillRect(left + size * 0.18, top + size * 0.24, size * 0.64, size * 0.18);

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = `bold ${Math.max(10, size * 0.12)}px system-ui`;
    ctx.fillText(label, left + size * 0.28, top + size * 0.36);
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

    // sprites: zombies + drops + interactables
    const sprites = [];
    for (const z of zombies) sprites.push({ kind: "z", ...z, d: dist(player.x, player.y, z.x, z.y) });
    for (const d of drops) sprites.push({ kind: "drop", ...d, d: dist(player.x, player.y, d.x, d.y) });

    const m = MAPS[world.mapIndex];
    sprites.push({ kind: "weapons", x: m.weaponKiosk.x, y: m.weaponKiosk.y, d: dist(player.x, player.y, m.weaponKiosk.x, m.weaponKiosk.y) });
    for (const pm of m.perkMachines) {
      sprites.push({ kind: "perks", x: pm.x, y: pm.y, d: dist(player.x, player.y, pm.x, pm.y) });
    }
    sprites.push({ kind: "exit", x: m.exitGate.x, y: m.exitGate.y, d: dist(player.x, player.y, m.exitGate.x, m.exitGate.y) });

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

      const spriteBottom = horizon + size * 0.35;
      const top = spriteBottom - size;

      if (s.kind === "weapons") {
        drawBillboard(screenX, top, size * 0.92, "rgba(34,197,94,.95)", "KIOSK");
        continue;
      }
      if (s.kind === "perks") {
        drawBillboard(screenX, top, size * 0.92, "rgba(250,204,21,.95)", "PERK");
        continue;
      }
      if (s.kind === "exit") {
        const locked = game.wave < m.exitGate.unlockWave;
        drawBillboard(screenX, top, size * 0.92, locked ? "rgba(96,165,250,.55)" : "rgba(96,165,250,.95)", "EXIT");
        continue;
      }

      if (s.kind === "z") {
        const runner = s.type === "runner";
        const bodyCol = runner ? "rgba(239,68,68,.90)" : "rgba(160,175,190,.90)";
        const darkCol = runner ? "rgba(120,20,20,.92)" : "rgba(70,80,95,.92)";
        const bob = Math.sin(performance.now() / 130 + s.x * 2.1) * (size * 0.02);

        const left = screenX - size / 2;

        // legs
        ctx.fillStyle = darkCol;
        ctx.fillRect(left + size * 0.36, top + size * 0.72 + bob, size * 0.10, size * 0.24);
        ctx.fillRect(left + size * 0.54, top + size * 0.72 + bob, size * 0.10, size * 0.24);

        // torso
        ctx.fillStyle = bodyCol;
        ctx.fillRect(left + size * 0.32, top + size * 0.34 + bob, size * 0.42, size * 0.48);

        // head
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.arc(screenX, top + size * 0.24 + bob, size * 0.14, 0, Math.PI * 2);
        ctx.fill();

        // arms
        ctx.fillStyle = darkCol;
        ctx.fillRect(left + size * 0.20, top + size * 0.42 + bob, size * 0.12, size * 0.32);
        ctx.fillRect(left + size * 0.72, top + size * 0.42 + bob, size * 0.12, size * 0.32);

        // eyes
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(screenX - size * 0.06, top + size * 0.22 + bob, size * 0.04, size * 0.03);
        ctx.fillRect(screenX + size * 0.02, top + size * 0.22 + bob, size * 0.04, size * 0.03);

        // health bar
        const pct = clamp(s.hp / s.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(left, top - 10, size, 6);
        ctx.fillStyle = "rgba(34,197,94,.9)";
        ctx.fillRect(left, top - 10, size * pct, 6);

        continue;
      }

      if (s.kind === "drop") {
        let col = "rgba(34,197,94,.9)";
        let txt = "$";
        if (s.kind === "drop" && s.kind) {}
        if (s.kind === "drop") {
          if (s.kind && s.kind !== "drop") {}
        }

        // Determine drop style by s.kind field "kind" is already "drop"; use s.kind2? Actually we stored {kind:"drop", ...d}
        // So use s.kind on object? We'll store drop.kind as "cash/scrap/essence"
        const dropKind = s.kind === "drop" ? s.kind : "cash";
        const dk = s.kind === "drop" ? (s.kind2 || null) : null;

        const k2 = s.kind === "drop" ? (s.kind2 || s.kind) : s.kind;
      }
    }

    // Draw drops properly in a second pass (so we can read their type cleanly)
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

      const spriteBottom = horizon + size * 0.35;
      const top = spriteBottom - size;

      let col = "rgba(34,197,94,.92)";
      let label = "$";
      if (d.kind === "scrap") { col = "rgba(148,163,184,.92)"; label = "S"; }
      if (d.kind === "essence") { col = "rgba(168,85,247,.92)"; label = "E"; }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(screenX, horizon + size * 0.10, Math.max(6, size * 0.09), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.font = "bold 14px system-ui";
      ctx.fillText(label, screenX - 4, horizon + size * 0.10 + 5);
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

    // prompt near interactable
    const it = nearestInteractable();
    if (it && game.mode === "play") {
      const m = MAPS[world.mapIndex];
      let text = "Press Q";
      if (it.kind === "weapons") text = "Press Q: Weapon Kiosk";
      if (it.kind === "perks") text = "Press Q: Perk Machine";
      if (it.kind === "exit") {
        const locked = game.wave < m.exitGate.unlockWave;
        text = locked ? `EXIT locked (need Wave ${m.exitGate.unlockWave})` : "Press Q: Exit Gate";
      }
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(w * 0.26, h * 0.62, w * 0.48, 36);
      ctx.fillStyle = "rgba(34,197,94,.95)";
      ctx.font = "bold 16px system-ui";
      ctx.fillText(text, w * 0.29, h * 0.645);
    }
  }

  // ---------- Death ----------
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

    // respawn on current map spawn
    const m = MAPS[world.mapIndex];
    player.x = m.playerSpawn.x;
    player.y = m.playerSpawn.y;
    player.a = m.playerSpawn.a;

    player.hp = player.maxHp;

    setHint("Restarted. Progress kept. Click to lock mouse.", true);
    saveGame();
  });

  // ---------- INIT ----------
  // Ensure starting weapon progression exists
  ensureWeaponProg("pistol_rusty");
  syncAmmoToWeapon(player.slots[0]);

  // Apply perks defaults
  applyPerks();

  // Set initial map
  setMap(0, true);

  // Load save (overwrites map / perks / weaponProg / currencies)
  loadGame();

  // ---------- Loop ----------
  let last = performance.now();
  let saveTimer = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // UI sync
    ui.hp.textContent = Math.max(0, Math.floor(player.hp));
    ui.cash.textContent = Math.floor(player.cash);
    ui.wave.textContent = game.wave;
    ui.level.textContent = player.level;
    ui.xp.textContent = Math.floor(player.xp);

    if (uiExtra.scrap) uiExtra.scrap.textContent = Math.floor(player.scrap);
    if (uiExtra.essence) uiExtra.essence.textContent = Math.floor(player.essence);
    if (uiExtra.mapname) uiExtra.mapname.textContent = world.mapName;

    const base = currentWeapon();
    if (player.usingKnife) {
      ui.weapon.textContent = "Knife";
      ui.ammo.textContent = "-";
      ui.mag.textContent = "-";
      ui.reserve.textContent = "-";
      if (uiExtra.wpnLv) uiExtra.wpnLv.textContent = "-";
    } else {
      const ew = base ? effectiveWeapon(base) : null;
      ui.weapon.textContent = ew ? ew.name : "None";
      ui.ammo.textContent = player.ammo.mag;
      ui.reserve.textContent = player.ammo.reserve;
      ui.mag.textContent = ew ? ew.magSize : "-";
      if (uiExtra.wpnLv) uiExtra.wpnLv.textContent = ew ? ew._wLevel : "1";
    }

    render(dt);

    // autosave
    saveTimer += dt;
    if (saveTimer >= 12) {
      saveTimer = 0;
      saveGame();
    }

    // knife timers
    if (player.knife.t > 0) player.knife.t = Math.max(0, player.knife.t - dt);
    if (player.knife.swing > 0) player.knife.swing = Math.max(0, player.knife.swing - dt);

    if (game.mode !== "play") return;

    // wave pacing (keeps pressure rising)
    game.t += dt;
    if (game.t > game.wave * 25) game.wave++;

    // reload
    const baseW = currentWeapon();
    const ew = baseW ? effectiveWeapon(baseW) : null;
    if (!player.usingKnife && ew && player.ammo.reloading) {
      player.ammo.rt += dt;
      if (player.ammo.rt >= ew.reloadTime) {
        const need = ew.magSize - player.ammo.mag;
        const take = Math.min(need, player.ammo.reserve);
        player.ammo.reserve -= take;
        player.ammo.mag += take;
        player.ammo.reloading = false;
        setHint("Reloaded.", true);
        saveAmmoToWeapon(baseW);
        saveGame();
      }
    }

    // yaw
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
    const m = MAPS[world.mapIndex];
    const target = Math.floor((4 + game.wave * 2) * m.difficultyMult);
    if (zombies.length < target && Math.random() < 0.08 + game.wave * 0.002) spawnZombie();

    // zombie AI + groan
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.hitCd = Math.max(0, z.hitCd - dt);

      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = rand(2.2, 5.6);
        const d = dist(player.x, player.y, z.x, z.y);
        sfxZombieGroanMP3(d);
      }

      const ang = Math.atan2(player.y - z.y, player.x - z.x);
      const spz = z.speed * (z.type === "runner" ? 1.18 : 1);

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
        if (d.kind === "cash") player.cash += d.amount;
        if (d.kind === "scrap") player.scrap += d.amount;
        if (d.kind === "essence") player.essence += d.amount;

        drops.splice(i, 1);
        setHint(`Picked up ${d.kind === "cash" ? "$" : ""}${d.amount} ${d.kind}.`, true);
        saveGame();
        continue;
      }
      if (d.t <= 0) drops.splice(i, 1);
    }

    // shoot
    if (mouseDown) shoot();

    // hint if standing near interactable
    const it = nearestInteractable();
    if (it) {
      if (it.kind === "weapons") setHint("At KIOSK: press Q.", true);
      if (it.kind === "perks") setHint("At PERK machine: press Q.", true);
      if (it.kind === "exit") {
        const locked = game.wave < m.exitGate.unlockWave;
        setHint(locked ? `EXIT locked: reach Wave ${m.exitGate.unlockWave}.` : "EXIT ready: press Q to travel.", locked ? false : true);
      }
    }
  }

  setHint("Click to play. Find KIOSK/PERK/EXIT. Press Q.");
  requestAnimationFrame(tick);

})();

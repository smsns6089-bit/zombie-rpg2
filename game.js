<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Blob Wars 2.0 (Mobile First)</title>
  <style>
    :root{
      --bg1:#0b1020;
      --glass: rgba(255,255,255,.08);
      --line: rgba(234,240,255,.16);
      --text: #eaf0ff;
      --muted: rgba(234,240,255,.75);
      --safeTop: env(safe-area-inset-top, 0px);
      --safeBottom: env(safe-area-inset-bottom, 0px);
    }
    *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Arial;}
    html, body{
      width:100%;
      height:100%;
      overflow:hidden;
      background: radial-gradient(900px 480px at 15% 10%, rgba(124,92,255,.22), transparent 60%),
                  radial-gradient(900px 480px at 85% 25%, rgba(46,229,157,.18), transparent 60%),
                  var(--bg1);
      color: var(--text);
      touch-action:none;
      overscroll-behavior:none;
    }

    /* Fullscreen game canvas */
    canvas{
      position:fixed;
      inset:0;
      width:100vw;
      height:100vh;
      display:block;
      background: linear-gradient(#13234a, #0b1020);
    }

    /* HUD overlay */
    .hud{
      position:fixed;
      top: calc(10px + var(--safeTop));
      left: 10px;
      right: 10px;
      z-index:10;
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:flex-start;
      pointer-events:none;
    }
    .hud .panel{
      pointer-events:auto;
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      padding:10px 12px;
      border:1px solid var(--line);
      border-radius:16px;
      background: rgba(255,255,255,.06);
      backdrop-filter: blur(10px);
      max-width: 100%;
    }
    .title{font-weight:900; letter-spacing:.2px; margin-right:6px}
    .badge{
      font-size:12px;
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--line);
      background: rgba(255,255,255,.06);
      color: rgba(234,240,255,.9);
      white-space:nowrap;
    }
    .btn{
      border:1px solid var(--line);
      background: rgba(255,255,255,.06);
      color: var(--text);
      padding:8px 10px;
      border-radius:12px;
      cursor:pointer;
      font-weight:700;
    }
    .btn:hover{ background: rgba(255,255,255,.12); }

    @media (max-width: 720px){
      .hud{ top: calc(8px + var(--safeTop)); left:8px; right:8px; }
      .hud .panel{ padding:8px 10px; border-radius:14px; gap:6px; }
      .badge{ font-size:10px; padding:3px 8px; }
      .btn{ padding:7px 9px; border-radius:12px; font-size:12px; }
    }

    /* Fullscreen overlays */
    .overlay{
      position:fixed;
      inset:0;
      z-index:30;
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 18px;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(6px);
    }
    .card{
      width: min(720px, 100%);
      border:1px solid var(--line);
      border-radius:18px;
      background: rgba(255,255,255,.07);
      box-shadow: 0 18px 55px rgba(0,0,0,.45);
      padding: 16px;
    }
    .card h1{
      font-size:22px;
      margin-bottom:8px;
    }
    .card p{
      color: var(--muted);
      line-height:1.35;
      margin-bottom:10px;
      font-size:14px;
    }
    .grid{
      display:grid;
      grid-template-columns: repeat(3, 1fr);
      gap:10px;
      margin-top:10px;
    }
    @media (max-width: 720px){
      .grid{ grid-template-columns:1fr; }
      .card h1{ font-size:20px; }
      .card p{ font-size:13px; }
    }
    .choice{
      border:1px solid var(--line);
      border-radius:16px;
      background: rgba(255,255,255,.06);
      padding:12px;
      cursor:pointer;
      transition: transform .06s ease;
    }
    .choice:hover{ transform: translateY(-1px); background: rgba(255,255,255,.10); }
    .choice b{ display:block; margin-bottom:6px; }
    .choice span{ color: var(--muted); font-size:13px; line-height:1.25; display:block; }

    .row{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:12px;
    }
  </style>
</head>
<body>
  <canvas id="c"></canvas>

  <div class="hud">
    <div class="panel" id="hudLeft">
      <span class="title">Blob Wars</span>
      <span class="badge" id="hudMode">NORMAL</span>
      <span class="badge" id="hudWave">Wave: 1</span>
      <span class="badge" id="hudKills">Kills: 0</span>
      <span class="badge" id="hudScore">Score: 0</span>
      <span class="badge" id="hudHigh">High: 0</span>
      <span class="badge" id="hudHP">HP: 120/120</span>
      <span class="badge" id="hudSH">Shield: 60/60</span>
      <span class="badge" id="hudWeapon">Weapon: SMG</span>
      <span class="badge" id="hudGuns">Guns: 1</span>
      <span class="badge" id="hudMines">Mines: 2</span>
      <span class="badge" id="hudTur">Turrets: 0</span>
    </div>

    <div class="panel">
      <button class="btn" id="btnRestart">Restart</button>
      <button class="btn" id="btnPause">Pause</button>
    </div>
  </div>

  <!-- Start Screen -->
  <div class="overlay" id="startOverlay">
    <div class="card">
      <h1>Blob Wars 2.0</h1>
      <p>
        Survive waves of enemy blobs. Use cover, mines, and turrets.
        Every <b>3 waves</b> you pick an upgrade. Every <b>10 waves</b> is a boss.
      </p>
      <p>
        <b>PC:</b> WASD move, Mouse aim, Hold Click shoot, M mine, T turret, P pause.<br/>
        <b>Mobile:</b> Left joystick move. Right joystick aim (auto-shoot). Tap MINE / TUR buttons.
      </p>
      <div class="row">
        <button class="btn" id="btnPlay">Tap to Play</button>
        <button class="btn" id="btnFullscreen">Fullscreen</button>
      </div>
      <p style="margin-top:10px; font-size:12px; color: rgba(234,240,255,.65);">
        Tip: Add to Home Screen on iPhone/Android for a “real app” vibe.
      </p>
    </div>
  </div>

  <!-- Upgrade Screen -->
  <div class="overlay" id="upgradeOverlay" style="display:none;">
    <div class="card">
      <h1>Upgrade Time</h1>
      <p>Pick one. Enemies are paused. Your choice shapes the build. 🧠⚔️</p>
      <div class="grid" id="upgradeGrid"></div>
    </div>
  </div>

  <script>
    // ===== Crash Guard (shows on screen) =====
    window.onerror = (msg, src, line, col) => {
      const box = document.createElement("pre");
      box.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;" +
        "background:#111;color:#0f0;padding:10px;border:1px solid #0f0;" +
        "white-space:pre-wrap;font-size:12px;";
      box.textContent = `JS CRASH:\n${msg}\nLine: ${line}:${col}\n${src}`;
      document.body.appendChild(box);
    };

    // ===== DOM =====
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");

    const hudMode   = document.getElementById("hudMode");
    const hudWave   = document.getElementById("hudWave");
    const hudKills  = document.getElementById("hudKills");
    const hudScore  = document.getElementById("hudScore");
    const hudHigh   = document.getElementById("hudHigh");
    const hudHP     = document.getElementById("hudHP");
    const hudSH     = document.getElementById("hudSH");
    const hudWeapon = document.getElementById("hudWeapon");
    const hudGuns   = document.getElementById("hudGuns");
    const hudMines  = document.getElementById("hudMines");
    const hudTur    = document.getElementById("hudTur");

    const btnRestart = document.getElementById("btnRestart");
    const btnPause   = document.getElementById("btnPause");

    const startOverlay = document.getElementById("startOverlay");
    const btnPlay = document.getElementById("btnPlay");
    const btnFullscreen = document.getElementById("btnFullscreen");

    const upgradeOverlay = document.getElementById("upgradeOverlay");
    const upgradeGrid = document.getElementById("upgradeGrid");

    // ===== Helpers =====
    const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
    const rand  = (a,b)=>Math.random()*(b-a)+a;
    const randi = (a,b)=>Math.floor(rand(a,b+1));
    const dist2 = (ax,ay,bx,by)=> (ax-bx)*(ax-bx)+(ay-by)*(ay-by);
    const now = ()=>performance.now();

    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

    // ===== Fullscreen / Resize =====
    let W = 960, H = 540, DPR = 1;

    function resize(){
      DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      W = Math.floor(window.innerWidth * DPR);
      H = Math.floor(window.innerHeight * DPR);
      canvas.width = W;
      canvas.height = H;
    }
    window.addEventListener("resize", resize, {passive:true});
    resize();

    async function goFullscreen(){
      try{
        if(document.fullscreenElement) return;
        await document.documentElement.requestFullscreen?.();
      }catch(e){}
    }
    btnFullscreen.addEventListener("click", goFullscreen);

    // ===== Input (PC) =====
    const keys = {};
    window.addEventListener("keydown", e=>{
      keys[e.key.toLowerCase()] = true;
      const k = e.key.toLowerCase();
      if(k==="p") togglePause();
      if(k==="r") hardRestart();
      if(k==="m") dropMine();
      if(k==="t") placeTurret();
    });
    window.addEventListener("keyup", e=> keys[e.key.toLowerCase()] = false);

    // mouse aim
    let mouse = {x: 0, y: 0, down:false};
    canvas.addEventListener("mousemove", e=>{
      const r = canvas.getBoundingClientRect();
      const sx = W / r.width, sy = H / r.height;
      mouse.x = (e.clientX - r.left) * sx;
      mouse.y = (e.clientY - r.top)  * sy;
    });
    canvas.addEventListener("mousedown", ()=> mouse.down = true);
    window.addEventListener("mouseup", ()=> mouse.down = false);

    // ===== Mobile Joysticks =====
    const touchState = {
      leftId:null, rightId:null,
      leftStart:{x:0,y:0}, rightStart:{x:0,y:0},
      leftVec:{x:0,y:0}, rightVec:{x:0,y:0},
      aiming:false,
    };
    function normStick(dx,dy,max=110){
      const len = Math.hypot(dx,dy) || 1;
      const mag = Math.min(max, len);
      return { x:(dx/len)*(mag/max), y:(dy/len)*(mag/max), mag: mag/max };
    }

    // mobile buttons (canvas coords)
    function safeBottomPx(){
      // We can't directly read CSS env from JS reliably; give a good cushion:
      return Math.floor(28 * DPR);
    }
    function uiButtons(){
      const pad = Math.floor(16*DPR);
      const safeB = safeBottomPx();
      const bw = Math.floor(170*DPR);
      const bh = Math.floor(96*DPR);
      const x = W - bw - pad;
      const mineY = H - bh - pad - safeB;
      const turY  = mineY - bh - Math.floor(14*DPR);
      return {
        mine:{x, y:mineY, w:bw, h:bh},
        tur:{x, y:turY,  w:bw, h:bh}
      };
    }
    function inRect(px,py,r){ return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }

    canvas.addEventListener("touchstart", (e)=>{
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = W / r.width, sy = H / r.height;

      const btns = uiButtons();

      for(const t of e.changedTouches){
        const x = (t.clientX - r.left)*sx;
        const y = (t.clientY - r.top)*sy;

        if(inRect(x,y,btns.mine)){ dropMine(); continue; }
        if(inRect(x,y,btns.tur)){ placeTurret(); continue; }

        // left half for move
        if(x < W*0.5 && touchState.leftId === null){
          touchState.leftId = t.identifier;
          touchState.leftStart = {x,y};
          touchState.leftVec = {x:0,y:0,mag:0};
        }
        // right half for aim
        else if(touchState.rightId === null){
          touchState.rightId = t.identifier;
          touchState.rightStart = {x,y};
          touchState.rightVec = {x:0,y:0,mag:0};
          touchState.aiming = true;
        }
      }
    }, {passive:false});

    canvas.addEventListener("touchmove", (e)=>{
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = W / r.width, sy = H / r.height;

      for(const t of e.changedTouches){
        const x = (t.clientX - r.left)*sx;
        const y = (t.clientY - r.top)*sy;

        if(t.identifier === touchState.leftId){
          const v = normStick(x-touchState.leftStart.x, y-touchState.leftStart.y, 120);
          touchState.leftVec = v;
        }
        if(t.identifier === touchState.rightId){
          const v = normStick(x-touchState.rightStart.x, y-touchState.rightStart.y, 120);
          touchState.rightVec = v;
          touchState.aiming = v.mag > 0.12; // deadzone
          if(touchState.aiming){
            // direct aim (no smoothing/drag)
            mouse.x = player.x + v.x * Math.floor(260*DPR);
            mouse.y = player.y + v.y * Math.floor(260*DPR);
          }
        }
      }
    }, {passive:false});

    canvas.addEventListener("touchend", (e)=>{
      e.preventDefault();
      for(const t of e.changedTouches){
        if(t.identifier === touchState.leftId){
          touchState.leftId = null;
          touchState.leftVec = {x:0,y:0,mag:0};
        }
        if(t.identifier === touchState.rightId){
          touchState.rightId = null;
          touchState.rightVec = {x:0,y:0,mag:0};
          touchState.aiming = false;
        }
      }
    }, {passive:false});

    // ===== World wrapping =====
    function wrap(ent){
      if(ent.x < -ent.r) ent.x = W + ent.r;
      if(ent.x > W + ent.r) ent.x = -ent.r;
      if(ent.y < -ent.r) ent.y = H + ent.r;
      if(ent.y > H + ent.r) ent.y = -ent.r;
    }

    // ===== Walls (cover) =====
    let walls = [];
    function makeWalls(){
      // randomized cover layout, changes every 2 waves
      const pad = Math.floor(90*DPR);
      const maxW = Math.floor(260*DPR);
      const maxH = Math.floor(160*DPR);
      const count = 6;

      walls = [];
      for(let i=0;i<count;i++){
        const w = randi(Math.floor(120*DPR), maxW);
        const h = randi(Math.floor(28*DPR), Math.floor(46*DPR));
        const x = randi(pad, W-pad-w);
        const y = randi(Math.floor(160*DPR), H-pad-h); // avoid top HUD area
        walls.push({x,y,w,h});
      }
      // one chunky block in middle-ish
      walls.push({
        x: Math.floor(W*0.45),
        y: Math.floor(H*0.42),
        w: Math.floor(110*DPR),
        h: Math.floor(110*DPR)
      });
    }

    function resolveCircleRect(c, r){
      const cx = clamp(c.x, r.x, r.x+r.w);
      const cy = clamp(c.y, r.y, r.y+r.h);
      const dx = c.x - cx, dy = c.y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 > c.r*c.r) return;
      const d = Math.hypot(dx,dy) || 1;
      const nx = dx/d, ny = dy/d;
      const push = (c.r - d) + 0.5;
      c.x += nx*push;
      c.y += ny*push;
    }
    function pointInRect(px,py,r){
      return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h;
    }

    // ===== Save/Highscore =====
    const HS_KEY = "blobwars_highscore_v2";
    function loadHigh(){
      const v = Number(localStorage.getItem(HS_KEY) || "0");
      return Number.isFinite(v) ? v : 0;
    }
    function saveHigh(v){
      localStorage.setItem(HS_KEY, String(Math.floor(v)));
    }
    let highScore = loadHigh();

    // ===== Game State =====
    let running = false;
    let paused = false;
    let gameOver = false;
    let wave = 1;
    let kills = 0;
    let score = 0;

    // every 3 waves -> upgrade
    const UPGRADE_EVERY = 3;

    const player = {
      x: 0, y: 0, r: Math.floor(18*DPR),
      hp: 120, maxHp: 120,
      shield: 60, maxShield: 60,
      shieldRegen: 0.26*DPR,   // per frame
      shieldDelay: 0,
      speed: isTouch ? 4.4*DPR : 3.3*DPR,
      ifr: 0,
      cd: 0,
      guns: 1,
      gunSpread: 0.22,
      mines: 2, mineMax: 2,
      turrets: 0, turretMax: 2,
      weapon: "SMG",
      // weapon stats
      fireRate: 8,      // frames
      bulletSpeed: 12*DPR,
      bulletDmg: 14,
      bulletLife: 85
    };

    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let mines = [];
    let particles = [];
    let turrets = [];

    let perf = 0;
    let lastT = now();

    // ===== HUD =====
    function syncHUD(){
      hudMode.textContent = (wave % 10 === 0) ? "BOSS" : "NORMAL";
      hudWave.textContent = `Wave: ${wave}`;
      hudKills.textContent = `Kills: ${kills}`;
      hudScore.textContent = `Score: ${Math.floor(score)}`;
      hudHigh.textContent = `High: ${Math.floor(highScore)}`;
      hudHP.textContent = `HP: ${Math.floor(player.hp)}/${player.maxHp}`;
      hudSH.textContent = `Shield: ${Math.floor(player.shield)}/${player.maxShield}`;
      hudWeapon.textContent = `Weapon: ${player.weapon}`;
      hudGuns.textContent = `Guns: ${player.guns}`;
      hudMines.textContent = `Mines: ${player.mines}`;
      hudTur.textContent = `Turrets: ${player.turrets}`;
      btnPause.textContent = paused ? "Resume" : "Pause";
    }

    function togglePause(){
      if(!running) return;
      if(gameOver) return;
      paused = !paused;
      syncHUD();
    }

    btnPause.addEventListener("click", togglePause);
    btnRestart.addEventListener("click", hardRestart);

    // ===== VFX =====
    function burst(x,y,n=10){
      for(let i=0;i<n;i++){
        const a = rand(0, Math.PI*2);
        const sp = rand(1.5*DPR, 6.5*DPR);
        particles.push({x,y,vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life: rand(16,34)});
      }
    }

    // ===== Damage/Heal =====
    function damagePlayer(d){
      if(player.ifr>0) return;

      // shield first
      if(player.shield > 0){
        const take = Math.min(player.shield, d);
        player.shield -= take;
        d -= take;
      }
      if(d>0) player.hp -= d;

      player.ifr = 14;
      player.shieldDelay = 90;

      if(player.hp <= 0){
        player.hp = 0;
        die();
      }
      syncHUD();
    }

    function healPlayer(h){
      player.hp = clamp(player.hp + h, 0, player.maxHp);
      syncHUD();
    }

    function regenShield(){
      if(player.shieldDelay > 0){
        player.shieldDelay--;
        return;
      }
      player.shield = clamp(player.shield + player.shieldRegen, 0, player.maxShield);
    }

    // ===== Weapons =====
    function setWeapon(name){
      player.weapon = name;
      if(name==="SMG"){
        player.fireRate = 8;
        player.bulletDmg = 14;
        player.bulletSpeed = 12*DPR;
        player.bulletLife = 85;
      }else if(name==="AR"){
        player.fireRate = 10;
        player.bulletDmg = 18;
        player.bulletSpeed = 12*DPR;
        player.bulletLife = 95;
      }else if(name==="SHOTGUN"){
        player.fireRate = 18;
        player.bulletDmg = 12;
        player.bulletSpeed = 11*DPR;
        player.bulletLife = 55;
      }else if(name==="BURST"){
        player.fireRate = 14;
        player.bulletDmg = 15;
        player.bulletSpeed = 13*DPR;
        player.bulletLife = 80;
      }
      syncHUD();
    }

    // ===== Enemies =====
    function enemyConfig(type){
      if(type==="normal") return { r: rand(16,22), hp: rand(40,60), speed: rand(1.15,1.95), dmg: 10, bs: 6.6, rate: 64 };
      if(type==="tank")   return { r: rand(26,34), hp: rand(110,150), speed: rand(0.85,1.25), dmg: 12, bs: 6.0, rate: 78 };
      if(type==="sniper") return { r: rand(16,22), hp: rand(38,55), speed: rand(1.0,1.55),  dmg: 15, bs: 8.2, rate: 100 };
      if(type==="boss")   return { r: 54, hp: 1200, speed: 1.2, dmg: 16, bs: 7.3, rate: 26 };
      return enemyConfig("normal");
    }

    function spawnEnemy(type="normal"){
      const side = Math.floor(Math.random()*4);
      let x,y;
      const off = Math.floor(50*DPR);
      if(side===0){ x=-off; y=rand(0,H); }
      if(side===1){ x=W+off; y=rand(0,H); }
      if(side===2){ x=rand(0,W); y=-off; }
      if(side===3){ x=rand(0,W); y=H+off; }

      const cfg = enemyConfig(type);

      // scale with wave
      const hp = (type==="boss")
        ? Math.floor(cfg.hp + wave*90)
        : Math.floor(cfg.hp + wave*3.2);

      enemies.push({
        type,
        x,y,
        r: cfg.r*DPR,
        hp, maxHp: hp,
        speed: (cfg.speed + wave*0.02) * DPR,
        dmg: cfg.dmg + Math.floor(wave*0.15),
        bulletSpeed: (cfg.bs + wave*0.02) * DPR,
        fireRate: Math.max(18, cfg.rate - wave*1.2),
        fireT: Math.floor(rand(0,40)),
        orbit: rand(-1,1),
        bossPhase: 0
      });
    }

    function spawnWave(){
      enemies.length = 0;
      enemyBullets.length = 0;

      // change cover every 2 waves (1,3,5,7...)
      if(wave % 2 === 1) makeWalls();

      if(wave % 10 === 0){
        // boss wave
        spawnEnemy("boss");
        const minions = 8 + Math.floor(wave*0.35);
        for(let i=0;i<minions;i++){
          const t = (wave>=8 && Math.random()<0.18) ? "tank" : "normal";
          spawnEnemy(t);
        }
      }else{
        const count = 8 + Math.floor(wave*2.0);
        for(let i=0;i<count;i++){
          let type="normal";
          const roll = Math.random();
          if(wave >= 7 && roll < 0.17) type="tank";
          if(wave >= 6 && roll >= 0.17 && roll < 0.34) type="sniper";
          spawnEnemy(type);
        }
      }
      syncHUD();
    }

    // ===== Shooting =====
    function shoot(){
      if(player.cd>0) return;

      const dx = mouse.x - player.x, dy = mouse.y - player.y;
      const base = Math.atan2(dy, dx);

      // shotgun fires multiple pellets
      const isShotgun = (player.weapon==="SHOTGUN");
      const pelletCount = isShotgun ? 6 : 1;
      const pelletSpread = isShotgun ? 0.22 : 0;

      // multi-guns: side barrels
      const angles = [base];
      for(let i=1;i<player.guns;i++){
        const side = (i%2===1) ? -1 : 1;
        const step = Math.ceil(i/2);
        angles.push(base + side * step * player.gunSpread);
      }

      for(const ang0 of angles){
        for(let p=0;p<pelletCount;p++){
          const ang = ang0 + (isShotgun ? rand(-pelletSpread, pelletSpread) : 0);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          bullets.push({
            x: player.x + ux*(player.r+10),
            y: player.y + uy*(player.r+10),
            vx: ux*player.bulletSpeed,
            vy: uy*player.bulletSpeed,
            r: Math.floor(4*DPR),
            life: player.bulletLife,
            dmg: player.bulletDmg
          });
        }
      }

      // burst weapon: quick 3-shot microburst
      if(player.weapon==="BURST"){
        // schedule 2 extra delayed shots
        burstQueue.push({t: 4, base});
        burstQueue.push({t: 8, base});
      }

      player.cd = player.fireRate;
    }

    let burstQueue = [];
    function updateBurstQueue(){
      for(const q of burstQueue) q.t--;
      const ready = burstQueue.filter(q=>q.t<=0);
      burstQueue = burstQueue.filter(q=>q.t>0);
      for(const q of ready){
        const base = q.base;
        const angles = [base];
        for(let i=1;i<player.guns;i++){
          const side = (i%2===1) ? -1 : 1;
          const step = Math.ceil(i/2);
          angles.push(base + side * step * player.gunSpread);
        }
        for(const ang of angles){
          const ux = Math.cos(ang), uy = Math.sin(ang);
          bullets.push({
            x: player.x + ux*(player.r+10),
            y: player.y + uy*(player.r+10),
            vx: ux*player.bulletSpeed,
            vy: uy*player.bulletSpeed,
            r: Math.floor(4*DPR),
            life: player.bulletLife,
            dmg: player.bulletDmg
          });
        }
      }
    }

    // ===== Mines =====
    function dropMine(){
      if(!running || paused || gameOver) return;
      if(player.mines <= 0) return;
      player.mines--;
      mines.push({x: player.x, y: player.y, r: Math.floor(10*DPR), arm: 16, life: 1000});
      syncHUD();
    }
    function explodeMine(m){
      const R = Math.floor(140*DPR);
      burst(m.x,m.y,34);
      for(const e of enemies){
        const rr = R + e.r;
        if(dist2(m.x,m.y,e.x,e.y) <= rr*rr){
          e.hp -= 95;
        }
      }
    }

    // ===== Turrets =====
    function placeTurret(){
      if(!running || paused || gameOver) return;
      if(player.turrets <= 0) return;
      player.turrets--;
      turrets.push({
        x: player.x,
        y: player.y,
        r: Math.floor(12*DPR),
        cd: 0,
        // lasts current + next wave (2 waves)
        expireWave: wave + 2,
        dmg: 12,
        rate: Math.max(6, Math.floor(10 - wave*0.05)),
        range: Math.floor(340*DPR)
      });
      syncHUD();
    }

    function updateTurrets(){
      for(const t of turrets){
        if(t.expireWave <= wave) t.dead = true;
        if(t.cd>0) t.cd--;

        if(t.dead) continue;

        // shoot nearest enemy in range
        let best = null;
        let bestD2 = Infinity;
        for(const e of enemies){
          const d2 = dist2(t.x,t.y,e.x,e.y);
          if(d2 < bestD2 && d2 <= t.range*t.range){
            bestD2 = d2;
            best = e;
          }
        }
        if(best && t.cd===0){
          const ang = Math.atan2(best.y - t.y, best.x - t.x);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          bullets.push({
            x: t.x + ux*(t.r+8),
            y: t.y + uy*(t.r+8),
            vx: ux*(12*DPR),
            vy: uy*(12*DPR),
            r: Math.floor(4*DPR),
            life: 80,
            dmg: t.dmg
          });
          t.cd = t.rate;
        }
      }
      turrets = turrets.filter(t=>!t.dead);
    }

    // ===== Player Update =====
    function updatePlayer(){
      let mx=0,my=0;
      if(keys["w"]) my--;
      if(keys["s"]) my++;
      if(keys["a"]) mx--;
      if(keys["d"]) mx++;

      // mobile joystick move
      mx += touchState.leftVec.x;
      my += touchState.leftVec.y;

      if(mx || my){
        const len = Math.hypot(mx,my) || 1;
        mx/=len; my/=len;
        player.x += mx*player.speed;
        player.y += my*player.speed;
      }

      wrap(player);
      for(const w of walls) resolveCircleRect(player, w);

      if(player.cd>0) player.cd--;
      if(player.ifr>0) player.ifr--;

      const wantShoot = mouse.down || touchState.aiming;
      if(wantShoot && !gameOver) shoot();

      updateBurstQueue();
      regenShield();
    }

    // ===== Bullets =====
    function updateBullets(){
      for(const b of bullets){
        b.x += b.vx; b.y += b.vy; b.life--;
        wrap(b);
      }
      for(const b of enemyBullets){
        b.x += b.vx; b.y += b.vy; b.life--;
        wrap(b);
      }

      // stop bullets on walls
      for(const b of bullets){
        for(const w of walls){
          if(pointInRect(b.x,b.y,w)){ b.life=0; burst(b.x,b.y,4); break; }
        }
      }
      for(const b of enemyBullets){
        for(const w of walls){
          if(pointInRect(b.x,b.y,w)){ b.life=0; break; }
        }
      }

      bullets = bullets.filter(b=>b.life>0);
      enemyBullets = enemyBullets.filter(b=>b.life>0);
    }

    function updateMines(){
      for(const m of mines){
        if(m.arm>0) m.arm--;
        m.life--;
      }
      mines = mines.filter(m=>m.life>0);
    }

    // ===== Enemy AI =====
    function steerEnemies(){
      for(const e of enemies){
        let dx = player.x - e.x, dy = player.y - e.y;
        let d = Math.hypot(dx,dy) || 1;
        let ux = dx/d, uy = dy/d;

        const ox = -uy * e.orbit;
        const oy =  ux * e.orbit;

        // separation
        let sx=0, sy=0;
        for(const o of enemies){
          if(o===e) continue;
          const ddx = e.x - o.x, ddy = e.y - o.y;
          const dd = Math.hypot(ddx,ddy) || 1;
          const min = e.r + o.r + 10*DPR;
          if(dd < min){
            sx += (ddx/dd) * (min-dd);
            sy += (ddy/dd) * (min-dd);
          }
        }

        // wall avoidance
        let wx=0, wy=0;
        for(const w of walls){
          const cx = clamp(e.x, w.x, w.x+w.w);
          const cy = clamp(e.y, w.y, w.y+w.h);
          const adx = e.x - cx, ady = e.y - cy;
          const ad = Math.hypot(adx,ady) || 1;
          const min = e.r + 10*DPR;
          if(ad < min){
            wx += (adx/ad) * (min-ad);
            wy += (ady/ad) * (min-ad);
          }
        }

        // boss has heavier push
        const bossMul = (e.type==="boss") ? 1.25 : 1;

        let vx = ux*1.0 + ox*0.5 + sx*0.018 + wx*0.05;
        let vy = uy*1.0 + oy*0.5 + sy*0.018 + wy*0.05;
        const vlen = Math.hypot(vx,vy) || 1;
        vx/=vlen; vy/=vlen;

        const desired = (e.type==="sniper") ? (320*DPR) : (150*DPR);
        const chase = d > desired ? 1.0 : 0.45;

        e.x += vx * e.speed * chase * bossMul;
        e.y += vy * e.speed * chase * bossMul;

        wrap(e);
        for(const w of walls) resolveCircleRect(e, w);

        // shooting
        e.fireT++;
        if(e.fireT >= e.fireRate && !gameOver){
          e.fireT = 0;

          // boss patterns
          if(e.type==="boss"){
            bossShoot(e);
          }else{
            const base = Math.atan2(player.y - e.y, player.x - e.x);
            const spread = (e.type==="sniper") ? rand(-0.06,0.06) : rand(-0.14,0.14);
            fireEnemyBullet(e, base + spread, 1);
          }
        }
      }
    }

    function fireEnemyBullet(e, ang, count=1){
      for(let i=0;i<count;i++){
        const ux = Math.cos(ang), uy = Math.sin(ang);
        enemyBullets.push({
          x: e.x + ux*(e.r+10),
          y: e.y + uy*(e.r+10),
          vx: ux*e.bulletSpeed,
          vy: uy*e.bulletSpeed,
          r: Math.floor(4*DPR),
          life: 150,
          dmg: e.dmg
        });
      }
    }

    function bossShoot(e){
      // alternating patterns
      e.bossPhase = (e.bossPhase + 1) % 3;
      const base = Math.atan2(player.y - e.y, player.x - e.x);

      if(e.bossPhase === 0){
        // 5-shot fan
        for(let i=-2;i<=2;i++){
          fireEnemyBullet(e, base + i*0.18, 1);
        }
      }else if(e.bossPhase === 1){
        // triple burst
        for(let k=0;k<3;k++){
          const spread = rand(-0.08,0.08);
          fireEnemyBullet(e, base + spread, 1);
        }
      }else{
        // ring shot (harder)
        const n = 10;
        for(let i=0;i<n;i++){
          fireEnemyBullet(e, (Math.PI*2)*(i/n), 1);
        }
      }
    }

    // ===== Collisions =====
    function handleCollisions(){
      // player bullets -> enemies
      for(const b of bullets){
        for(const e of enemies){
          if(e.hp<=0) continue;
          const rr = b.r + e.r;
          if(dist2(b.x,b.y,e.x,e.y) <= rr*rr){
            e.hp -= b.dmg;
            b.life = 0;
            burst(b.x,b.y,5);

            if(e.hp <= 0){
              kills++;
              score += 120 + wave*8;

              // small lifesteal on kill
              healPlayer(10);

              // drop chance: mines / turrets / potion
              // normal: low; tank/sniper: medium; boss: high
              let p = 0.05;
              if(e.type==="tank" || e.type==="sniper") p = 0.12;
              if(e.type==="boss") p = 0.40;

              if(Math.random() < p){
                const roll = Math.random();
                if(roll < 0.45){
                  // potion (instant heal)
                  healPlayer(24);
                }else if(roll < 0.75){
                  player.mines = Math.min(player.mineMax, player.mines + 1);
                }else{
                  player.turrets = Math.min(player.turretMax, player.turrets + 1);
                }
              }

              burst(e.x,e.y,22);
              syncHUD();
            }
          }
        }
      }

      // enemy bullets -> player
      for(const b of enemyBullets){
        const rr = b.r + player.r;
        if(dist2(b.x,b.y,player.x,player.y) <= rr*rr){
          b.life = 0;
          burst(b.x,b.y,7);
          damagePlayer(b.dmg);
        }
      }

      // contact damage
      for(const e of enemies){
        const rr = e.r + player.r;
        if(dist2(e.x,e.y,player.x,player.y) <= rr*rr){
          damagePlayer(9);
        }
      }

      // mines explode
      for(const m of mines){
        if(m.arm>0) continue;
        for(const e of enemies){
          const rr = Math.floor(40*DPR) + e.r;
          if(dist2(m.x,m.y,e.x,e.y) <= rr*rr){
            m.life = 0;
            explodeMine(m);
            break;
          }
        }
      }

      enemies = enemies.filter(e=>e.hp>0);

      // next wave
      if(!gameOver && enemies.length===0){
        onWaveClear();
      }
    }

    function onWaveClear(){
      wave++;

      // score for clearing
      score += 400 + wave*15;

      // between-wave rewards
      player.mines = Math.min(player.mineMax, player.mines + 1);
      // small heal + shield top-up
      healPlayer(12);
      player.shield = Math.min(player.maxShield, player.shield + 22);

      // upgrades every 3 waves
      if((wave-1) % UPGRADE_EVERY === 0){
        openUpgrade();
      }else{
        spawnWave();
      }
      syncHUD();
    }

    // ===== Upgrades =====
    const upgradePool = [
      {
        id:"hp_up",
        title:"+ Max HP",
        desc:"Increase max HP by 20 and heal 20 now.",
        apply:()=>{ player.maxHp += 20; player.hp += 20; player.hp = clamp(player.hp,0,player.maxHp); }
      },
      {
        id:"shield_up",
        title:"+ Max Shield",
        desc:"Increase max Shield by 15 and refill 15 now.",
        apply:()=>{ player.maxShield += 15; player.shield += 15; player.shield = clamp(player.shield,0,player.maxShield); }
      },
      {
        id:"damage_up",
        title:"+ Damage",
        desc:"Bullets hit harder (+4 damage).",
        apply:()=>{ player.bulletDmg += 4; }
      },
      {
        id:"firerate_up",
        title:"+ Fire Rate",
        desc:"Shoot faster (cooldown -1 frame).",
        apply:()=>{ player.fireRate = Math.max(4, player.fireRate - 1); }
      },
      {
        id:"guns_up",
        title:"+ Gun Barrel",
        desc:"Add another gun barrel (multi-shot).",
        apply:()=>{ player.guns = Math.min(6, player.guns + 1); }
      },
      {
        id:"mine_pouch",
        title:"+ Mines",
        desc:"Increase mine capacity by 1 and gain +1 now.",
        apply:()=>{ player.mineMax += 1; player.mines = Math.min(player.mineMax, player.mines+1); }
      },
      {
        id:"tur_pack",
        title:"+ Turrets",
        desc:"Increase turret capacity by 1 and gain +1 now.",
        apply:()=>{ player.turretMax += 1; player.turrets = Math.min(player.turretMax, player.turrets+1); }
      },
      {
        id:"weapon_ar",
        title:"Unlock AR",
        desc:"Switch weapon to AR (stronger shots).",
        apply:()=>{ setWeapon("AR"); }
      },
      {
        id:"weapon_shotgun",
        title:"Unlock Shotgun",
        desc:"Switch weapon to Shotgun (close-range burst).",
        apply:()=>{ setWeapon("SHOTGUN"); }
      },
      {
        id:"weapon_burst",
        title:"Unlock Burst",
        desc:"Switch weapon to Burst (3-shot bursts).",
        apply:()=>{ setWeapon("BURST"); }
      }
    ];

    function pick3Upgrades(){
      const copy = [...upgradePool];
      const picks = [];
      while(picks.length<3 && copy.length){
        const idx = Math.floor(Math.random()*copy.length);
        picks.push(copy.splice(idx,1)[0]);
      }
      return picks;
    }

    let currentUpgrades = [];
    function openUpgrade(){
      paused = true; // pause action while picking
      currentUpgrades = pick3Upgrades();
      upgradeGrid.innerHTML = "";
      for(const u of currentUpgrades){
        const div = document.createElement("div");
        div.className = "choice";
        div.innerHTML = `<b>${u.title}</b><span>${u.desc}</span>`;
        div.addEventListener("click", ()=>{
          u.apply();
          upgradeOverlay.style.display = "none";
          paused = false;
          spawnWave();
          syncHUD();
        });
        upgradeGrid.appendChild(div);
      }
      upgradeOverlay.style.display = "flex";
      syncHUD();
    }

    // ===== Score / Highscore =====
    function die(){
      gameOver = true;
      paused = false;

      // finalize highscore
      if(score > highScore){
        highScore = score;
        saveHigh(highScore);
      }
      syncHUD();
    }

    // ===== Draw =====
    function drawGrid(){
      ctx.strokeStyle = "rgba(234,240,255,0.06)";
      ctx.lineWidth = Math.max(1, DPR);
      const step = Math.floor(44*DPR);
      for(let x=0;x<=W;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for(let y=0;y<=H;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }

    function drawWalls(){
      for(const w of walls){
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(w.x,w.y,w.w,w.h);
        ctx.strokeStyle = "rgba(234,240,255,0.18)";
        ctx.lineWidth = Math.max(1, DPR);
        ctx.strokeRect(w.x,w.y,w.w,w.h);
      }
    }

    function drawMines(){
      for(const m of mines){
        const pulse = 1 + Math.sin(perf/140) * 0.25;
        ctx.beginPath();
        ctx.strokeStyle = m.arm>0 ? "rgba(234,240,255,0.18)" : "rgba(255,77,109,0.55)";
        ctx.lineWidth = Math.max(2, 2*DPR);
        ctx.arc(m.x, m.y, (m.r+12)*pulse, 0, Math.PI*2);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = m.arm>0 ? "rgba(234,240,255,0.35)" : "rgba(255,77,109,0.92)";
        ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function drawTurrets(){
      for(const t of turrets){
        ctx.beginPath();
        ctx.fillStyle = "rgba(46,229,157,0.28)";
        ctx.arc(t.x,t.y,t.r+16*DPR,0,Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "rgba(46,229,157,0.92)";
        ctx.arc(t.x,t.y,t.r,0,Math.PI*2);
        ctx.fill();

        // tiny barrel toward nearest enemy (visual)
        let target = null, best = Infinity;
        for(const e of enemies){
          const d2 = dist2(t.x,t.y,e.x,e.y);
          if(d2 < best){ best = d2; target = e; }
        }
        if(target){
          const ang = Math.atan2(target.y - t.y, target.x - t.x);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          ctx.strokeStyle = "rgba(234,240,255,0.28)";
          ctx.lineWidth = Math.max(2, 2*DPR);
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(t.x + ux*(22*DPR), t.y + uy*(22*DPR));
          ctx.stroke();
        }
      }
    }

    function drawPlayer(){
      // glow
      ctx.beginPath();
      ctx.fillStyle = "rgba(124,92,255,0.25)";
      ctx.arc(player.x, player.y, player.r+12*DPR, 0, Math.PI*2);
      ctx.fill();

      // body
      ctx.beginPath();
      ctx.fillStyle = (player.ifr>0) ? "rgba(255,209,102,0.60)" : "rgba(255,209,102,0.98)";
      ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
      ctx.fill();

      // gun barrels
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const base = Math.atan2(dy, dx);

      const angles = [base];
      for(let i=1;i<player.guns;i++){
        const side = (i%2===1) ? -1 : 1;
        const step = Math.ceil(i/2);
        angles.push(base + side * step * player.gunSpread);
      }

      for(const ang of angles){
        const ux = Math.cos(ang), uy = Math.sin(ang);
        ctx.strokeStyle = "rgba(234,240,255,0.28)";
        ctx.lineWidth = Math.max(3, 3*DPR);
        ctx.beginPath();
        ctx.moveTo(player.x + ux*(player.r-2*DPR), player.y + uy*(player.r-2*DPR));
        ctx.lineTo(player.x + ux*(player.r+26*DPR), player.y + uy*(player.r+26*DPR));
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "rgba(46,229,157,0.92)";
        ctx.arc(player.x + ux*(player.r+26*DPR), player.y + uy*(player.r+26*DPR), 4*DPR, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function drawEnemies(){
      for(const e of enemies){
        let body = "rgba(255,77,109,0.92)";
        if(e.type==="tank") body = "rgba(255,77,109,0.78)";
        if(e.type==="sniper") body = "rgba(255,77,190,0.90)";
        if(e.type==="boss") body = "rgba(255,120,60,0.92)";

        ctx.beginPath();
        ctx.fillStyle = body;
        ctx.arc(e.x,e.y,e.r,0,Math.PI*2);
        ctx.fill();

        // HP bar
        const bw = e.r*2.25, bh = 6*DPR;
        const x = e.x - bw/2, y = e.y - e.r - 16*DPR;
        ctx.fillStyle = "rgba(234,240,255,0.16)";
        ctx.fillRect(x,y,bw,bh);
        ctx.fillStyle = (e.type==="boss") ? "rgba(255,209,102,0.90)" : "rgba(46,229,157,0.85)";
        ctx.fillRect(x,y,bw*(e.hp/e.maxHp),bh);

        ctx.fillStyle = "rgba(234,240,255,0.55)";
        ctx.font = `${Math.floor(10*DPR)}px system-ui`;
        ctx.fillText(e.type.toUpperCase(), x, y-4*DPR);
      }
    }

    function drawBullets(){
      for(const b of bullets){
        ctx.beginPath();
        ctx.fillStyle = "rgba(46,229,157,0.98)";
        ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
        ctx.fill();
      }
      for(const b of enemyBullets){
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,77,109,0.98)";
        ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
        ctx.fill();
      }
    }

    function drawParticles(){
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for(const p of particles){
        ctx.globalAlpha = Math.max(0, p.life/34);
        ctx.fillRect(p.x,p.y,2*DPR,2*DPR);
      }
      ctx.globalAlpha = 1;
    }

    function updateParticles(){
      for(const p of particles){
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life--;
      }
      particles = particles.filter(p=>p.life>0);
    }

    function drawOnCanvasUI(){
      // mobile-only: joysticks + buttons
      if(!isTouch) return;

      const btns = uiButtons();

      // buttons
      function drawBtn(r, label, count){
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = "rgba(234,240,255,0.20)";
        ctx.lineWidth = Math.max(2, 2*DPR);
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        ctx.fillStyle = "rgba(234,240,255,0.92)";
        ctx.font = `900 ${Math.floor(20*DPR)}px system-ui`;
        ctx.fillText(label, r.x + Math.floor(20*DPR), r.y + Math.floor(58*DPR));

        ctx.fillStyle = "rgba(234,240,255,0.70)";
        ctx.font = `800 ${Math.floor(14*DPR)}px system-ui`;
        ctx.fillText(String(count), r.x + r.w - Math.floor(26*DPR), r.y + Math.floor(24*DPR));
      }
      drawBtn(btns.tur, "TUR", player.turrets);
      drawBtn(btns.mine,"MINE",player.mines);

      // joystick rings
      if(touchState.leftId !== null){
        const s = touchState.leftStart;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(234,240,255,0.22)";
        ctx.lineWidth = Math.max(2, 2*DPR);
        ctx.arc(s.x, s.y, 52*DPR, 0, Math.PI*2);
        ctx.stroke();

        // knob
        ctx.beginPath();
        ctx.fillStyle = "rgba(234,240,255,0.18)";
        ctx.arc(s.x + touchState.leftVec.x*52*DPR, s.y + touchState.leftVec.y*52*DPR, 22*DPR, 0, Math.PI*2);
        ctx.fill();
      }
      if(touchState.rightId !== null){
        const s = touchState.rightStart;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(234,240,255,0.22)";
        ctx.lineWidth = Math.max(2, 2*DPR);
        ctx.arc(s.x, s.y, 52*DPR, 0, Math.PI*2);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "rgba(46,229,157,0.16)";
        ctx.arc(s.x + touchState.rightVec.x*52*DPR, s.y + touchState.rightVec.y*52*DPR, 22*DPR, 0, Math.PI*2);
        ctx.fill();
      }

      // gameover message (canvas)
      if(gameOver){
        ctx.fillStyle="rgba(0,0,0,0.55)";
        ctx.fillRect(W/2 - 260*DPR, H/2 - 90*DPR, 520*DPR, 180*DPR);

        ctx.fillStyle="rgba(234,240,255,0.96)";
        ctx.font=`900 ${Math.floor(34*DPR)}px system-ui`;
        ctx.textAlign="center";
        ctx.fillText("YOU DIED", W/2, H/2 - 18*DPR);

        ctx.fillStyle="rgba(234,240,255,0.80)";
        ctx.font=`700 ${Math.floor(16*DPR)}px system-ui`;
        ctx.fillText(`Score: ${Math.floor(score)}  |  High: ${Math.floor(highScore)}`, W/2, H/2 + 16*DPR);
        ctx.fillText("Tap Restart (top right) to play again", W/2, H/2 + 44*DPR);
        ctx.textAlign="left";
      }
    }

    function render(){
      ctx.clearRect(0,0,W,H);
      drawGrid();
      drawWalls();
      drawMines();
      drawTurrets();
      drawEnemies();
      drawBullets();
      drawParticles();
      drawPlayer();
      drawOnCanvasUI();
    }

    // ===== Loop =====
    function tick(){
      perf++;

      const t = now();
      const dt = Math.min(40, t - lastT);
      lastT = t;

      if(running && !paused && !gameOver){
        // score from survival time
        score += dt * 0.05;

        updatePlayer();
        updateTurrets();
        updateBullets();
        updateMines();
        steerEnemies();
        handleCollisions();
        updateParticles();
      }else if(running){
        // still animate mines/particles while paused
        updateMines();
        updateParticles();
      }

      render();
      requestAnimationFrame(tick);
    }

    // ===== Restart / Start =====
    function resetState(){
      paused=false; gameOver=false;
      wave=1; kills=0; score=0;
      highScore = loadHigh();

      player.r = Math.floor(18*DPR);
      player.x = W/2; player.y = H/2;

      player.maxHp = 120; player.hp = 120;
      player.maxShield = 60; player.shield = 60;
      player.shieldDelay = 0;

      player.speed = isTouch ? 4.4*DPR : 3.3*DPR;

      player.ifr=0; player.cd=0;
      player.guns=1;
      player.gunSpread=0.22;

      player.mineMax=2; player.mines=2;
      player.turretMax=2; player.turrets=0;

      setWeapon("SMG");

      bullets=[]; enemyBullets=[]; enemies=[]; mines=[]; particles=[]; turrets=[];
      burstQueue=[];
      makeWalls();
      spawnWave();
      syncHUD();
    }

    function hardRestart(){
      if(!running){
        startOverlay.style.display = "none";
        running = true;
      }
      resetState();
    }

    btnPlay.addEventListener("click", async ()=>{
      await goFullscreen();
      startOverlay.style.display = "none";
      running = true;
      resetState();
    });

    // allow click canvas to fullscreen on mobile if user wants
    canvas.addEventListener("click", ()=>{ if(isTouch && !document.fullscreenElement) goFullscreen(); });

    // start loop
    syncHUD();
    tick();
  </script>
</body>
</html>

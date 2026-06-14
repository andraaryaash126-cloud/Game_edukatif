const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const TILE = 64;
let WW = window.innerWidth,
  WH = window.innerHeight;

window.addEventListener("resize", () => {
  WW = window.innerWidth;
  WH = window.innerHeight;
  canvas.width = WW;
  canvas.height = WH;
  ctx.imageSmoothingEnabled = false;
});
window.dispatchEvent(new Event("resize"));

// Fungsi Memaksa Fullscreen dan Lock Landscape di Android
function bukaLayarPenuh() {
  let doc = document.documentElement;
  if (doc.requestFullscreen) {
    doc.requestFullscreen().catch((err) => console.log(err));
  } else if (doc.webkitRequestFullscreen) {
    /* Safari */
    doc.webkitRequestFullscreen();
  }

  // Mengunci orientasi ke landscape
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch((err) => console.log(err));
  }
}

// 4 THEMES
const THEMES = [
  {}, // index 0 unused
  {
    wall: "#1b3315",
    top: "#284a1e",
    floor: "#0e1c0a",
    name: "Hutan Biner",
  },
  {
    wall: "#152a33",
    top: "#1e3d4a",
    floor: "#0a171c",
    name: "Gua Es Oktal",
  },
  {
    wall: "#332615",
    top: "#4a381e",
    floor: "#1c140a",
    name: "Gurun Desimal",
  },
  {
    wall: "#331515",
    top: "#4a1e1e",
    floor: "#1c0a0a",
    name: "Kawah Heksadesimal",
  },
];

let state = "MENU"; // MENU, PLAY, QUIZ, DIALOGUE, GO, WIN
let map = [],
  ents = [],
  particles = [],
  floatTexts = [],
  projectiles = [];
let MW = 40,
  MH = 40;
let chestsOpened = 0;
let skorBenar = 0;
let skorSalah = 0;
let totalSoalTerjawab = 0;

// Sistem Dialog RPG
let dialogQueue = [];
let currentDialogIndex = 0;
let onDialogComplete = null;

const keys = {};
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;

  keys[e.code] = true;
  if (
    [
      "Space",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyJ",
      "KeyK",
      "KeyL",
    ].includes(e.code)
  ) {
    e.preventDefault();
  }

  if (state === "DIALOGUE" && e.code === "Space") {
    nextDialog();
    return;
  }

  if (state === "PLAY") {
    if (e.code === "Space") doAttack();
    if (e.code === "KeyJ") doSkill1();
    if (e.code === "KeyK") doSkill2();
    if (e.code === "KeyL") doSkill3();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys[e.code] = false;
});

// Joystick
let joy = { x: 0, y: 0, active: false, origin: { x: 0, y: 0 } };
const jBase = document.getElementById("joy-base");
const jStick = document.getElementById("joy-stick");

if (jBase) {
  jBase.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      joy.active = true;
      const rect = jBase.getBoundingClientRect();
      joy.origin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateJoy(e.touches[0]);
    },
    { passive: false },
  );

  jBase.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (joy.active) updateJoy(e.touches[0]);
    },
    { passive: false },
  );

  jBase.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      joy.active = false;
      joy.x = 0;
      joy.y = 0;
      jStick.style.transform = `translate(0px, 0px)`;
    },
    { passive: false },
  );
}

function updateJoy(touch) {
  let dx = touch.clientX - joy.origin.x;
  let dy = touch.clientY - joy.origin.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  let max = 35;

  if (dist > max) {
    dx = (dx / dist) * max;
    dy = (dy / dist) * max;
  }

  jStick.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max;
  joy.y = dy / max;
}

const setupBtn = (id, action) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        action();
      },
      { passive: false },
    );
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      action();
    });
  }
};

setupBtn("btn-atk", doAttack);
setupBtn("btn-s1", doSkill1);
setupBtn("btn-s2", doSkill2);
setupBtn("btn-s3", doSkill3);

const dBox = document.getElementById("dialogue-box");
dBox.addEventListener("mousedown", (e) => {
  e.preventDefault();
  nextDialog();
});

dBox.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    nextDialog();
  },
  { passive: false },
);

const p = {
  name: "SAMURAI",
  x: TILE * 2.5,
  y: TILE * 2.5,
  speed: 220,
  rad: 14,
  dirX: 1,
  dirY: 0,
  lastDirX: 1,
  hp: 100,
  maxHp: 100,
  xp: 0,
  maxXp: 100,
  level: 1,
  area: 1,
  walkFrame: 0,
  walkTimer: 0,
  cdAtk: 0,
  cdS1: 0,
  cdS2: 0,
  cdS3: 0,
  atkMax: 0.3,
  s1Max: 3,
  s2Max: 10,
  s3Max: 5,
  isDashing: false,
};

const cam = { x: 0, y: 0 };

function showNotif(text) {
  const el = document.getElementById("notif-area");
  el.innerText = text;
  el.style.opacity = 1;
  setTimeout(() => (el.style.opacity = 0), 4000);
}

function startDialog(dialogs, callback) {
  state = "DIALOGUE";
  dialogQueue = dialogs;
  currentDialogIndex = 0;
  onDialogComplete = callback;
  document.getElementById("dialogue-box").style.display = "block";
  document.getElementById("vctrl").style.display = "none";
  showDialog();
}

function showDialog() {
  let d = dialogQueue[currentDialogIndex];
  document.getElementById("dialogue-speaker").innerText = d.speaker;
  document.getElementById("dialogue-text").innerHTML = d.text;
}

function nextDialog() {
  currentDialogIndex++;
  if (currentDialogIndex >= dialogQueue.length) {
    document.getElementById("dialogue-box").style.display = "none";
    state = "PLAY";

    // PERBAIKAN: Deteksi HP berdasarkan sentuhan layar atau resolusi tablet
    if (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 1024
    ) {
      document.getElementById("vctrl").style.display = "flex";
    }

    if (onDialogComplete) onDialogComplete();
  } else {
    showDialog();
  }
}

function resetStats() {
  Object.assign(p, {
    x: TILE * 2.5,
    y: TILE * 2.5,
    hp: 100,
    maxHp: 100,
    xp: 0,
    maxXp: 100,
    level: 1,
    area: 1,
    score: 0,
    cdAtk: 0,
    cdS1: 0,
    cdS2: 0,
    cdS3: 0,
  });
  totalSoalTerjawab = 0;
  skorBenar = 0;
  skorSalah = 0;
}

function initGame() {
  bukaLayarPenuh();

  let inputName = document
    .getElementById("player-name-input")
    .value.trim()
    .toUpperCase();
  p.name = inputName !== "" ? inputName : "SAMURAI";

  document
    .querySelectorAll(".menu-screen")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById("hud").classList.add("active");

  resetStats();
  generateMap(p.area);
  cam.x = p.x - WW / 2;
  cam.y = p.y - WH / 2;
  lastTime = performance.now();

  let prologue = [
    {
      speaker: "RAJA RADIX",
      text: "Pahlawan... Kerajaan Radix dulunya damai karena keseimbangan sistem bilangan yang menyatukan kita.",
    },
    {
      speaker: "RAJA RADIX",
      text: "Namun Iblis Hexator menyegel pengetahuan itu ke dalam 4 dimensi buas, memecah belah dunia kita.",
    },
    {
      speaker: p.name,
      text: "Aku akan memotong-motong iblis itu dan merebut pecahan ilmu bilangan kita kembali!",
    },
    {
      speaker: "RAJA RADIX",
      text: "Bagus! Bukalah peti-peti ilmu dan selesaikan tantangannya untuk memancing para Penjaga Area keluar. Semoga pedangmu tajam!",
    },
  ];

  startDialog(prologue, () => {});
}

// Checkpoint saat Gugur (Mulai dari Area terakhir)
function startGame() {
  bukaLayarPenuh();

  document
    .querySelectorAll(".menu-screen")
    .forEach((el) => el.classList.remove("active"));

  // Mengembalikan HP dan Posisi (Tanpa reset level/xp/area)
  p.hp = p.maxHp;
  p.x = TILE * 2.5;
  p.y = TILE * 2.5;
  p.cdAtk = 0;
  p.cdS1 = 0;
  p.cdS2 = 0;
  p.cdS3 = 0;
  p.isDashing = false;

  generateMap(p.area);
  cam.x = p.x - WW / 2;
  cam.y = p.y - WH / 2;

  document.getElementById("hud").classList.add("active");

  // PERBAIKAN: Deteksi HP berdasarkan sentuhan layar atau resolusi tablet
  if (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 1024
  ) {
    document.getElementById("vctrl").style.display = "flex";
  }

  state = "PLAY";
  lastTime = performance.now();
}

function generateMap(lvl) {
  chestsOpened = 0;
  projectiles = [];
  ents = [];
  let th = THEMES[lvl];
  showNotif(`AREA ${lvl}: ${th.name} | Selesaikan 6 Soal untuk memanggil Bos!`);

  map = [];
  for (let y = 0; y < MH; y++) map.push(new Array(MW).fill(1));
  for (let y = 1; y <= 5; y++) {
    for (let x = 1; x <= 5; x++) {
      map[y][x] = 0;
    }
  }

  for (let x = 1; x < MW - 1; x++) map[3][x] = 0;
  for (let y = 1; y < MH - 1; y++) map[y][3] = 0;

  for (let i = 0; i < 15; i++) {
    let r = 3 + Math.floor(Math.random() * (MH - 6));
    for (let x = 2; x < MW - 2; x++) map[r][x] = 0;
  }

  for (let i = 0; i < 15; i++) {
    let c = 3 + Math.floor(Math.random() * (MW - 6));
    for (let y = 2; y < MH - 2; y++) map[y][c] = 0;
  }

  for (let i = 0; i < 35; i++) {
    let rw = 4 + Math.floor(Math.random() * 6);
    let rh = 4 + Math.floor(Math.random() * 6);
    let rx = 2 + Math.floor(Math.random() * (MW - rw - 4));
    let ry = 2 + Math.floor(Math.random() * (MH - rh - 4));
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        map[y][x] = 0;
      }
    }
  }

  for (let y = MH - 7; y < MH - 1; y++) {
    for (let x = MW - 7; x < MW - 1; x++) {
      map[y][x] = 0;
    }
  }

  let lantaiAman = [];
  for (let y = 8; y < MH - 2; y++) {
    for (let x = 8; x < MW - 2; x++) {
      if (x >= MW - 8 && y >= MH - 8) continue;
      if (map[y][x] === 0) lantaiAman.push({ x: x, y: y });
    }
  }

  lantaiAman.sort(() => Math.random() - 0.5);

  for (let i = 0; i < 30; i++) {
    if (lantaiAman.length > 0) {
      let pos = lantaiAman.pop();
      map[pos.y][pos.x] = 3;
    }
  }

  let jumlahMusuh = 25 + lvl * 5;
  for (let i = 0; i < jumlahMusuh; i++) {
    if (lantaiAman.length > 0) {
      let pos = lantaiAman.pop();
      let eradius = 14;
      let ehp = 40;
      let espd = 70;

      if (lvl === 1) {
        eradius = 16;
        ehp = 30;
        espd = 60;
      } else if (lvl === 2) {
        eradius = 14;
        ehp = 50;
        espd = 90;
      } else if (lvl === 3) {
        eradius = 22;
        ehp = 120;
        espd = 40;
      } else if (lvl === 4) {
        eradius = 18;
        ehp = 100;
        espd = 80;
      }

      ents.push({
        type: "ENEMY",
        x: pos.x * TILE + TILE / 2,
        y: pos.y * TILE + TILE / 2,
        hp: ehp,
        max: ehp,
        rad: eradius,
        speed: espd,
        hitT: 0,
        isBoss: false,
        eType: lvl,
        dead: false,
      });
    }
  }

  for (let i = 0; i < 6; i++) {
    if (lantaiAman.length > 0) {
      let pos = lantaiAman.pop();
      ents.push({
        type: "CHEST",
        x: pos.x * TILE + TILE / 2,
        y: pos.y * TILE + TILE / 2,
        open: false,
        rad: 20,
      });
    }
  }

  updateHUD();
}

function spawnBoss() {
  let bossNames = ["", "RAJA SLIME", "RAJA GOBLIN", "RAJA OGRE", "HEXATOR"];

  let bossName = bossNames[p.area];
  let bossText = "";

  if (p.area === 1) {
    bossText = `Beraninya kau masuk ke Hutan Biner! Akan kutelan kau bulat-bulat, ${p.name}!`;
  } else if (p.area === 2) {
    bossText = "Gua Es Oktal ini akan menjadi kuburan bekumu. Matilah!";
  } else if (p.area === 3) {
    bossText = "RAAAWRR! Gurun Desimal takkan melepaskanmu hidup-hidup!";
  } else if (p.area === 4) {
    bossText = `Hahaha! Samurai bodoh ${p.name}! Sihir Heksadesimal adalah yang tertinggi! Kau akan bertekuk lutut!`;
  }

  let bossDialog = [
    { speaker: bossName, text: bossText },
    {
      speaker: p.name,
      text: "Serahkan pecahan ilmu itu sekarang! Pedang katanaku akan membelahmu!",
    },
  ];

  startDialog(bossDialog, () => {
    let bx = (MW - 4) * TILE + TILE / 2;
    let by = (MH - 4) * TILE + TILE / 2;
    let bHp = 500 * p.area;

    ents.push({
      type: "ENEMY",
      x: bx,
      y: by,
      hp: bHp,
      max: bHp,
      rad: 32,
      speed: 60 + p.area * 15,
      hitT: 0,
      isBoss: true,
      eType: p.area,
      dead: false,
    });

    for (let i = 0; i < 60; i++) spawnParticles(bx, by, "#ff0000", 1);
    showNotif(`⚠ ${bossName} TELAH MUNCUL! IKUTI ARAH PANAH MERAH! ⚠`);
  });
}

function genSoal(lvl) {
  let n = Math.floor(Math.random() * (15 + lvl * 15)) + 10;
  let r = Math.random();
  let tipe, soal, jwb, step;

  if (lvl === 1) {
    if (r < 0.5) {
      tipe = "d2b";
      soal = `Ubah Bilangan Desimal <b>${n}</b> ke Biner:`;
      jwb = n.toString(2);
      step = `Untuk mengubah ${n} ke biner, bagi terus dengan 2 dan catat sisanya dari bawah ke atas.<br>Hasil: ${jwb}`;
    } else {
      let b = n.toString(2);
      tipe = "b2d";
      soal = `Ubah Biner <b>${b}</b> ke Desimal:`;
      jwb = n.toString(10);
      step = `Setiap digit biner dikali dengan 2 pangkat posisinya (dari kanan ke kiri).<br>Jumlahkan semuanya = ${jwb}`;
    }
  } else if (lvl === 2) {
    if (r < 0.5) {
      tipe = "d2o";
      soal = `Ubah Desimal <b>${n}</b> ke Oktal:`;
      jwb = n.toString(8);
      step = `Bagi ${n} dengan 8 terus menerus, catat sisa baginya dari bawah.<br>Hasil akhir: ${jwb}`;
    } else {
      let b = n.toString(2);
      tipe = "b2o";
      soal = `Ubah Biner <b>${b}</b> ke Oktal:`;
      jwb = n.toString(8);
      step = `Kelompokkan biner ${b} menjadi 3 digit dari kanan, lalu ubah tiap kelompok ke desimal.<br>Hasil: ${jwb}`;
    }
  } else if (lvl === 3) {
    if (r < 0.3) {
      let o = n.toString(8);
      tipe = "o2d";
      soal = `Ubah Oktal <b>${o}</b> ke Desimal:`;
      jwb = n.toString(10);
      step = `Setiap digit dikali 8 pangkat posisinya.<br>Jumlahkan = ${jwb}`;
    } else if (r < 0.6) {
      let h = n.toString(16).toUpperCase();
      tipe = "h2d";
      soal = `Ubah Heksadesimal <b>${h}</b> ke Desimal:`;
      jwb = n.toString(10);
      step = `Setiap digit dikali 16 pangkat posisinya.<br>Jumlahkan = ${jwb}`;
    } else {
      let b = n.toString(2);
      tipe = "b2d";
      soal = `Ubah Biner <b>${b}</b> ke Desimal:`;
      jwb = n.toString(10);
      step = `Setiap digit biner dikali 2 pangkat posisinya.<br>Hasil: ${jwb}`;
    }
  } else {
    if (r < 0.3) {
      tipe = "d2h";
      soal = `Ubah Desimal <b>${n}</b> ke Heksadesimal:`;
      jwb = n.toString(16).toUpperCase();
      step = `Bagi ${n} dengan 16, ingat sisa baginya (10=A, 11=B, dst).<br>Hasil: ${jwb}`;
    } else if (r < 0.6) {
      let h = n.toString(16).toUpperCase();
      tipe = "h2b";
      soal = `Ubah Heksadesimal <b>${h}</b> ke Biner:`;
      jwb = n.toString(2);
      step = `Pecah setiap digit Heksadesimal menjadi 4 digit Biner.<br>Gabungkan hasilnya = ${jwb}`;
    } else {
      let b = n.toString(2).padStart(8, "0");
      tipe = "b2h";
      soal = `Ubah Biner <b>${b}</b> ke Heksadesimal:`;
      jwb = parseInt(b, 2).toString(16).toUpperCase();
      step = `Kelompokkan biner menjadi 4 digit dari kanan, ubah tiap kelompok ke heksa.<br>Hasil: ${jwb}`;
    }
  }

  let options = [jwb];
  while (options.length < 4) {
    let wrong = "";
    if (tipe.endsWith("b")) {
      wrong = (n + Math.floor(Math.random() * 10 - 5)).toString(2);
    } else if (tipe.endsWith("o")) {
      wrong = (n + Math.floor(Math.random() * 10 - 5)).toString(8);
    } else if (tipe.endsWith("h")) {
      wrong = (n + Math.floor(Math.random() * 10 - 5))
        .toString(16)
        .toUpperCase();
    } else {
      wrong = (n + Math.floor(Math.random() * 10 - 5)).toString(10);
    }

    if (!options.includes(wrong) && !wrong.includes("-")) {
      options.push(wrong);
    }
  }
  options.sort(() => Math.random() - 0.5);

  return { q: soal, opts: options, a: jwb, exp: step };
}

let quizTarget = null,
  currentQuiz = null;

function cekPeti() {
  for (let e of ents) {
    if (e.type === "CHEST" && !e.open) {
      let dx = e.x - p.x;
      let dy = e.y - p.y;

      if (Math.sqrt(dx * dx + dy * dy) < 60) {
        state = "QUIZ";
        quizTarget = e;
        currentQuiz = genSoal(p.area);

        document.getElementById("quiz-question").innerHTML = currentQuiz.q;

        let optsHTML = "";
        let labels = ["A", "B", "C", "D"];

        currentQuiz.opts.forEach((opt, i) => {
          optsHTML += `<button class="pg-btn" onclick="pilihJawaban('${opt}')">${labels[i]}. ${opt}</button>`;
        });

        document.getElementById("q-options").innerHTML = optsHTML;
        document.getElementById("q-options").style.display = "grid";
        document.getElementById("quiz-explanation").style.display = "none";
        document.getElementById("m-quiz").classList.add("active");
        break;
      }
    }
  }
}

function pilihJawaban(jwb) {
  document.getElementById("q-options").style.display = "none";
  let resText = document.getElementById("q-result-text");

  if (jwb === currentQuiz.a) {
    resText.innerHTML =
      '<span class="text-benar">✔ BENAR! Analisismu Tepat!</span>';
    quizTarget.open = true;
    p.xp += 60;
    chestsOpened++;
    skorBenar++;
    totalSoalTerjawab++;

    spawnParticles(quizTarget.x, quizTarget.y, "#ffd700", 30);
    spawnText(quizTarget.x, quizTarget.y, "Terbuka!", "#ffd700");
    cekLevelUp();

    // PEMANGGILAN BOS DIHAPUS DARI SINI AGAR TIDAK BENTROK UI
  } else {
    resText.innerHTML = `<span class="text-salah">✘ SALAH! Jawaban yang benar adalah: ${currentQuiz.a}</span>`;
    p.hp -= 20;
    skorSalah++;
    totalSoalTerjawab++;

    spawnText(p.x, p.y, "-20 HP", "#ff4444");
    if (p.hp <= 0) setTimeout(gameOver, 100);
  }

  document.getElementById("q-exp-text").innerHTML = currentQuiz.exp;
  document.getElementById("quiz-explanation").style.display = "block";
  updateHUD();
}

// BOS BARU DIPANGGIL SAAT LAYAR KUIS DITUTUP
function tutupPenjelasan() {
  document.getElementById("m-quiz").classList.remove("active");

  if (chestsOpened === 6) {
    chestsOpened++; // Naikkan jadi 7 agar bos tidak muncul dobel
    spawnBoss();
  } else {
    state = "PLAY";
  }
}

function doAttack() {
  if (p.cdAtk > 0) return;
  p.cdAtk = p.atkMax;
  cekPeti();

  let ax = p.x + p.dirX * 40;
  let ay = p.y + p.dirY * 40;

  spawnParticles(ax, ay, "#e8f0ff", 10);

  for (let e of ents) {
    if (e.type === "ENEMY" && !e.dead) {
      let dx = e.x - ax;
      let dy = e.y - ay;
      if (Math.sqrt(dx * dx + dy * dy) < 55) {
        hitEnemy(e, 35);
      }
    }
  }
}

function doSkill1() {
  if (p.cdS1 > 0) return;
  p.cdS1 = p.s1Max;
  p.isDashing = true;

  setTimeout(() => (p.isDashing = false), 300);
  spawnParticles(p.x, p.y, "#ffaa00", 30);

  for (let e of ents) {
    if (e.type === "ENEMY" && !e.dead) {
      let dx = e.x - p.x;
      let dy = e.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        hitEnemy(e, 50);
      }
    }
  }
}

function doSkill2() {
  if (p.cdS2 > 0) return;
  p.cdS2 = p.s2Max;
  p.hp = Math.min(p.maxHp, p.hp + 60);

  spawnParticles(p.x, p.y, "#40e080", 25);
  spawnText(p.x, p.y - 20, "+60 Heal", "#40e080");
  updateHUD();
}

function doSkill3() {
  if (p.cdS3 > 0) return;
  p.cdS3 = p.s3Max;

  let vx = p.dirX * 400;
  let vy = p.dirY * 400;

  if (vx === 0 && vy === 0) {
    vx = p.lastDirX * 400;
    vy = 0;
  }

  projectiles.push({
    x: p.x,
    y: p.y,
    vx: vx,
    vy: vy,
    life: 1.5,
    rad: 20,
  });

  spawnText(p.x, p.y - 20, "WAVE!", "#9966ff");
}

function hitEnemy(e, dmg) {
  if (e.dead) return;

  e.hp -= dmg;
  e.hitT = 0.2;

  spawnText(e.x, e.y - 20, dmg, "#ffaa00");
  spawnParticles(e.x, e.y, "#ff4444", 10);

  if (e.hp <= 0) {
    e.dead = true;
    p.xp += e.isBoss ? 300 : 40;
    p.maxHp += 1;
    p.hp = Math.min(p.maxHp, p.hp + 5);

    cekLevelUp();
    spawnText(e.x, e.y, "+XP", "#40e080");

    if (e.isBoss) {
      let ptX = Math.floor(e.x / TILE);
      let ptY = Math.floor(e.y / TILE);
      map[ptY][ptX] = 2; // Portal terbuka
      // PENGECEKAN AREA DITAMBAHKAN DI SINI:
  if (p.area === 4) {
    // Jika di Area 4 (Hexator)
    showNotif("HEXATOR DIKALAHKAN! PORTAL KEMBALI KE KERAJAAN TELAH TERBUKA!");
  } else {
    // Jika di Area 1, 2, atau 3
    showNotif("BOS DIKALAHKAN! PORTAL KE AREA SELANJUTNYA TELAH TERBUKA DI TEMPAT BOS MATI!");
  }
   }
  }
}

function cekLevelUp() {
  if (p.xp >= p.maxXp) {
    p.xp -= p.maxXp;
    p.level++;
    p.maxXp = Math.floor(p.maxXp * 1.5);
    p.maxHp += 20;
    p.hp = p.maxHp;

    spawnText(p.x, p.y - 40, "LEVEL UP!", "#ffd700");
    spawnParticles(p.x, p.y, "#00ffaa", 40);
  }
  updateHUD();
}

function isSolid(x, y) {
  let tx = Math.floor(x / TILE);
  let ty = Math.floor(y / TILE);

  if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) return true;
  return map[ty][tx] === 1 || map[ty][tx] === 3;
}

function moveObj(obj, dx, dy) {
  if (dx !== 0) {
    if (!isSolid(obj.x + dx + Math.sign(dx) * obj.rad, obj.y)) obj.x += dx;
  }
  if (dy !== 0) {
    if (!isSolid(obj.x, obj.y + dy + Math.sign(dy) * obj.rad)) obj.y += dy;
  }
}

let lastTime = performance.now();

function loop(ts) {
  let dt = (ts - lastTime) / 1000;
  lastTime = ts;

  if (dt > 0.1) dt = 0.1;

  if (state === "PLAY") {
    updateGame(dt);
  }

  if (state === "PLAY" || state === "DIALOGUE") {
    drawGame();
  }

  requestAnimationFrame(loop);
}

function updateGame(dt) {
  if (p.cdAtk > 0) p.cdAtk -= dt;
  document.getElementById("cd-atk").style.height =
    (p.cdAtk / p.atkMax) * 100 + "%";

  if (p.cdS1 > 0) p.cdS1 -= dt;
  document.getElementById("cd-s1").style.height =
    (p.cdS1 / p.s1Max) * 100 + "%";

  if (p.cdS2 > 0) p.cdS2 -= dt;
  document.getElementById("cd-s2").style.height =
    (p.cdS2 / p.s2Max) * 100 + "%";

  if (p.cdS3 > 0) p.cdS3 -= dt;
  document.getElementById("cd-s3").style.height =
    (p.cdS3 / p.s3Max) * 100 + "%";

  let ix = 0;
  let iy = 0;

  if (keys["KeyW"] || keys["ArrowUp"]) iy = -1;
  if (keys["KeyS"] || keys["ArrowDown"]) iy = 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) ix = -1;
  if (keys["KeyD"] || keys["ArrowRight"]) ix = 1;

  if (joy.active) {
    ix = joy.x;
    iy = joy.y;
  }

  let len = Math.sqrt(ix * ix + iy * iy);
  if (len > 0) {
    ix /= len;
    iy /= len;
    p.dirX = ix;
    p.dirY = iy;

    if (Math.abs(ix) > Math.abs(iy)) p.lastDirX = Math.sign(ix);

    p.walkTimer += dt * 12;
    if (p.walkTimer > 1) {
      p.walkTimer = 0;
      p.walkFrame = (p.walkFrame + 1) % 2;
    }
  } else {
    p.walkFrame = 0;
  }

  let currSpeed = p.isDashing ? p.speed * 3.5 : p.speed;
  moveObj(p, ix * currSpeed * dt, iy * currSpeed * dt);

  let ptX = Math.floor(p.x / TILE);
  let ptY = Math.floor(p.y / TILE);

  // CEK PORTAL DAN ALUR CERITA BARU
  if (map[ptY] && map[ptY][ptX] === 2) {
    p.area++;

  // === KODE BARU UNTUK ENDING ===
  if (p.area > 4) {
    p.area = 4; // Tahan di area 4 agar tidak error saat render map
    map[ptY][ptX] = 0; // Hapus portal agar tidak tertrigger berkali-kali

    // Hentikan pergerakan pemain secara paksa
    p.dirX = 0;
    p.dirY = 0;
    keys["KeyW"] = keys["KeyS"] = keys["KeyA"] = keys["KeyD"] = false;
    keys["ArrowUp"] = keys["ArrowDown"] = keys["ArrowLeft"] = keys["ArrowRight"] = false;
    if (typeof joy !== 'undefined') joy.active = false;

    // Siapkan dialog penutup cerita
    let epilogueDialog = [
      {
        speaker: "RAJA RADIX",
        text: "Luar biasa, Pahlawan " + p.name + "! Kau berhasil mengalahkan Hexator dan membebaskan ke-4 dimensi bilangan!"
      },
      {
        speaker: p.name,
        text: "Sesuai janjiku, keseimbangan sistem bilangan kini telah kembali utuh, Yang Mulia."
      },
      {
        speaker: "RAJA RADIX",
        text: "Kerajaan Radix berhutang budi padamu. Namamu akan terukir abadi sebagai Legenda Jelajah Bilangan!"
      }
    ];

    // Jalankan dialog, lalu munculkan layar kemenangan saat dialog selesai
    startDialog(epilogueDialog, () => {
      document.getElementById("win-benar").innerText = skorBenar;
      document.getElementById("win-salah").innerText = skorSalah;

      // Sembunyikan HUD dan Kontrol Virtual saat layar menang muncul
      document.getElementById("hud").classList.remove("active");
      document.getElementById("vctrl").style.display = "none";

      state = "WIN";
      document.getElementById("m-win").classList.add("active");
    });

    return; 
  }

    generateMap(p.area);
    p.x = TILE * 2.5;
    p.y = TILE * 2.5;
    p.hp = p.maxHp;

    let storyDialog = [];
    if (p.area === 2) {
      storyDialog = [
        {
          speaker: p.name,
          text: "Hawa dingin ini menusuk tulang... Ini pasti Gua Es Oktal (Basis 8).",
        },
        {
          speaker: "RAJA RADIX",
          text: "Benar! Monster di sini lebih agresif. Terus selesaikan soal untuk memancing penjaga areanya keluar!",
        },
      ];
    } else if (p.area === 3) {
      storyDialog = [
        {
          speaker: p.name,
          text: "Panas sekali... Gurun Desimal (Basis 10) ini benar-benar menguras tenaga.",
        },
        {
          speaker: "RAJA RADIX",
          text: "Jangan menyerah sekarang! Peti ilmu di gurun ini berisi ingatan bilangan yang paling sering digunakan manusia.",
        },
      ];
    } else if (p.area === 4) {
      storyDialog = [
        {
          speaker: p.name,
          text: "Aura sihir gelapnya sangat pekat... Kawah Heksadesimal (Basis 16). Aku bisa merasakannya.",
        },
        {
          speaker: "RAJA RADIX",
          text: "Ini adalah sarang Hexator! Angka dan huruf bercampur di dimensi ini. Hati-hati, Pahlawan, ini akan menjadi pertarungan terakhirmu!",
        },
      ];
    }

    if (storyDialog.length > 0) {
      startDialog(storyDialog, () => {});
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    let pr = projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    spawnParticles(pr.x, pr.y, "#9966ff", 2);

    for (let e of ents) {
      if (e.type === "ENEMY" && !e.dead) {
        let dx = e.x - pr.x;
        let dy = e.y - pr.y;
        if (Math.sqrt(dx * dx + dy * dy) < pr.rad + e.rad) {
          hitEnemy(e, 80);
          pr.life = 0;
        }
      }
    }
    if (isSolid(pr.x, pr.y)) pr.life = 0;
    if (pr.life <= 0) projectiles.splice(i, 1);
  }

  for (let e of ents) {
    if (e.type === "ENEMY" && !e.dead) {
      if (e.hitT > 0) e.hitT -= dt;
      let dx = p.x - e.x;
      let dy = p.y - e.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let aggro = e.isBoss ? 500 : 350;

      if (dist < aggro && dist > e.rad + p.rad) {
        moveObj(e, (dx / dist) * e.speed * dt, (dy / dist) * e.speed * dt);
      } else if (dist <= e.rad + p.rad && e.hitT <= 0) {
        let edmg = e.isBoss ? 30 : 15;
        p.hp -= edmg;
        e.hitT = 1.0;

        spawnText(p.x, p.y, `-${edmg} HP`, "#ff4444");
        spawnParticles(p.x, p.y, "#ff0000", 10);

        if (p.hp <= 0) gameOver();
      }
    }
  }

  particles.forEach((pt) => {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt * 2;
  });
  particles = particles.filter((pt) => pt.life > 0);

  floatTexts.forEach((ft) => {
    ft.y -= 30 * dt;
    ft.life -= dt;
  });
  floatTexts = floatTexts.filter((ft) => ft.life > 0);

  cam.x += (p.x - WW / 2 - cam.x) * 5 * dt;
  cam.y += (p.y - WH / 2 - cam.y) * 5 * dt;

  updateHUD();
}

function drawGame() {
  let th = THEMES[p.area];
  ctx.clearRect(0, 0, WW, WH);
  ctx.save();
  ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

  let startC = Math.max(0, Math.floor(cam.x / TILE));
  let startR = Math.max(0, Math.floor(cam.y / TILE));
  let endC = Math.min(MW, Math.floor((cam.x + WW) / TILE) + 1);
  let endR = Math.min(MH, Math.floor((cam.y + WH) / TILE) + 1);

  let renderList = [
    ...ents.filter((e) => !e.dead),
    { type: "PLAYER", x: p.x, y: p.y },
  ];

  for (let y = startR; y < endR; y++) {
    for (let x = startC; x < endC; x++) {
      let t = map[y][x];

      if (t === 1) {
        ctx.fillStyle = th.wall;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = th.top;
        ctx.fillRect(x * TILE, y * TILE, TILE, 10);
      } else if (t === 0) {
        ctx.fillStyle = th.floor;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      } else if (t === 2) {
        ctx.fillStyle = th.floor;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = "rgba(150, 60, 255, 0.5)";
        ctx.beginPath();
        ctx.arc(
          x * TILE + 32,
          y * TILE + 32,
          24 + Math.sin(performance.now() * 0.005) * 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x * TILE + 32, y * TILE + 32, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (t === 3) {
        ctx.fillStyle = th.floor;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        renderList.push({
          type: "DECO",
          x: x * TILE + TILE / 2,
          y: y * TILE + TILE / 2,
        });
      }

      ctx.strokeStyle = "rgba(255,255,255,0.015)";
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  renderList.sort((a, b) => a.y - b.y);

  for (let obj of renderList) {
    if (obj.type === "PLAYER") {
      ctx.save();
      ctx.translate(p.x, p.y);

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      let walkOffset = p.walkFrame === 0 ? 0 : 4;
      if (p.lastDirX < 0) ctx.scale(-1, 1);

      // DESAIN SAMURAI ZORO - INDO HEADBAND

      // Kaki
      ctx.fillStyle = "#222";
      ctx.fillRect(-6, 6, 5, 8 - walkOffset);
      ctx.fillRect(1, 6, 5, 4 + walkOffset);

      // Sandal
      ctx.fillStyle = "#da8";
      ctx.fillRect(-6, 14 - walkOffset, 5, 2);
      ctx.fillRect(1, 10 + walkOffset, 5, 2);

      // Baju Kimono (Hijau Zoro)
      ctx.fillStyle = "#1e591e";
      ctx.fillRect(-7, -4, 14, 12);

      // Sabuk
      ctx.fillStyle = "#8B0000";
      ctx.fillRect(-7, 4, 14, 3);

      // Rambut Belakang
      ctx.fillStyle = "#111";
      ctx.fillRect(-6, -10, 12, 18);

      // Wajah
      ctx.fillStyle = "#ffccaa";
      ctx.beginPath();
      ctx.arc(0, -9, 7, 0, Math.PI * 2);
      ctx.fill();

      // Rambut Atas
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(0, -12, 7, Math.PI, 0);
      ctx.fill();

      // Ikat Kepala Bendera Indonesia
      ctx.fillStyle = "#f00";
      ctx.fillRect(-7, -15, 14, 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-7, -13, 14, 2);

      // Mata
      ctx.fillStyle = "#000";
      ctx.fillRect(-4, -10, 2, 2);
      ctx.fillRect(2, -10, 2, 2);

      // Katana Mulut
      ctx.fillStyle = "#ddd";
      ctx.fillRect(4, -9, 10, 2);
      ctx.fillStyle = "#111";
      ctx.fillRect(-4, -9, 8, 2);

      // Katana Tangan
      ctx.save();
      if (p.cdAtk > p.atkMax - 0.1) {
        ctx.translate(10, -5);
        ctx.rotate(Math.PI / 3);
      } else {
        ctx.translate(6, 4);
        ctx.rotate(-Math.PI / 4);
      }

      for (let i = 0; i < 2; i++) {
        let yOffset = i * 5;
        ctx.fillStyle = "#111";
        ctx.fillRect(-1.5, 0 + yOffset, 3, 10);

        ctx.fillStyle = "#da3";
        ctx.fillRect(-3, -2 + yOffset, 6, 2);

        ctx.fillStyle = "#ddd";
        ctx.beginPath();
        ctx.moveTo(-1.5, -2 + yOffset);
        ctx.lineTo(1.5, -2 + yOffset);
        ctx.quadraticCurveTo(4, -15 + yOffset, 0, -28 + yOffset);
        ctx.quadraticCurveTo(-1.5, -15 + yOffset, -1.5, -2 + yOffset);
        ctx.fill();
      }
      ctx.restore();

      ctx.scale(p.lastDirX < 0 ? -1 : 1, 1);
      ctx.fillStyle = "#fff";
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.name, 0, -26);

      ctx.restore();
    } else if (obj.type === "CHEST") {
      ctx.fillStyle = obj.open ? "#444" : "#aa7722";
      ctx.fillRect(obj.x - 20, obj.y - 15, 40, 30);

      ctx.fillStyle = "#222";
      ctx.fillRect(obj.x - 20, obj.y - 5, 40, 4);

      if (!obj.open) {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(obj.x - 6, obj.y - 8, 12, 10);
      }
    } else if (obj.type === "DECO") {
      ctx.save();
      ctx.translate(obj.x, obj.y);

      if (p.area === 1) {
        ctx.fillStyle = "#4a2e00";
        ctx.fillRect(-4, 0, 8, 16);
        ctx.fillStyle = "#1e591e";
        ctx.beginPath();
        ctx.arc(0, -6, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2b7a2b";
        ctx.beginPath();
        ctx.arc(-6, -12, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.area === 2) {
        ctx.fillStyle = "#88ddff";
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(12, 16);
        ctx.lineTo(-12, 16);
        ctx.fill();
        ctx.fillStyle = "#ccf0ff";
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(0, 16);
        ctx.lineTo(-12, 16);
        ctx.fill();
      } else if (p.area === 3) {
        ctx.fillStyle = "#2b7a2b";
        ctx.fillRect(-6, -24, 12, 40);
        ctx.fillRect(-18, -10, 12, 8);
        ctx.fillRect(-18, -20, 8, 10);
        ctx.fillRect(6, -2, 12, 8);
        ctx.fillRect(14, -12, 8, 10);
      } else if (p.area === 4) {
        ctx.fillStyle = "#222";
        ctx.fillRect(-16, -12, 32, 28);
        ctx.fillStyle = "#111";
        ctx.fillRect(-10, -18, 20, 6);
        ctx.fillStyle = "#ff4400";
        ctx.fillRect(-6, -6, 12, 2);
        ctx.fillRect(4, 4, 8, 2);
      }
      ctx.restore();
    } else if (obj.type === "ENEMY") {
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(0, obj.rad, obj.rad, obj.rad / 3, 0, 0, Math.PI * 2);
      ctx.fill();

      let bounce = Math.sin(performance.now() * 0.01 + obj.x) * 2;
      ctx.translate(0, bounce);

      if (obj.isBoss) ctx.scale(1.8, 1.8);
      let hitWhite = obj.hitT > 0;

      if (obj.eType === 1) {
        ctx.fillStyle = hitWhite ? "#fff" : obj.isBoss ? "#00ccaa" : "#00ff88";
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI, 0);
        ctx.lineTo(14, 8);
        ctx.lineTo(-14, 8);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);
      } else if (obj.eType === 2) {
        ctx.fillStyle = hitWhite ? "#fff" : "#44cc44";
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6, -12);
        ctx.lineTo(-16, -10);
        ctx.lineTo(-8, -6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, -12);
        ctx.lineTo(16, -10);
        ctx.lineTo(8, -6);
        ctx.fill();
        ctx.fillStyle = "#775533";
        ctx.fillRect(-6, 0, 12, 10);
        ctx.fillStyle = "#000";
        ctx.fillRect(-4, -6, 3, 3);
        ctx.fillRect(1, -6, 3, 3);
        ctx.fillStyle = "#885522";
        ctx.fillRect(8, -4, 4, 16);
      } else if (obj.eType === 3) {
        ctx.fillStyle = hitWhite ? "#fff" : "#cc8855";
        ctx.fillRect(-14, -16, 28, 22);
        ctx.beginPath();
        ctx.arc(0, -20, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#332211";
        ctx.fillRect(-10, 6, 20, 10);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(0, -20, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f00";
        ctx.beginPath();
        ctx.arc(0, -20, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#eee";
        ctx.beginPath();
        ctx.moveTo(-6, -28);
        ctx.lineTo(-2, -24);
        ctx.lineTo(-6, -20);
        ctx.fill();
      } else if (obj.eType === 4) {
        ctx.fillStyle = hitWhite ? "#fff" : "#dd2222";
        ctx.fillRect(-10, -14, 20, 26);
        ctx.beginPath();
        ctx.arc(0, -18, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.moveTo(-6, -24);
        ctx.lineTo(-14, -30);
        ctx.lineTo(-10, -20);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, -24);
        ctx.lineTo(14, -30);
        ctx.lineTo(10, -20);
        ctx.fill();
        ctx.fillStyle = "#880000";
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(-24, -20);
        ctx.lineTo(-20, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -10);
        ctx.lineTo(24, -20);
        ctx.lineTo(20, 0);
        ctx.fill();
        ctx.fillStyle = "#ffee00";
        ctx.fillRect(-6, -20, 4, 4);
        ctx.fillRect(2, -20, 4, 4);
      }

      if (obj.isBoss) {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(-10, -32, 20, 6);
        ctx.beginPath();
        ctx.moveTo(-12, -36);
        ctx.lineTo(-8, -32);
        ctx.lineTo(-4, -36);
        ctx.lineTo(0, -32);
        ctx.lineTo(4, -36);
        ctx.lineTo(8, -32);
        ctx.lineTo(12, -36);
        ctx.lineTo(10, -32);
        ctx.lineTo(-10, -32);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = "#000";
      ctx.fillRect(obj.x - 15, obj.y - obj.rad - 10, 30, 4);
      ctx.fillStyle = "#f00";
      ctx.fillRect(
        obj.x - 15,
        obj.y - obj.rad - 10,
        30 * (obj.hp / obj.max),
        4,
      );
    }
  }

  // --- KOMPAS PENUNJUK PETI / BOS ---
  let targetEnt = null;
  let minDist = Infinity;
  let isBossTarget = false;

  for (let e of ents) {
    if (e.type === "ENEMY" && e.isBoss && !e.dead) {
      targetEnt = e;
      isBossTarget = true;
      break;
    }

    if (!isBossTarget && e.type === "CHEST" && !e.open) {
      let dx = e.x - p.x;
      let dy = e.y - p.y;
      let dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        targetEnt = e;
      }
    }
  }

  if (targetEnt) {
    let angle = Math.atan2(targetEnt.y - p.y, targetEnt.x - p.x);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    let pulse = Math.sin(performance.now() * 0.005) * 5;
    ctx.translate(45 + pulse, 0);

    if (isBossTarget) {
      ctx.fillStyle = "rgba(255, 50, 50, 0.9)";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
    }

    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-6, -7);
    ctx.fill();
    ctx.restore();
  }

  projectiles.forEach((pr) => {
    ctx.fillStyle = "#9966ff";
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.rad / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  particles.forEach((pt) => {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, 4, 4);
  });

  ctx.globalAlpha = 1;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.textAlign = "center";

  floatTexts.forEach((ft) => {
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = Math.min(1, ft.life);
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

function spawnParticles(x, y, col, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 1,
      color: col,
    });
  }
}

function spawnText(x, y, txt, col) {
  floatTexts.push({ x: x, y: y, text: txt, color: col, life: 1.5 });
}

function updateHUD() {
  document.getElementById("t-hp").innerText = Math.floor(p.hp);
  document.getElementById("t-maxhp").innerText = p.maxHp;
  document.getElementById("b-hp").style.width =
    Math.max(0, (p.hp / p.maxHp) * 100) + "%";

  document.getElementById("t-xp").innerText = Math.floor(p.xp);
  document.getElementById("b-xp").style.width =
    Math.max(0, (p.xp / p.maxXp) * 100) + "%";

  document.getElementById("t-area").innerText = p.area + "/4";

  document.getElementById("t-peti").innerText =
    Math.min(chestsOpened, 6) + "/6";
}

function showMenu(id) {
  bukaLayarPenuh();
  document
    .querySelectorAll(".menu-screen")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(id).classList.add("active");
  document.getElementById("hud").classList.remove("active");
  document.getElementById("vctrl").style.display = "none";

  state = "MENU";
}

function gameOver() {
  state = "GO";
  document.getElementById("go-lvl").innerText = THEMES[p.area].name;
  document.getElementById("go-benar").innerText = skorBenar;
  document.getElementById("go-salah").innerText = skorSalah;

  showMenu("m-go");
}
function tampilkanMateri() {
  bukaLayarPenuh();
  // Menyembunyikan semua layar menu yang sedang aktif
  document.querySelectorAll(".menu-screen").forEach((el) => el.classList.remove("active"));

  // Menampilkan layar materi yang baru kita buat di HTML
  document.getElementById("m-materi").classList.add("active");

  // Mengubah status game agar sistem tahu kita sedang berada di menu materi
  state = "MATERI";
}
function tampilkanProfil() {
  bukaLayarPenuh();
  // Menyembunyikan semua layar menu aktif
  document.querySelectorAll(".menu-screen").forEach((el) => el.classList.remove("active"));

  // Menampilkan layar profil developer yang baru kita buat
  document.getElementById("m-profil").classList.add("active");

  // Mengubah status sistem game
  state = "PROFIL";
}
requestAnimationFrame(loop);

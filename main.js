/* ===========
   GameState
   =========== */
const GameState = {
  week: 1,
  funds: 100000,
  totalSales: 0,
  weekSales: 0,
  rankScore: 0, // 内部ポイント
  rank: "平民",
  rep: 0,
  pop: 0,
  ad: "none",
  adCost: 0,
  adEffect: 0,
  casts: [],
  shifts: {}, // {castId: true/false} 出勤/休み
  waves: [],  // 今週の来客波生成結果
  waveCursor: 0,
  assignments: {}, // {waveIndex: {customerIndex: castId}}
  lastReport: null,
  ended: false,
  pendingRare: [],
  perCastSales: [],
  dismissed: {},
  troubleResolved: false,
  troubleSuccess: false,
  trainCount: 0
};

/* ===========
   BGM管理
   =========== */
const mainBGM = new Audio("sounds/bgm.mp3");
mainBGM.loop = true;
mainBGM.volume = 0.2;

function startBGM() {
  mainBGM.play().catch(error => {
    console.log("BGMの再生に失敗しました。ユーザー操作で再生を開始します。:", error);
  });
}

window.addEventListener('click', () => {
  startBGM();
}, { once: true });

// 初期キャスト (jpg extensions)
const initialCasts = [
  {
    id: "c1", name: "野々花", img: "img/syoki/nonoka.jpg",
    look: "カジュアル", nature: "明るい",
    aisou: 60, kaiwa: 50, attentiveness: 65,
    fati: 0, fatiMax: 100, stress: 0, stressMax: 120,
    cond: "良好", lv: 1, exp: 0, salary: 10000, isInitial: true, joinweek: 1
  },
  {
    id: "c2", name: "モカ", img: "img/syoki/moka.jpg",
    look: "クール", nature: "大人しい",
    aisou: 55, kaiwa: 65, attentiveness: 50,
    fati: 0, fatiMax: 100, stress: 0, stressMax: 120,
    cond: "良好", lv: 1, exp: 0, salary: 10000, isInitial: true, joinweek: 1
  },
  {
    id: "c3", name: "ゆずみ", img: "img/syoki/yuzumi.jpg",
    look: "ビューティー", nature: "穏やか",
    aisou: 50, kaiwa: 55, attentiveness: 60,
    fati: 0, fatiMax: 100, stress: 0, stressMax: 120,
    cond: "良好", lv: 1, exp: 0, salary: 10000, isInitial: true, joinweek: 1
  }
];

// レアキャスト (mapping to the character names provided in rare folder)
const RARE = {
  "カレン": { id: "rare_karen", name: "カレン", img: "img/rare/karen.jpg", aisou: 90, kaiwa: 75, attentiveness: 80, fati: 0, fatiMax: 120, stress: 0, stressMax: 120, lv: 5, exp: 0, salary: 18000, isInitial: false, joinWeek: 1 },
  "ユズ": { id: "rare_yuzu", name: "ユズ", img: "img/rare/yuzu.jpg", aisou: 80, kaiwa: 90, attentiveness: 75, fati: 0, fatiMax: 120, stress: 0, stressMax: 120, lv: 5, exp: 0, salary: 18000, isInitial: false, joinWeek: 1 },
  "レイナ": { id: "rare_reina", name: "レイナ", img: "img/rare/reina.jpg", aisou: 85, kaiwa: 80, attentiveness: 90, fati: 0, fatiMax: 120, stress: 0, stressMax: 120, lv: 5, exp: 0, salary: 18000, isInitial: false, joinWeek: 1 },
  "ミナ": { id: "rare_mina", name: "ミナ", img: "img/rare/mina.jpg", aisou: 75, kaiwa: 85, attentiveness: 80, fati: 0, fatiMax: 120, stress: 0, stressMax: 120, lv: 5, exp: 0, salary: 18000, isInitial: false, joinWeek: 1 },
  "アオイ": { id: "rare_aoi", name: "アオイ", img: "img/rare/aoi.jpg", aisou: 80, kaiwa: 80, attentiveness: 85, fati: 0, fatiMax: 120, stress: 0, stressMax: 120, lv: 5, exp: 0, salary: 18000, isInitial: false, joinWeek: 1 }
};

// ランク段階 (仕様書通り)
const RankSteps = ["路地裏", "大衆店", "人気店", "名店", "プレステージ", "伝説"];

/* ===========
   ユーティリティ
   =========== */
function yen(n) { return "¥" + Math.floor(n).toLocaleString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ===========
   初期化
   =========== */
function initGame() {
  GameState.week = 1;
  GameState.funds = 100000;
  GameState.totalSales = 0;
  GameState.weekSales = 0;
  GameState.rep = 0;
  GameState.pop = 0;
  GameState.rankScore = 0;
  GameState.rank = "路地裏";
  GameState.ad = "none";
  GameState.adCost = 0;
  GameState.adEffect = 0;
  GameState.casts = JSON.parse(JSON.stringify(initialCasts));
  GameState.shifts = {};
  GameState.waves = [];
  GameState.waveCursor = 0;
  GameState.assignments = {};
  GameState.lastReport = null;
  GameState.ended = false;
  GameState.pendingRare = [];
  GameState.perCastSales = [];
  GameState.dismissed = {};
  GameState.troubleResolved = false;
  GameState.troubleSuccess = false;
  GameState.trainCount = 0;

  renderHeader();
  renderCastList();
  fillTrainTarget();
  rollShiftRandom();
  renderShiftList();
  document.getElementById("hireCandidates").innerHTML = "";
  document.getElementById("report").innerHTML = "<span class='muted'>今週のレポートはありません</span>";
}

function renderHeader() {
  const remaining = 52 - GameState.week;
  document.getElementById("uiWeek").textContent = `第${GameState.week}週 ／ 残り${remaining}週`;
  document.getElementById("uiFunds").textContent = yen(GameState.funds);
  document.getElementById("uiTotal").textContent = yen(GameState.totalSales);
  document.getElementById("uiRank").textContent = GameState.rank;
  document.getElementById("uiRep").textContent = `評判 ${GameState.rep}`;
  document.getElementById("uiPop").textContent = `知名度 ${GameState.pop}`;
}

function toggleMute() {
  const btn = document.getElementById("btnMute");
  if (mainBGM.muted) {
    mainBGM.muted = false;
    btn.textContent = "🎵 BGM: ON";
    btn.classList.remove("is-muted");
  } else {
    mainBGM.muted = true;
    btn.textContent = "🔇 BGM: OFF";
    btn.classList.add("is-muted");
  }
}

function generateNextWeekWaves(rank) {
  let waveCount = 3;
  if (rank === "路地裏") waveCount = 2;
  else if (rank === "大衆店" || rank === "人気店") waveCount = 3;
  else if (rank === "名店") waveCount = 4;
  else if (rank === "プレステージ" || rank === "伝説") waveCount = 5;

  const waves = [];
  for (let i = 0; i < waveCount; i++) {
    const custCount = randInt(2, 5);
    waves.push(generateCustomers(custCount));
  }
  return waves;
}

function renderCastList() {
  const el = document.getElementById("castList");
  el.innerHTML = GameState.casts.map(c => {
    const cond = computeCondition(c);
    return `
      <div class="row" style="margin:6px 0;">
        <img class="avatar" src="${c.img}" alt="${c.name}">
        <div style="flex:1;">
          <div><strong>${c.name}</strong> Lv${c.lv} <span class="pill">${c.look}/${c.nature}</span></div>
          <div>愛想:${c.aisou} 会話:${c.kaiwa} 気配り:${c.attentiveness} ／ 給料:${yen(c.salary)}</div>
          <div>疲労:${c.fati}/${c.fatiMax} ストレス:${c.stress}/${c.stressMax} <span class="pill">${cond}</span></div>
        </div>
      </div>
    `;
  }).join("");
}

function fillTrainTarget() {
  updateTrainDropdown();
}

function updateTrainDropdown() {
  const select = document.getElementById("trainTarget");
  if (!select) return;
  select.innerHTML = "";
  GameState.casts.forEach(cast => {
    const opt = document.createElement("option");
    opt.value = cast.id;
    opt.textContent = `${cast.name} (Lv.${cast.lv})`;
    select.appendChild(opt);
  });
}

function showPhase(name) {
  const phases = ["day", "night", "result"];
  phases.forEach(p => {
    const el = document.getElementById("phase" + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = (p === name) ? "block" : "none";
  });
}

function rollShiftRandom() {
  GameState.casts.forEach(c => GameState.shifts[c.id] = false);
  if (GameState.week === 1) {
    GameState.casts.forEach(c => GameState.shifts[c.id] = true);
    renderShiftList();
    return;
  }
  const activeCount = Math.max(1, Math.floor(GameState.casts.length * 0.6));
  const shuffled = [...GameState.casts].sort(() => Math.random() - 0.5);

  let count = 0;
  for (let i = 0; i < shuffled.length && count < activeCount; i++) {
    const c = shuffled[i];
    GameState.shifts[c.id] = true;
    count++;
  }
  renderShiftList();
}

function renderShiftList() {
  const el = document.getElementById("shiftList");
  el.innerHTML = GameState.casts.map(c => {
    const on = GameState.shifts[c.id] === true;
    return `
      <div class="row" style="margin:6px 0;">
        <img class="avatar" src="${c.img}">
        <div style="flex:1;">
          <strong>${c.name}</strong> <span class="pill">${on ? '出勤' : '休み'}</span>
        </div>
        <button class="btn" onclick="toggleShift('${c.id}')">
                ${on ? '休みにする' : '出勤にする'}
        </button>
      </div>
    `;
  }).join("");
}

window.toggleShift = function (id) {
  const cast = GameState.casts.find(c => c.id === id);
  const wasOn = GameState.shifts[id] === true;
  const nowOn = !wasOn;
  GameState.shifts[id] = nowOn;

  if (cast) {
    if (!wasOn && nowOn) {
      cast.stress = Math.min(cast.stressMax, cast.stress + 50);
    } else if (wasOn && !nowOn) {
      cast.stress = Math.max(0, cast.stress - 10);
    }
  }
  renderShiftList();
};

const AdDefs = {
  none: { cost: 0, effect: 0, popUp: 0 },
  sns: { cost: 5000, effect: 0.05, popUp: 0 },
  event: { cost: 15000, effect: 0.15, popUp: 2 },
  mag: { cost: 30000, effect: 0.30, popUp: 5 }
};

if (document.getElementById("adSelect")) {
  document.getElementById("adSelect").addEventListener("change", e => {
    const key = e.target.value;
    GameState.ad = key;
    GameState.adCost = AdDefs[key].cost;
    GameState.adEffect = AdDefs[key].effect;
  });
}

if (document.getElementById("btnTrain")) {
  document.getElementById("btnTrain").addEventListener("click", () => {
    const id = document.getElementById("trainTarget").value;
    const stat = document.getElementById("trainStat").value;
    const budgetInput = document.getElementById("trainBudget").value;
    const budget = parseInt(budgetInput || "0", 10);
    const c = GameState.casts.find(x => x.id === id);

    if (!c) { alert("対象のキャストが見つかりません"); return; }
    if (budget <= 0) { alert("予算を入力してください"); return; }
    if (GameState.funds < budget) { alert("資金不足です"); return; }

    const inc = Math.floor(Math.random() * (budget / 2000 + 2)) + 1;
    if (typeof c[stat] === 'number') { c[stat] += inc; }

    c.fati = Math.min(c.fati + 10, c.fatiMax);
    GameState.funds -= budget;
    GameState.trainCount++;

    renderHeader();
    renderCastList();
    alert(`${c.name}の${stat}が +${inc} されました！\n（費用: ${budget}円 / 疲労 +10）`);
  });
}

if (document.getElementById("btnGenCandidates")) {
  document.getElementById("btnGenCandidates").addEventListener("click", () => {
    const budgetValue = document.getElementById("hireBudget").value;
    const budget = parseInt(budgetValue || "0", 10);
    if (GameState.funds < budget) { alert("資金不足です"); return; }

    const rankFactor = RankSteps.indexOf(GameState.rank) + 1;
    const count = clamp(randInt(1, 6) + Math.floor(rankFactor / 2), 1, 6);
    const looks = ["キュート", "クール", "ビューティー", "セクシー", "カジュアル"];
    const natures = ["明るい", "大人しい", "元気", "ミステリアス", "穏やか"];
    const base = Math.min(80, 45 + rankFactor * 5);
    const swing = 20 + Math.floor(budget / 10000) * 3;

    const kanjiNames = ["美咲", "彩花", "玲奈", "真央", "香織", "舞", "華", "愛莉", "結衣", "沙羅"];
    const hiraganaNames = ["あかり", "ゆずは", "みお", "さくら", "ななみ", "はるか", "もも", "ちカ", "ひな", "のぞみ"];
    const katakanaNames = ["マリア", "エリカ", "リナ", "アイ", "ナツ", "カレン", "ユイ", "ミナ", "アオイ", "レイナ"];

    function randomGenjiName() {
      const type = randInt(1, 3);
      if (type === 1) return pick(kanjiNames);
      if (type === 2) return pick(hiraganaNames);
      return pick(katakanaNames);
    }

    const lookImgMap = {
      "キュート": Array.from({ length: 30 }, (_, i) => `img/cute/cute (${i + 1}).jpg`),
      "クール": Array.from({ length: 30 }, (_, i) => `img/cool/cool (${i + 1}).jpg`),
      "ビューティー": Array.from({ length: 30 }, (_, i) => `img/beauty/beauty (${i + 1}).jpg`),
      "セクシー": Array.from({ length: 30 }, (_, i) => `img/sexy/sexy (${i + 1}).jpg`),
      "カジュアル": Array.from({ length: 30 }, (_, i) => `img/casual/casual (${i + 1}).jpg`)
    };

    let html = "";
    for (let i = 0; i < count; i++) {
      const look = pick(looks);
      const imgList = lookImgMap[look] || [];
      const img = imgList.length ? pick(imgList) : "img/placeholder.jpg";

      const cand = {
        id: "cand_" + Date.now() + "_" + i,
        name: randomGenjiName(),
        img: img,
        look: look,
        nature: pick(natures),
        aisou: clamp(randInt(base - swing, base + swing), 35, 95),
        kaiwa: clamp(randInt(base - swing, base + swing), 35, 95),
        attentiveness: clamp(randInt(base - swing, base + swing), 35, 95),
        fati: 0, fatiMax: 100,
        stress: 0, stressMax: 100,
        cond: "普通",
        lv: 1, exp: 0,
        salary: clamp(9000 + randInt(-1500, 1500), 7000, 14000),
        isInitial: false,
        joinWeek: GameState.week
      };

      html += `
        <div class="row" style="margin:6px 0;" data-id="${cand.id}">
          <img class="avatar" src="${cand.img}">
          <div style="flex:1;">
            <strong>${cand.name}</strong> <span class="pill">${cand.look}/${cand.nature}</span>
            <div>AI:${cand.aisou} TK:${cand.kaiwa} CA:${cand.attentiveness} ／ 給料:${yen(cand.salary)}</div>
          </div>
          <button class="btn" onclick='hire(${JSON.stringify(cand)})'>採用する</button>
        </div>
      `;
    }

    document.getElementById("hireCandidates").innerHTML = html;
    GameState.funds -= budget;
    renderHeader();
  });
}

window.hire = function (cand) {
  GameState.casts.push(cand);
  alert(`${cand.name}を採用しました！`);
  renderShiftList();
  renderCastList();
  updateTrainDropdown();
  const area = document.getElementById("hireCandidates");
  const candEl = area.querySelector(`[data-id="${cand.id}"]`);
  if (candEl) candEl.remove();
};

function computeCondition(c) {
  const ratio = c.fati / c.fatiMax;
  if (ratio < 0.3) return "良好";
  if (ratio < 0.6) return "普通";
  if (ratio < 0.9) return "疲労";
  return "絶不調";
}

function conditionStatMod(c) {
  const cond = computeCondition(c);
  if (cond === "良好") return 1.05;
  if (cond === "普通") return 1.0;
  if (cond === "疲労") return 0.9;
  return 0.8;
}

if (document.getElementById("btnStartNight")) {
  document.getElementById("btnStartNight").addEventListener("click", startNight);
}

function startNight() {
  let baseWaveCount = 3;
  const rank = GameState.rank;
  if (rank === "路地裏") baseWaveCount = 2;
  else if (rank === "大衆店" || rank === "人気店") baseWaveCount = 3;
  else if (rank === "名店") baseWaveCount = 4;
  else if (rank === "プレステージ" || rank === "伝説") baseWaveCount = 5;

  const randomAdjustment = randInt(-1, 1);
  const minWaves = 2;
  const maxWaves = 6;
  const waveCount = clamp(baseWaveCount + randomAdjustment, minWaves, maxWaves);

  GameState.waves = [];
  for (let i = 0; i < waveCount; i++) {
    let simCount = 0;
    if (rank === "路地裏") {
      simCount = randInt(1, 3); // 低ランク時は1〜3人に抑制
    } else {
      const simBase = randInt(1, 5);
      simCount = clamp(simBase + Math.floor(RankSteps.indexOf(GameState.rank) / 2), 1, 7);
    }
    GameState.waves.push(generateCustomers(simCount));
  }

  GameState.waveCursor = 0;
  GameState.assignments = {};
  GameState.weekSales = 0;

  openWaveModal();
}

function generateCustomers(count) {
  const types = ["初心者", "一般", "常連", "ハイグレード", "VIP"];

  // ランクに応じた出現率の調整
  const rankIdx = RankSteps.indexOf(GameState.rank);
  let typeWeights = [4, 6, 4, 2, 1]; // デフォルト

  if (rankIdx === 0) { // 路地裏
    typeWeights = [8, 10, 2, 0.1, 0]; // 初心者・一般メイン、高級客はほぼ出ない
  } else if (rankIdx === 1) { // 大衆店
    typeWeights = [5, 10, 5, 0.5, 0.1];
  } else if (rankIdx >= 2) { // 人気店以上
    typeWeights = [4, 6, 4, 2, 1 + Math.floor(rankIdx / 2)];
  }

  const nature = ["静か", "陽気", "絡み厄介"];
  const looks = ["キュート", "クール", "ビューティー", "セクシー", "カジュアル"];
  const stats = ["愛想", "会話", "気遣い"];

  function weightedPick(arr, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  const customers = [];
  for (let i = 0; i < count; i++) {
    const t = weightedPick(types, typeWeights);
    const basePrice = { "初心者": 2000, "一般": 3000, "常連": 4000, "ハイグレード": 5500, "VIP": 8000 }[t];
    const reqStat = pick(stats);
    const reqBase = 45 + RankSteps.indexOf(GameState.rank) * 6;
    const reqVal = clamp(randInt(reqBase - 5, reqBase + 15), 30, 95);
    const n = pick(nature);
    const like = { look: pick(looks), nature: pick(nature) };
    const troubleRate = clamp(randInt(10, 50) - Math.floor(avgAttentiveness() / 10), 5, 50);
    customers.push({
      type: t, nature: n, like, basePrice, reqStat, reqVal,
      troubleRate
    });
  }
  return customers;
}

function avgAttentiveness() {
  const onCast = GameState.casts.filter(c => GameState.shifts[c.id]);
  if (onCast.length === 0) return 50;
  return Math.floor(onCast.reduce((s, c) => s + c.attentiveness, 0) / onCast.length);
}

function openWaveModal() {
  const idx = GameState.waveCursor;
  const waves = GameState.waves;
  const wave = waves[idx];

  if (!wave) { closeWaveModal(); finishNight(); return; }

  // 波数の表示はUIから削除されたため、内部のみで利用
  // document.getElementById("waveIndex").textContent = idx+1;
  // document.getElementById("waveTotal").textContent = waves.length;
  document.getElementById("waveRankTag").textContent = GameState.rank;

  const custHtml = wave.map((c, i) => {
    const onCast = GameState.casts.filter(ca => GameState.shifts[ca.id]);
    const options = onCast.map(ca => `<option value="${ca.id}">${ca.name}</option>`).join("");

    return `
    <div class="subpanel">
      <div class="row">
        <span class="tag ${c.type === 'VIP' ? 'vip' : ''}">${c.type}</span>
        ${c.nature === "絡み厄介" ? "" : `<span class="pill">${c.nature}</span>`}
      </div>
      <div>要求: ${c.reqStat.toUpperCase()} ／ 好み: ${c.like.look}/${c.like.nature}</div>
      <div class="row" style="margin-top:6px;">
        <select class="input" id="assign_${idx}_${i}">
          <option value="">未配置</option>
          ${options}
        </select>
        <button class="btn" onclick="assignCastToCustomer(${idx},${i})">配置</button>
      </div>
      <div id="assigned_${idx}_${i}" class="row" style="margin-top:6px;">
        <span class="muted">未配置</span>
      </div>
    </div>`;
  }).join("");
  document.getElementById("waveCustomers").innerHTML = custHtml;

  const onCast = GameState.casts.filter(c => GameState.shifts[c.id]);
  const assignHtml = onCast.map(c => `
    <div class="row cast-selection-item" style="margin:8px 0; padding:8px; border:1px solid #ffd6e7; border-radius:8px; background:#fff;">
      <img class="avatar" src="${c.img}" style="width:40px; height:40px;">
      <div style="flex:1; margin-left:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${c.name}</strong>
          <span class="pill" style="font-size:10px; background:#fff0f6;">${c.look}/${c.nature}</span>
        </div>
        <div style="font-size:11px; color:#666; margin-top:2px;">
          愛想:${c.aisou} 会話:${c.kaiwa} 気配り:${c.attentiveness}
        </div>
      </div>
    </div>
  `).join("");
  document.getElementById("assignArea").innerHTML = assignHtml;
  document.getElementById("waveModal").style.display = "flex";
}

function closeWaveModal() { document.getElementById("waveModal").style.display = "none"; }

window.assignCastToCustomer = function (waveIndex, customerIndex) {
  const sel = document.getElementById(`assign_${waveIndex}_${customerIndex}`);
  const castId = sel.value;
  if (!castId) return;

  GameState.assignments[waveIndex] = GameState.assignments[waveIndex] || {};
  GameState.assignments[waveIndex][customerIndex] = castId;

  const cast = GameState.casts.find(c => c.id === castId);

  const fatiPercent = Math.floor((cast.fati / cast.fatiMax) * 100);
  const stressPercent = Math.floor((cast.stress / cast.stressMax) * 100);

  document.getElementById(`assigned_${waveIndex}_${customerIndex}`).innerHTML = `
    <div class="row" style="align-items:center; gap:8px;">
      <img src="${cast.img}" class="avatar" style="width:30px;height:30px;">
      <div>
        <div><strong>${cast.name}</strong></div>
        <div style="font-size:12px; color:#666;">疲労: ${fatiPercent}% ／ ストレス: ${stressPercent}%</div>
        <div style="width:100px; background:#eee; border-radius:6px; overflow:hidden; margin:2px 0;">
          <div style="width:${fatiPercent}%; background:#ff69b4; height:6px;"></div>
        </div>
        <div style="width:100px; background:#eee; border-radius:6px; overflow:hidden;">
          <div style="width:${stressPercent}%; background:#87cefa; height:6px;"></div>
        </div>
      </div>
    </div>
  `;
};

if (document.getElementById("btnResolveWave")) {
  document.getElementById("btnResolveWave").addEventListener("click", () => {
    resolveWave(false);
  });
}
if (document.getElementById("btnSkipAssign")) {
  document.getElementById("btnSkipAssign").addEventListener("click", () => {
    resolveWave(true);
  });
}

function resolveWave(skipped) {
  const idx = GameState.waveCursor;
  const wave = GameState.waves[idx];
  const assigns = GameState.assignments[idx] || {};
  let salesThisWave = 0;
  let repDelta = 0;

  wave.forEach((cust, ci) => {
    const castId = assigns[ci];
    if (castId == null) {
      repDelta -= 1;
      return;
    }
    const cast = GameState.casts.find(c => c.id === castId);
    if (!cast) return;

    if (cast.fati >= cast.fatiMax) {
      cast.stress = clamp(cast.stress + 10, 0, cast.stressMax);
    }

    const likeBonus = (cast.look === cust.like.look ? 1.15 : 1.0) *
      (cast.nature === cust.like.nature ? 1.10 : 1.0);

    const statVal = cust.reqStat === "愛想" ? cast.aisou :
      cust.reqStat === "会話" ? cast.kaiwa : cast.attentiveness;
    const meets = statVal >= cust.reqVal;
    repDelta += meets ? 1 : -1;

    const mod = conditionStatMod(cast);
    let price = cust.basePrice;
    price *= (meets ? 1.15 : 0.85);
    price *= likeBonus;
    price *= mod;
    price *= (1 + GameState.adEffect);

    if (castId) {
      let castSales = GameState.perCastSales.find(x => x.id === castId);
      if (!castSales) {
        castSales = { id: castId, sales: 0, name: cast.name, img: cast.img };
        GameState.perCastSales.push(castSales);
      }
      castSales.sales += price;
    }

    salesThisWave += price;
    GameState.weekSales += price;
    cast.fati = clamp(cast.fati + 10, 0, cast.fatiMax + 30);
  });

  const onCast = GameState.casts.filter(c => GameState.shifts[c.id]);
  onCast.forEach(c => {
    const handled = Object.values(assigns).includes(c.id);
    if (!handled) {
      c.fati = clamp(c.fati - 5, 0, c.fatiMax);
    }
  });

  GameState.totalSales += salesThisWave;
  GameState.funds += salesThisWave;
  GameState.rep = clamp(GameState.rep + repDelta, 0, 100);

  const troubleChance = Math.min(0.25, 0.05 + (wave.length * 0.01));
  if (Math.random() < troubleChance) {
    openTrouble(wave, assigns);
    return;
  }

  GameState.waveCursor++;
  renderHeader();
  if (GameState.waveCursor >= GameState.waves.length) {
    closeWaveModal();
    finishNight();
  } else {
    openWaveModal();
  }
}

function openTrouble(wave, assigns) {
  GameState.troubleResolved = false;
  document.querySelectorAll("#troubleModal button[data-choice]").forEach(btn => {
    btn.disabled = false;
  });

  const candidates = Object.entries(assigns).map(([ci, castId]) => {
    return GameState.casts.find(x => x.id === castId);
  }).filter(Boolean);

  const actor = candidates.length ? pick(candidates) : pick(GameState.casts.filter(c => GameState.shifts[c.id]));

  const types = [
    { key: "bad_claim", title: "悪質クレーマー", text: "強気な態度で出禁対応が必要です。" },
    { key: "drunk", title: "酔っぱらい絡み", text: "落ち着いて退店してもらうのが適切です。" },
    { key: "annoy", title: "絡み厄介客", text: "注意対応で場を整えましょう。" }
  ];
  const t = pick(types);

  document.getElementById("troubleBody").innerHTML = `
    <div class="row">
      <img class="avatar" src="${actor.img}">
      <div>
        <div><strong>${actor.name}</strong> が対応します</div>
        <div>${t.title}：${t.text}</div>
      </div>
    </div>
  `;
  document.getElementById("troubleResult").innerHTML = "";
  document.getElementById("troubleModal").style.display = "flex";

  function handle(choice) {
    if (GameState.troubleResolved) return;
    GameState.troubleResolved = true;

    const key = choice === "strong" ? "kaiwa" :
      choice === "calm" ? "aisou" : "attentiveness";
    const base = 0.4 + (actor[key] / 200);
    const ok = Math.random() < base;

    if (ok) {
      GameState.rep = clamp(GameState.rep + 2, 0, 100);
      actor.exp += 40;
      GameState.troubleSuccess = true;
      document.getElementById("troubleResult").innerHTML =
        `<span class="ok">成功！ 評判+2 / EXP+40</span>`;
    } else {
      GameState.funds -= 2000;
      actor.stress = clamp(actor.stress + 10, 0, actor.stressMax);
      let resText = `<span class="bad">失敗… 売上損失¥2,000 / ${actor.name} ストレス+10</span>`;

      if (!actor.isInitial && Math.random() < 0.05) {
        GameState.casts = GameState.casts.filter(c => c.id !== actor.id);
        resText += `<div class="bad">突然の辞職が発生… ${actor.name}が退職しました</div>`;
      }
      document.getElementById("troubleResult").innerHTML = resText;
    }

    document.querySelectorAll("#troubleModal button[data-choice]").forEach(btn => {
      btn.disabled = true;
    });
    renderHeader();
  }

  document.getElementById("troubleStrong").onclick = () => handle("strong");
  document.getElementById("troubleCalm").onclick = () => handle("calm");
  document.getElementById("troubleWarn").onclick = () => handle("warn");

  document.getElementById("btnCloseTrouble").onclick = () => {
    document.getElementById("troubleModal").style.display = "none";
    GameState.waveCursor++;
    if (GameState.waveCursor >= GameState.waves.length) {
      closeWaveModal();
      finishNight();
    } else {
      openWaveModal();
    }
  };
}

function finishNight() {
  const salary = GameState.casts.filter(c => GameState.shifts[c.id])
    .reduce((s, c) => s + c.salary, 0);
  GameState.funds -= salary;
  GameState.funds -= GameState.adCost;
  GameState.pop = clamp(GameState.pop + AdDefs[GameState.ad].popUp, 0, 100);

  const active = GameState.casts.filter(c => GameState.shifts[c.id]);
  const totals = active.map(c => {
    const statSum = c.aisou + c.kaiwa + c.attentiveness;
    const contrib = Math.max(0, c.fati);
    return {
      id: c.id,
      name: c.name,
      img: c.img,
      contrib: statSum * 0.5 + contrib * 1.5
    };
  });
  const sumContrib = totals.reduce((s, x) => s + x.contrib, 0) || 1;
  const inferredSales = totals.map(x => ({
    ...x,
    sales: Math.floor((GameState.weekSales) * (x.contrib / sumContrib))
  }));

  GameState.perCastSales = GameState.perCastSales.length > 0 ? GameState.perCastSales : inferredSales;
  const mvp = GameState.perCastSales.slice().sort((a, b) => b.sales - a.sales)[0];

  GameState.casts.forEach(c => {
    let rec = GameState.perCastSales.find(x => x.id === c.id);
    if (!rec) return;
    let expGain = Math.floor(rec.sales / 100);
    if (mvp && mvp.id === c.id) expGain = Math.floor(expGain * 1.5);
    c.exp += expGain;

    while (c.exp >= 100) {
      c.exp -= 100;
      c.lv += 1;
      c.aisou += randInt(1, 3);
      c.kaiwa += randInt(1, 3);
      c.attentiveness += randInt(1, 3);
      c.fatiMax += randInt(0, 2);
      c.stressMax += randInt(0, 2);
    }

    if (GameState.shifts[c.id]) {
      c.stress = Math.min(c.stressMax, c.stress + 5);
    } else {
      c.fati = Math.max(0, c.fati - 30);
      c.stress = Math.max(0, c.stress - 5);
    }

    if (c.fati > c.fatiMax) GameState.shifts[c.id] = false;
    if (c.stress >= c.stressMax) {
      if (c.isInitial) {
        GameState.shifts[c.id] = false;
      } else {
        GameState.casts = GameState.casts.filter(x => x.id !== c.id);
      }
    }
  });

  const score = Math.floor(GameState.pop * 0.4 + GameState.rep * 0.4 + (GameState.totalSales / 50000));
  GameState.rankScore = score;
  const step = clamp(Math.floor(score / 25), 0, RankSteps.length - 1);
  GameState.rank = RankSteps[step];

  showWeekReport();

  if (GameState.funds < 0) {
    openGameOver();
    return;
  }

  GameState.week++;
  if (GameState.week > 52) {
    openEnding(GameState.perCastSales);
    return;
  }

  GameState.ad = "none";
  GameState.adCost = 0;
  GameState.adEffect = 0;
  if (document.getElementById("adSelect")) document.getElementById("adSelect").value = "none";

  GameState.shifts = {};
  GameState.assignments = {};
  GameState.waveCursor = 0;

  checkRareEvents();
  rollShiftRandom();
  renderHeader();

  const weekMsg = ` 
    <div class="weekReportContent">
      <h3>第${GameState.week - 1}週目の売上</h3>
      <p>売上: ${yen(GameState.weekSales)}</p>
      <p>評判: ${GameState.rep} ／ 知名度: ${GameState.pop} ／ ランク: ${GameState.rank}</p>
    </div>
  `;
  const modalPanel = document.getElementById("weekReportPanel");
  if (modalPanel) {
    modalPanel.innerHTML = weekMsg;
    document.getElementById("weekReportModal").style.display = "flex";
  }
}

function showWeekReport() {
  const perCastSales = GameState.perCastSales || [];
  const salary = GameState.casts.filter(c => GameState.shifts[c.id])
    .reduce((s, c) => s + c.salary, 0);

  const reportHtml = `
    <div>今週売上合計: <strong>${yen(GameState.weekSales)}</strong></div>
    <div>接客ウェーブ: ${GameState.waves.length}</div>
    <div>広告費用: ${yen(GameState.adCost)} ／ 給料報酬: ${yen(salary)}</div>
    <div>評判: ${GameState.rep} ／ 知名度: ${GameState.pop} ／ ランク: ${GameState.rank}</div>
    <h4>キャスト別売上</h4>
    ${perCastSales.map(x => `
      <div class="row" style="margin:4px 0;">
        <img class="avatar" src="${x.img}">
        <div style="flex:1;">${x.name}</div>
        <div>${yen(x.sales)}</div>
      </div>
    `).join("")}
  `;
  document.getElementById("report").innerHTML = reportHtml;

  document.querySelectorAll(".phase").forEach(p => p.style.display = "none");
  document.getElementById("phaseResult").style.display = "block";

  renderHeader();
  renderCastList();
}

window.closeWeekReport = function () {
  document.getElementById("weekReportModal").style.display = "none";
};

function checkRareEvents() {
  if (GameState.ad !== "none" && !GameState.dismissed["カレン"] && !GameState.casts.find(c => c.name === "カレン")) {
    GameState.pendingRare.push("カレン");
  }

  if (GameState.weekSales >= 50000 && !GameState.dismissed["ユズ"] && !GameState.casts.find(c => c.name === "ユズ")) {
    GameState.pendingRare.push("ユズ");
  }

  if (GameState.troubleSuccess && !GameState.dismissed["レイナ"] && !GameState.casts.find(c => c.name === "レイナ")) {
    GameState.pendingRare.push("レイナ");
    GameState.troubleSuccess = false;
  }

  if (GameState.trainCount >= 3 && !GameState.dismissed["ミナ"] && !GameState.casts.find(c => c.name === "ミナ")) {
    GameState.pendingRare.push("ミナ");
    GameState.trainCount = 0;
  }

  if (GameState.week === 20 && !GameState.dismissed["アオイ"] && !GameState.casts.find(c => c.name === "アオイ")) {
    GameState.pendingRare.push("アオイ");
  }

  if (GameState.pendingRare.length > 0) {
    openRareJoinModalIfPending();
  }
}

function openRareJoinModalIfPending() {
  const list = GameState.pendingRare.map(n => `
    <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
      <img src="${RARE[n].img}" class="avatar" alt="${n}">
      <div><strong>${n}</strong> が加入希望です</div>
    </div>
  `).join('');
  document.getElementById("rareJoinList").innerHTML = list;
  document.getElementById("rareJoinModal").style.display = "flex";
}

window.acceptRare = function () {
  GameState.pendingRare.forEach(n => {
    GameState.casts.push({ ...RARE[n] });
    alert(`${n}が加入しました！`);
  });
  GameState.pendingRare = [];
  document.getElementById("rareJoinModal").style.display = "none";
  renderCastList();
};

window.declineRare = function () {
  GameState.pendingRare.forEach(n => {
    GameState.dismissed[n] = true;
    alert(`${n}の加入を断りました…`);
  });
  GameState.pendingRare = [];
  document.getElementById("rareJoinModal").style.display = "none";
};

function openEnding(perCastSales) {
  GameState.ended = true;
  const avgLv = Math.floor(GameState.casts.reduce((s, c) => s + c.lv, 0) / GameState.casts.length);
  const topSales = perCastSales.slice().sort((a, b) => b.sales - a.sales)[0];

  document.getElementById("endingSummary").innerHTML = `
    <div>累計総売上: <strong>${yen(GameState.totalSales)}</strong></div>
    <div>店舗ランク: <strong>${GameState.rank}</strong> ／ 評判: ${GameState.rep} ／ 知名度: ${GameState.pop}</div>
    <div>キャスト平均Lv: <strong>${avgLv}</strong></div>
    <div>売上トップキャスト: ${topSales ? topSales.name : '—'}</div>
  `;
  document.getElementById("endingCastList").innerHTML = GameState.casts.map(c => `
    <div class="row" style="margin:4px 0;">
      <img class="avatar" src="${c.img}">
      <div style="flex:1;">
        <strong>${c.name}</strong> Lv${c.lv}／愛想:${c.aisou} 会話:${c.kaiwa} 気配り:${c.attentiveness}
      </div>
      <div>疲労:${c.fati}/${c.fatiMax} ストレス:${c.stress}/${c.stressMax}</div>
    </div>
  `).join("");
  document.getElementById("endingModal").style.display = "flex";
}

function openGameOver() {
  document.getElementById("gameoverCastList").innerHTML = GameState.casts.map(c => `
    <div class="row" style="margin:4px 0;">
      <img class="avatar" src="${c.img}">
      <div style="flex:1;"><strong>${c.name}</strong> Lv${c.lv}</div>
      <div>疲労:${c.fati}/${c.fatiMax} ストレス:${c.stress}/${c.stressMax}</div>
    </div>`).join("");
  document.getElementById("gameoverModal").style.display = "flex";
}

if (document.getElementById("btnReset")) {
  document.getElementById("btnReset").onclick = () => { initGame(); document.getElementById("endingModal").style.display = "none"; };
}
if (document.getElementById("btnReset2")) {
  document.getElementById("btnReset2").onclick = () => { initGame(); document.getElementById("gameoverModal").style.display = "none"; };
}

initGame();

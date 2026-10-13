/* =========================================================
   오늘우리 — 화면 흐름 & 인터랙션
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const W = 1700;
const H = 1064;

/* ---------- 화면 비율 맞추기 (1700x1064 기준) ---------- */
let scale = 1;
function fitStage() {
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.setProperty('--scale', scale);
}
window.addEventListener('resize', fitStage);
fitStage();

// 화면 좌표 → 스테이지 좌표
function toStage(e, el = stage) {
  const r = el.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

// 포인터 캡처 (지원하지 않는 환경에서도 오류 없이)
function capture(el, e) {
  try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
}

// localStorage는 막혀 있을 수 있으므로 항상 try/catch
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* noop */ }
  },
};

/* =========================================================
   사운드 — 파일 없이 Web Audio로 직접 만든 소리
   ========================================================= */
const Sound = {
  ctx: null,
  master: null,
  sfx: null,
  music: null,
  muted: store.get('oneuluri-muted', false),

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.16;
    this.music.connect(this.master);
    this.startBgm();
  },

  setMuted(m) {
    this.muted = m;
    store.set('oneuluri-muted', m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  },

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, bus } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus || this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noise(dur, { from = 1800, to = 600, vol = 0.12, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfx);
    src.start(t);
  },

  // 효과음
  click() { this.tone(880, 0.08, { type: 'triangle', vol: 0.22 }); this.tone(1320, 0.07, { delay: 0.03, vol: 0.1 }); },
  select() { this.tone(660, 0.1, { vol: 0.25 }); this.tone(990, 0.16, { delay: 0.07, vol: 0.22 }); },
  back() { this.tone(620, 0.12, { type: 'triangle', vol: 0.2, slide: -220 }); },
  tick() { this.tone(1400, 0.04, { type: 'triangle', vol: 0.12 }); },
  swoosh() { this.noise(0.22, { from: 2200, to: 700, vol: 0.14 }); },
  drop() { this.tone(500, 0.18, { vol: 0.35, slide: 900 }); this.tone(1500, 0.08, { delay: 0.05, vol: 0.08 }); },
  bubble() { const f = 380 + Math.random() * 520; this.tone(f, 0.07 + Math.random() * 0.05, { vol: 0.12 + Math.random() * 0.08, slide: f * 0.9 }); },
  success() { [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.5, { delay: i * 0.09, vol: 0.18, type: 'triangle' })); },
  whoosh() { this.noise(0.5, { from: 400, to: 3000, vol: 0.08 }); },

  // 배경음악: 부드러운 화음 + 오르골 멜로디가 반복
  startBgm() {
    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0], // G
    ];
    const scaleNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const BAR = 2.6;
    let bar = 0;
    let next = this.ctx.currentTime + 0.1;
    const schedule = () => {
      while (next < this.ctx.currentTime + 1.5) {
        const chord = chords[bar % chords.length];
        chord.forEach((f) => this.pad(f, next, BAR));
        for (let b = 0; b < 4; b++) {
          if (Math.random() < 0.55) {
            const f = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
            this.bell(f, next + b * (BAR / 4));
          }
        }
        next += BAR;
        bar++;
      }
    };
    schedule();
    setInterval(schedule, 500);
  },
  pad(freq, t, dur) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    filter.connect(g).connect(this.music);
    [-4, 4].forEach((cents) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = cents;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.7);
    });
  },
  bell(freq, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 1.3);
  },
};

// 첫 터치/클릭 때 오디오 시작 (브라우저 자동재생 정책)
window.addEventListener('pointerdown', () => Sound.init(), { capture: true });

const soundBtn = $('#soundBtn');
function renderSoundBtn() {
  soundBtn.classList.toggle('muted', Sound.muted);
  soundBtn.setAttribute('aria-label', Sound.muted ? '소리 켜기' : '소리 끄기');
}
soundBtn.addEventListener('click', () => {
  Sound.setMuted(!Sound.muted);
  renderSoundBtn();
  Sound.click();
});
renderSoundBtn();

/* =========================================================
   데이터
   ========================================================= */
const MOODS = [
  { label: '매우 좋지 않음', img: 'mood-1.png', colors: ['#ff9b9b', '#ffc4c0', '#ffeae6'], text: ['#4a2222', '#d0504f'] },
  { label: '좋지 않음', img: 'mood-2.png', colors: ['#ffa985', '#ffcdb3', '#fff0e3'], text: ['#3f2618', '#d0683a'] },
  { label: '보통', img: 'mood-3.png', colors: ['#ffbc89', '#ffd8b3', '#fff3dd'], text: ['#1a1f27', '#d48851'] },
  { label: '좋음', img: 'mood-4.png', colors: ['#ffd27a', '#ffe6ad', '#fff8e0'], text: ['#3e3016', '#c59a1e'] },
  { label: '매우 좋음', img: 'mood-5.png', colors: ['#9fdcaa', '#c9ebc9', '#eff9ea'], text: ['#1f3a24', '#4f9d5c'] },
];
const DEFAULT_PALETTE = MOODS[2].colors;

const CHIP_SETS = {
  activity: { question: '무엇을 하고 있었어?', options: ['공부', '출근', '등교', '일', '대화', '여가'] },
  place: { question: '어디에 있었어?', options: ['학교', '회사', '버스', '집', '가게', '공원'] },
  who: { question: '누구와 함께했어?', options: ['엄마', '아빠', '아이', '혼자', '친구', '모르는 사람'] },
};

// 감정 카드 (원형 궤도에 이 순서대로 놓임)
const EMOTIONS = [
  { name: '불안한', img: 'card-anxious.png', pill: '#b98fd6' },
  { name: '슬픈', img: 'card-sad.png', pill: '#a8a4a0' },
  { name: '지루한', img: 'card-bored.png', pill: '#8d94bf' },
  { name: '무난한', img: 'card-okay.png', pill: '#e297cb' },
  { name: '즐거운', img: 'card-fun.png', pill: '#d2b53c' },
  { name: '행복한', img: 'card-happy.png', pill: '#c4a3b5' },
  { name: '설레는', img: 'card-excited.png', pill: '#fb9b80' },
  { name: '뿌듯한', img: 'card-proud.png', pill: '#8cc275' },
  { name: '여유로운', img: 'card-relaxed.png', pill: '#74bfd6' },
];

// bg: 로딩·피드백 화면 배경색, card: 마지막 기록 카드 색 [바탕, 제목 위, 제목 아래, 태그]
const CHARACTERS = [
  { id: 'hamster', name: '다이아 골든 햄스터', traits: [3, 4, 1], grad: ['#bb9b35', '#554618'], dot: '#ffa800', bg: ['#ffe489', '#fff2c7', '#fffaf0'],
    card: ['#ffaa21', '#907856', '#c88a33', '#ffeec9'], bubbleName: '#857948' },
  { id: 'bird', name: '사과 코끼리', traits: [5, 2, 3], grad: ['#5d8fd6', '#2a4a80'], dot: '#5b9be6', bg: ['#a7d0f5', '#d6e9fb', '#f3f9fe'],
    card: ['#62b4f0', '#5b6d82', '#3d82c4', '#dff0ff'], bubbleName: '#3f6a9c' },
  { id: 'sprout', name: '새싹 뭉실양', traits: [4, 3, 2], grad: ['#86ad4f', '#3f5527'], dot: '#8fd05a', bg: ['#c3e7a3', '#e3f4d4', '#f6fcf1'],
    card: ['#8fd15e', '#69774f', '#5e9a33', '#ecf9dc'], bubbleName: '#56733a' },
  { id: 'pig', name: '소세지 돼지', traits: [2, 1, 5], grad: ['#e47d9d', '#8a3d55'], dot: '#f58fb3', bg: ['#ffbfd3', '#ffe0ea', '#fff5f8'],
    card: ['#ff92b6', '#86606c', '#d8587f', '#ffe6ee'], bubbleName: '#a24e6a' },
  { id: 'lion', name: '초코별 사자', traits: [4, 2, 4], grad: ['#8a6656', '#3d2a22'], dot: '#7b5444', bg: ['#d6b39c', '#ecd9cb', '#faf3ee'],
    card: ['#a97f6b', '#7d6457', '#a0634a', '#f5e6dc'], bubbleName: '#6e5145' },
];

const BUBBLES = [
  '그러니까... 네 순간은....',
  '유리구슬에서 뭔가가 보여!',
  '오늘은 어떤 하루였어?',
  '음... 반짝이는 게 느껴져...!',
  '부모님께 마음을 전해볼까?',
  '조금만 더 들여다볼게...',
];

/* ---------- 상태 ---------- */
function freshState() {
  return {
    mood: 2,
    activity: null,
    place: null,
    who: null,
    custom: { activity: [], place: [], who: [] },
    emotion: 3,
    juice: 0,
    drawn: false,
    draw: null, // 원 그리기 분석값 { round, seconds, size }
    character: 0,
  };
}
let state = freshState();
let guided = {}; // 단계별로 조작 가이드를 이미 따라했는지

/* ---------- 단계 정의 ---------- */
const STEPS = [
  { id: 'mood', scene: 'mood', title: '지금 기분이 어때?',
    hint: { text: '동그라미를 좌우로 끌어서 기분을 골라봐', top: 990 }, target: '#moodKnob' },
  { id: 'activity', scene: 'chips', title: '네 순간에 대해 알려줘',
    hint: { text: '하나를 눌러서 골라줘! + 로 직접 쓸 수도 있어', top: 950 } },
  { id: 'place', scene: 'chips', title: '네 순간에 대해 알려줘',
    hint: { text: '어디에 있었는지 하나를 눌러줘', top: 950 } },
  { id: 'who', scene: 'chips', title: '네 순간에 대해 알려줘',
    hint: { text: '누구와 함께였는지 하나를 눌러줘', top: 950 } },
  { id: 'confirm', scene: 'confirm', title: '기록된 순간이 맞는지 확인해 봐',
    hint: { text: '맞으면 오른쪽 위 화살표를 눌러 다음으로 가자', top: 820 } },
  { id: 'emotion', scene: 'cards', title: '어떤 감정이 지나갔는지 궁금해!',
    hint: { text: '카드를 좌우로 끌어서 돌리고, 마음에 맞는 카드를 골라봐', top: 985 } },
  { id: 'juice', scene: 'juice', title: '네가 느낀 감정만큼 잔을 눌러 채워줘!',
    hint: { text: '잔을 꾹 누르고 있으면 채워져', top: 330, left: 668 }, target: '#glass' },
  { id: 'draw', scene: 'draw', title: '순간을 떠올리며 원을 따라 그려보자',
    hint: { text: '움직이는 점을 따라 마우스로 원을 그려봐', top: 985 } },
  { id: 'character', scene: 'character', title: '결과를 함께할 캐릭터를 골라봐!',
    hint: { text: '화살표를 눌러 캐릭터를 바꿔봐', top: 340, left: 494 }, target: '.arrow' },
];

let stepIndex = -1; // -1 = 시작 화면
const stepUi = $('#stepUi');
const nextBtn = $('#nextBtn');
const hint = $('#hint');

// 진행 바
const progress = $('#progress');
STEPS.forEach(() => progress.appendChild(document.createElement('i')));

function showScene(name) {
  document.querySelectorAll('.scene').forEach((s) => s.classList.toggle('active', s.dataset.scene === name));
}

function setPalette([c0, c1, c2]) {
  stage.style.setProperty('--c0', c0);
  stage.style.setProperty('--c1', c1);
  stage.style.setProperty('--c2', c2);
}
function setMoodColors(i) {
  setPalette(MOODS[i].colors);
  stage.style.setProperty('--t0', MOODS[i].text[0]);
  stage.style.setProperty('--t1', MOODS[i].text[1]);
}

function goStep(i) {
  stepIndex = i;
  hideHint();
  if (i < 0) {
    showScene('start');
    stepUi.classList.remove('show');
    setPalette(DEFAULT_PALETTE);
    return;
  }
  const step = STEPS[i];
  showScene(step.scene);
  setPalette(step.id === 'mood' ? MOODS[state.mood].colors : DEFAULT_PALETTE);
  stepUi.classList.add('show', 'swap');
  progress.querySelectorAll('i').forEach((bar, k) => bar.classList.toggle('done', k < i));
  ENTER[step.id]?.();
  updateNext();
  setTimeout(() => {
    $('#stepTitle').textContent = step.title;
    stepUi.classList.remove('swap');
  }, 200);
  setTimeout(() => showHint(step), 700);
}

function canNext() {
  switch (STEPS[stepIndex]?.id) {
    case 'activity': return !!state.activity;
    case 'place': return !!state.place;
    case 'who': return !!state.who;
    case 'juice': return state.juice > 0;
    case 'draw': return state.drawn;
    default: return true;
  }
}
function updateNext() {
  const ok = canNext();
  nextBtn.disabled = !ok;
  // 다음으로 갈 수 있으면 다음 버튼을 깜박여서 알려줌
  nextBtn.classList.toggle('ready', ok && (guided[STEPS[stepIndex]?.id] || STEPS[stepIndex]?.id === 'confirm'));
}

/* ---------- 조작 가이드 ---------- */
function showHint(step) {
  if (STEPS[stepIndex] !== step || guided[step.id]) return;
  $('#hintText').textContent = step.hint.text;
  hint.style.top = `${step.hint.top}px`;
  hint.style.left = `${step.hint.left ?? 850}px`;
  hint.classList.add('show');
  if (step.target) document.querySelectorAll(step.target).forEach((el) => el.classList.add('attention'));
  if (step.id === 'activity' || step.id === 'place' || step.id === 'who') $('#chipList').classList.add('nudge');
}
function hideHint() {
  hint.classList.remove('show');
  document.querySelectorAll('.attention').forEach((el) => el.classList.remove('attention'));
  $('#chipList').classList.remove('nudge');
}
// 해당 단계의 조작을 한 번 하면 가이드를 숨김
function markGuided() {
  const id = STEPS[stepIndex]?.id;
  if (!id) return;
  guided[id] = true;
  hideHint();
  updateNext();
}

/* ---------- 버튼 ---------- */
$('#startBtn').addEventListener('click', () => { Sound.select(); goStep(0); });
$('#prevBtn').addEventListener('click', () => { Sound.back(); goStep(stepIndex - 1); });
nextBtn.addEventListener('click', () => {
  if (!canNext()) return;
  Sound.click();
  if (STEPS[stepIndex].id === 'confirm') guided.confirm = true;
  if (stepIndex === STEPS.length - 1) startLoading();
  else goStep(stepIndex + 1);
});

/* =========================================================
   단계별 진입 처리
   ========================================================= */
const ENTER = {
  mood() { applyMood(state.mood, true); },
  activity() { renderChips('activity'); },
  place() { renderChips('place'); },
  who() { renderChips('who'); },
  confirm() {
    const list = $('#confirmList');
    list.innerHTML = '';
    [state.activity, state.place, state.who].forEach((v, n) => {
      const s = document.createElement('span');
      s.textContent = v;
      s.style.animationDelay = `${n * 0.1}s`;
      list.appendChild(s);
    });
  },
  emotion() { renderCards(); },
  juice() { drawJuice(); },
  draw() { resetDraw(); },
  character() { applyCharacter(0); },
};

/* =========================================================
   시작 화면 — 말풍선 랜덤 변경
   ========================================================= */
const bubble = $('#startBubble');
let bubbleIdx = 0;
setInterval(() => {
  if (stepIndex !== -1) return;
  bubble.classList.add('fade');
  setTimeout(() => {
    let n;
    do { n = Math.floor(Math.random() * BUBBLES.length); } while (n === bubbleIdx);
    bubbleIdx = n;
    bubble.querySelector('span').textContent = BUBBLES[n];
    bubble.classList.remove('fade');
  }, 350);
}, 2800);

/* =========================================================
   1. 기분 슬라이더
   ========================================================= */
const slider = $('#moodSlider');
const knob = $('#moodKnob');
const moodImg = $('#moodImg');
const TRACK_W = 1101.6;
const TRACK_PAD = 51;

function knobPosFor(i) { return TRACK_PAD + ((TRACK_W - TRACK_PAD * 2) * i) / 4; }

function applyMood(i, instant) {
  const changed = i !== state.mood;
  state.mood = i;
  setMoodColors(i);
  $('#moodWord').innerHTML = `<span>${MOODS[i].label}</span>`;
  if (instant) {
    moodImg.src = `assets/${MOODS[i].img}`;
    knob.style.left = `${knobPosFor(i)}px`;
    return;
  }
  if (!changed) return;
  Sound.tick();
  moodImg.classList.add('changing');
  setTimeout(() => {
    moodImg.src = `assets/${MOODS[i].img}`;
    moodImg.classList.remove('changing');
  }, 200);
}

function sliderMove(e, snap) {
  const { x } = toStage(e, slider);
  const w = TRACK_W - TRACK_PAD * 2;
  const ratio = Math.min(1, Math.max(0, (x - TRACK_PAD) / w));
  const idx = Math.round(ratio * 4);
  knob.style.left = `${snap ? knobPosFor(idx) : TRACK_PAD + ratio * w}px`;
  if (idx !== state.mood) applyMood(idx);
}
slider.addEventListener('pointerdown', (e) => {
  capture(slider, e);
  slider.classList.add('dragging');
  sliderMove(e);
});
slider.addEventListener('pointermove', (e) => {
  if (slider.classList.contains('dragging')) sliderMove(e);
});
slider.addEventListener('pointerup', (e) => {
  if (!slider.classList.contains('dragging')) return;
  slider.classList.remove('dragging');
  sliderMove(e, true);
  markGuided();
});

/* =========================================================
   2~4. 칩 선택
   ========================================================= */
function renderChips(key) {
  const set = CHIP_SETS[key];
  $('#chipQuestion').textContent = set.question;
  const list = $('#chipList');
  list.innerHTML = '';

  const options = [...set.options, ...state.custom[key]];
  options.forEach((label, n) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (state[key] === label ? ' selected' : '');
    chip.textContent = label;
    chip.style.animationDelay = `${n * 0.04}s`;
    chip.addEventListener('click', () => {
      if (advancing) return;
      state[key] = label;
      Sound.select();
      list.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c.textContent === state[key]));
      markGuided();
      autoAdvance();
    });
    list.appendChild(chip);
  });

  // + 버튼: 직접 입력
  const add = document.createElement('button');
  add.className = 'chip add';
  add.textContent = '+';
  add.setAttribute('aria-label', '직접 입력');
  add.style.animationDelay = `${options.length * 0.04}s`;
  add.addEventListener('click', () => {
    Sound.click();
    const input = document.createElement('input');
    input.className = 'chip-input';
    input.id = `custom-${key}`;
    input.maxLength = 8;
    input.placeholder = '직접 입력';
    add.replaceWith(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (v && !options.includes(v)) {
        state.custom[key].push(v);
        state[key] = v;
        Sound.select();
        markGuided();
        renderChips(key);
        autoAdvance();
        return;
      }
      renderChips(key);
      updateNext();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit();
      if (ev.key === 'Escape') { done = true; renderChips(key); }
    });
    input.addEventListener('blur', commit, { once: true });
  });
  list.appendChild(add);
  if (!guided[key] && hint.classList.contains('show')) list.classList.add('nudge');
}

// 선택하면 선택 표시를 잠깐 보여준 뒤 다음 단계로 넘어감
let advancing = false;
function autoAdvance() {
  advancing = true;
  const from = stepIndex;
  setTimeout(() => {
    advancing = false;
    if (stepIndex === from) goStep(from + 1);
  }, 450);
}

/* =========================================================
   6. 감정 카드 — 원형 궤도
   ========================================================= */
const orbit = $('#cardOrbit');
const PIVOT = { x: 850, y: 1277 - 300 }; // 궤도 중심 (orbit 영역 기준)
const RADIUS = 560;
const STEP_DEG = 22;
let rotation = state.emotion; // 소수점까지 포함한 현재 회전 위치
let cardsBuilt = false;

function buildCards() {
  EMOTIONS.forEach((emo, i) => {
    const card = document.createElement('div');
    card.className = 'emo-card';
    card.innerHTML = `<img src="assets/${emo.img}" alt="${emo.name}" />`;
    card.addEventListener('click', () => {
      if (dragMoved) return;
      rotateTo(rotation + wrapDiff(i - rotation));
    });
    orbit.appendChild(card);
  });
  cardsBuilt = true;
}

// 카드 개수만큼 한 바퀴 도는 원형 순서에서 가장 가까운 차이
function wrapDiff(d) {
  const n = EMOTIONS.length;
  return ((((d + n / 2) % n) + n) % n) - n / 2;
}

function renderCards() {
  if (!cardsBuilt) buildCards();
  const n = EMOTIONS.length;
  orbit.querySelectorAll('.emo-card').forEach((card, i) => {
    const d = wrapDiff(i - rotation);
    const angle = d * STEP_DEG;
    const rad = (angle * Math.PI) / 180;
    const cx = PIVOT.x + RADIUS * Math.sin(rad);
    const cy = PIVOT.y - RADIUS * Math.cos(rad);
    const near = Math.max(0, 1 - Math.abs(d)); // 가운데일수록 1
    const s = 0.92 + near * 0.18;
    card.style.transform = `translate(${cx - 135}px, ${cy - 164 - near * 30}px) rotate(${angle}deg) scale(${s})`;
    card.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
    const hidden = Math.abs(d) > 2.5; // 한 화면에 5장
    card.style.opacity = hidden ? 0 : String(1 - Math.max(0, Math.abs(d) - 1) * 0.3);
    card.style.pointerEvents = hidden ? 'none' : 'auto';
  });
  const current = ((Math.round(rotation) % n) + n) % n;
  if (current !== state.emotion) {
    state.emotion = current;
    Sound.tick();
  }
  const pill = $('#emotionPill');
  pill.textContent = EMOTIONS[current].name;
  pill.style.setProperty('--pill', EMOTIONS[current].pill);
}

function rotateTo(r) {
  rotation = Math.round(r);
  Sound.swoosh();
  renderCards();
  markGuided();
}

// 좌우 드래그로 회전
let drag = null;
let dragMoved = false;
orbit.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, start: rotation };
  dragMoved = false;
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - drag.x) / scale;
  if (Math.abs(dx) > 8 && !dragMoved) {
    dragMoved = true;
    orbit.classList.add('dragging');
  }
  if (dragMoved) {
    rotation = drag.start - dx / 210;
    renderCards();
  }
});
window.addEventListener('pointerup', () => {
  if (!drag) return;
  const moved = dragMoved;
  drag = null;
  orbit.classList.remove('dragging');
  if (moved) rotateTo(rotation);
  setTimeout(() => (dragMoved = false), 0);
});
let wheelLock = false;
$('[data-scene="cards"]').addEventListener('wheel', (e) => {
  e.preventDefault();
  if (wheelLock) return;
  wheelLock = true;
  rotateTo(rotation + (e.deltaY > 0 || e.deltaX > 0 ? 1 : -1));
  setTimeout(() => (wheelLock = false), 220);
}, { passive: false });

/* =========================================================
   7. 잔 꾹 누르기 — 물이 차오르고 찰랑임
   ========================================================= */
const glass = $('#glass');
const wave = $('#juiceWave');
const GLASS_H = 624.569;
let pressing = false;
let wavePhase = 0;
let slosh = 0; // 손을 뗀 뒤 남는 찰랑임
let lastTime = 0;
let bubbleTimer = 0;

function drawJuice() {
  const level = GLASS_H * (1 - state.juice / 100) - (state.juice >= 100 ? 20 : 0);
  const amp = state.juice > 0 && state.juice < 100 ? 4 + slosh * 10 + (pressing ? 4 : 0) : 0;
  let d = `M -20 ${level}`;
  for (let x = -20; x <= 440; x += 16) {
    const y = level + Math.sin(x / 40 + wavePhase) * amp + Math.sin(x / 23 - wavePhase * 1.4) * amp * 0.4;
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  d += ` L 440 ${GLASS_H + 20} L -20 ${GLASS_H + 20} Z`;
  wave.setAttribute('d', d);
  $('#juicePct').textContent = `${Math.round(state.juice)}%`;
}

function juiceLoop(t) {
  const dt = Math.min(50, t - (lastTime || t));
  lastTime = t;
  if (STEPS[stepIndex]?.id === 'juice') {
    wavePhase += dt * 0.007;
    slosh = Math.max(0, slosh - dt * 0.0012);
    if (pressing && state.juice < 100) {
      state.juice = Math.min(100, state.juice + dt * 0.028);
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) {
        Sound.bubble();
        bubbleTimer = 70 + Math.random() * 90;
      }
      if (state.juice >= 100) Sound.success();
    }
    drawJuice();
  }
  requestAnimationFrame(juiceLoop);
}
requestAnimationFrame(juiceLoop);

glass.addEventListener('pointerdown', (e) => {
  capture(glass, e);
  pressing = true;
  glass.classList.add('pressing');
  Sound.drop();
  markGuided();
});
['pointerup', 'pointercancel'].forEach((ev) =>
  glass.addEventListener(ev, () => {
    if (!pressing) return;
    pressing = false;
    slosh = 1;
    glass.classList.remove('pressing');
    updateNext();
  })
);

/* =========================================================
   8. 원 따라 그리기
   ========================================================= */
const canvas = $('#drawCanvas');
const ctx = canvas.getContext('2d');
const guide = $('#drawGuide');
const toast = $('#drawToast');
const CIRCLE = { x: 850, y: 674, r: 270 };
let drawing = false;
let bins = new Set();
let lastPt = null;
let strokeTick = 0;
let radii = [];
let strokeStart = 0;

// 그린 원 분석: 얼마나 동그란지(반지름이 고른지), 걸린 시간, 크기
function analyzeCircle() {
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const sd = Math.sqrt(radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length);
  const round = Math.max(0, Math.min(100, Math.round(100 - (sd / mean) * 250)));
  const seconds = Math.round((performance.now() - strokeStart) / 100) / 10;
  return { round, seconds, size: Math.round((mean / CIRCLE.r) * 100) };
}

function resetDraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  guide.classList.toggle('good', state.drawn);
  guide.classList.remove('drawing');
  canvas.style.pointerEvents = state.drawn ? 'none' : 'auto';
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.drawn) return;
  capture(canvas, e);
  drawing = true;
  bins = new Set();
  radii = [];
  strokeStart = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lastPt = toStage(e, canvas);
  guide.classList.add('drawing');
  markGuided();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = toStage(e, canvas);
  const grad = ctx.createLinearGradient(560, 384, 1140, 964);
  grad.addColorStop(0, '#ff8a7a');
  grad.addColorStop(1, '#ffa864');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lastPt.x, lastPt.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  lastPt = p;
  if (++strokeTick % 6 === 0) Sound.tone(700 + bins.size * 25, 0.05, { vol: 0.06, type: 'triangle' });

  const dist = Math.hypot(p.x - CIRCLE.x, p.y - CIRCLE.y);
  radii.push(dist);
  if (Math.abs(dist - CIRCLE.r) < 75) {
    const ang = Math.atan2(p.y - CIRCLE.y, p.x - CIRCLE.x);
    bins.add(Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 36) % 36);
  }
});
canvas.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  guide.classList.remove('drawing');
  if (bins.size >= 30) {
    state.drawn = true;
    state.draw = analyzeCircle();
    Sound.success();
    canvas.style.transition = 'opacity 0.4s';
    canvas.style.opacity = 0;
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.opacity = 1;
      resetDraw();
    }, 400);
    guide.classList.add('good');
    updateNext();
  } else {
    Sound.back();
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1600);
    setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 600);
  }
});

/* =========================================================
   9. 캐릭터 선택
   ========================================================= */
const traits = $('#traits');
['다정한', '현실적인', '장난스런'].forEach((label) => {
  const row = document.createElement('div');
  row.className = 'trait';
  row.innerHTML = `<span>${label}</span>` + '<i></i>'.repeat(5);
  traits.appendChild(row);
});

function applyCharacter(delta) {
  state.character = (state.character + delta + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[state.character];
  const big = $('#charBig');
  if (delta) {
    big.classList.add('changing');
    setTimeout(() => {
      big.src = `assets/char-${c.id}.png`;
      big.classList.remove('changing');
    }, 200);
  } else {
    big.src = `assets/char-${c.id}.png`;
  }
  $('#charPedestal').src = `assets/ped-${c.id}.png`;
  const name = $('#charName');
  name.textContent = c.name;
  name.style.setProperty('--n1', c.grad[0]);
  name.style.setProperty('--n2', c.grad[1]);
  traits.querySelectorAll('.trait').forEach((row, r) => {
    row.querySelectorAll('i').forEach((dot, k) => {
      dot.classList.toggle('on', k < c.traits[r]);
      dot.style.setProperty('--dot', c.dot);
    });
  });
}
$('#charPrev').addEventListener('click', () => { Sound.swoosh(); applyCharacter(-1); markGuided(); });
$('#charNext').addEventListener('click', () => { Sound.swoosh(); applyCharacter(1); markGuided(); });

/* =========================================================
   로딩 → 결과
   ========================================================= */
function startLoading() {
  const c = CHARACTERS[state.character];
  stepIndex = STEPS.length; // 기록 단계 밖 (가이드가 다시 뜨지 않도록)
  stepUi.classList.remove('show');
  hideHint();
  setPalette(c.bg);
  $('#loadingChar').src = `assets/load-${c.id}.png`;
  const text = $('#loadingText');
  text.innerHTML = `<span>${c.name}${josa(c.name, '이', '가')} 순간을 분석하고 있어요</span>`;
  text.style.setProperty('--n1', c.grad[0]);
  text.style.setProperty('--n2', c.grad[1]);
  $('.loading-dots').style.setProperty('--dot', c.dot);
  showScene('loading');
  Sound.whoosh();
  setTimeout(showResult, 2800);
}

// 받침 유무에 따른 조사 선택
function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 ? withBatchim : without;
}

const DO_VERB = { 공부: '공부하던', 출근: '출근하던', 등교: '등교하던', 일: '일하던', 대화: '대화하던', 여가: '여가를 보내던' };

function buildFeedback(s = state) {
  const c = CHARACTERS[s.character];
  const emo = EMOTIONS[s.emotion].name;
  const act = DO_VERB[s.activity] || `${s.activity}${josa(s.activity, '을', '를')} 하던`;
  const withWho = s.who === '혼자' ? '혼자' : `${s.who}${josa(s.who, '과', '와')} 함께`;
  const moment = `${s.place}에서 ${withWho} ${act} 순간`;
  const level = s.juice < 34 ? '살짝' : s.juice < 67 ? '꽤' : '가득';
  const tone = s.mood <= 1 ? 'low' : s.mood === 2 ? 'mid' : 'high';

  const T = {
    hamster: [
      `정리해볼게! ${moment}, 감정은 '${emo}', 감정의 크기는 ${Math.round(s.juice)}%야.`,
      { low: '기분이 안 좋은 날엔 원인을 딱 하나만 찾아보자. 생각보다 작은 것일 수도 있어.', mid: '무난한 하루도 꽤 괜찮은 성과야. 내일은 작은 즐거움 하나를 계획해보자!', high: '좋은 순간엔 이유가 있어. 그게 뭐였는지 기억해두면 또 만들 수 있지!' }[tone],
      '오늘 저녁, 부모님께 이 순간을 한 문장으로 말해보는 건 어때?',
    ],
    bird: [
      `${moment}, ${emo} 마음이 ${level} 차올랐구나.`,
      { low: '그런 마음이 들 땐 누구라도 지칠 수 있어. 오늘 정말 애썼어.', mid: '평범해 보여도 소중한 하루의 한 조각이야.', high: '네가 웃는 순간이라니, 듣는 나까지 행복해져!' }[tone],
      '말로 다 못 해도 괜찮아. 마음은 천천히 전해지니까.',
    ],
    sprout: [
      `${moment}에 '${emo}' 감정이 ${level} 피어났네.`,
      { low: '이럴 땐 잠깐 쉬어가는 것도 좋은 방법이야. 따뜻한 물 한 잔 어때?', mid: '잔잔한 날도 차곡차곡 쌓이면 힘이 돼.', high: '이 기분을 기억해두면 힘든 날 꺼내 볼 수 있어.' }[tone],
      '부모님께 오늘의 마음을 살짝 들려드려 봐. 생각보다 쉬울지도 몰라.',
    ],
    pig: [
      `꿀꿀! ${moment}이라니~ ${emo} 기분 냄새가 여기까지 나는걸?`,
      { low: '기분 나쁜 날엔 맛있는 거 먹고 꿀잠 자는 게 최고야. 내가 보증할게!', mid: '평범한 날? 그럼 내가 오늘을 재밌게 만들어주지! 꿀꿀~', high: '와아~ 그 기분 나한테도 나눠줘! 같이 데굴데굴 구르자!' }[tone],
      '하고 싶은 말이 안 떠오르면 "사랑해요!" 어때? 히히.',
    ],
    lion: [
      `어흥~ 초코별에서 다 보고 있었어! ${moment}, ${emo} 마음이 ${level} 반짝였네.`,
      { low: '힘든 날엔 사자도 꼬리를 내리고 쉬어. 오늘은 푹 쉬고, 내일 다시 기운 내자!', mid: '별일 없는 하루도 반짝이는 별 하나쯤은 숨어 있어. 같이 찾아볼래?', high: '이렇게 좋은 기분이라니, 내 갈기까지 신나서 들썩거려! 어흥!' }[tone],
      '말이 안 떠올라도 괜찮아. 꼭 안아드리는 것도 멋진 대답이야.',
    ],
  };
  return T[c.id].join(' ');
}

/* ---------- 기록 분석: 입력 → 분석 → 최종 기록 ---------- */
const MOOD_BASE = ['많이 지친', '조금 가라앉은', '평온한', '밝은', '아주 밝은'];
const MOOD_TAG = ['힘들었던', '서운했던', '평범한', '기분 좋은', '행복한'];

function intensityOf(juice) {
  return juice < 34 ? '은은하게' : juice < 67 ? '분명하게' : '아주 강하게';
}
// 그린 원 해석: 걸린 시간 → 그린 속도, 동그란 정도 → 마음의 모양
function drawMindOf(d) {
  if (!d) return { speed: '편안하게', shape: '편안한' };
  const speed = d.seconds < 1.6 ? '힘차게' : d.seconds > 4.5 ? '차분하게' : '편안하게';
  const shape = d.round >= 85 ? '안정적인' : d.round >= 65 ? '부드러운' : '조금 흔들리는';
  return { speed, shape };
}

function buildAnalysis(s = state) {
  const emo = EMOTIONS[s.emotion].name;
  const d = s.draw || { round: 0, seconds: 0, size: 100 };
  const juice = Math.round(s.juice);
  const mind = drawMindOf(d);
  return {
    rows: [
      { step: '기분 바', input: `'${MOODS[s.mood].label}' 선택`, out: `감정의 바탕을 '${MOOD_BASE[s.mood]}' 상태로 봤어요` },
      { step: '순간', input: `${s.activity} · ${s.place} · ${s.who}`, out: '어떤 상황이었는지 키워드로 정리했어요' },
      { step: '감정 카드', input: `'${emo}' 카드`, out: '이번 순간의 핵심 감정으로 정했어요' },
      { step: '잔 채우기', input: `${juice}% 채움`, out: `감정의 세기를 '${intensityOf(juice)}'로 봤어요` },
      { step: '원 그리기', input: `동그란 정도 ${d.round}% · ${d.seconds}초`, out: `${mind.speed} 그린 ${mind.shape} 마음으로 봤어요` },
    ],
    final: `${MOOD_BASE[s.mood]} 하루 속에서 <strong>'${emo}'</strong> 감정을 ${intensityOf(juice)} 느꼈고, ${mind.shape} 마음으로 기록했어요.`,
  };
}

// 기록에 맞는 #키워드
function buildTags(s = state) {
  const who = s.who === '혼자' ? '혼자만의' : s.who === '모르는 사람' ? '낯선 사람과의' : `${s.who}${josa(s.who, '과', '와')}의`;
  return [`# ${EMOTIONS[s.emotion].name}`, `# ${who} ${s.activity}`, `# ${MOOD_TAG[s.mood]} 순간`];
}

// 짧은 행동 추천 + 이모지 (두 줄)
function buildAction(s = state) {
  const parent = s.who === '엄마' || s.who === '아빠';
  const sets = {
    low: [['오늘은 부모님께', '힘들었다고 말해보자', '🫂'], ['따뜻한 물 한 잔 마시고', '푹 쉬어 보자', '🍵']],
    mid: [['가끔은 부모님께 먼저', '안부를 물어보자!', '💗'], ['저녁 식탁에서 오늘', '있었던 일을 나눠보자', '🍚']],
    high: [['이 기분 그대로', '부모님께 먼저 인사해보자!', '🖐'], ['오늘의 좋은 순간을', '부모님께 자랑해보자!', '✨']],
  };
  if (parent && s.mood >= 2) return [`${s.who}에게 오늘`, '고맙다고 말해보자!', '💐'];
  const tone = s.mood <= 1 ? 'low' : s.mood === 2 ? 'mid' : 'high';
  return sets[tone][(s.emotion + s.activity.length) % 2];
}

let lastRecord = null;

function showResult() {
  const c = CHARACTERS[state.character];
  $('#resultChar').src = `assets/char-${c.id}.png`;
  $('#resultPedestal').src = `assets/ped-${c.id}.png`;
  const from = $('#feedbackFrom');
  from.textContent = `${c.name}의 피드백`;
  from.style.color = c.bubbleName;

  const analysis = buildAnalysis();
  $('#analysis').innerHTML = analysis.rows.map((r) => `
    <li><b>${r.step}</b><span class="in">${esc(r.input)}</span><span class="out">${esc(r.out)}</span></li>`).join('');
  const final = $('#analysisFinal');
  final.innerHTML = `최종 기록 · ${analysis.final}`;
  final.style.setProperty('--accent', c.card[2]);

  showScene('result');
  Sound.success();
  const feedback = buildFeedback();
  typeText($('#feedbackText'), feedback);
  lastRecord = saveRecord(feedback);
}

// 마지막 기록 카드
function showCard() {
  const c = CHARACTERS[state.character];
  const card = $('#momentCard');
  const [base, a0, a1, tag] = c.card;
  card.style.setProperty('--card', base);
  card.style.setProperty('--card-glow', `${base}40`);
  card.style.setProperty('--card-line', `${tag}`);
  card.style.setProperty('--a0', a0);
  card.style.setProperty('--a1', a1);
  card.style.setProperty('--tag', tag);
  const [l1, l2, emoji] = lastRecord?.action || buildAction();
  renderAction(`${l1} ${l2}`, emoji);
  $('#cardTags').innerHTML = (lastRecord?.tags || buildTags()).map((t) => `<li>${esc(t)}</li>`).join('');
  $('#cardChar').src = `assets/char-${c.id}.png`;
  showScene('card');
  Sound.whoosh();
}

// 행동 추천 문구: 캐릭터 영역 전까지만 쓰고 자연스럽게 줄바꿈.
// 마지막 단어와 이모지는 같은 줄에 붙여 두고, 3줄을 넘으면 글자를 줄임
function renderAction(text, emoji) {
  const el = $('#cardAction');
  const words = text.trim().split(/\s+/);
  const last = words.pop();
  el.innerHTML = `<span class="grad">${esc(words.join(' '))} </span><span class="tail"><span class="grad">${esc(last)}</span> ${emoji}</span>`;
  let size = 67;
  el.style.fontSize = `${size}px`;
  el.style.lineHeight = `${size * 1.37}px`;
  while (el.scrollHeight > size * 1.37 * 3 + 4 && size > 44) {
    size -= 3;
    el.style.fontSize = `${size}px`;
    el.style.lineHeight = `${size * 1.37}px`;
  }
}

$('#resultNext').addEventListener('click', () => {
  clearInterval(typeTimer);
  Sound.click();
  showCard();
});

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// 피드백 타자 효과
let typeTimer;
function typeText(el, text) {
  clearInterval(typeTimer);
  el.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typeTimer);
  }, 28);
}

$('#homeBtn').addEventListener('click', () => {
  clearInterval(typeTimer);
  Sound.click();
  state = freshState();
  guided = {};
  rotation = state.emotion;
  goStep(-1);
});

/* =========================================================
   기록 저장 & 기록 보기
   ========================================================= */
const RECORDS_KEY = 'oneuluri-records';

function saveRecord(feedback) {
  const records = store.get(RECORDS_KEY, []);
  const record = {
    date: new Date().toISOString(),
    mood: state.mood,
    activity: state.activity,
    place: state.place,
    who: state.who,
    emotion: state.emotion,
    juice: Math.round(state.juice),
    character: state.character,
    draw: state.draw,
    feedback,
    tags: buildTags(),
    action: buildAction(),
  };
  records.unshift(record);
  store.set(RECORDS_KEY, records.slice(0, 60));
  return record;
}

function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const modal = $('#recordsModal');
function openRecords() {
  const records = store.get(RECORDS_KEY, []);
  const list = $('#recordsList');
  $('#recordsCount').textContent = records.length
    ? `이 기기에서 남긴 기록 ${records.length}개`
    : '이 기기에서 남긴 기록이 여기에 모여요.';
  list.innerHTML = records.length
    ? records.map((r) => {
        const c = CHARACTERS[r.character] || CHARACTERS[0];
        return `
          <article class="record">
            <img src="assets/char-${c.id}.png" alt="${c.name}" />
            <p class="r-date">${formatDate(r.date)}</p>
            <p class="r-main">${MOODS[r.mood]?.label ?? ''} · ${EMOTIONS[r.emotion]?.name ?? ''}</p>
            <p class="r-tags">${r.tags ? r.tags.map(esc).join(' ') : `${esc(r.activity)} · ${esc(r.place)} · ${esc(r.who)}`} · ${r.juice}%</p>
            <p class="r-text">${esc(r.feedback)}</p>
          </article>`;
      }).join('')
    : `<p class="records-empty">아직 남긴 기록이 없어요.<br />'시작하기'를 눌러 첫 순간을 기록해 봐!</p>`;
  modal.hidden = false;
}
$('#recordsBtn').addEventListener('click', () => { Sound.click(); openRecords(); });
$('#recordsClose').addEventListener('click', () => { Sound.back(); modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

setPalette(DEFAULT_PALETTE);

/* =========================================================
   이 순간의 감정 — 화면 흐름 & 인터랙션
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');

/* ---------- 화면 비율 맞추기 (1920x1080 기준) ---------- */
let scale = 1;
function fitStage() {
  scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.setProperty('--scale', scale);
}
window.addEventListener('resize', fitStage);
fitStage();

// 화면 좌표 → 스테이지(1920x1080) 좌표
function toStage(e, el = stage) {
  const r = el.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

// 포인터 캡처 (지원하지 않는 환경에서도 오류 없이)
function capture(el, e) {
  try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
}

/* ---------- 데이터 ---------- */
const MOODS = [
  { label: '매우 좋지 않음', img: 'mood-1.png', colors: ['#ff9b9b', '#ffc4c0', '#ffeae6'], text: ['#4a2222', '#d0504f'] },
  { label: '좋지 않음', img: 'mood-2.png', colors: ['#ffa985', '#ffcdb3', '#fff0e3'], text: ['#3f2618', '#d0683a'] },
  { label: '보통', img: 'mood-3.png', colors: ['#ffbc89', '#ffd8b3', '#fff3dd'], text: ['#3b2a20', '#c0702e'] },
  { label: '좋음', img: 'mood-4.png', colors: ['#ffd27a', '#ffe6ad', '#fff8e0'], text: ['#3e3016', '#c59a1e'] },
  { label: '매우 좋음', img: 'mood-5.png', colors: ['#9fdcaa', '#c9ebc9', '#eff9ea'], text: ['#1f3a24', '#4f9d5c'] },
];

const CHIP_SETS = {
  activity: { question: '무엇을 하고 있었나요?', options: ['공부', '출근', '등교', '일', '대화', '여가'] },
  place: { question: '어디에 있었나요?', options: ['학교', '회사', '버스', '집', '가게', '공원'] },
  who: { question: '누구와 함께했나요?', options: ['엄마', '아빠', '아이', '혼자', '친구', '모르는 사람'] },
};

const EMOTIONS = [
  { name: '슬픈', card: '#e6e1d8', blob: '#b9b4ad', shape: '50%' },
  { name: '지루한', card: '#b7bbd8', blob: '#d6daee', shape: '60% 40% 55% 45% / 50% 60% 40% 50%' },
  { name: '무난한', card: '#f7c4e8', blob: '#fde6f5', shape: '45% 55% 40% 60% / 55% 45% 60% 40%' },
  { name: '즐거운', card: '#efe7a0', blob: '#dcc65a', shape: '30%' },
  { name: '행복한', card: '#f3f1ee', blob: '#ffffff', shape: '50%' },
  { name: '설레는', card: '#ffcdb5', blob: '#ffe8dc', shape: '50% 50% 40% 40%' },
  { name: '뿌듯한', card: '#c6e6b8', blob: '#e6f5dc', shape: '40%' },
  { name: '여유로운', card: '#bfe3e6', blob: '#e4f5f6', shape: '60% 40% 50% 50%' },
  { name: '화난', card: '#ffb3a7', blob: '#ff8c7a', shape: '20%' },
  { name: '불안한', card: '#d7c4ec', blob: '#eee3f9', shape: '55% 45% 35% 65%' },
];

// pedestal: 받침대 색 필터, pedestalImg: 받침대 이미지(기본 노란색), bg: 로딩·피드백 화면 배경색
const CHARACTERS = [
  { id: 'hamster', name: '다이아 골든 햄스터', img: 'char-hamster.png', traits: [3, 4, 1], grad: ['#bb9b35', '#554618'], dot: '#ffc21a',
    pedestal: 'none', bg: ['#ffd66e', '#ffe7a8', '#fff8df'] },
  { id: 'bird', name: '사과 코끼리', img: 'char-bird.png', traits: [5, 2, 3], grad: ['#6f9be0', '#2f4f8a'], dot: '#5b8ff0',
    pedestal: 'hue-rotate(175deg)', bg: ['#93bdf5', '#c3dbfa', '#edf5fe'] },
  { id: 'sprout', name: '새싹 뭉실양', img: 'char-sprout.png', traits: [4, 3, 2], grad: ['#8fb35a', '#41562a'], dot: '#9ed85a',
    pedestal: 'hue-rotate(55deg)', bg: ['#a5da98', '#cbecc3', '#eff9ea'] },
  { id: 'pig', name: '소세지 돼지', img: 'char-pig.png', traits: [2, 1, 5], grad: ['#e88aa5', '#8a3d55'], dot: '#f58fb3',
    pedestal: 'hue-rotate(-45deg)', bg: ['#f7a6c3', '#fbcde0', '#fff0f6'] },
  { id: 'lion', name: '초코별 사자', img: 'char-lion.png', traits: [4, 2, 4], grad: ['#8a6656', '#3d2a22'], dot: '#7b4a33',
    pedestal: 'saturate(0.6) brightness(0.6)', pedestalImg: 'pedestal-orange.png', bg: ['#bf9278', '#dcc0ab', '#f5ebe2'] },
];

const BUBBLES = [
  '그러니까... 네 순간은....',
  '오늘은 어떤 하루였어?',
  '수정구슬에 네 마음이 비쳐...',
  '지금 기분, 정말 궁금한걸?',
  '부모님께 마음을 전해볼까?',
  '음... 뭔가 느껴져...!',
];

/* ---------- 상태 ---------- */
const state = {
  mood: 2,
  activity: null,
  place: null,
  who: null,
  custom: { activity: [], place: [], who: [] },
  emotion: 2,
  juice: 0,
  drawn: false,
  message: '',
  character: 0,
};

/* ---------- 단계 정의 ---------- */
const STEPS = [
  { id: 'mood', scene: 'mood', title: '지금 이 순간!<br>네 기분이 궁금해.', sub: '지금 느끼는 기분을 선택하세요.' },
  { id: 'activity', scene: 'chips', title: '무슨 순간이 다녀갔어?', sub: '어떤 순간이었는지 선택해주세요.' },
  { id: 'place', scene: 'chips', title: '무슨 순간이 다녀갔어?', sub: '어떤 순간이었는지 선택해주세요.' },
  { id: 'who', scene: 'chips', title: '무슨 순간이 다녀갔어?', sub: '어떤 순간이었는지 선택해주세요.' },
  { id: 'confirm', scene: 'empty', title: '이 순간이 맞을까?', sub: '기록된 순간이 맞는지 확인해주세요.' },
  { id: 'emotion', scene: 'cards', title: '어떤 감정이<br>지나갔는지 궁금해!', sub: '느낀 감정에 맞는 감정 카드를 골라주세요.' },
  { id: 'juice', scene: 'juice', title: '느끼는 네 감정만큼<br>잔을 꾹 눌러서 채워줘.', sub: '잔을 꾹~ 눌러주세요.' },
  { id: 'draw', scene: 'draw', title: '이 순간을 떠올리며<br>원을 따라 그려볼까?', sub: '마우스로 원을 따라 그리세요!' },
  { id: 'message', scene: 'message', title: '지금 이 순간 부모님께<br>하고 싶은 말은 뭐야?', sub: '하고 싶은 말을 자유롭게 적어주세요.' },
  { id: 'character', scene: 'character', title: '마지막이야! 결과를<br>함께할 캐릭터를 선택해.', sub: '선택한 캐릭터가 피드백을 남겨줍니다.', next: '완료하기' },
];

let stepIndex = -1; // -1 = 시작 화면

const stepPanel = $('#stepPanel');
const panelBody = $('#panelBody');
const nextBtn = $('#nextBtn');

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
  if (i < 0) {
    showScene('start');
    stepPanel.classList.remove('show');
    return;
  }
  const step = STEPS[i];
  showScene(step.scene);
  setMoodColors(step.id === 'mood' ? state.mood : 2); // 배경 색은 기분 단계에서만 변경
  stepPanel.classList.add('show', 'swap');

  // 패널 텍스트는 살짝 페이드 후 교체
  setTimeout(() => {
    $('#stepTitle').innerHTML = step.title;
    $('#stepSub').textContent = step.sub;
    nextBtn.textContent = step.next || '다음 단계';
    $('#progressFill').style.width = `${((i + 1) / (STEPS.length + 1)) * 100}%`;
    panelBody.innerHTML = '';
    ENTER[step.id]?.();
    updateNext();
    stepPanel.classList.remove('swap');
  }, stepPanel.dataset.ready ? 220 : 0);
  stepPanel.dataset.ready = '1';
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
function updateNext() { nextBtn.disabled = !canNext(); }

$('#startBtn').addEventListener('click', () => goStep(0));
$('#prevBtn').addEventListener('click', () => goStep(stepIndex - 1));
nextBtn.addEventListener('click', () => {
  if (!canNext()) return;
  if (stepIndex === STEPS.length - 1) startLoading();
  else goStep(stepIndex + 1);
});

/* ---------- 패널 공용: 선택된 순간 태그 ---------- */
function renderTags(keys) {
  const list = document.createElement('div');
  list.className = 'tag-list';
  keys.forEach((k, n) => {
    if (!state[k]) return;
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = state[k];
    t.style.animationDelay = `${n * 0.08}s`;
    list.appendChild(t);
  });
  panelBody.appendChild(list);
}

/* =========================================================
   단계별 진입 처리
   ========================================================= */
const ENTER = {
  mood() {
    const word = document.createElement('div');
    word.className = 'mood-word';
    word.id = 'moodWord';
    panelBody.appendChild(word);
    applyMood(state.mood, true);
  },
  activity() { renderChips('activity'); },
  place() { renderChips('place'); renderTags(['activity']); },
  who() { renderChips('who'); renderTags(['activity', 'place']); },
  confirm() { renderTags(['activity', 'place', 'who']); },
  emotion() {
    panelBody.innerHTML = '<div class="emotion-pick">선택한 감정 <b id="emotionPick"></b></div>';
    renderCards();
  },
  juice() {
    panelBody.innerHTML = '<div class="juice-meter"><strong id="juicePct">0%</strong><span>만큼 채웠어요</span></div>';
    drawJuice();
  },
  draw() { resetDraw(); },
  message() {
    setTimeout(() => $('#messageInput').focus(), 400);
  },
  character() {
    panelBody.innerHTML = `
      <div class="char-info">
        <img class="char-mini" id="charMini" alt="" />
        <p class="char-name" id="charName"></p>
        <div class="trait" style="top:127px"><span>다정한</span></div>
        <div class="trait" style="top:183px"><span>현실적인</span></div>
        <div class="trait" style="top:242px"><span>장난스런</span></div>
      </div>`;
    applyCharacter(0);
  },
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
const TRACK_PAD = 52; // 손잡이 반지름만큼 여백

function knobPosFor(i) {
  const w = 896 - TRACK_PAD * 2;
  return TRACK_PAD + (w * i) / 4;
}

function applyMood(i, instant) {
  const changed = i !== state.mood || instant;
  state.mood = i;
  setMoodColors(i);
  const word = $('#moodWord');
  if (word) {
    word.innerHTML = `<span>${MOODS[i].label}</span>`;
    word.classList.toggle('long', MOODS[i].label.length > 3);
  }
  if (!changed) return;
  moodImg.classList.add('changing');
  setTimeout(() => {
    moodImg.src = `assets/${MOODS[i].img}`;
    moodImg.classList.remove('changing');
  }, instant ? 0 : 200);
}

function sliderMove(e, snap) {
  const { x } = toStage(e, slider);
  const w = 896 - TRACK_PAD * 2;
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
  slider.classList.remove('dragging');
  sliderMove(e, true);
});
knob.style.left = `${knobPosFor(state.mood)}px`;

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
      state[key] = state[key] === label ? null : label;
      list.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c.textContent === state[key]));
      updateNext();
    });
    list.appendChild(chip);
  });

  // + 버튼: 직접 입력
  const add = document.createElement('button');
  add.className = 'chip add';
  add.textContent = '+';
  add.style.animationDelay = `${options.length * 0.04}s`;
  add.addEventListener('click', () => {
    const input = document.createElement('input');
    input.className = 'chip-input';
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
}

/* =========================================================
   6. 감정 카드 (부채꼴 + 다이얼)
   ========================================================= */
const fan = $('#cardFan');
const dial = $('#dial');
const dialDot = $('#dialDot');
const PIVOT = { x: 548, y: 1300 };
const RADIUS = 920;
const STEP_DEG = 17;
let cardsBuilt = false;
let dialRotation = 0; // 연속 회전 각도

function buildCards() {
  EMOTIONS.forEach((emo, i) => {
    const card = document.createElement('div');
    card.className = 'emo-card';
    card.style.setProperty('--card', emo.card);
    card.style.setProperty('--blob', emo.blob);
    card.innerHTML = `<span class="label">${emo.name}</span><span class="blob" style="border-radius:${emo.shape}"></span>`;
    card.addEventListener('click', () => {
      if (fanDragMoved) return;
      setEmotion(i);
    });
    fan.appendChild(card);
  });
  cardsBuilt = true;
}

function renderCards() {
  if (!cardsBuilt) buildCards();
  const cards = fan.querySelectorAll('.emo-card');
  cards.forEach((card, i) => {
    const d = i - state.emotion;
    const angle = d * STEP_DEG;
    const rad = (angle * Math.PI) / 180;
    const cx = PIVOT.x + RADIUS * Math.sin(rad);
    const cy = PIVOT.y - RADIUS * Math.cos(rad);
    const selected = d === 0;
    const s = selected ? 1.14 : 0.94;
    card.style.transform = `translate(${cx - 135}px, ${cy - 175 - (selected ? 30 : 0)}px) rotate(${angle}deg) scale(${s})`;
    card.style.zIndex = 100 - Math.abs(d);
    const hidden = d > 2 || d < -3; // 오른쪽은 패널에 가려지지 않게 2장까지만
    card.style.opacity = hidden ? 0 : 1 - Math.max(0, Math.abs(d) - 1) * 0.35;
    card.style.pointerEvents = hidden ? 'none' : 'auto';
    card.classList.toggle('selected', selected);
  });
  const pick = $('#emotionPick');
  if (pick) {
    pick.textContent = EMOTIONS[state.emotion].name;
    pick.style.setProperty('--card', EMOTIONS[state.emotion].card);
  }
  dialDot.style.transform = `rotate(${dialRotation}deg) translateY(-170px)`;
}

function setEmotion(i) {
  const next = Math.max(0, Math.min(EMOTIONS.length - 1, i));
  dialRotation += (next - state.emotion) * 30;
  state.emotion = next;
  renderCards();
}

// 다이얼 돌리기: 30도마다 카드 한 장
let dialStart = null;
function dialAngle(e) {
  const p = toStage(e);
  return (Math.atan2(p.y - 866, p.x - 548) * 180) / Math.PI;
}
dial.addEventListener('pointerdown', (e) => {
  capture(dial, e);
  dial.classList.add('dragging');
  dialStart = { angle: dialAngle(e), rot: dialRotation, emo: state.emotion };
});
dial.addEventListener('pointermove', (e) => {
  if (!dialStart) return;
  let delta = dialAngle(e) - dialStart.angle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  dialStart.angle += delta;
  dialRotation += delta;
  const moved = Math.round((dialRotation - dialStart.rot) / 30);
  const target = Math.max(0, Math.min(EMOTIONS.length - 1, dialStart.emo + moved));
  if (target !== state.emotion) { state.emotion = target; }
  renderCards();
});
dial.addEventListener('pointerup', () => {
  dial.classList.remove('dragging');
  dialStart = null;
  dialRotation = Math.round(dialRotation / 30) * 30;
  renderCards();
});

// 카드 영역 드래그 / 휠
let fanDrag = null;
let fanDragMoved = false;
fan.addEventListener('pointerdown', (e) => {
  fanDrag = { x: e.clientX, emo: state.emotion };
  fanDragMoved = false;
});
window.addEventListener('pointermove', (e) => {
  if (!fanDrag) return;
  const dx = (e.clientX - fanDrag.x) / scale;
  if (Math.abs(dx) > 10) fanDragMoved = true;
  const target = fanDrag.emo - Math.round(dx / 160);
  if (target !== state.emotion) setEmotion(target);
});
window.addEventListener('pointerup', () => {
  fanDrag = null;
  setTimeout(() => (fanDragMoved = false), 0);
});
let wheelLock = false;
$('[data-scene="cards"]').addEventListener('wheel', (e) => {
  e.preventDefault();
  if (wheelLock) return;
  wheelLock = true;
  setEmotion(state.emotion + (e.deltaY > 0 || e.deltaX > 0 ? 1 : -1));
  setTimeout(() => (wheelLock = false), 220);
}, { passive: false });

/* =========================================================
   7. 주스 잔 꾹 누르기
   ========================================================= */
const glass = $('#glass');
const wave = $('#juiceWave');
const GLASS_H = 624.569;
let pressing = false;
let wavePhase = 0;
let lastTime = 0;

function drawJuice() {
  // 채움 높이에 따라 물결치는 수면을 그림
  const level = GLASS_H * (1 - state.juice / 100) + (state.juice >= 100 ? -20 : 0);
  const amp = state.juice > 0 && state.juice < 100 ? (pressing ? 9 : 5) : 0;
  let d = `M -20 ${level}`;
  for (let x = -20; x <= 440; x += 20) {
    const y = level + Math.sin(x / 45 + wavePhase) * amp;
    d += ` L ${x} ${y}`;
  }
  d += ` L 440 ${GLASS_H + 20} L -20 ${GLASS_H + 20} Z`;
  wave.setAttribute('d', d);
  const pct = $('#juicePct');
  if (pct) pct.textContent = `${Math.round(state.juice)}%`;
}

function juiceLoop(t) {
  const dt = Math.min(50, t - (lastTime || t));
  lastTime = t;
  if (STEPS[stepIndex]?.id === 'juice') {
    wavePhase += dt * 0.006;
    if (pressing && state.juice < 100) {
      state.juice = Math.min(100, state.juice + dt * 0.03);
      updateNext();
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
});
['pointerup', 'pointercancel'].forEach((ev) =>
  glass.addEventListener(ev, () => {
    pressing = false;
    glass.classList.remove('pressing');
  })
);

/* =========================================================
   8. 원 따라 그리기
   ========================================================= */
const canvas = $('#drawCanvas');
const ctx = canvas.getContext('2d');
const guide = $('#drawGuide');
const toast = $('#drawToast');
const CIRCLE = { x: 557, y: 557, r: 323 };
let drawing = false;
let bins = new Set();
let lastPt = null;

function resetDraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  guide.classList.toggle('good', state.drawn);
  canvas.style.pointerEvents = state.drawn ? 'none' : 'auto';
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.drawn) return;
  capture(canvas, e);
  drawing = true;
  bins = new Set();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lastPt = toStage(e, canvas);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = toStage(e, canvas);
  const grad = ctx.createLinearGradient(200, 200, 900, 900);
  grad.addColorStop(0, '#ff8a7a');
  grad.addColorStop(1, '#ffa864');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lastPt.x, lastPt.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  lastPt = p;

  const dist = Math.hypot(p.x - CIRCLE.x, p.y - CIRCLE.y);
  if (Math.abs(dist - CIRCLE.r) < 80) {
    const ang = Math.atan2(p.y - CIRCLE.y, p.x - CIRCLE.x);
    bins.add(Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 36) % 36);
  }
});
canvas.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  if (bins.size >= 30) {
    state.drawn = true;
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
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1600);
    setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 600);
  }
});

/* =========================================================
   9. 하고 싶은 말
   ========================================================= */
const messageInput = $('#messageInput');
messageInput.addEventListener('input', () => {
  state.message = messageInput.value;
  $('#messageCount').textContent = `${messageInput.value.length} / 200`;
});

/* =========================================================
   10. 캐릭터 선택
   ========================================================= */
function setPedestal(img, c) {
  img.src = `assets/${c.pedestalImg || 'pedestal-yellow.png'}`;
  img.style.filter = c.pedestal;
}

function applyCharacter(delta) {
  state.character = (state.character + delta + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[state.character];
  const big = $('#charBig');
  big.classList.add('changing');
  setTimeout(() => {
    big.src = `assets/${c.img}`;
    big.classList.remove('changing');
  }, delta ? 200 : 0);
  setPedestal($('#charPedestal'), c);

  const mini = $('#charMini');
  if (!mini) return;
  mini.src = `assets/${c.img}`;
  const name = $('#charName');
  name.textContent = c.name;
  name.style.setProperty('--n1', c.grad[0]);
  name.style.setProperty('--n2', c.grad[1]);
  panelBody.querySelectorAll('.trait').forEach((row, r) => {
    row.querySelectorAll('i').forEach((dot) => dot.remove());
    for (let k = 0; k < 5; k++) {
      const dot = document.createElement('i');
      if (k < c.traits[r]) dot.className = 'on';
      dot.style.setProperty('--dot', c.dot);
      row.appendChild(dot);
    }
  });
}
$('#charPrev').addEventListener('click', () => applyCharacter(-1));
$('#charNext').addEventListener('click', () => applyCharacter(1));

/* =========================================================
   로딩 → 결과
   ========================================================= */
function startLoading() {
  const c = CHARACTERS[state.character];
  stepPanel.classList.remove('show');
  $('#loadingChar').src = `assets/${c.img}`;
  $('#loadingText').textContent = `${c.name}${josa(c.name, '이', '가')} 피드백을 쓰고 있어요`;
  setPalette(c.bg); // 로딩·피드백 화면은 캐릭터 색 배경
  showScene('loading');
  setTimeout(showResult, 2600);
}

// 받침 유무에 따른 조사 선택
function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 ? withBatchim : without;
}

const DO_VERB = { 공부: '공부하던', 출근: '출근하던', 등교: '등교하던', 일: '일하던', 대화: '대화하던', 여가: '여가를 보내던' };

function buildFeedback() {
  const c = CHARACTERS[state.character];
  const emo = EMOTIONS[state.emotion].name;
  const act = DO_VERB[state.activity] || `${state.activity}${josa(state.activity, '을', '를')} 하던`;
  const withWho = state.who === '혼자' ? '혼자' : `${state.who}${josa(state.who, '과', '와')} 함께`;
  const moment = `${state.place}에서 ${withWho} ${act} 순간`;
  const level = state.juice < 34 ? '살짝' : state.juice < 67 ? '꽤' : '가득';
  const tone = state.mood <= 1 ? 'low' : state.mood === 2 ? 'mid' : 'high';
  const msg = state.message.trim();
  const shortMsg = msg.length > 40 ? msg.slice(0, 40) + '…' : msg;

  const T = {
    hamster: [
      `정리해볼게! ${moment}, 감정은 '${emo}', 감정의 크기는 ${Math.round(state.juice)}%야.`,
      { low: '기분이 안 좋은 날엔 원인을 딱 하나만 찾아보자. 생각보다 작은 것일 수도 있어.', mid: '무난한 하루도 꽤 괜찮은 성과야. 내일은 작은 즐거움 하나를 계획해보자!', high: '좋은 순간엔 이유가 있어. 그게 뭐였는지 기억해두면 또 만들 수 있지!' }[tone],
      shortMsg ? `"${shortMsg}" — 이 말은 타이밍이 중요해. 저녁 먹을 때 슬쩍 꺼내봐!` : '하고 싶은 말이 떠오르면, 짧게라도 메모해두는 걸 추천해.',
    ],
    bird: [
      `${moment}, ${emo} 마음이 ${level} 차올랐구나.`,
      { low: '그런 마음이 들 땐 누구라도 지칠 수 있어. 오늘 정말 애썼어.', mid: '평범해 보여도 소중한 하루의 한 조각이야.', high: '네가 웃는 순간이라니, 듣는 나까지 행복해져!' }[tone],
      shortMsg ? `"${shortMsg}" — 이 마음, 부모님도 분명 따뜻하게 들어주실 거야.` : '말로 다 못 해도 괜찮아. 마음은 천천히 전해지니까.',
    ],
    sprout: [
      `${moment}에 '${emo}' 감정이 ${level} 피어났네.`,
      { low: '이럴 땐 잠깐 쉬어가는 것도 좋은 방법이야. 따뜻한 물 한 잔 어때?', mid: '잔잔한 날도 차곡차곡 쌓이면 힘이 돼.', high: '이 기분을 기억해두면 힘든 날 꺼내 볼 수 있어.' }[tone],
      shortMsg ? `부모님께 "${shortMsg}"라고 직접 말해보는 건 어때? 생각보다 쉬울지도 몰라.` : '오늘의 마음을 한 문장으로 전해보는 연습부터 해볼까?',
    ],
    pig: [
      `꿀꿀! ${moment}이라니~ ${emo} 기분 냄새가 여기까지 나는걸?`,
      { low: '기분 나쁜 날엔 맛있는 거 먹고 꿀잠 자는 게 최고야. 내가 보증할게!', mid: '평범한 날? 그럼 내가 오늘을 재밌게 만들어주지! 꿀꿀~', high: '와아~ 그 기분 나한테도 나눠줘! 같이 데굴데굴 구르자!' }[tone],
      shortMsg ? `"${shortMsg}"? 부끄러워하지 말고 크게 외쳐봐! 부모님이 깜짝 놀라실걸?` : '하고 싶은 말이 없다고? 그럼 "사랑해요!" 어때? 히히.',
    ],
    lion: [
      `어흥~ 초코별에서 다 보고 있었어! ${moment}, ${emo} 마음이 ${level} 반짝였네.`,
      { low: '힘든 날엔 사자도 꼬리를 내리고 쉬어. 오늘은 푹 쉬고, 내일 다시 기운 내자!', mid: '별일 없는 하루도 반짝이는 별 하나쯤은 숨어 있어. 같이 찾아볼래?', high: '이렇게 좋은 기분이라니, 내 갈기까지 신나서 들썩거려! 어흥!' }[tone],
      shortMsg ? `"${shortMsg}" — 용기 내서 말해봐. 사자처럼 당당하게, 대신 다정하게!` : '말이 안 떠올라도 괜찮아. 꼭 안아드리는 것도 멋진 대답이야.',
    ],
  };
  return T[c.id].join(' ');
}

function showResult() {
  const c = CHARACTERS[state.character];
  $('#resultChar').src = `assets/${c.img}`;
  setPedestal($('#resultPedestal'), c);
  const from = $('#feedbackFrom');
  from.textContent = `${c.name}의 피드백`;
  from.style.color = c.grad[1];

  const emo = EMOTIONS[state.emotion];
  const msg = state.message.trim();
  $('#summary').innerHTML = `
    <dt>기분</dt><dd>${MOODS[state.mood].label}</dd>
    <dt>순간</dt><dd class="mini-tags"><span>${esc(state.activity)}</span><span>${esc(state.place)}</span><span>${esc(state.who)}</span></dd>
    <dt>감정</dt><dd>${emo.name}</dd>
    <dt>감정 크기</dt><dd><div class="bar"><i style="width:${state.juice}%"></i></div></dd>
    <dt>하고 싶은 말</dt><dd class="quote">${msg ? esc(msg) : '<span style="color:#b3a399">(적지 않았어요)</span>'}</dd>`;

  setPalette(c.bg);
  showScene('result');
  typeText($('#feedbackText'), buildFeedback());
}

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

$('#resultPrev').addEventListener('click', () => {
  clearInterval(typeTimer);
  goStep(STEPS.length - 1);
});
$('#restartBtn').addEventListener('click', () => {
  clearInterval(typeTimer);
  Object.assign(state, {
    mood: 2, activity: null, place: null, who: null,
    custom: { activity: [], place: [], who: [] },
    emotion: 2, juice: 0, drawn: false, message: '', character: 0,
  });
  messageInput.value = '';
  $('#messageCount').textContent = '0 / 200';
  knob.style.left = `${knobPosFor(2)}px`;
  dialRotation = 0;
  setMoodColors(2);
  applyMood(2, true);
  goStep(-1);
});

setMoodColors(state.mood);

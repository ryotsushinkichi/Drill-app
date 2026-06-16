/**
 * app.js — メインアプリケーション
 * 画面遷移・UI操作・イベント管理
 */

/* ============================================================
   DOM参照
   ============================================================ */
const $ = id => document.getElementById(id);

const UI = {
  /* 画面 */
  screenInput:  $('screen-input'),
  screenMode:   $('screen-mode'),
  screenDrill:  $('screen-drill'),
  screenResult: $('screen-result'),

  /* 入力 */
  pdfInput:     $('pdf-input'),
  imageInput:   $('image-input'),
  textInput:    $('text-input'),
  pdfDrop:      $('pdf-drop'),
  imageDrop:    $('image-drop'),
  charCount:    $('char-count'),
  btnGenerate:  $('btn-generate'),

  /* 処理状況 */
  processingArea:   $('processing-area'),
  progressBar:      $('progress-bar'),
  processingStatus: $('processing-status'),
  errorArea:        $('error-area'),
  errorMessage:     $('error-message'),

  /* モード選択 */
  questionCountLabel: $('question-count-label'),
  modeWeakBtn:        $('mode-weak-btn'),
  btnBackToInput:     $('btn-back-to-input'),

  /* 演習 */
  drillCurrent:     $('drill-current'),
  drillTotal:       $('drill-total'),
  drillProgressBar: $('drill-progress-bar'),
  drillModeLabel:   $('drill-mode-label'),
  questionCard:     $('question-card'),
  questionBody:     $('question-body'),
  answerCard:       $('answer-card'),
  answerBody:       $('answer-body'),
  btnFlip:          $('btn-flip'),
  btnJudgeGroup:    $('btn-judge-group'),
  btnWrong:         $('btn-wrong'),
  btnCorrect:       $('btn-correct'),
  btnShowAnswer:    $('btn-show-answer'),
  btnJudgeGroup2:   $('btn-judge-group2'),
  btnWrong2:        $('btn-wrong2'),
  btnCorrect2:      $('btn-correct2'),
  btnExitDrill:     $('btn-exit-drill'),
  btnThemeToggle:   $('btn-theme-toggle'),
  siteHeader:       document.querySelector('.site-header'),

  /* 結果 */
  resultCorrect:    $('result-correct'),
  resultTotalCount: $('result-total-count'),
  resultRate:       $('result-rate'),
  weakSummary:      $('weak-summary'),
  weakCount:        $('weak-count'),
  weakList:         $('weak-list'),
  btnRetrySame:     $('btn-retry-same'),
  btnBackToMode:    $('btn-back-to-mode'),
  btnBackToTop:     $('btn-back-to-top'),
};

/* ============================================================
   状態
   ============================================================ */
let allQuestions   = [];   // 全問題
let currentMode    = '';   // 現在のモード
let activeTab      = 'tab-pdf'; // 現在のタブ

/* ============================================================
   画面遷移
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // ヘッダー：ドリル中は白、それ以外は緑
  const header = document.querySelector('.site-header');
  if (id === 'screen-drill' || id === 'screen-result') {
    header.classList.add('drill-mode');
  } else {
    header.classList.remove('drill-mode');
  }
}

/* ============================================================
   タブ切り替え
   ============================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    // ボタン状態
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    // パネル表示
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    activeTab = target;
    hideError();
  });
});

/* ============================================================
   ドラッグ&ドロップ
   ============================================================ */
function setupDrop(zone, handler) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = [...e.dataTransfer.files];
    if (files.length) handler(files);
  });
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      zone.querySelector('input[type=file]')?.click();
    }
  });
}

setupDrop(UI.pdfDrop, files => {
  const pdf = files.find(f => f.type === 'application/pdf');
  if (pdf) {
    UI.pdfInput.files = createFileList([pdf]);
    showFileSelected('pdf-drop', pdf.name);
  }
});

setupDrop(UI.imageDrop, files => {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (imgs.length) {
    UI.imageInput.files = createFileList(imgs);
    showFileSelected('image-drop', `${imgs.length}枚の画像`);
  }
});

/* FileList を動的に作るための DataTransfer 利用 */
function createFileList(files) {
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  return dt.files;
}

/* ファイル選択後の表示更新 */
function showFileSelected(zoneId, name) {
  const zone = document.getElementById(zoneId);
  const main = zone.querySelector('.drop-main');
  if (main) main.textContent = `✓ ${name}`;
  zone.style.borderColor = 'var(--accent)';
  zone.style.background  = '#f5f5ff';
}

/* ファイル選択イベント */
UI.pdfInput.addEventListener('change', () => {
  if (UI.pdfInput.files[0]) {
    showFileSelected('pdf-drop', UI.pdfInput.files[0].name);
  }
});
UI.imageInput.addEventListener('change', () => {
  if (UI.imageInput.files.length) {
    showFileSelected('image-drop', `${UI.imageInput.files.length}枚の画像`);
  }
});

/* テキスト文字数カウント */
UI.textInput.addEventListener('input', () => {
  UI.charCount.textContent = UI.textInput.value.length.toLocaleString();
});

/* ============================================================
   進捗表示
   ============================================================ */
function setProgress(percent, statusText) {
  if (percent !== null) {
    UI.progressBar.style.width = `${Math.min(100, percent)}%`;
  }
  if (statusText) {
    UI.processingStatus.textContent = statusText;
  }
}

function showProcessing() {
  UI.processingArea.classList.remove('hidden');
  UI.btnGenerate.disabled = true;
  setProgress(0, '処理を開始します...');
}

function hideProcessing() {
  UI.processingArea.classList.add('hidden');
  UI.btnGenerate.disabled = false;
}

function showError(msg) {
  UI.errorArea.classList.remove('hidden');
  UI.errorMessage.textContent = msg;
}

function hideError() {
  UI.errorArea.classList.add('hidden');
  UI.errorMessage.textContent = '';
}

/* ============================================================
   STEP 1: 問題生成
   ============================================================ */
UI.btnGenerate.addEventListener('click', async () => {
  hideError();
  showProcessing();

  try {
    let text = '';

    if (activeTab === 'tab-pdf') {
      // PDF処理
      const file = UI.pdfInput.files[0];
      if (!file) throw new Error(I18N.t('error.no_input'));
      text = await Extractor.fromPDF(file, (p, s) => setProgress(p, s));

    } else if (activeTab === 'tab-image') {
      // 画像処理
      const files = [...UI.imageInput.files];
      if (!files.length) throw new Error(I18N.t('error.no_input'));
      text = await Extractor.fromImages(files, (p, s) => setProgress(p, s));

    } else {
      // テキスト処理
      text = Extractor.fromText(UI.textInput.value);
      if (text.length < 20) throw new Error(I18N.t('error.text_too_short'));
    }

    setProgress(90, I18N.t('status.generating'));

    // 問題生成
    allQuestions = Generator.generate(text);

    if (allQuestions.length === 0) {
      throw new Error(I18N.t('error.no_questions'));
    }

    setProgress(100, I18N.t('status.done'));

    // モード選択画面へ
    setTimeout(() => {
      hideProcessing();
      goToModeSelect();
    }, 400);

  } catch (err) {
    hideProcessing();
    showError(err.message || 'エラーが発生しました。');
  }
});

/* ============================================================
   STEP 2: モード選択
   ============================================================ */
function goToModeSelect() {
  UI.questionCountLabel.textContent = I18N.t('ui.question_count', { n: allQuestions.length });

  // 苦手問題の有無でボタンを制御
  if (Storage.hasWeak()) {
    UI.modeWeakBtn.disabled = false;
    UI.modeWeakBtn.style.opacity = '1';
  } else {
    UI.modeWeakBtn.disabled = true;
    UI.modeWeakBtn.style.opacity = '0.4';
  }

  showScreen('screen-mode');
}

/* モードカード クリック */
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (card.disabled) return;

    if (mode === 'weak' && !Storage.hasWeak()) {
      alert(I18N.t('error.no_weak'));
      return;
    }

    startDrill(mode);
  });
});

/* 資料変更ボタン */
UI.btnBackToInput.addEventListener('click', () => {
  showScreen('screen-input');
});

/* ============================================================
   STEP 3: 演習
   ============================================================ */
function startDrill(mode) {
  currentMode = mode;
  const count = Drill.init(allQuestions, mode);

  if (count === 0) {
    alert('出題できる問題がありません。');
    return;
  }

  showScreen('screen-drill');
  renderQuestion();
}

function renderQuestion() {
  const q = Drill.current();
  if (!q) {
    finishDrill();
    return;
  }

  // 進捗更新
  const idx   = Drill.currentIndex();
  const total = Drill.total();
  UI.drillCurrent.textContent     = idx;
  UI.drillTotal.textContent       = total;
  UI.drillProgressBar.style.width = `${Math.round((idx - 1) / total * 100)}%`;
  UI.drillModeLabel.textContent   = Generator.typeLabel(q.type);

  // 答えエリアを隠す
  UI.answerCard.classList.add('hidden');

  // ボタンを全部隠す
  UI.btnFlip.classList.add('hidden');
  UI.btnJudgeGroup.classList.add('hidden');
  UI.btnShowAnswer.classList.add('hidden');
  UI.btnJudgeGroup2.classList.add('hidden');

  // 問題本文を表示
  UI.questionBody.innerHTML = formatQuestion(q);

  // タイプ別にボタンを表示
  const isFlash = (q.type === 'flash' || q.type === 'fallback' ||
    currentMode === 'flash');

  if (isFlash) {
    // フラッシュカード: めくるボタン
    UI.btnFlip.classList.remove('hidden');
  } else {
    // 一問一答・穴埋め: 答え確認ボタン
    UI.btnShowAnswer.classList.remove('hidden');
  }
}

/**
 * 問題をHTML形式に整形
 */
function formatQuestion(q) {
  if (q.type === 'qa') {
    return `<span style="color:var(--gray-mid);font-size:0.8em;display:block;margin-bottom:0.5rem;">Q.</span>${escHtml(q.question)}`;
  }
  if (q.type === 'fill') {
    // (　　) を視覚的な下線ブランクに変換
    const html = escHtml(q.question).replace(/\(　　\)/g,
      '<span class="blank">　　　</span>');
    return html;
  }
  if (q.type === 'flash') {
    return `${escHtml(q.question)}`;
  }
  // fallback
  return `<span style="font-size:0.75em;color:var(--gray-mid);display:block;margin-bottom:0.4rem;">※ フラッシュカード形式</span>${escHtml(q.question)}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── フラッシュカード: めくる ── */
UI.btnFlip.addEventListener('click', () => {
  const q = Drill.current();
  if (!q) return;

  UI.answerBody.innerHTML =
    `<span style="color:var(--gray-mid);font-size:0.8em;display:block;margin-bottom:0.5rem;">答え</span>${escHtml(q.answer)}`;
  UI.answerCard.classList.remove('hidden');
  UI.btnFlip.classList.add('hidden');
  UI.btnJudgeGroup.classList.remove('hidden');
});

/* ── フラッシュカード: 正誤ボタン ── */
UI.btnCorrect.addEventListener('click', () => recordAnswer(true));
UI.btnWrong.addEventListener('click',   () => recordAnswer(false));

/* ── 一問一答・穴埋め: 答え表示 ── */
UI.btnShowAnswer.addEventListener('click', () => {
  const q = Drill.current();
  if (!q) return;

  let answerHtml = '';
  if (q.type === 'fill') {
    answerHtml = `<span style="color:var(--gray-mid);font-size:0.8em;display:block;margin-bottom:0.5rem;">答え（穴埋め）</span>${escHtml(q.answer)}`;
    // 穴埋めの場合は元の文章も表示
    answerHtml += `<hr style="border:none;border-top:1px solid var(--gray-light);margin:0.75rem 0;">
      <span style="color:var(--gray-mid);font-size:0.8em;display:block;margin-bottom:0.3rem;">元の文章</span>
      ${escHtml(q.source)}`;
  } else {
    answerHtml = `<span style="color:var(--gray-mid);font-size:0.8em;display:block;margin-bottom:0.5rem;">A.</span>${escHtml(q.answer)}`;
  }

  UI.answerBody.innerHTML = answerHtml;
  UI.answerCard.classList.remove('hidden');
  UI.btnShowAnswer.classList.add('hidden');
  UI.btnJudgeGroup2.classList.remove('hidden');
});

/* ── 一問一答・穴埋め: 正誤ボタン ── */
UI.btnCorrect2.addEventListener('click', () => recordAnswer(true));
UI.btnWrong2.addEventListener('click',   () => recordAnswer(false));

function recordAnswer(correct) {
  const finished = Drill.answer(correct);
  if (finished) {
    finishDrill();
  } else {
    renderQuestion();
  }
}

/* ── 中断 ── */
UI.btnExitDrill.addEventListener('click', () => {
  if (confirm('演習を中断して戻りますか？\n（現在の進捗は苦手問題として記録されません）')) {
    goToModeSelect();
  }
});

/* ============================================================
   STEP 4: 結果表示
   ============================================================ */
function finishDrill() {
  const result = Drill.getResult();

  UI.resultCorrect.textContent    = result.correct;
  UI.resultTotalCount.textContent = result.total;
  UI.resultRate.textContent       = `${result.rate}%`;

  // 苦手一覧
  if (result.weakList.length > 0) {
    UI.weakSummary.classList.remove('hidden');
    UI.weakCount.textContent = result.weakList.length;
    UI.weakList.innerHTML = result.weakList.map(q =>
      `<li><strong>Q.</strong> ${escHtml(q.question)}<br>
       <span style="color:var(--gray-dark);">A. ${escHtml(q.answer)}</span></li>`
    ).join('');
  } else {
    UI.weakSummary.classList.add('hidden');
  }

  showScreen('screen-result');
}

/* ── 結果画面のボタン ── */
UI.btnRetrySame.addEventListener('click', () => {
  startDrill(currentMode);
});

UI.btnBackToMode.addEventListener('click', () => {
  goToModeSelect();
});

UI.btnBackToTop.addEventListener('click', () => {
  // 入力をリセット
  UI.pdfInput.value   = '';
  UI.imageInput.value = '';
  UI.textInput.value  = '';
  UI.charCount.textContent = '0';
  allQuestions = [];

  // ドロップゾーンをリセット
  ['pdf-drop', 'image-drop'].forEach(id => {
    const zone = document.getElementById(id);
    const main = zone?.querySelector('.drop-main');
    if (id === 'pdf-drop' && main) main.textContent = 'PDFをここにドロップ';
    if (id === 'image-drop' && main) main.textContent = '画像をここにドロップ';
    if (zone) {
      zone.style.borderColor = '';
      zone.style.background  = '';
    }
  });

  showScreen('screen-input');
});

/* ============================================================
   テーマ切り替え（シック ⇄ ポップ）
   ============================================================ */
let currentTheme = 'chic'; // デフォルト：シック
if (UI.btnThemeToggle) {
  UI.btnThemeToggle.addEventListener('click', () => {
    if (currentTheme === 'chic') {
      currentTheme = 'pop';
      document.body.classList.add('theme-pop');
      UI.btnThemeToggle.textContent = '📓 シック表示';
    } else {
      currentTheme = 'chic';
      document.body.classList.remove('theme-pop');
      UI.btnThemeToggle.textContent = '🎨 ポップ表示';
    }
  });
}

/* ============================================================
   Service Worker 登録（PWA Phase2準備）
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW登録失敗はサイレントに無視（機能に影響なし）
    });
  });
}

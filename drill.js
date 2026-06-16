/**
 * drill.js — 演習セッション管理
 * 出題・正誤記録・苦手問題フラグ・結果集計
 */

const Drill = {

  /* ── 状態 ── */
  _questions:   [],   // 現在のセッションの問題リスト
  _current:     0,    // 現在のインデックス
  _mode:        '',   // 'qa' | 'fill' | 'flash' | 'drill' | 'weak'
  _results:     [],   // { question, correct: bool }
  _requeue:     [],   // 不正解で再出題待ちの問題
  _allQuestions: [],  // 全問題（モード選択に戻ったとき再利用）
  _answered:    false, // 現在の問題に答えたか

  /**
   * セッションを初期化して開始
   * @param {Object[]} questions  全問題配列
   * @param {string}   mode       'qa' | 'fill' | 'flash' | 'drill' | 'weak'
   */
  init(questions, mode) {
    this._allQuestions = questions;
    this._mode         = mode;
    this._results      = [];
    this._requeue      = [];
    this._current      = 0;
    this._answered     = false;

    // モードに応じて問題を選択・フィルタ
    let pool;
    if (mode === 'weak') {
      const weakIds = new Set(Storage.getWeakList().map(w => w.id));
      pool = questions.filter(q => weakIds.has(q.id));
    } else if (mode === 'qa') {
      pool = questions.filter(q => q.type === 'qa');
      if (pool.length === 0) pool = questions; // フォールバック
    } else if (mode === 'fill') {
      pool = questions.filter(q => q.type === 'fill');
      if (pool.length === 0) pool = questions;
    } else if (mode === 'flash') {
      pool = [...questions]; // 全種類
    } else if (mode === 'drill') {
      pool = [...questions]; // 全種類ミックス
    } else {
      pool = [...questions];
    }

    this._questions = Generator.shuffle(pool);
    return this._questions.length;
  },

  /** 現在の問題を返す */
  current() {
    return this._questions[this._current] || null;
  },

  /** 残り問題数 */
  remaining() {
    return this._questions.length - this._current;
  },

  /** 総問題数（再出題含む） */
  total() {
    return this._questions.length;
  },

  /** 現在のインデックス（1始まり） */
  currentIndex() {
    return this._current + 1;
  },

  /** 現在のモード */
  mode() {
    return this._mode;
  },

  /** セッション終了か */
  isFinished() {
    return this._current >= this._questions.length && this._requeue.length === 0;
  },

  /**
   * 正誤を記録して次の問題へ進む
   * @param {boolean} correct
   * @returns {boolean} セッション終了かどうか
   */
  answer(correct) {
    const q = this.current();
    if (!q) return true;

    this._results.push({ question: q, correct });
    this._answered = true;

    if (correct) {
      // 苦手フラグを解除
      Storage.removeWeak(q.id);
    } else {
      // 苦手登録 + 再出題キューへ
      Storage.addWeak(q);
      this._requeue.push(q);
    }

    this._current++;

    // 通常問題が終わったら再出題を追加
    if (this._current >= this._questions.length && this._requeue.length > 0) {
      const retry = Generator.shuffle(this._requeue);
      this._questions.push(...retry);
      this._requeue = [];
    }

    return this.isFinished();
  },

  /**
   * セッション結果を返す
   * @returns {Object} { correct, total, rate, weakList }
   */
  getResult() {
    const correct = this._results.filter(r => r.correct).length;
    const total   = this._results.length;
    const rate    = total > 0 ? Math.round((correct / total) * 100) : 0;

    // 最終的に不正解だった問題（直近の正誤で判定）
    const finalMap = new Map();
    for (const r of this._results) {
      finalMap.set(r.question.id, r);
    }
    const weakList = [...finalMap.values()]
      .filter(r => !r.correct)
      .map(r => r.question);

    // 履歴保存
    Storage.addHistory({ mode: this._mode, correct, total });

    return { correct, total, rate, weakList };
  },

  /** 同じ設定で再試行 */
  restart() {
    this.init(this._allQuestions, this._mode);
  },
};

window.Drill = Drill;

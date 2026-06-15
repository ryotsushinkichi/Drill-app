/**
 * storage.js — 進捗・苦手問題のlocalStorage管理
 */

const Storage = {
  KEYS: {
    WEAK:      'drill_weak_questions',
    HISTORY:   'drill_history',
    QUESTIONS: 'drill_questions_cache',
  },

  /* ========== 苦手問題 ========== */

  /**
   * 苦手問題一覧を取得
   * @returns {Object} { questionId: { count, lastWrong, questionText, answerText } }
   */
  getWeak() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.WEAK) || '{}');
    } catch {
      return {};
    }
  },

  /**
   * 苦手問題を登録・更新
   * @param {Object} question - { id, question, answer }
   */
  addWeak(question) {
    const weak = this.getWeak();
    const id = question.id;
    if (!weak[id]) {
      weak[id] = { count: 0, lastWrong: null, questionText: question.question, answerText: question.answer };
    }
    weak[id].count += 1;
    weak[id].lastWrong = Date.now();
    weak[id].questionText = question.question;
    weak[id].answerText = question.answer;
    this._save(this.KEYS.WEAK, weak);
  },

  /**
   * 苦手フラグを解除（正解したとき）
   * @param {string} id
   */
  removeWeak(id) {
    const weak = this.getWeak();
    delete weak[id];
    this._save(this.KEYS.WEAK, weak);
  },

  /**
   * 苦手問題の配列を返す
   * @returns {Array}
   */
  getWeakList() {
    const weak = this.getWeak();
    return Object.entries(weak).map(([id, data]) => ({
      id,
      question: data.questionText,
      answer:   data.answerText,
      wrongCount: data.count,
    }));
  },

  /** 苦手問題が存在するか */
  hasWeak() {
    return Object.keys(this.getWeak()).length > 0;
  },

  /** 苦手問題をすべてクリア */
  clearWeak() {
    localStorage.removeItem(this.KEYS.WEAK);
  },

  /* ========== 学習履歴 ========== */

  /**
   * セッション結果を記録
   * @param {Object} session - { mode, correct, total, date }
   */
  addHistory(session) {
    try {
      const history = JSON.parse(localStorage.getItem(this.KEYS.HISTORY) || '[]');
      history.push({ ...session, date: Date.now() });
      // 最新100件のみ保持
      const trimmed = history.slice(-100);
      this._save(this.KEYS.HISTORY, trimmed);
    } catch {
      // 履歴保存の失敗はサイレントに無視
    }
  },

  /**
   * 学習履歴を取得
   * @returns {Array}
   */
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.HISTORY) || '[]');
    } catch {
      return [];
    }
  },

  /** 全データをクリア */
  clearAll() {
    Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
  },

  /* ========== 内部 ========== */
  _save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ストレージ容量超過などは無視
      console.warn('[Storage] 保存失敗:', e);
    }
  }
};

window.Storage = Storage;

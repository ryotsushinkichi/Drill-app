/**
 * i18n.js — 国際化基盤
 * 現在は日本語のみ。将来的な多言語対応のための構造を確立。
 */

const I18N = {
  /** 現在のロケール */
  locale: 'ja',

  /** メッセージ辞書 */
  messages: {
    ja: {
      /* 処理ステータス */
      'status.reading_pdf':      'PDFを読み込んでいます...',
      'status.extracting_text':  'テキストを抽出しています...',
      'status.ocr_start':        'OCR処理を開始します（しばらくかかる場合があります）...',
      'status.ocr_page':         'ページ {n} をOCR処理中...',
      'status.generating':       '問題を生成しています...',
      'status.done':             '完了しました。',
      'status.loading_lang':     '日本語データを読み込んでいます...',

      /* エラー */
      'error.no_input':          '資料を入力してください。',
      'error.text_too_short':    'テキストが短すぎます。もう少し長い資料を入力してください。',
      'error.no_questions':      '問題を生成できませんでした。テキストの形式を確認するか、テキストタブで直接貼り付けてみてください。',
      'error.no_weak':           '苦手問題がありません。まず演習モードか一問一答を試してください。',
      'error.pdf_failed':        'PDFの読み込みに失敗しました。テキストタブから直接貼り付けることもできます。',
      'error.image_failed':      '画像の処理に失敗しました。テキストタブから直接入力を試してください。',
      'error.ocr_low_quality':   'OCRの精度が低い可能性があります。テキストを確認してください。',

      /* UI */
      'ui.question_count':       '{n} 問の問題を生成しました。',
      'ui.no_weak_questions':    '苦手問題なし',
      'ui.mode.qa':              '一問一答',
      'ui.mode.fill':            '穴埋め',
      'ui.mode.flash':           'フラッシュカード',
      'ui.mode.drill':           '演習モード',
      'ui.mode.weak':            '苦手のみ',
      'ui.fallback_card':        '※ この項目はフラッシュカード形式で表示しています。',
    }
  },

  /**
   * 翻訳テキストを取得
   * @param {string} key
   * @param {Object} [params] - テンプレート変数 e.g. { n: 3 }
   * @returns {string}
   */
  t(key, params = {}) {
    const dict = this.messages[this.locale] || this.messages['ja'];
    let text = dict[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  },

  /** ロケールを変更（将来拡張用） */
  setLocale(locale) {
    if (this.messages[locale]) {
      this.locale = locale;
    }
  }
};

// グローバルに公開
window.I18N = I18N;

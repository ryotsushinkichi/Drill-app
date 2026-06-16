/**
 * generator.js — ルールベース問題生成エンジン
 *
 * 【絶対原則】
 * - 資料内テキストの情報のみを使用する
 * - AIによる補完・推測・外部知識は一切使用しない
 * - 問題・解答の根拠は必ず資料内に存在する
 * - 抽出・変換のみ行い、内容を追加しない
 */

const Generator = {

  /**
   * テキストから全問題を生成
   * @param {string} rawText
   * @returns {Object[]} questions配列
   */
  generate(rawText) {
    // 1. テキストを文単位に分割
    const sentences = this._splitSentences(rawText);

    if (sentences.length === 0) return [];

    const questions = [];
    let idCounter = 0;

    for (const sent of sentences) {
      if (sent.trim().length < 5) continue;

      // ── ① 一問一答生成を試みる ──
      const qaList = this._tryQA(sent, idCounter);
      if (qaList.length > 0) {
        questions.push(...qaList.map(q => ({ ...q, id: `q_${idCounter++}` })));
        continue;
      }

      // ── ② 穴埋め生成を試みる ──
      const fillList = this._tryFill(sent, idCounter);
      if (fillList.length > 0) {
        questions.push(...fillList.map(q => ({ ...q, id: `q_${idCounter++}` })));
        continue;
      }

      // ── ③ フラッシュカード化 ──
      const flash = this._tryFlash(sent, idCounter);
      if (flash) {
        questions.push({ ...flash, id: `q_${idCounter++}` });
        continue;
      }

      // ── ④ テキストそのままカード化（フォールバック）──
      questions.push({
        id:       `q_${idCounter++}`,
        type:     'fallback',
        question: sent.trim(),
        answer:   sent.trim(),
        source:   sent.trim(),
      });
    }

    return questions;
  },

  /* ============================================================
     STEP 1: テキスト分割
     ============================================================ */

  /**
   * テキストを「意味のある文」単位に分割
   */
  _splitSentences(text) {
    // 正規化
    let t = text
      .replace(/\r\n/g, '\n')
      .replace(/　/g, ' ')           // 全角スペース→半角
      .replace(/[。．]/g, '。')      // 句点統一
      .replace(/[、，]/g, '、')      // 読点統一
      .replace(/：/g, ':')
      .replace(/（/g, '(')
      .replace(/）/g, ')');

    // 番号リスト・箇条書きを文として扱う
    t = t.replace(/^([\d１-９][\.．\)）]\s*)/gm, '\n');
    t = t.replace(/^[・●▶▷□■◆◇→\-\*]\s*/gm, '\n');

    // 句点・改行で分割
    const raw = t.split(/(?<=[。\n])/);

    const sentences = [];
    for (const s of raw) {
      const clean = s.replace(/\n+/g, ' ').trim();
      if (clean.length >= 6 && clean.length <= 300) {
        sentences.push(clean);
      } else if (clean.length > 300) {
        // 長文は句点で再分割
        const sub = clean.split(/(?<=[。])/);
        sentences.push(...sub.filter(x => x.trim().length >= 6));
      }
    }
    return sentences;
  },

  /* ============================================================
     STEP 2: 一問一答生成
     ============================================================ */

  /**
   * 定義文パターンから一問一答を生成
   * 「AはBである」「AとはBをいう」「AとはBのことである」 など
   */
  _tryQA(sent, _idx) {
    const questions = [];

    // パターン群
    const PATTERNS = [
      // 「〇〇とは△△である／をいう／を指す」
      {
        re: /^(.{2,30})とは[、,]?\s*(.{3,})(?:である|をいう|を指す|のことである|のことをいう|とも呼ばれる|と定義される|と定義されている)。?$/,
        buildQ: (m) => `${m[1]}とは何か？`,
        buildA: (m) => m[2].trim(),
      },
      // 「〇〇は△△である／と呼ばれる」（主語が短く明確なもの）
      {
        re: /^([^\s、。]{2,15})は[、,]?\s*(.{5,80})(?:である|と呼ばれる|とよばれる|とされる|に分類される|と定義される)。?$/,
        buildQ: (m) => `${m[1]}とは？`,
        buildA: (m) => m[2].trim(),
      },
      // 「〇〇の定義は△△である」
      {
        re: /^(.{2,20})の定義は[、,]?\s*(.{5,})(?:である|とされる)。?$/,
        buildQ: (m) => `${m[1]}の定義は？`,
        buildA: (m) => m[2].trim(),
      },
      // 「〇〇を〇〇という／とよぶ」
      {
        re: /^(.{5,})を(.{2,20})(?:という|とよぶ|と呼ぶ|と定義する)。?$/,
        buildQ: (m) => `${m[2]}とは？`,
        buildA: (m) => m[1].trim(),
      },
      // 「〇〇の原因は△△である」
      {
        re: /^(.{2,20})の(原因|症状|治療|診断|目的|役割|機能|特徴|種類|分類|副作用|効果|原則|要件|条件)は[、,]?\s*(.{5,})(?:である|とされる|だ)。?$/,
        buildQ: (m) => `${m[1]}の${m[2]}は？`,
        buildA: (m) => m[3].trim(),
      },
      // 「〇〇は△△によって分類される」などの受動
      {
        re: /^(.{2,25})は[、,]?\s*(.{5,})(?:によって|で)(?:分類|定義|規定|決定)される。?$/,
        buildQ: (m) => `${m[1]}はどのように分類されるか？`,
        buildA: (m) => m[2].trim(),
      },
    ];

    for (const pat of PATTERNS) {
      const m = sent.match(pat.re);
      if (m) {
        const q = pat.buildQ(m).replace(/\s+/g, '');
        const a = pat.buildA(m);
        if (q.length >= 3 && a.length >= 2) {
          questions.push({
            type:     'qa',
            question: q,
            answer:   a,
            source:   sent,
          });
        }
        break; // 1文から1パターンのみ
      }
    }

    return questions;
  },

  /* ============================================================
     STEP 3: 穴埋め問題生成
     ============================================================ */

  /**
   * 数値・固有名詞・重要語句を穴埋めに変換
   */
  _tryFill(sent, _idx) {
    const questions = [];

    // ── 数値穴埋め ──
    // 「GFR60未満」「3か月以上」「140mmHg」などの数値を対象
    const numMatches = [...sent.matchAll(/(\d+(?:\.\d+)?(?:[%％mg/dl㎎mmHg万億千円年月日週時間回度]*))/g)];
    if (numMatches.length >= 1 && numMatches.length <= 4) {
      const blanks = numMatches.map(m => m[1]);
      let fillText = sent;
      for (const b of blanks) {
        fillText = fillText.replace(b, '(　　)');
      }
      // 穴埋めが生成できた場合のみ追加
      if (fillText !== sent) {
        questions.push({
          type:     'fill',
          question: fillText.trim(),
          answer:   blanks.join('、'),
          source:   sent,
          blanks:   blanks,
        });
        return questions; // 数値穴埋めが成功したら終了
      }
    }

    // ── キーワード穴埋め（述語部分） ──
    // 「AはBである」の B を穴埋めにする
    const defMatch = sent.match(/^(.{2,25})(?:は|とは)[、,]?\s*(.{3,20})(?:である|をいう|と定義される|に分類される)。?$/);
    if (defMatch) {
      const keyword = defMatch[2].trim();
      if (keyword.length >= 2 && keyword.length <= 20) {
        const filled = sent.replace(keyword, '(　　)');
        questions.push({
          type:     'fill',
          question: filled.trim(),
          answer:   keyword,
          source:   sent,
          blanks:   [keyword],
        });
      }
    }

    // ── 接続助詞前後パターン ──
    // 「〇〇は△△することが重要である」→△△を穴埋め
    const actionMatch = sent.match(/^(.{2,20})(?:は|が|を)[、,]?\s*(.{3,15})すること/);
    if (actionMatch && questions.length === 0) {
      const keyword = actionMatch[2].trim();
      if (keyword.length >= 2) {
        const filled = sent.replace(keyword + 'すること', '(　　)すること');
        if (filled !== sent) {
          questions.push({
            type:     'fill',
            question: filled.trim(),
            answer:   keyword,
            source:   sent,
            blanks:   [keyword],
          });
        }
      }
    }

    return questions;
  },

  /* ============================================================
     STEP 4: フラッシュカード
     ============================================================ */

  /**
   * 文をフラッシュカード化
   * 表：先頭の主語・主題 / 裏：文全体
   */
  _tryFlash(sent, _idx) {
    // 主題の抽出
    const topicMatch = sent.match(/^(.{2,20})(?:は|が|の|を)/);
    if (topicMatch) {
      const topic = topicMatch[1];
      // 主題が短すぎたり長すぎる場合は文の前半を使う
      const front = topic.length >= 2 && topic.length <= 15
        ? `${topic}について説明せよ。`
        : sent.slice(0, Math.min(30, Math.floor(sent.length / 2))) + '……';

      return {
        type:     'flash',
        question: front.trim(),
        answer:   sent.trim(),
        source:   sent,
      };
    }

    // 主語が取れない場合は前半を表にする
    const half = Math.max(10, Math.floor(sent.length / 2));
    return {
      type:     'flash',
      question: sent.slice(0, half).trim() + '……',
      answer:   sent.trim(),
      source:   sent,
    };
  },

  /* ============================================================
     ユーティリティ
     ============================================================ */

  /**
   * 問題をシャッフル
   * @param {Object[]} questions
   * @returns {Object[]}
   */
  shuffle(questions) {
    const arr = [...questions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /**
   * 問題タイプのラベルを返す
   * @param {string} type
   * @returns {string}
   */
  typeLabel(type) {
    const map = {
      qa:       I18N.t('ui.mode.qa'),
      fill:     I18N.t('ui.mode.fill'),
      flash:    I18N.t('ui.mode.flash'),
      fallback: I18N.t('ui.mode.flash'),
    };
    return map[type] || '問題';
  },
};

window.Generator = Generator;

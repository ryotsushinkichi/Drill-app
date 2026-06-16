/**
 * extractor.js — PDF / 画像 / テキストからテキスト抽出
 * PDF.js + Tesseract.js を使用。全処理ブラウザ完結。
 *
 * 【設計変更】
 * 1. PDF.jsのグローバル変数名を修正（文字化けの根本原因だった）
 * 2. 抽出テキストの品質を自動検査し、異常なら自動でOCRに切替
 * 3. ページごとの結果に警告・OCR使用有無のメタ情報を付与
 * 4. OCR失敗箇所は画像として保持（処理は止めない）
 */

const Extractor = {

  /**
   * PDF からテキスト抽出
   * @param {File} file
   * @param {Function} onProgress (percent, statusText)
   * @returns {Promise<Object>} { text, pages: [{pageNum, text, usedOCR, warning, failedImage}] }
   */
  async fromPDF(file, onProgress = () => {}) {
    onProgress(5, I18N.t('status.reading_pdf'));

    const arrayBuffer = await file.arrayBuffer();

    // ── PDF.js: 正しいグローバル変数名 ──
    // CDN版(3.11系)は window.pdfjsLib として公開される
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error(I18N.t('error.pdf_failed'));
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      throw new Error(I18N.t('error.pdf_failed'));
    }

    const totalPages = pdf.numPages;
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const rawText = content.items.map(item => item.str).join(' ');

      const percent = Math.round(5 + ((i - 1) / totalPages) * 70);
      onProgress(percent, I18N.t('status.extracting_text'));

      // ── 品質検査 ──
      const quality = this._checkTextQuality(rawText);

      if (quality.ok) {
        // テキスト抽出が正常 → そのまま採用
        pages.push({
          pageNum: i,
          text: rawText.trim(),
          usedOCR: false,
          warning: null,
          failedImage: null,
        });
      } else {
        // 異常検出 → OCRへ自動切替
        const ocrResult = await this._ocrPDFPage(page, i, totalPages, onProgress);
        pages.push({
          pageNum: i,
          text: ocrResult.text,
          usedOCR: true,
          warning: ocrResult.text.trim().length < 10
            ? I18N.t('error.ocr_low_quality')
            : `テキスト抽出で${quality.reason}を検出したため、OCRで再読込しました。`,
          failedImage: ocrResult.text.trim().length < 10 ? ocrResult.imageDataUrl : null,
        });
      }
    }

    onProgress(80, I18N.t('status.generating'));

    const fullText = pages.map(p => p.text).join('\n').trim();
    return { text: fullText, pages };
  },

  /**
   * テキストの品質を検査する
   * 文字化け・異常文字・文字数不足を検出
   * @param {string} text
   * @returns {{ok: boolean, reason: string|null}}
   */
  _checkTextQuality(text) {
    const trimmed = text.trim();

    // 文字数不足
    if (trimmed.length < 20) {
      return { ok: false, reason: '文字数不足' };
    }

    // 文字化け文字（U+FFFD「�」）の出現率チェック
    const replacementCount = (trimmed.match(/\uFFFD/g) || []).length;
    if (replacementCount > 0) {
      return { ok: false, reason: '文字化け（�記号）' };
    }

    // 制御文字・異常な記号の混入率チェック
    const totalLen = trimmed.length;
    const weirdChars = (trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    if (weirdChars / totalLen > 0.05) {
      return { ok: false, reason: '制御文字の異常混入' };
    }

    // 日本語・英数字・基本記号がほぼ存在しない（文字種が異常）
    const validChars = (trimmed.match(/[\u3040-\u30FF\u4E00-\u9FFF\uFF00-\uFFEFa-zA-Z0-9]/g) || []).length;
    if (validChars / totalLen < 0.3) {
      return { ok: false, reason: '有効文字種の不足' };
    }

    // 同一文字の異常な連続（崩壊パターン）
    if (/(.)\1{9,}/.test(trimmed)) {
      return { ok: false, reason: '異常な文字連続' };
    }

    return { ok: true, reason: null };
  },

  /**
   * PDFページをCanvas描画してOCR
   * @private
   * @returns {Promise<{text: string, imageDataUrl: string}>}
   */
  async _ocrPDFPage(page, pageNum, totalPages, onProgress) {
    const scale = 3.0; // 高解像度でOCR精度向上（2.0→3.0に強化）
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    onProgress(
      Math.round(10 + (pageNum / totalPages) * 60),
      I18N.t('status.ocr_page', { n: pageNum })
    );

    // OCR前処理（グレースケール化・コントラスト強調・二値化）
    const processedCanvas = this._preprocessForOCR(canvas);

    const text = await this._runOCR(processedCanvas, onProgress);
    return { text, imageDataUrl: canvas.toDataURL('image/png') };
  },

  /**
   * 画像ファイルからテキスト抽出（OCR）
   * @param {File[]} files
   * @param {Function} onProgress
   * @returns {Promise<Object>} { text, pages: [{pageNum, text, usedOCR, warning, failedImage}] }
   */
  async fromImages(files, onProgress = () => {}) {
    onProgress(5, I18N.t('status.ocr_start'));
    const pages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = await this._loadImage(file);
      const canvas = this._imageToCanvas(img);

      onProgress(
        Math.round(10 + (i / files.length) * 70),
        I18N.t('status.ocr_page', { n: i + 1 })
      );

      // OCR前処理（グレースケール化・コントラスト強調・二値化）
      const processedCanvas = this._preprocessForOCR(canvas);

      const text = await this._runOCR(processedCanvas, onProgress);
      const isLowQuality = text.trim().length < 10;

      pages.push({
        pageNum: i + 1,
        text: text.trim(),
        usedOCR: true,
        warning: isLowQuality ? I18N.t('error.ocr_low_quality') : null,
        failedImage: isLowQuality ? canvas.toDataURL('image/png') : null,
      });
    }

    onProgress(85, I18N.t('status.generating'));

    const fullText = pages.map(p => p.text).join('\n').trim();
    return { text: fullText, pages };
  },

  /**
   * テキスト文字列をそのまま返す（前処理のみ）
   * @param {string} text
   * @returns {Object} { text, pages }
   */
  fromText(text) {
    const trimmed = text.trim();
    return {
      text: trimmed,
      pages: [{
        pageNum: 1,
        text: trimmed,
        usedOCR: false,
        warning: null,
        failedImage: null,
      }],
    };
  },

  /* ── 内部: OCR実行 ── */
  async _runOCR(canvas, onProgress) {
    try {
      onProgress(null, I18N.t('status.loading_lang'));

      const result = await Tesseract.recognize(canvas, 'jpn+eng', {
        logger: () => {
          // OCR進捗は親のonProgressに委ねる（上書きしない）
        },
        // PSM 6: 単一の均一なテキストブロックとして認識（資料・レジュメ向き）
        tessedit_pageseg_mode: '6',
        // 文字間の不要な空白を抑制
        preserve_interword_spaces: '1',
      });

      const text = result.data.text || '';
      const confidence = result.data.confidence || 0;

      // 信頼スコアが低い場合でも停止しない（呼び出し元で警告判定）
      if (confidence < 50 && text.trim().length < 10) {
        console.warn('[OCR] 信頼スコア低:', confidence);
        return '';
      }

      return text;
    } catch (e) {
      // OCR失敗しても処理継続
      console.warn('[OCR] 処理失敗（継続）:', e);
      return '';
    }
  },

  /**
   * OCR精度向上のための画像前処理
   * グレースケール化 → コントラスト強調 → 二値化
   * @param {HTMLCanvasElement} canvas
   * @returns {HTMLCanvasElement} 処理済みCanvas
   */
  _preprocessForOCR(canvas) {
    const out = document.createElement('canvas');
    out.width  = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, out.width, out.height);
    const data = imageData.data;

    // ── ステップ1: グレースケール化 ──
    const gray = new Uint8ClampedArray(out.width * out.height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // ── ステップ2: 大津の二値化（Otsu's method）で最適な閾値を自動算出 ──
    const threshold = this._otsuThreshold(gray);

    // ── ステップ3: コントラスト強調 + 二値化を同時適用 ──
    for (let i = 0; i < data.length; i += 4) {
      const grayVal = gray[i / 4];
      // 閾値を基準にコントラストを強める（完全な二値化ではなく強調に留め、
      // 薄い文字や手書き文字のかすれを潰さないようにする）
      const enhanced = grayVal < threshold
        ? Math.max(0, grayVal - (threshold - grayVal) * 0.5)
        : Math.min(255, grayVal + (grayVal - threshold) * 0.5);

      data[i]     = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
      // data[i+3] はアルファ値なので変更しない
    }

    ctx.putImageData(imageData, 0, 0);
    return out;
  },

  /**
   * 大津の二値化法：画像全体から最適な閾値を自動計算
   * @param {Uint8ClampedArray} grayData グレースケール画素値の配列
   * @returns {number} 最適閾値（0-255）
   */
  _otsuThreshold(grayData) {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < grayData.length; i++) {
      histogram[grayData[i]]++;
    }

    const total = grayData.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    return threshold;
  },

  /* ── 内部: 画像読み込み ── */
  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(I18N.t('error.image_failed'))); };
      img.src = url;
    });
  },

  /* ── 内部: ImageをCanvasへ変換 ── */
  _imageToCanvas(img) {
    const canvas = document.createElement('canvas');
    // OCR精度向上のため最低2000px幅に拡大
    const scale = Math.max(1, 2000 / img.width);
    canvas.width  = img.width  * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
};

window.Extractor = Extractor;

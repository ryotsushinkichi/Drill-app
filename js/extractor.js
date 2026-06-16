/**
 * extractor.js — PDF / 画像 / テキストからテキスト抽出
 * PDF.js + Tesseract.js を使用。全処理ブラウザ完結。
 */

const Extractor = {

  /**
   * PDF からテキスト抽出
   * @param {File} file
   * @param {Function} onProgress (percent, statusText)
   * @returns {Promise<string>}
   */
  async fromPDF(file, onProgress = () => {}) {
    onProgress(5, I18N.t('status.reading_pdf'));

    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      throw new Error(I18N.t('error.pdf_failed'));
    }

    const totalPages = pdf.numPages;
    let fullText = '';
    let needsOCR = false;

    // ── まずテキストレイヤー抽出を試みる ──
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');

      if (pageText.trim().length > 20) {
        fullText += pageText + '\n';
      } else {
        // テキストが取れないページはOCRフラグを立てる
        needsOCR = true;
        fullText += await this._ocrPDFPage(page, i, totalPages, onProgress);
      }

      const percent = Math.round(5 + (i / totalPages) * 70);
      onProgress(percent, I18N.t('status.extracting_text'));
    }

    onProgress(80, I18N.t('status.generating'));
    return fullText.trim();
  },

  /**
   * PDFページをCanvas描画してOCR
   * @private
   */
  async _ocrPDFPage(page, pageNum, totalPages, onProgress) {
    const scale = 2.0; // 高解像度でOCR精度向上
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

    return await this._runOCR(canvas, onProgress);
  },

  /**
   * 画像ファイルからテキスト抽出（OCR）
   * @param {File[]} files
   * @param {Function} onProgress
   * @returns {Promise<string>}
   */
  async fromImages(files, onProgress = () => {}) {
    onProgress(5, I18N.t('status.ocr_start'));
    let fullText = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = await this._loadImage(file);
      const canvas = this._imageToCanvas(img);

      onProgress(
        Math.round(10 + (i / files.length) * 70),
        I18N.t('status.ocr_page', { n: i + 1 })
      );

      const pageText = await this._runOCR(canvas, onProgress);
      fullText += pageText + '\n';
    }

    onProgress(85, I18N.t('status.generating'));
    return fullText.trim();
  },

  /**
   * テキスト文字列をそのまま返す（前処理のみ）
   * @param {string} text
   * @returns {string}
   */
  fromText(text) {
    return text.trim();
  },

  /* ── 内部: OCR実行 ── */
  async _runOCR(canvas, onProgress) {
    try {
      onProgress(null, I18N.t('status.loading_lang'));

      const result = await Tesseract.recognize(canvas, 'jpn+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            // OCR進捗は親のonProgressに委ねる（上書きしない）
          }
        }
      });

      const text = result.data.text || '';
      const confidence = result.data.confidence || 0;

      // 信頼スコアが低い場合でも停止しない（警告のみ）
      if (confidence < 50 && text.trim().length < 10) {
        console.warn('[OCR] 信頼スコア低:', confidence);
        return ''; // 空文字で続行
      }

      return text;
    } catch (e) {
      // OCR失敗しても処理継続
      console.warn('[OCR] 処理失敗（継続）:', e);
      return '';
    }
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

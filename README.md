# ドリル変換 — 資料をそのまま暗記教材へ

PDF・画像・テキストを**一問一答・穴埋め・フラッシュカード・演習モード**へ変換する暗記ドリルツールです。

---

## 特徴

- **資料の内容のみ**から問題を生成（外部知識・AI補完なし）
- PDF・画像（OCR対応）・テキスト貼り付けに対応
- 苦手問題を自動管理・集中出題
- ブラウザ完結・サーバーレス・完全無料で運用可能
- スマホ最優先レスポンシブ対応

---

## ファイル構成

```
/
├── index.html          # メインHTML
├── manifest.json       # PWAマニフェスト（Phase2準備）
├── sw.js               # Service Worker（Phase2準備）
├── css/
│   └── style.css       # スタイルシート
├── js/
│   ├── i18n.js         # 国際化基盤（現在は日本語のみ）
│   ├── storage.js      # localStorage管理（進捗・苦手問題）
│   ├── extractor.js    # PDF・画像・テキスト抽出
│   ├── generator.js    # ルールベース問題生成エンジン
│   ├── drill.js        # 演習セッション管理
│   └── app.js          # メインアプリケーション制御
└── icons/              # PWAアイコン（Phase2で追加）
    ├── icon-192.png
    └── icon-512.png
```

---

## GitHub Pages への公開手順

### 1. リポジトリ作成

```
GitHubで新しいリポジトリを作成する
例：drill-app（公開設定: Public）
```

### 2. ファイルをアップロード

```
GitHubのリポジトリ画面で「Add file」→「Upload files」
全ファイル・フォルダをそのままアップロード
```

### 3. GitHub Pages を有効化

```
リポジトリ → Settings → Pages
Source: Deploy from a branch
Branch: main / root
Save をクリック
```

### 4. 公開URL確認

```
https://（ユーザー名）.github.io/（リポジトリ名）/
```

---

## 使い方

1. **資料を投入** — PDF・画像・テキストのいずれかを選択
2. **モードを選択** — 一問一答 / 穴埋め / フラッシュカード / 演習モード / 苦手のみ
3. **演習開始** — 問題を解いて正誤を記録
4. **結果確認** — 正答率と苦手問題を確認

---

## 技術仕様

| 項目 | 内容 |
|---|---|
| 実行環境 | ブラウザのみ（サーバー不要） |
| PDF処理 | PDF.js 3.11（CDN） |
| OCR | Tesseract.js 5.0（日本語＋英語対応） |
| 問題生成 | ルールベース変換（資料内情報のみ） |
| データ保存 | localStorage（端末内のみ） |
| ホスティング | GitHub Pages対応 |

---

## 将来のロードマップ

| Phase | 内容 |
|---|---|
| Phase 1（現在） | GitHub Pages静的版・全機能解放 |
| Phase 2 | PWA完全化・オフライン対応・アイコン追加 |
| Phase 3 | 問題セットのJSON/QRコードエクスポート・共有 |
| Phase 4 | Supabase連携・クラウド保存・Stripe有料版展開 |

---

## ライセンス

Copyright © 2025 しんのすけ. All rights reserved.

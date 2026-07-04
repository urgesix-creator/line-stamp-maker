# デザインプロンプト：HTMLマニュアル デザインシステム

#デザインシステム #UIデザイン #デザインプロンプト #LINEスタンプメーカー #初心者向けUI #レスポンシブ #CSS設計 #Webアプリ #スタイルガイド

以下のデザインルールに従って、初心者向けの画面・HTMLを作成すること。

---

## 1. 全体の方針

- **対象読者**：パソコンに不慣れな人（専門用語は使わず、平易な日本語で書く）
- **雰囲気**：やわらかく、あたたかみがあり、威圧感のないデザイン
- **レイアウト**：1カラム、最大幅780px、中央寄せ
- **レスポンシブ対応**：スマホ（600px以下）でも読めるようにする

---

## 2. フォント

**Google Fonts読み込み：**

```
https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap
```

- **本文**：'Noto Sans JP', sans-serif
- **見出し（ヘッダー内h1）**：'M PLUS Rounded 1c', sans-serif（丸みのあるフォントでやわらかい印象にする）
- **行間**：line-height: 1.8
- **文字レンダリング**：-webkit-font-smoothing: antialiased

### 文字サイズの階層

| 用途 | サイズ | 太さ | フォント |
|------|--------|------|----------|
| ヘッダータイトル（h1） | 28px（スマホ: 22px） | 700 | M PLUS Rounded 1c |
| ヘッダーバッジ | 13px | 500 | Noto Sans JP |
| ヘッダー説明文 | 15px | 400 | Noto Sans JP |
| セクション見出し | 20px | 700 | Noto Sans JP |
| カード内見出し（h2） | 18px | 700 | Noto Sans JP |
| ステップタイトル | 17px | 700 | Noto Sans JP |
| カード内小見出し（h3） | 16px | 700 | Noto Sans JP |
| 本文 | 15px | 400 | Noto Sans JP |
| 補足・注意書き | 14px | 400 | Noto Sans JP |
| コピー対象テキスト | 14px, line-height: 2 | 400 | Noto Sans JP |
| フッター | 13px | 400 | Noto Sans JP |
| コピーブロック内ラベル | 12px | 500 | Noto Sans JP |

---

## 3. カラーパレット（CSS変数で定義）

```css
:root {
  /* ── ベース ── */
  --bg: #FFF8F0;              /* ページ背景：あたたかいクリーム色 */
  --card: #FFFFFF;            /* カード背景：白 */
  --border: #E8E0D8;          /* カード枠線・区切り線 */
  --shadow: 0 2px 12px rgba(0,0,0,0.06);  /* カードの影（控えめ） */

  /* ── メインカラー（アクセント） ── */
  --accent: #E86C3A;          /* オレンジ系アクセント（ボタン、番号、見出し色） */
  --accent-light: #FFF0E8;    /* アクセントの薄い背景色（操作パス、注意ボックス背景） */
  --accent-dark: #C4501E;     /* アクセントの濃い色（注意ボックスの文字色） */

  /* ── テキスト ── */
  --text: #2D2A26;            /* メイン文字色：ほぼ黒だが真っ黒ではない */
  --text-sub: #6B6560;        /* 補助文字色：グレー系 */

  /* ── 状態色 ── */
  --success: #2E8B57;         /* 成功・完了（緑） */
  --success-light: #E8F5EE;   /* 成功ボックスの背景 */
  --highlight: #FFF3CD;       /* キーワードハイライト背景（黄色系） */

  /* ── コピーブロック専用 ── */
  --copy-bg: #1E1E2E;         /* コピー領域の背景（ダーク） */
  --copy-text: #CDD6F4;       /* コピー領域の文字色（明るいグレー） */
  /* コピーブロックのヘッダー/フッター: #313244 */
  /* 信号ドット: 赤 #f38ba8 / 黄 #f9e2af / 緑 #a6e3a1 */
  /* ラベル文字色: #a6adc8 */
}
```

### 色の使い分けルール

- ページ背景は `--bg`（クリーム色）。真っ白にしない
- カード背景は `--card`（白）。背景との差でカードが浮き出て見える
- 見出しの色分け：セクション見出しは `--text`（黒系）、カード内のh2/h3は `--accent`（オレンジ）
- 本文は `--text-sub`（グレー）を使い、見出しとのコントラストを出す
- **強調（`<strong>`）**は `--text`（黒系）にして、グレー本文の中で目立たせる

---

## 4. ヘッダー

- 背景：`linear-gradient(135deg, var(--accent) 0%, #D4582A 100%)` ← オレンジのグラデーション
- 角丸：border-radius: 20px
- パディング：48px 32px
- 文字色：白
- テキスト配置：中央揃え
- 下マージン：48px
- 装飾：::before と ::after で白い半透明の円（rgba(255,255,255,0.08)）を配置し、奥行き感を出す

**内部要素：**

- バッジ（上部ラベル）：半透明白背景（rgba(255,255,255,0.2)）、角丸100px（ピル形状）
- タイトル：M PLUS Rounded 1c, 28px, 700
- 説明文：15px, opacity: 0.9

---

## 5. カードコンポーネント

すべてのカード（説明カード、ステップカード、ヒントカード、モバイルセクション）に共通：

- 背景：var(--card)
- 角丸：border-radius: 16px
- パディング：28px 32px（スマホ: 24px 20px）
- 影：var(--shadow)
- 枠線：1px solid var(--border)

---

## 6. ステップ（手順）の表現

### ステップ番号（丸数字）

- 幅・高さ：36px
- 背景：var(--accent)（オレンジ）
- 文字色：白
- 角丸：50%（円形）
- フォント：16px, 700
- 下マージン：14px

### ステップ間の接続線

- ステップカードの下に、幅2px・高さ20pxの縦線（色: var(--border)）を ::before で描画
- 最後のステップでは非表示

### 操作パス（「A → B → C」の表示）

- 背景：var(--accent-light)
- 角丸：8px
- パディング：6px 14px
- 文字色：var(--accent-dark)
- フォント：15px, 500
- 矢印「→」の色：var(--accent), 太字

---

## 7. 注意ボックス／成功ボックス

### 注意ボックス（note-box）

- 背景：var(--accent-light)
- 左ボーダー：4px solid var(--accent)
- 角丸：0 10px 10px 0（左は直角、右のみ角丸）
- パディング：16px 20px
- 文字色：var(--accent-dark)
- フォント：14px
- タイトル（strong）：display: block, 下マージン4px

### 成功ボックス（success-box）

- 背景：var(--success-light)
- 左ボーダー：4px solid var(--success)
- 角丸：0 10px 10px 0
- パディング：16px 20px
- 文字色：#1a5c36
- フォント：14px

---

## 8. コピーブロック（ユーザーがテキストをコピーする領域）

ターミナル風のデザインで「ここをコピーする」ことが一目でわかるようにする。

- 全体：border-radius: 14px, overflow: hidden, box-shadow: 0 4px 20px rgba(0,0,0,0.12)

**ヘッダー部：**

- 背景：#313244
- パディング：12px 20px
- 左側：信号ドット3つ（赤 #f38ba8, 黄 #f9e2af, 緑 #a6e3a1, 各10px丸）＋ラベル
- 右側：コピーボタン

**コピーボタン：**

- 背景：rgba(255,255,255,0.1)
- 枠線：1px solid rgba(255,255,255,0.15)
- 文字色：#cdd6f4
- 角丸：8px
- ホバー：背景 rgba(255,255,255,0.2)
- コピー完了時：背景 rgba(166,227,161,0.2), 文字色 #a6e3a1

**テキスト本体：**

- 背景：var(--copy-bg) ← #1E1E2E
- 文字色：var(--copy-text) ← #CDD6F4
- パディング：24px
- フォント：14px, line-height: 2
- white-space: pre-wrap（改行を保持）
- user-select: all（クリックで全選択しやすくする）

**フッター部：**

- 背景：#313244
- パディング：10px 20px
- アイコン：16px丸, 背景 var(--accent), 文字色 白
- テキスト：12px, 色 #a6adc8

**コピーボタンのJavaScript：**

```javascript
function copyText(btn) {
  const text = document.getElementById('copyTarget').innerText;
  navigator.clipboard.writeText(text).then(() => {
    // ボタンの見た目を「コピーしました！」に変更（チェックマークアイコン）
    // 2秒後に元に戻す
  });
}
```

---

## 9. セクション見出し

- フォント：20px, 700
- 左ボーダー：4px solid var(--accent)
- 左パディング：16px
- 下マージン：24px
- line-height: 1.4

---

## 10. キーワードハイライト

- 背景：var(--highlight) ← #FFF3CD（薄い黄色）
- パディング：2px 6px
- 角丸：4px
- フォント：500
- 文字色：var(--text)
- display: inline

---

## 11. ヒント一覧（tip-item）

各項目：

- フォント：14px
- 文字色：var(--text-sub)
- パディング：8px 0
- 下ボーダー：1px dashed var(--border)（最後の項目は非表示）
- 項目内のstrong：color var(--text)

---

## 12. フッター

- テキスト配置：中央
- 上マージン：56px
- 上ボーダー：1px solid var(--border), 上パディング：32px
- 文字色：var(--text-sub)
- フォント：13px
- リンク色：var(--accent), text-decoration: none

---

## 13. レスポンシブ（スマホ対応）

```css
@media (max-width: 600px) {
  .container { padding: 20px 16px 60px; }
  .header { padding: 36px 24px; }
  .header h1 { font-size: 22px; }
  /* カード類のパディング: 24px 20px */
  /* コピーブロック本体: padding 16px, font-size 13px */
}
```

---

## 14. 印刷対応

```css
@media print {
  body { background: white; }
  .container { padding: 20px; }
  .copy-btn { display: none; }  /* コピーボタンは印刷不要 */
}
```

---

## 15. デザインの原則（まとめ）

- 背景はクリーム色（#FFF8F0）、カードは白。コントラストで階層感を出す
- アクセントカラーはオレンジ（#E86C3A）。ボタン、番号、見出しに統一して使う
- **コピー対象はダーク背景（#1E1E2E）**で、周囲と明確に区別する
- **角丸は大きめ（14〜20px）**でやわらかい印象にする
- 影は控えめ（0 2px 12px rgba(0,0,0,0.06)）
- 本文はグレー（#6B6560）、強調だけ黒系（#2D2A26）にして読みやすく
- ステップ間は縦線でつなぎ、順序の流れを視覚的に示す
- 注意事項は左ボーダー付きボックスで目を引く
- 絵文字を見出しの先頭に使い、親しみやすさを出す（💡📱📝 など）
- 専門用語には必ず補足（例：「設定」→ 英語では「Settings」）

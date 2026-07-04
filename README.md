# LINEスタンプメーカー

招待制のクローズドWebアプリ。人物写真（または特徴入力）と5つの質問から、LINEスタンプ申請規格に沿った「文字入りキャラクタースタンプ一式」をAIで生成します。

- **基盤**：GitHub（コード管理）＋ Vercel（ホスティング）＋ Supabase（認証・DB・ストレージ）
- **画像生成**：OpenAI GPT Image（`gpt-image-2`、品質High・大きめ出力からLINE規格へ整形）
- **フレームワーク**：Next.js 15（App Router / TypeScript）
- 仕様書 `LINEスタンプメーカー_実装仕様書_v1.0.md` / デザイン `design-prompt.md` に準拠

---

## 1. 必要なもの

- Node.js 20 以上
- Supabase プロジェクト（無料枠で可）
- OpenAI APIキー（GPT Image が使えるアカウント）
- Vercel アカウント（デプロイ用）
- （任意）Resend アカウント（追加枠申請の管理者メール通知）

---

## 2. 環境変数一覧

`.env.example` を `.env.local` にコピーして設定します。Vercel では Project Settings → Environment Variables に同じキーを登録してください。

| 変数名 | 用途 | 例 / 既定 |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key（ブラウザ可） | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバー専用**の秘密鍵（RLSバイパス） | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI APIキー（サーバー専用） | `sk-...` |
| `OPENAI_IMAGE_MODEL` | 画像生成モデル | `gpt-image-2` |
| `OPENAI_IMAGE_QUALITY` | 画像品質。最高品質は `high` | `high` |
| `OPENAI_IMAGE_SIZE` | 生成時の画像サイズ。最終的に370×320へ整形 | `2048x2048` |
| `RESEND_API_KEY` | メール送信（任意・未設定時はログ出力） | `re_...` |
| `MAIL_FROM` | 送信元アドレス | `"... <noreply@example.com>"` |
| `ADMIN_EMAIL` | 申請通知の宛先（管理者メール） | `admin@example.com` |
| `NEXT_PUBLIC_APP_URL` | 公開URL（招待リンク生成に使用） | `http://localhost:3000` |
| `CRON_SECRET` | 日次削除・生成復旧Cronの認証用シークレット | 長いランダム文字列 |
| `ADMIN_INITIAL_EMAIL` | 初期管理者メール（seed用） | `admin@example.com` |
| `ADMIN_INITIAL_PASSWORD` | 初期管理者パスワード（seed用） | 任意 |
| `ADMIN_INITIAL_NAME` | 初期管理者表示名（seed用） | `管理者` |

> **秘密情報の扱い**：`SUPABASE_SERVICE_ROLE_KEY` と `OPENAI_API_KEY` はサーバー側（Route Handler）でのみ使用し、ブラウザには渡しません。`NEXT_PUBLIC_` が付かない変数はクライアントバンドルに含まれません。

---

## 3. セットアップ手順

### 3-1. 依存インストール

```bash
npm install
```

### 3-2. Supabase：スキーマ＋RLS の適用

Supabase ダッシュボードの **SQL Editor** で `supabase/migrations/0001_init.sql` の内容を実行します（テーブル・enum・RLSポリシー・トリガー・Storageバケット `uploads` / `stamps` を作成）。

または Supabase CLI：

```bash
supabase db push   # もしくは psql で 0001_init.sql を流す
```

### 3-3. 初期管理者アカウントの作成

`.env.local` を用意したうえで：

```bash
node --env-file=.env.local supabase/seed.mjs
```

`ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD` の管理者ユーザーが作成され、`profiles.role = admin` に設定されます。

### 3-4. ローカル起動

```bash
npm run dev
# http://localhost:3000/login から管理者でログイン
```

管理者でログイン → `⚙ 管理メニュー` → 招待リンクを発行 → 別ブラウザでそのリンクから一般ユーザー登録、という流れで動作確認できます。

---

## 4. Vercel へのデプロイ

1. GitHub にリポジトリを push
2. Vercel で **New Project** → 当リポジトリを import
3. 上記の環境変数をすべて登録（`NEXT_PUBLIC_APP_URL` は本番URLに）
4. Deploy
5. `vercel.json` の Cron（`/api/cron/cleanup` と `/api/cron/resume-generation`）が自動登録されます。Cron 認証のため `CRON_SECRET` を設定してください（Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を送ります）。

> **画像生成の実行時間**：`generate-preview` / `generate-remaining` などは最大 300 秒（`vercel.json` の `maxDuration`）。各画像は生成後すぐStorageへアップロードされ、途中で止まった場合も `/api/cron/resume-generation` が未生成スロットだけを続きから再開します。

---

## 5. 品質・レート制限の設定

- **品質**：`OPENAI_IMAGE_MODEL=gpt-image-2`、`OPENAI_IMAGE_QUALITY=high`、`OPENAI_IMAGE_SIZE=2048x2048` を標準にします。大きめに生成してから370×320へ縮小し、線と文字の密度を上げます。
- **背景**：`gpt-image-2`は透過背景を直接返せないため、生成時はシアン単色背景を指示し、後処理で透過PNGへ変換します。
- **レート制限**：16枚は1枚ずつ**順次生成**。2枚目以降は1枚目の生成画像を参照して同一キャラを維持します（`src/lib/generation.ts`）。進捗は S5 / S6 で逐次表示。
- **単価**：管理画面（S8 アプリ設定）で 通常生成 円/枚（既定40円）・服装変更 円/回（既定20円）を編集可能。費用お知らせ（F11）とダッシュボード（S9）に反映されます。

---

## 6. ディレクトリ構成（主要部）

```
src/
├── app/
│   ├── globals.css              デザインシステム（design-prompt.md 準拠）
│   ├── login / register         S1 / S2
│   ├── home                     S3（＋ request-monthly：月間枠申請 F10）
│   ├── guide                    S11 はじめてガイド
│   ├── create/[id]              S4 ウィザード（自動保存 F2）
│   ├── project/[id]/preview     S5 プレビュー確認
│   ├── project/[id]/review      S6 全16枚確認（再生成 F5・紙吹雪 F13）
│   ├── project/[id]/download    S7 書き出し・費用お知らせ F11
│   ├── admin                    S8 管理（承認・招待・ユーザー・設定）
│   ├── admin/dashboard          S9 利用状況
│   └── api/                     Route Handlers（生成・ZIP・申請・Cron 等）
├── components/                  共通UI（CopyBlock / Confetti / モーダル 等）
└── lib/                         supabase / openai / image(sharp) / prompt / generation / …
supabase/
├── migrations/0001_init.sql     スキーマ + RLS + Storage
└── seed.mjs                     初期管理者作成
```

---

## 7. 受け入れ条件（仕様書8章14項目）との対応

| # | 条件 | 実装箇所 |
|---|------|----------|
| 1 | 招待発行→登録→ログイン。使用済/期限切れ/取消は登録不可 | `api/admin/invites`, `lib/invite.ts`, `register/`, `login/` |
| 2 | ウィザード完了→4枚プレビューまで自動 | `api/projects/[id]/generate-preview`, `lib/generation.ts` |
| 3 | 承認後に残り12枚生成・個別再生成 | `generate-remaining`, `regenerate` |
| 4 | ZIPに01-16(370×320透過1MB以下10px余白)/main(240)/tab(96×74) | `lib/image.ts`, `api/.../download` |
| 5 | 停止中ログイン不可・他人/管理画面アクセス不可 | `middleware.ts`, `lib/auth.ts`, RLS（0001_init.sql） |
| 6 | 月間上限到達で新規作成ブロック | `api/projects`（POST）, `lib/quota.ts` |
| 7 | スマホ375pxで崩れず操作 | `globals.css`（@media 600px） |
| 8 | 服装変更→結果→元にもどす | `api/.../clothing`, `changeClothing`/`revertClothing` |
| 9 | 服装枠3回→申請→承認+3→再変更、申請時メール通知 | `requests`, `admin/requests`, `lib/email.ts` |
| 10 | 却下でユーザー側に却下表示・再申請可 | `admin/requests`（reject）, `RequestModal` |
| 11 | S7初回のみ費用モーダル（実績金額）、2回目以降は1行再掲 | `download/`, `lib/settings.ts`, `cost-shown` |
| 12 | 全16枚OKで紙吹雪（reduced-motion時は非表示） | `components/Confetti.tsx`, `globals.css` |
| 13 | 完成セット90日以内はS3から再DL | `home/`, `api/.../download`（410判定） |
| 14 | S11ガイド表示・初回ログイン案内 | `guide/`, `home`（`welcome=1`） |

---

## 8. スクリプト

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run start      # 本番起動
npm run typecheck  # 型チェック
```

---

## 9. スコープ外（今回作らないもの）

LINE申請代行・審査保証、公開登録・決済、ネイティブアプリ、アニメーションスタンプ、全16枚一括の服装変更、完成済みセットへの服装変更・再ZIP化、ペット等の人物以外キャラ化、複数管理者の階層権限、多言語対応。詳細は仕様書9章を参照。

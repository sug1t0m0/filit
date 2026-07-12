# filit 基本設計

> **Status:** ドラフト
> **Last updated:** 2026-07-08
> [requirements.md](./requirements.md) の MVP (R1〜R8) を対象とする。
> 基本方針: [difit](https://github.com/yoshiko-pg/difit) のアーキテクチャ・ツールチェーンを積極的に踏襲し、知見を流用する。

## 1. 決定事項 (requirements.md の Open Questions への回答)

| #          | 決定                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Q1         | デフォルトポートは `4967` (difit の 4966 に隣接)                                                           |
| Q6         | 合成 Markdown は **行番号付き + インライン注釈** 形式で固定 (§7 参照)。Gemini in Chrome での実測後に見直す |
| ツール構成 | difit に完全準拠: pnpm / TypeScript (ESM) / oxlint / oxfmt / vitest / lefthook / Tailwind CSS v4           |
| 進め方     | 本ドキュメントレビュー後にスキャフォールドから実装                                                         |

## 2. 全体構成

difit と同じ 3 層構成。単一パッケージ (`filit`) に CLI・サーバ・クライアントを同居させ、`dist/` にビルドして npm 配布する。

```
filit <paths...>
  │
  ├─ src/cli/      commander でパース → スコープ解決 → サーバ起動 → ブラウザ open
  ├─ src/server/   Express。ファイルツリー/内容 API、コメント永続化、合成 Markdown 生成
  └─ src/client/   React + Vite + Tailwind。ツリー選択 UI、行コメント UI、バイト数表示
```

- 開発時: Vite dev server がクライアントを配信し、`/api` を Express にプロキシ (difit の `scripts/dev.js` 方式)。
- 配布時: ビルド済みクライアントを Express が静的配信。

## 3. ディレクトリ構成 (予定)

```
src/
├── cli/
│   ├── index.ts            # エントリポイント (bin)。引数パース、サーバ起動、open
│   └── utils.ts            # ポート探索、パス検証など
├── server/
│   ├── server.ts           # Express セットアップ、ルーティング、heartbeat 自動終了
│   ├── file-scanner.ts     # スコープ解決 (glob 展開、.gitignore 尊重、バイナリ除外)
│   ├── comment-store.ts    # .filit/comments.json の読み書き (アトミック書き込み)
│   └── composer.ts         # 選択ファイル + コメント → 合成 Markdown
├── client/
│   ├── index.html / main.tsx / App.tsx
│   ├── components/
│   │   ├── FileTree.tsx        # チェックボックス付きツリー (R2)
│   │   ├── FileViewer.tsx      # 行番号付きファイル表示
│   │   ├── CommentButton.tsx   # 行ホバーで表示 (difit から移植)
│   │   ├── CommentForm.tsx     # コメント入力 (difit から移植)
│   │   ├── CommentCard.tsx     # 既存コメント表示・削除
│   │   └── Header.tsx          # バイト数表示 (R3) + 「タブに開く」ボタン (R6)
│   ├── hooks/                  # useFileTree, useComments, useSelection
│   └── styles/
├── types/
│   └── core.ts             # FileNode, Comment, ComposeRequest など共有型
└── utils/
    └── byteCount.ts        # UTF-8 バイト数計算 (client/server 共用)
```

## 4. CLI 仕様

```
filit [paths...] [options]
```

| 引数/オプション    | 説明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `paths...`         | スコープ。ファイル・ディレクトリ・グロブ混在可 (R1)。省略時は `.` |
| `--port <n>`       | 希望ポート (default: 4967)。使用中なら +1 して探索 (difit 方式)   |
| `--host <host>`    | バインドホスト (default: 127.0.0.1)                               |
| `--no-open`        | ブラウザ自動起動 (R7) を抑止                                      |
| `--clear-comments` | 起動時に `.filit/comments.json` をクリア                          |

- スコープ解決はサーバ側 `file-scanner.ts` に委譲し、CLI は存在チェックのみ行う。
- 依存: `commander`, `open` (difit と同じ)。

## 5. サーバ設計

### 5.1 API

| メソッド/パス                   | 説明                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/tree`                 | スコープ配下のファイルツリー。各ファイルの UTF-8 バイト数を含む (R2, R3)                         |
| `GET /api/file/*`               | ファイル内容 (テキスト) を返す。スコープ外・シンボリックリンク越えは 403                         |
| `GET /api/comments`             | 全コメント取得                                                                                   |
| `POST /api/comments`            | コメント追加 → `.filit/comments.json` に永続化 (R4, R5)                                          |
| `DELETE /api/comments/:id`      | コメント削除                                                                                     |
| `GET /api/git/head`             | HEAD の SHA と dirty ファイル一覧 (「HEAD 固定で開く」用)                                        |
| `GET /api/bundles/:payload`     | payload をデコードし、解決した files + comments + bytes + missing を JSON で返す                 |
| `GET /api/bundles/:payload/raw` | 素の合成 Markdown (text/markdown)。コピー用 / リッチページが LLM に合わない場合のフォールバック  |
| `GET /bundle/:payload`          | SPA ルート。「タブに開く」の遷移先 (R6)。読み取り専用ツリー + ハイライト付き全ファイル縦積み表示 |
| `GET /api/heartbeat`            | SSE。クライアント切断後 N 秒でプロセス自動終了 (difit 方式)。開発モードでは無効                  |

- **bundle はステートレス**: URL の payload に選択ファイルリスト (と任意の固定コミット `rev`) を deflate + base64url でエンコードする。仕様は [bundle-url-spec.md](./bundle-url-spec.md)。エンコードはクライアントで完結し、サーバ往復なしで `window.open('/bundle/<payload>')` する。
- rev なし = ライブ解決 (アクセス時点のファイル内容)。rev あり = `git show <rev>:<path>` でそのコミット時点の内容に固定 (URL が内容まで一意に決定する)。コメントは常に `.filit/comments.json` をライブ解決 (NF6)。
- スコープ外 / 削除済み / rev に存在しないファイルは警告表示でスキップ。デコードされたパスはスキャン結果との照合でスコープ検査する。

### 5.2 ファイルスキャン (`file-scanner.ts`)

- glob 展開後、`.gitignore` を尊重して除外 (`ignore` パッケージ)。`.git/`, `node_modules/` は常に除外。
- バイナリ判定 (先頭バイトの NUL 検査) で除外し、ツリーに出さない。
- ファイルサイズ上限 (暫定 1MB/ファイル) 超過はツリーに出すが選択不可 + 警告表示。
- セキュリティ: API のパスはスコープ内に正規化・検証し、パストラバーサルを拒否 (R8 のローカル完結と合わせて)。

### 5.3 コメント永続化 (`comment-store.ts`)

- 保存先: **カレントリポジトリ (cwd の git ルート、なければ cwd) 直下の** `.filit/comments.json`。
- スキーマは requirements.md §7 の通り (version / id / file / startLine / endLine / body / createdAt)。
- 書き込みは temp ファイル + rename のアトミック方式。
- 行アンカリングは MVP ではベストエフォート (NF6)。再アンカリング (R15) は将来対応。

## 6. クライアント設計

### 6.1 画面構成 (1 画面)

```
┌──────────────────────────────────────────────────────┐
│ Header: filit | 選択 N files / 12,345 bytes | [タブに開く] │
├───────────────┬──────────────────────────────────────┤
│ FileTree      │ FileViewer                           │
│ ☑ src/        │  1  async function withdraw() {      │
│  ☑ auth.ts    │  2    await lock()      [+]          │
│  ☐ db.ts      │     ┌ コメント: この境界は妥当? ┐      │
│ ☐ docs/       │  3    ...                            │
└───────────────┴──────────────────────────────────────┘
```

- 左ペイン: チェックボックス付きファイルツリー。ディレクトリのチェックは配下一括トグル。
- 右ペイン: 2モードをタブで切替。**プレビュー** = ツリーでクリックした単一ファイルを表示、**選択ファイル** = チェック済みファイルをツリー順に全件縦積みで表示 (bundle のプレビューを兼ねる)。ファイル名クリックでプレビューモードに切替。行ホバーで `[+]` → クリックで行・範囲コメント追加 (difit の CommentButton / CommentForm を参考)。
- ヘッダ: 選択ファイルの UTF-8 バイト合計をライブ表示 (ツリー API のサイズ合算 + コメント分)。「タブに開く」ボタン。
- シンタックスハイライトは difit と同じ `prism-react-renderer` (拡張子ベースの言語判定、未知の拡張子はプレーン表示)。

### 6.2 状態管理

- difit 同様、外部状態管理ライブラリなし。React hooks (`useFileTree` / `useSelection` / `useComments`) + fetch。

## 7. 合成 Markdown 書式 (確定)

行番号付きコードブロック + インライン注釈 (決定事項 Q6)。

````markdown
# filit bundle (3 files, 12,345 bytes)

## src/auth.ts

```
  1: async function withdraw() {
     [注釈 L2-4: ここのロックは何を守ってる?]
  2:   await lock()
  3:   ...
  4: }
```
````

- 注釈は **行番号なしの行**として `startLine` の**直前**に `[注釈 L{start}-{end}: {body}]` の形で挿入する (単一行は `L{n}:`)。行番号を消費させないことで、実ファイルの行番号と合成結果の行番号が一致し、LLM が行を正確に参照できる。
- 先頭にファイル数のヘッダ行と**ディレクトリツリーのコードブロック**を置き、テキストだけでも構造が読み取れるようにする。
- `/bundle/:id` は SPA のリッチページ (読み取り専用ツリー + ハイライト表示)。素の Markdown は `/api/bundles/:id/raw` で取得できる (NF4 のフォールバック)。

## 8. 技術スタック・ツールチェーン (difit 準拠)

| 領域           | 採用                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| ランタイム     | Node.js >= 20, ESM                                                             |
| CLI            | commander, open                                                                |
| サーバ         | Express 5                                                                      |
| クライアント   | React 19, Vite, Tailwind CSS v4                                                |
| ファイル走査   | fast-glob + ignore                                                             |
| Lint / Format  | oxlint / oxfmt                                                                 |
| テスト         | vitest                                                                         |
| Git hooks      | lefthook                                                                       |
| パッケージ管理 | pnpm                                                                           |
| ビルド         | `tsc` (CLI/server) + `vite build` (client) → `dist/`。`bin: dist/cli/index.js` |

difit から流用しないもの: git diff 解析 (simple-git / GitDiffParser)、Prism ハイライト (MVP 後)、VSCode 拡張、file-watcher (MVP 後の検討)。

## 9. テスト方針

- 単体テスト (vitest): `file-scanner` (glob / ignore / バイナリ除外)、`composer` (注釈挿入位置・書式)、`comment-store` (永続化・アトミック性)、`byteCount`。
- コンポーネントテスト: FileTree の選択伝播、CommentForm の送信。
- E2E は MVP では持たない。手動確認は「起動 → 選択 → コメント → タブに開く」の一連で行う。

## 10. 実装ステップ

1. スキャフォールド: pnpm + TypeScript + Vite + Express + ツールチェーン一式、`filit` で Hello ページが開くまで
2. `file-scanner` + `GET /api/tree` + FileTree UI (R1, R2)
3. `GET /api/file/*` + FileViewer + バイト数表示 (R3)
4. コメント API + comment-store + コメント UI (R4, R5)
5. composer + bundle API + 「タブに開く」(R6)
6. 仕上げ: ポート探索、`--no-open`、heartbeat 自動終了、README (R7, R8, NF2)

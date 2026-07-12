# filit

CLI that bundles selected files into a single browser page so tab-aware LLMs (Gemini in Chrome, etc.) can ingest them at once.

Inspired by [difit](https://github.com/yoshiko-pg/difit) — but instead of reviewing a diff, filit lets you pick arbitrary files, annotate specific lines with questions, and hand the whole tab to an LLM.

## Usage

```bash
npx filit                 # scope = current directory
npx filit src docs        # scope = specific directories
npx filit 'src/**/*.ts'   # globs work too
```

This starts a local server (default port 4967) and opens your browser:

1. Check the files you want to include — the total UTF-8 byte size updates live
2. Click a line's `+` button to attach a question like "この境界は妥当?" to a line or range
3. Hit **タブに開く** — a new tab opens with everything assembled as plain Markdown
4. Point your tab-aware LLM at that tab

Comments are injected next to the lines they refer to:

```
## src/auth.ts

   [注釈 L2-4: ここのロックは何を守ってる?]
 2:   await lock()
```

### Options

| Option             | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `--port <port>`    | Preferred port (default: 4967, falls back to the next free port) |
| `--host <host>`    | Host to bind (default: 127.0.0.1)                                |
| `--no-open`        | Don't open the browser automatically                             |
| `--clear-comments` | Clear saved comments on startup                                  |

### Notes

- Comments are persisted to `.filit/comments.json` at your repository root. filit does **not** add `.filit/` to `.gitignore` automatically — commit it to share annotations, or ignore it yourself.
- Everything runs locally. File contents and comments never leave your machine; there is no telemetry.
- `.gitignore`d files, binary files, `.git/`, and `node_modules/` are excluded from the tree. Files over 1MB are listed but not selectable.
- The server shuts down automatically when all filit tabs are closed.

## Development

```bash
pnpm install
pnpm dev          # Express API + Vite dev server with HMR
pnpm test         # vitest
pnpm run check    # oxlint
pnpm run build    # dist/

pnpm dev --host 0.0.0.0   # expose the dev server on your LAN (e.g. to test from a phone);
                          # anyone on the network can then read the scoped files
```

## License

MIT

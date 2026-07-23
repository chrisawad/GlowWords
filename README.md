# Glow Words

A colorful, touch-first word search game for mobile and desktop browsers. Players choose an age level and tune the timer, word count, and grid size before racing to find hidden words.

## Run locally

On Windows, the included launcher automatically finds Codex's bundled Node.js
and pnpm, so no global installation or PowerShell policy change is required:

```bat
dev.cmd
```

The PowerShell launcher is also available if local scripts are enabled:

```powershell
.\dev.ps1
```

The development server binds to `0.0.0.0`, allowing other devices on the same
network to connect. Vite prints the network URL when it starts. If Windows asks,
allow Node.js through the firewall on private networks.

With Node.js and pnpm already installed globally, the standard commands are:

```bash
pnpm install
pnpm dev
```

Create an optimized build with `pnpm build`.

The build also emits a Cloudflare Worker-compatible Sites package under
`dist/`, including SPA routing and request-aware social preview metadata.

## Word service contract

The client is ready to use a remote word source. It requests:

```text
GET /api/words?age=7-8&gridSize=10&count=8
```

The service may return either a JSON array or an object:

```json
{ "words": ["PLANET", "GARDEN", "RABBIT"] }
```

Words are sanitized, deduplicated, and checked against the selected grid size. If the request fails, times out after 2.5 seconds, or returns too few usable words, the client automatically draws from the bundled age-level word banks in `src/words.ts`.

## Input support

The letter board uses Pointer Events, so one interaction path supports mouse, pen, Android touch, and iPhone touch. Native scrolling is disabled only on the board while a player is selecting letters.

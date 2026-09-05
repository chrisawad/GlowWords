# Glow Words

A colorful, touch-first word search game for mobile and desktop browsers. Players choose an age level and tune the timer, word count, and grid size before racing to find hidden words.

## Run with Docker

Install Docker with Docker Compose for your environment, then make sure the
Docker daemon is running and accessible from your terminal. No host installation
of Node.js, pnpm, or nginx is needed.

From the repository root, build and start the app:

```text
docker compose up --build -d app
docker compose port app 80
```

The checked-in configuration publishes port 8080. With that mapping, open
[Glow Words](http://127.0.0.1:8080). If your configuration uses a different port,
use the host port reported by the second command. For a remote Docker host, use
its reachable address or a forwarded port.

Docker installs the locked dependencies, compiles TypeScript, and builds the
production app. The runtime container serves the generated `dist/client` files
with nginx. Source files are copied into the image, so rerun the build-and-start
command after making changes.

## Build and verify

To validate the configuration and build without starting the app:

```text
docker compose config
docker compose build app
```

Once the app is running, check its status, logs, and server configuration:

```text
docker compose ps
docker compose logs --tail 100 app
docker compose exec -T app nginx -t
```

Open the preview and try the game. See [HOSTING.md](HOSTING.md) for HTTP and
asset verification. The default preview uses HTTP; HTTPS is not configured.

To stop the app:

```text
docker compose stop app
```

## Deploy to GitHub Pages

The `Deploy to GitHub Pages` workflow builds and deploys the app whenever a
change is pushed to `main`. It can also be started manually from the repository's
**Actions** tab.

Before the first deployment, open **Settings → Pages** in the GitHub repository
and set **Source** to **GitHub Actions**. The workflow builds asset URLs for the
repository's project-site path automatically and publishes `dist/client`.

## Word service contract

The client is ready to use a remote word source. It requests:

```text
GET /api/words?age=7-8&gridSize=10&count=8
```

The service may return either a JSON array or an object. Each word entry includes
the word displayed in the game and the complete list of microphone transcripts
that should count as a match:

```json
{
  "words": [
    {
      "word": "APPLE",
      "acceptedTranscriptions": ["APPLE", "APPLES"]
    },
    {
      "word": "BUTTERFLY",
      "acceptedTranscriptions": ["BUTTERFLY", "BUTTERFLIES"]
    }
  ]
}
```

For backward compatibility, string entries such as `"APPLE"` are also accepted
and use only that exact transcription. The displayed word is always added to its
accepted transcription list if the service omits it. Words and transcriptions
are sanitized and deduplicated, and displayed words are checked against the
selected grid size. If the request fails, times out after 2.5 seconds, or returns
too few usable words, the client automatically draws from the bundled age-level
word dictionaries in `src/words.ts`.

## Input support

The letter board uses Pointer Events, so one interaction path supports mouse, pen, Android touch, and iPhone touch. Native scrolling is disabled only on the board while a player is selecting letters.

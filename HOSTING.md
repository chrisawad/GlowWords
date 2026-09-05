# Local preview with Docker

Run these commands from the repository root in your terminal. Docker with Docker Compose must be installed, running, and accessible from that terminal. If either is missing, set it up for your environment before continuing. Node.js, pnpm, and nginx run inside the Docker images; they do not need to be installed on the host.

## Build and start

```text
docker compose config
docker compose build app
docker compose up -d app
```

The Dockerfile installs the locked application dependencies and runs the production build in its Node.js stage. Its runtime stage serves `dist/client` with nginx. Rebuild after changing source files to update the preview.

## Verify

```text
docker compose ps
docker compose logs --tail 100 app
docker compose exec -T app nginx -t
docker compose port app 80
```

Use the host port reported by the last command to construct `http://127.0.0.1:<published-port>`. Check that URL with an HTTP client available in your environment, then verify the JavaScript and CSS URLs referenced by the returned HTML also respond successfully. Share the verified URL for browser testing. If Docker runs on a remote machine, use a reachable address or port forwarding appropriate to that environment.

The checked-in Compose file maps host port 8080 to container port 80, but always inspect the running mapping before sharing a URL. HTTPS is not configured. No host nginx service or `NGINX_*` environment variables are needed.

## Stop the preview

Leave the preview running when the user needs to test. When it is no longer needed, stop only this project's app:

```text
docker compose stop app
```

Use Docker previews for local testing and unmerged work. See `README.md` for the GitHub Pages deployment workflow.

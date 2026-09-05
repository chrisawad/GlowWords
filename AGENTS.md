# GlowWords agent instructions

These instructions apply to this repository.

## Environment

- Do not assume a particular operating system, shell, checkout path, or agent runtime. Inspect the current environment and adapt commands as needed.
- Docker and Docker Compose provide the build and preview environment. Use the repository's `Dockerfile` and `docker-compose.yml`.
- Do not assume nginx or any other web server is installed or running on the host. The current Dockerfile includes nginx inside the runtime image.

## Dependencies and installation

- Inspect the available tools before starting work. For the normal build and verification workflow, the host needs Git and a working Docker installation with Docker Compose; host Node.js, pnpm, and nginx are not required.
- If Docker or Docker Compose is missing or unavailable, tell the user it is required and help them set it up for their environment. Ask for permission before installing it; if it is already installed, check that the Docker daemon is running and accessible.
- Install build tools and application dependencies inside Docker. Put required tooling changes in the Dockerfile and application dependencies in the package manifest and lockfile so the environment can be reproduced.
- Dependency installation already declared in the Dockerfile is part of an authorized Docker build and does not require a separate permission request.
- Ask for explicit permission before installing software on the host, including project-local dependencies outside Docker. Explain what is needed, why Docker cannot satisfy the need, and whether the installation is project-local or system-wide. After approval, install it and continue the original task.
- Do not install host dependencies merely because `node_modules` is absent.
- Container changes are disposable. Record required installations in the Dockerfile rather than relying on manual changes to a running container.

## Build and verify with Docker

- Use `docker compose config` to validate the configuration, then `docker compose build app` to run the production build inside Docker.
- If the build fails, fix the underlying project or Docker configuration and rebuild. Do not switch to host dependency installation as a workaround.
- Start the built app with `docker compose up -d app` for testing.
- Verify the service with `docker compose ps` and inspect `docker compose logs --tail 100 app` for startup failures.
- For the current nginx runtime, validate its configuration with `docker compose exec -T app nginx -t`.
- Check the published HTTP endpoint from the host, including the generated JavaScript and CSS assets. Run relevant automated checks inside Docker when the task requires them. A successful image build alone does not verify that the app is reachable.
- Read `HOSTING.md` for the local preview workflow. Leave a requested test preview running and provide its verified URL.
- Scope Docker operations to this project. Do not stop unrelated containers, prune Docker resources, or delete volumes as routine troubleshooting.

## Preview URLs and deployment

- Discover the actual published port with `docker compose port app 80` after startup. Use the current Compose configuration, not stale environment variables or assumed port mappings.
- Give the user `http://127.0.0.1:<published-port>`, substituting the verified host port. Do not give a container-only address or internal listener port.
- Only offer HTTPS if it is actually configured and verified. The current Compose configuration provides HTTP only.
- Use the Docker preview for local testing, feature branches, and pull requests.
- GitHub Pages deployment is managed by `.github/workflows/deploy-pages.yml`; keep its static build compatible with the Docker build.

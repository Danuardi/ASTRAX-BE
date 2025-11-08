# Docker & Docker Compose

This project includes a `Dockerfile` and `docker-compose.yml` to run the backend and a local MongoDB for development.

Files added:

- `Dockerfile` — builds the Node.js application image
- `docker-compose.yml` — runs `app` and `mongo` services
- `.dockerignore` — excludes local files from the build context

Quick commands

Build image locally:

```powershell
cd d:\Astrax-Backend\astra-backend
npm run docker:build
```

Run services (build + detach):

```powershell
npm run docker:up
```

Stop and remove services:

```powershell
npm run docker:down
```

Notes

- The compose file loads environment variables from the repository `.env` file via `env_file: ./.env` and also sets `MONGO_URI` to point at the `mongo` service.
- If you prefer to use an external managed MongoDB (Atlas), remove/override the `MONGO_URI` in your `.env` file before running compose.
- The build uses `npm ci --only=production` and falls back to `npm install` if `npm ci` fails (useful for local testing).

Troubleshooting

- If the container fails to start, inspect logs with:

```powershell
docker-compose logs -f
```

- If you need to run interactive commands in the container:

```powershell
docker-compose exec app sh
```

Railway deployment notes
-----------------------

- Railway (and similar PaaS) provide runtime environment variables for secrets and the HTTP port (commonly `PORT`). The Dockerfile and app are configured to read `process.env.PORT` so the same image will work on Railway without changes.
- Do NOT commit or copy your local `.env` into the image. `.dockerignore` already excludes `.env` to avoid leaking secrets. On Railway, set env vars in the project settings.
- The `docker-compose.yml` uses variable substitution for `PORT` and `MONGO_URI` so the same file works locally and does not conflict when the image is built/deployed to Railway.
- If Railway builds the image, it will run the container and provide `PORT`. The app will pick that up automatically.


# Live Presentation & Demo Script (12–15 Minutes)

This script guides the three team members through a complete 12–15 minute presentation covering the application, containerization, database persistence, CI/CD quality gates, and live deployment.

---

## Timing & Speaker Breakdown

| Time | Segment | Speaker |
|---|---|---|
| 0:00 – 2:30 | Repository, Branching & Application Overview | **Member A (Sahil)** |
| 2:30 – 5:00 | Repository Pattern, APIs & Automated Tests | **Member A (Sahil)** |
| 5:00 – 7:30 | Docker, Compose + Postgres 16 & Healthchecks | **Member B (Himanshu)** |
| 7:30 – 9:30 | Neon PostgreSQL & Vercel Live Deployment | **Member B (Himanshu)** |
| 9:30 – 12:30 | Live CI/CD Demo: Branch → PR → Lint/Test/Docker → Preview → Merge → Prod | **Member C (Suraj)** |
| 12:30 – 15:00 | README Walkthrough & Examiner Q&A | **All Members** |

---

## Segment 1: Repo Hygiene & Application Core (Member A — ~5 min)

### What to Show
1. Open GitHub repo → **Branches** & **Closed Pull Requests** (`feature/app`, `feature/docker`, `feature/ci`, `feature/db-and-api`, `feature/infra`, `feature/quality-and-docs`).
2. Open [`src/app.js`](../src/app.js) and [`src/repository/memoryRepository.js`](../src/repository/memoryRepository.js).
3. Run `npm run lint` and `npm run test:coverage` in the terminal.

### What to Say
> "Our project is an Expense Tracker built with Node.js and Express. We followed strict Git hygiene: nobody pushed directly to `main`, every feature was developed on its own branch with small conventional commits, and every PR was reviewed by a teammate."
>
> "To support both fast in-memory testing and persistent PostgreSQL storage, we refactored `src/app.js` to accept a repository via dependency injection (`createApp(repo)`). Our Jest and Supertest suite runs 19 tests against the in-memory repository, covering CRUD, date filtering, monthly budgets, and escaped CSV export, enforcing our coverage thresholds."

---

## Segment 2: Docker, Postgres 16 & Cloud Deployment (Member B — ~4.5 min)

### What to Show
1. Open [`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml), and [`db/schema.sql`](../db/schema.sql).
2. Run `docker compose up --build` (or show running container and `/health`).
3. Open [`src/repository/postgresRepository.js`](../src/repository/postgresRepository.js) and [`api/index.js`](../api/index.js).
4. Open the live Vercel URL (`https://system-design-project-ten.vercel.app`) in an **incognito window**, add an expense, and refresh to prove Neon Postgres persistence.

### What to Say
> "Our `Dockerfile` uses `node:20-alpine`, copies `package*.json` first for layer caching, installs only production dependencies with `npm ci --omit=dev`, adds a `HEALTHCHECK` on `/health`, and runs as non-root `USER node`."
>
> "With `docker compose up --build`, we spin up Postgres 16 with a named volume, automatically initialize `db/schema.sql`, wait for `pg_isready` to pass, and start the Express app. In production on Vercel, `api/index.js` reads `DATABASE_URL` and connects to Neon PostgreSQL using a module-level singleton pool (`max: 3`) with SSL and parameterized queries."

---

## Segment 3: Live CI/CD & Quality Gates Demo (Member C — ~3 min)

### Live Commands to Run During the Demo
1. **Create a branch and make a small visible change**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/demo-change
   ```
   Open [`public/index.html`](../public/index.html), change `<h1>Expense Tracker</h1>` to `<h1>Expense Tracker — Live Demo</h1>`, and save.
2. **Commit and push**:
   ```bash
   git add public/index.html
   git commit -m "feat: update header title for live demo"
   git push -u origin feature/demo-change
   ```
3. **Open Pull Request & Show CI**:
   - Open the PR on GitHub (notice `.github/pull_request_template.md` auto-populates!).
   - Click the **Actions** tab: show `Lint and Test` (`npm run lint`, `npm run test:coverage`, coverage artifact upload) turning green, followed by `Build Docker Image`.
   - Show the **Vercel Preview Deployment** URL comment on the PR and open it to preview the updated heading before merging.
4. **Merge & Watch Production Redeploy**:
   - Have Member A or B click **Merge pull request**.
   - Show `.github/workflows/docker-publish.yml` building and pushing the image to **GHCR** (`ghcr.io`), and show Vercel redeploying **Production** automatically.
   - Refresh `https://system-design-project-ten.vercel.app` to confirm the change is live.

### What to Say
> "Our CI pipeline runs ESLint, Jest with coverage thresholds, and a Docker image build on every pull request—blocking broken code before merge. Merging to `main` automatically publishes our tagged container image to GitHub Container Registry (`ghcr.io`) and triggers a zero-downtime production redeploy on Vercel."

---

## Segment 4: Examiner Q&A Quick Reference

- **Why use the repository pattern?** It decouples HTTP routing from data storage, allowing fast deterministic tests without a database while using parameterized PostgreSQL queries in production.
- **Why set `max: 3` on the `pg` Pool?** Vercel serverless functions scale horizontally into multiple instances; a small module-level singleton pool prevents exhausting Neon's connection limit.
- **How do you prevent SQL injection and XSS?** All SQL queries use `$1, $2` placeholders and an explicit allowlist for `ORDER BY`; the vanilla frontend renders user text exclusively with `textContent` rather than `innerHTML`.
- **What happens if `npm run lint` fails in CI?** The `test` job fails immediately and the dependent `docker` job is skipped, preventing the broken PR from passing checks.

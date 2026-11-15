# Expense Tracker

A simple expense tracker web application built with Node.js and Express. Users add expenses, see the total spent, and see the amount spent in each category. The project is packaged with Docker, built and tested automatically with GitHub Actions, and deployed on Vercel.

## Live link

[Open the live application](https://system-design-project-ten.vercel.app)

## Features

- Add an expense with a title, an amount and a category
- See all expenses in a list and delete any of them
- See the total spent and the amount spent in each category

## Architecture

```
Developer --> GitHub (branch --> pull request --> main)
                 |                                |
                 v                                v
          GitHub Actions                      Vercel
   (npm ci, npm test, docker build)        (auto-deploy)
                                                  |
                                                  v
                                          Live public URL
```

- **Frontend:** one HTML page (`public/index.html`) that calls the API using `fetch`.
- **Backend:** Express app (`src/app.js`) with endpoints `GET /health`, `GET /api/expenses`, `POST /api/expenses`, `DELETE /api/expenses/:id` and `GET /api/summary`.
- **Deployment:** on Vercel, `vercel.json` sends every request to `api/index.js`, which runs the same Express app.
- **Data:** expenses are stored in memory to keep the project simple, so they reset when the server restarts.

## Run locally

Requires Node.js 20 or higher.

```bash
git clone https://github.com/himanshu-a11y/SystemDesignProject.git
cd SystemDesignProject
npm install
npm start
```

Open http://localhost:3000

## Run the tests

```bash
npm test
```

## Run with Docker

```bash
docker build -t expense-tracker .
docker run -p 3000:3000 expense-tracker
```

Open http://localhost:3000

## CI/CD

The workflow `.github/workflows/ci.yml` runs on every push and on every pull request into `main`. It installs dependencies (`npm ci`), runs the tests (`npm test`) and builds the Docker image. Vercel deploys automatically after a merge into `main`.

## Team

| Member | Role |
|---|---|
| Sahil Yadav | Application and tests |
| Himanshu Gurjar | Docker and Vercel deployment |
| Suraj Nair | CI/CD pipeline and README |

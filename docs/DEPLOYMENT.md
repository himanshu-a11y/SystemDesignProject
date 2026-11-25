# Deployment Guide (Neon PostgreSQL + Vercel)

This guide explains how to provision a free managed PostgreSQL database on **Neon** and connect it to the **Vercel** deployment.

---

## 1. Create a Free Neon Database

1. Go to [neon.tech](https://neon.tech) and sign in (you can use your GitHub account).
2. Click **Create a project**, name it `expense-tracker`, choose a region close to your Vercel deployment, and click **Create**.
3. Open the **SQL Editor** in the Neon dashboard.
4. Copy the contents of [`db/schema.sql`](../db/schema.sql) and run it in the SQL Editor to create the `expenses` and `budgets` tables and indexes.
   - Alternatively, run it from your terminal with `psql`:
     ```bash
     psql "YOUR_NEON_CONNECTION_STRING" -f db/schema.sql
     ```
5. In the Neon dashboard, go to **Connection Details** and copy the **Connection string** (make sure it ends with `?sslmode=require`).

---

## 2. Configure `DATABASE_URL` on Vercel

1. Open your project in the [Vercel Dashboard](https://vercel.com).
2. Go to **Settings** → **Environment Variables**.
3. Add a new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: paste your Neon connection string (`postgresql://...?sslmode=require`)
   - **Environments**: check both **Production** and **Preview**.
4. Click **Save**.

---

## 3. Redeploy & Verify

1. Trigger a new deployment (or merge a pull request into `main` so Vercel auto-deploys).
2. Verify the live endpoints:
   - **Health check**:
     ```bash
     curl https://system-design-project-ten.vercel.app/health
     # Expected: {"status":"ok"}
     ```
   - **Create an expense**:
     ```bash
     curl -X POST https://system-design-project-ten.vercel.app/api/expenses \
       -H "Content-Type: application/json" \
       -d '{"title":"Coffee","amount":120,"category":"Food"}'
     ```
   - **Check persistence**: Reload the live app in an incognito window or run `GET /api/expenses` again—the data should persist across requests and serverless cold starts.
   - **Summary & Budget Status**: Visit `/api/summary` and `/api/budgets/status` to verify database aggregation queries succeed.

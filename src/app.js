const express = require("express");
const path = require("path");
const {
  CATEGORIES,
  VALID_SORTS,
  round2,
  todayISO,
  currentMonthISO,
  isValidISODate,
  expensesToCsv,
} = require("./utils");
const { createMemoryRepository } = require("./repository/memoryRepository");
const { createPostgresRepository } = require("./repository/postgresRepository");

function createDefaultRepository() {
  if (process.env.DATABASE_URL) {
    return createPostgresRepository(process.env.DATABASE_URL);
  }
  return createMemoryRepository();
}

function parseOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseExpenseFilters(query = {}) {
  const category = parseOptionalString(query.category);
  if (category && !CATEGORIES.includes(category)) {
    return { error: "invalid category" };
  }

  const from = parseOptionalString(query.from);
  if (from && !isValidISODate(from)) {
    return { error: "invalid from date" };
  }

  const to = parseOptionalString(query.to);
  if (to && !isValidISODate(to)) {
    return { error: "invalid to date" };
  }

  const sort = parseOptionalString(query.sort) || "date_desc";
  if (!VALID_SORTS.includes(sort)) {
    return { error: "invalid sort" };
  }

  return { filters: { category, from, to, sort } };
}

function validateExpenseBody(body, existing = null) {
  const data = body || {};
  const title = String(data.title || "").trim();
  if (!title) {
    return { error: "title is required" };
  }

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "amount must be a number greater than 0" };
  }

  const rawCategory = parseOptionalString(data.category);
  const category = rawCategory || (existing ? existing.category : "Other");
  if (!CATEGORIES.includes(category)) {
    return { error: "invalid category" };
  }

  const rawDate = parseOptionalString(data.date);
  let date;
  if (!rawDate) {
    date = existing ? existing.date : todayISO();
  } else {
    if (!isValidISODate(rawDate)) {
      return { error: "invalid date" };
    }
    date = rawDate;
  }

  return {
    value: {
      title,
      amount: round2(amount),
      category,
      date,
    },
  };
}

function createApp(repo = createDefaultRepository()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/expenses", async (req, res) => {
    const { error, filters } = parseExpenseFilters(req.query);
    if (error) return res.status(400).json({ error });

    const expenses = await repo.listExpenses(filters);
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    const { error, value } = validateExpenseBody(req.body);
    if (error) return res.status(400).json({ error });

    const expense = await repo.createExpense(value);
    res.status(201).json(expense);
  });

  app.put("/api/expenses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "invalid expense id" });
    }

    const existing = await repo.getExpenseById(id);
    if (!existing) {
      return res.status(404).json({ error: "expense not found" });
    }

    const { error, value } = validateExpenseBody(req.body, existing);
    if (error) return res.status(400).json({ error });

    const updated = await repo.updateExpense(id, value);
    res.json(updated);
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "invalid expense id" });
    }

    const deleted = await repo.deleteExpense(id);
    if (!deleted) {
      return res.status(404).json({ error: "expense not found" });
    }

    res.status(204).send();
  });

  app.get("/api/summary", async (req, res) => {
    const { error, filters } = parseExpenseFilters({
      from: req.query.from,
      to: req.query.to,
    });
    if (error) return res.status(400).json({ error });

    const summary = await repo.getSummary({
      from: filters.from,
      to: filters.to,
    });
    res.json(summary);
  });

  app.get("/api/summary/monthly", async (req, res) => {
    const monthly = await repo.getMonthlySummary();
    res.json(monthly);
  });

  app.get("/api/budgets", async (req, res) => {
    const budgets = await repo.listBudgets();
    res.json(budgets);
  });

  app.get("/api/budgets/status", async (req, res) => {
    const status = await repo.getBudgetStatus(currentMonthISO());
    res.json(status);
  });

  app.put("/api/budgets/:category", async (req, res) => {
    const category = req.params.category;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "invalid category" });
    }

    const body = req.body || {};
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res
        .status(400)
        .json({ error: "amount must be a number greater than or equal to 0" });
    }

    const budget = await repo.upsertBudget(category, round2(amount));
    res.json(budget);
  });

  app.get("/api/export.csv", async (req, res) => {
    const { error, filters } = parseExpenseFilters(req.query);
    if (error) return res.status(400).json({ error });

    const expenses = await repo.listExpenses(filters);
    const csv = expensesToCsv(expenses);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="expenses.csv"');
    res.status(200).send(csv);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "invalid JSON body" });
    }
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

const defaultApp = createApp();
defaultApp.createApp = createApp;
defaultApp.createDefaultRepository = createDefaultRepository;

module.exports = defaultApp;

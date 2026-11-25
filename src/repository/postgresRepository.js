const { Pool } = require("pg");
const { CATEGORIES, round2 } = require("../utils");

let pool;

function getPool(connectionString) {
  if (!pool) {
    const connStr = connectionString || process.env.DATABASE_URL;
    const useSsl =
      typeof connStr === "string" &&
      (connStr.includes("neon.tech") || connStr.includes("sslmode=require"));

    pool = new Pool({
      connectionString: connStr,
      max: 3,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

const SORT_CLAUSES = {
  date_desc: "ORDER BY date DESC, id DESC",
  date_asc: "ORDER BY date ASC, id ASC",
  amount_desc: "ORDER BY amount DESC, id DESC",
  amount_asc: "ORDER BY amount ASC, id ASC",
};

function formatExpenseRow(row) {
  return {
    id: Number(row.id),
    title: row.title,
    amount: round2(Number(row.amount)),
    category: row.category,
    date: row.date,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

function formatBudgetRow(row) {
  return {
    category: row.category,
    amount: round2(Number(row.amount)),
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function buildWhere({ category, from, to }) {
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereSql, params };
}

function createPostgresRepository(connectionString) {
  const db = getPool(connectionString);

  async function listExpenses({ category, from, to, sort = "date_desc" } = {}) {
    const { whereSql, params } = buildWhere({ category, from, to });
    const orderBy = SORT_CLAUSES[sort] || SORT_CLAUSES.date_desc;
    const sql = `
      SELECT id, title, amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
      FROM expenses
      ${whereSql}
      ${orderBy}
    `;
    const { rows } = await db.query(sql, params);
    return rows.map(formatExpenseRow);
  }

  async function getExpenseById(id) {
    const { rows } = await db.query(
      `SELECT id, title, amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
       FROM expenses
       WHERE id = $1`,
      [id]
    );
    return rows[0] ? formatExpenseRow(rows[0]) : null;
  }

  async function createExpense({ title, amount, category, date }) {
    const { rows } = await db.query(
      `INSERT INTO expenses (title, amount, category, date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at`,
      [title, round2(amount), category, date]
    );
    return formatExpenseRow(rows[0]);
  }

  async function updateExpense(id, { title, amount, category, date }) {
    const { rows } = await db.query(
      `UPDATE expenses
       SET title = $1, amount = $2, category = $3, date = $4
       WHERE id = $5
       RETURNING id, title, amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at`,
      [title, round2(amount), category, date, id]
    );
    return rows[0] ? formatExpenseRow(rows[0]) : null;
  }

  async function deleteExpense(id) {
    const result = await db.query("DELETE FROM expenses WHERE id = $1", [id]);
    return result.rowCount > 0;
  }

  async function getSummary({ from, to } = {}) {
    const { whereSql, params } = buildWhere({ from, to });
    const { rows } = await db.query(
      `SELECT category, SUM(amount) AS total, COUNT(*)::int AS count
       FROM expenses
       ${whereSql}
       GROUP BY category`,
      params
    );

    const byCategory = {};
    let total = 0;
    let count = 0;

    for (const row of rows) {
      const catTotal = round2(Number(row.total));
      byCategory[row.category] = catTotal;
      total = round2(total + catTotal);
      count += Number(row.count);
    }

    return { total, count, byCategory };
  }

  async function getMonthlySummary() {
    const { rows } = await db.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month, SUM(amount) AS total, COUNT(*)::int AS count
       FROM expenses
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY month ASC`
    );

    return rows.map((row) => ({
      month: row.month,
      total: round2(Number(row.total)),
      count: Number(row.count),
    }));
  }

  async function listBudgets() {
    const { rows } = await db.query(
      "SELECT category, amount, updated_at FROM budgets"
    );
    const formatted = rows.map(formatBudgetRow);
    return formatted.sort(
      (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
    );
  }

  async function upsertBudget(category, amount) {
    const { rows } = await db.query(
      `INSERT INTO budgets (category, amount, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (category)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
       RETURNING category, amount, updated_at`,
      [category, round2(amount)]
    );
    return formatBudgetRow(rows[0]);
  }

  async function getBudgetStatus(month) {
    const [spentRes, budgetRes] = await Promise.all([
      db.query(
        `SELECT category, SUM(amount) AS spent
         FROM expenses
         WHERE TO_CHAR(date, 'YYYY-MM') = $1
         GROUP BY category`,
        [month]
      ),
      db.query("SELECT category, amount FROM budgets"),
    ]);

    const spentByCat = {};
    for (const row of spentRes.rows) {
      spentByCat[row.category] = round2(Number(row.spent));
    }

    const budgetByCat = new Map();
    for (const row of budgetRes.rows) {
      budgetByCat.set(row.category, round2(Number(row.amount)));
    }

    const categories = CATEGORIES.map((cat) => {
      const spent = spentByCat[cat] || 0;
      const budget = budgetByCat.has(cat) ? budgetByCat.get(cat) : null;
      const remaining = budget === null ? null : round2(budget - spent);
      const overBudget = budget === null ? false : spent > budget;
      return {
        category: cat,
        spent,
        budget,
        remaining,
        overBudget,
      };
    });

    return { month, categories };
  }

  return {
    listExpenses,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    getSummary,
    getMonthlySummary,
    listBudgets,
    upsertBudget,
    getBudgetStatus,
  };
}

module.exports = { createPostgresRepository, getPool };

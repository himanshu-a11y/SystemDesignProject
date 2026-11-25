const { CATEGORIES, round2 } = require("../utils");

function createMemoryRepository() {
  let expenses = [];
  let nextId = 1;
  const budgets = new Map();

  async function listExpenses({ category, from, to, sort = "date_desc" } = {}) {
    let result = expenses.filter((e) => {
      if (category && e.category !== category) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === "date_asc") {
        return a.date.localeCompare(b.date) || a.id - b.id;
      }
      if (sort === "amount_desc") {
        return b.amount - a.amount || b.id - a.id;
      }
      if (sort === "amount_asc") {
        return a.amount - b.amount || a.id - b.id;
      }
      return b.date.localeCompare(a.date) || b.id - a.id;
    });

    return result.map((e) => ({ ...e }));
  }

  async function getExpenseById(id) {
    const found = expenses.find((e) => e.id === id);
    return found ? { ...found } : null;
  }

  async function createExpense({ title, amount, category, date }) {
    const expense = {
      id: nextId++,
      title,
      amount: round2(amount),
      category,
      date,
      created_at: new Date().toISOString(),
    };
    expenses.push(expense);
    return { ...expense };
  }

  async function updateExpense(id, { title, amount, category, date }) {
    const index = expenses.findIndex((e) => e.id === id);
    if (index === -1) return null;
    const updated = {
      ...expenses[index],
      title,
      amount: round2(amount),
      category,
      date,
    };
    expenses[index] = updated;
    return { ...updated };
  }

  async function deleteExpense(id) {
    const before = expenses.length;
    expenses = expenses.filter((e) => e.id !== id);
    return expenses.length !== before;
  }

  async function getSummary({ from, to } = {}) {
    const filtered = expenses.filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });

    const byCategory = {};
    let total = 0;
    for (const e of filtered) {
      byCategory[e.category] = round2((byCategory[e.category] || 0) + e.amount);
      total = round2(total + e.amount);
    }

    return { total, count: filtered.length, byCategory };
  }

  async function getMonthlySummary() {
    const byMonth = new Map();
    for (const e of expenses) {
      const month = e.date.slice(0, 7);
      const entry = byMonth.get(month) || { month, total: 0, count: 0 };
      entry.total = round2(entry.total + e.amount);
      entry.count += 1;
      byMonth.set(month, entry);
    }
    return Array.from(byMonth.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }

  async function listBudgets() {
    return CATEGORIES.filter((cat) => budgets.has(cat)).map((cat) => ({
      ...budgets.get(cat),
    }));
  }

  async function upsertBudget(category, amount) {
    const record = {
      category,
      amount: round2(amount),
      updated_at: new Date().toISOString(),
    };
    budgets.set(category, record);
    return { ...record };
  }

  async function getBudgetStatus(month) {
    const spentByCat = {};
    for (const e of expenses) {
      if (e.date.startsWith(month)) {
        spentByCat[e.category] = round2((spentByCat[e.category] || 0) + e.amount);
      }
    }

    const categories = CATEGORIES.map((cat) => {
      const spent = spentByCat[cat] || 0;
      const budgetRecord = budgets.get(cat);
      const budget = budgetRecord ? budgetRecord.amount : null;
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

module.exports = { createMemoryRepository };

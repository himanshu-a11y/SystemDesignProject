const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
const CATEGORIES = ["Food", "Travel", "Study", "Shopping", "Other"];
let expenses = [];
let nextId = 1;
const round2 = (n) => Math.round(n * 100) / 100;

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/expenses", (req, res) => res.json(expenses));
app.post("/api/expenses", (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const amount = Number(body.amount);
  const category = body.category || "Other";
  if (!title) return res.status(400).json({ error: "title is required" });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a number greater than 0" });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "invalid category" });
  }
  const expense = { id: nextId++, title, amount: round2(amount), category };
  expenses.push(expense);
  res.status(201).json(expense);
});
app.get("/api/summary", (req, res) => {
  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = round2((byCategory[e.category] || 0) + e.amount);
  });
  const total = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  res.json({ total, count: expenses.length, byCategory });
});
app.delete("/api/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  const before = expenses.length;
  expenses = expenses.filter((e) => e.id !== id);
  if (expenses.length === before) {
    return res.status(404).json({ error: "expense not found" });
  }
  res.status(204).send();
});
module.exports = app;

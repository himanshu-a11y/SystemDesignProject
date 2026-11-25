const request = require("supertest");
const { createApp } = require("../src/app");
const { createMemoryRepository } = require("../src/repository/memoryRepository");
const { todayISO, currentMonthISO } = require("../src/utils");

describe("Expense Tracker API", () => {
  const app = createApp(createMemoryRepository());

  test("1. GET /health returns 200 and body.status === 'ok'", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("2. POST /api/expenses with {title:\"Lunch\", amount:120.5, category:\"Food\"} returns 201", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .send({ title: "Lunch", amount: 120.5, category: "Food" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Lunch");
    expect(res.body.amount).toBe(120.5);
    expect(res.body.category).toBe("Food");
    expect(res.body).toHaveProperty("id");
  });

  test("3. POST /api/expenses with only {amount:50} (no title) returns 400", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .send({ amount: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("title is required");
  });

  test("4. POST /api/expenses with amount -10 returns 400, and with amount \"abc\" returns 400", async () => {
    const resNegative = await request(app)
      .post("/api/expenses")
      .send({ title: "Negative", amount: -10, category: "Other" });
    expect(resNegative.status).toBe(400);

    const resString = await request(app)
      .post("/api/expenses")
      .send({ title: "String Amount", amount: "abc", category: "Other" });
    expect(resString.status).toBe(400);
  });

  test("5. GET /api/expenses returns 200, an array, and length greater than 0", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("6. GET /api/summary (after also adding {title:\"Bus ticket\", amount:30, category:\"Travel\"}) returns total: 150.5, count: 2, byCategory: {Food: 120.5, Travel: 30}", async () => {
    const addRes = await request(app)
      .post("/api/expenses")
      .send({ title: "Bus ticket", amount: 30, category: "Travel" });
    expect(addRes.status).toBe(201);

    const res = await request(app).get("/api/summary");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(150.5);
    expect(res.body.count).toBe(2);
    expect(res.body.byCategory).toEqual({
      Food: 120.5,
      Travel: 30,
    });
  });

  test("7. DELETE /api/expenses/:id for a newly created expense returns 204, and it no longer exists", async () => {
    const createRes = await request(app)
      .post("/api/expenses")
      .send({ title: "Temporary Item", amount: 50, category: "Shopping" });
    expect(createRes.status).toBe(201);
    const newId = createRes.body.id;

    const delRes = await request(app).delete(`/api/expenses/${newId}`);
    expect(delRes.status).toBe(204);

    const checkRes = await request(app).delete(`/api/expenses/${newId}`);
    expect(checkRes.status).toBe(404);
  });

  test("8. DELETE /api/expenses/9999 returns 404", async () => {
    const res = await request(app).delete("/api/expenses/9999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("expense not found");
  });
});

describe("Expense dates and PUT /api/expenses/:id", () => {
  let app;

  beforeEach(() => {
    app = createApp(createMemoryRepository());
  });

  test("POST defaults date to today and sets created_at", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .send({ title: "Coffee", amount: 45, category: "Food" });

    expect(res.status).toBe(201);
    expect(res.body.date).toBe(todayISO());
    expect(typeof res.body.created_at).toBe("string");
    expect(Number.isNaN(Date.parse(res.body.created_at))).toBe(false);
  });

  test("POST accepts explicit ISO date and rejects invalid dates or category", async () => {
    const valid = await request(app)
      .post("/api/expenses")
      .send({ title: "Book", amount: 200, category: "Study", date: "2026-10-15" });
    expect(valid.status).toBe(201);
    expect(valid.body.date).toBe("2026-10-15");

    const invalidDate = await request(app)
      .post("/api/expenses")
      .send({ title: "Bad date", amount: 10, category: "Food", date: "2026-02-30" });
    expect(invalidDate.status).toBe(400);

    const malformedDate = await request(app)
      .post("/api/expenses")
      .send({ title: "Bad date", amount: 10, category: "Food", date: "not-a-date" });
    expect(malformedDate.status).toBe(400);

    const invalidCat = await request(app)
      .post("/api/expenses")
      .send({ title: "Bad cat", amount: 10, category: "InvalidCat" });
    expect(invalidCat.status).toBe(400);
  });

  test("PUT /api/expenses/:id updates an existing expense", async () => {
    const created = await request(app)
      .post("/api/expenses")
      .send({ title: "Old", amount: 100, category: "Food", date: "2026-11-01" });

    const updated = await request(app)
      .put(`/api/expenses/${created.body.id}`)
      .send({
        title: "Updated",
        amount: 250.75,
        category: "Shopping",
        date: "2026-11-05",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.title).toBe("Updated");
    expect(updated.body.amount).toBe(250.75);
    expect(updated.body.category).toBe("Shopping");
    expect(updated.body.date).toBe("2026-11-05");
  });

  test("PUT /api/expenses/:id returns 404 for unknown id and 400 for invalid input", async () => {
    const created = await request(app)
      .post("/api/expenses")
      .send({ title: "Item", amount: 20, category: "Other" });

    const notFound = await request(app)
      .put("/api/expenses/9999")
      .send({ title: "Item", amount: 20, category: "Other" });
    expect(notFound.status).toBe(404);

    const badId = await request(app)
      .put("/api/expenses/abc")
      .send({ title: "Item", amount: 20, category: "Other" });
    expect(badId.status).toBe(400);

    const badAmount = await request(app)
      .put(`/api/expenses/${created.body.id}`)
      .send({ title: "Item", amount: -5, category: "Other" });
    expect(badAmount.status).toBe(400);

    const badDate = await request(app)
      .put(`/api/expenses/${created.body.id}`)
      .send({ title: "Item", amount: 10, category: "Other", date: "bad" });
    expect(badDate.status).toBe(400);

    const badDeleteId = await request(app).delete("/api/expenses/abc");
    expect(badDeleteId.status).toBe(400);
  });
});

describe("Filters, sorting, and summaries", () => {
  let app;

  beforeEach(async () => {
    app = createApp(createMemoryRepository());
    await request(app)
      .post("/api/expenses")
      .send({ title: "Oct Meal", amount: 100, category: "Food", date: "2026-10-10" });
    await request(app)
      .post("/api/expenses")
      .send({ title: "Nov Flight", amount: 500, category: "Travel", date: "2026-11-05" });
    await request(app)
      .post("/api/expenses")
      .send({ title: "Nov Snacks", amount: 50, category: "Food", date: "2026-11-15" });
  });

  test("GET /api/expenses filters by category, from, to, and sorts", async () => {
    const byCat = await request(app).get("/api/expenses?category=Food");
    expect(byCat.status).toBe(200);
    expect(byCat.body.map((e) => e.title)).toEqual(["Nov Snacks", "Oct Meal"]);

    const byRange = await request(app).get(
      "/api/expenses?from=2026-11-01&to=2026-11-10"
    );
    expect(byRange.status).toBe(200);
    expect(byRange.body).toHaveLength(1);
    expect(byRange.body[0].title).toBe("Nov Flight");

    const sortAmountAsc = await request(app).get(
      "/api/expenses?sort=amount_asc"
    );
    expect(sortAmountAsc.status).toBe(200);
    expect(sortAmountAsc.body.map((e) => e.amount)).toEqual([50, 100, 500]);

    const sortDateAsc = await request(app).get("/api/expenses?sort=date_asc");
    expect(sortDateAsc.status).toBe(200);
    expect(sortDateAsc.body.map((e) => e.date)).toEqual([
      "2026-10-10",
      "2026-11-05",
      "2026-11-15",
    ]);
  });

  test("GET /api/expenses rejects invalid filters with 400", async () => {
    expect((await request(app).get("/api/expenses?category=Invalid")).status).toBe(400);
    expect((await request(app).get("/api/expenses?from=bad-date")).status).toBe(400);
    expect((await request(app).get("/api/expenses?to=2026-13-01")).status).toBe(400);
    expect((await request(app).get("/api/expenses?sort=unknown")).status).toBe(400);
  });

  test("GET /api/summary supports from/to filters", async () => {
    const res = await request(app).get(
      "/api/summary?from=2026-11-01&to=2026-11-30"
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 550,
      count: 2,
      byCategory: { Travel: 500, Food: 50 },
    });

    const bad = await request(app).get("/api/summary?from=invalid");
    expect(bad.status).toBe(400);
  });

  test("GET /api/summary/monthly aggregates expenses by month", async () => {
    const res = await request(app).get("/api/summary/monthly");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { month: "2026-10", total: 100, count: 1 },
      { month: "2026-11", total: 550, count: 2 },
    ]);
  });
});

describe("Budgets and budget status", () => {
  let app;

  beforeEach(() => {
    app = createApp(createMemoryRepository());
  });

  test("PUT /api/budgets/:category and GET /api/budgets work and validate inputs", async () => {
    const putFood = await request(app)
      .put("/api/budgets/Food")
      .send({ amount: 300 });
    expect(putFood.status).toBe(200);
    expect(putFood.body.category).toBe("Food");
    expect(putFood.body.amount).toBe(300);

    const putBadCat = await request(app)
      .put("/api/budgets/Unknown")
      .send({ amount: 100 });
    expect(putBadCat.status).toBe(400);

    const putBadAmt = await request(app)
      .put("/api/budgets/Food")
      .send({ amount: -10 });
    expect(putBadAmt.status).toBe(400);

    const list = await request(app).get("/api/budgets");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].category).toBe("Food");
    expect(list.body[0].amount).toBe(300);
  });

  test("GET /api/budgets/status computes current month spent, remaining, and overBudget", async () => {
    const month = currentMonthISO();
    const today = todayISO();

    await request(app).put("/api/budgets/Food").send({ amount: 200 });
    await request(app).put("/api/budgets/Travel").send({ amount: 100 });

    // Current month expenses
    await request(app)
      .post("/api/expenses")
      .send({ title: "Dinner", amount: 250, category: "Food", date: today });
    await request(app)
      .post("/api/expenses")
      .send({ title: "Metro", amount: 40, category: "Travel", date: today });
    // Previous year expense should NOT be included in current month status
    await request(app)
      .post("/api/expenses")
      .send({ title: "Old Meal", amount: 999, category: "Food", date: "2020-01-15" });

    const res = await request(app).get("/api/budgets/status");
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(month);

    const byCat = Object.fromEntries(
      res.body.categories.map((c) => [c.category, c])
    );

    expect(byCat.Food).toEqual({
      category: "Food",
      spent: 250,
      budget: 200,
      remaining: -50,
      overBudget: true,
    });
    expect(byCat.Travel).toEqual({
      category: "Travel",
      spent: 40,
      budget: 100,
      remaining: 60,
      overBudget: false,
    });
    expect(byCat.Study).toEqual({
      category: "Study",
      spent: 0,
      budget: null,
      remaining: null,
      overBudget: false,
    });
  });
});

describe("CSV export", () => {
  let app;

  beforeEach(() => {
    app = createApp(createMemoryRepository());
  });

  test("GET /api/export.csv returns properly escaped CSV and supports filters", async () => {
    await request(app).post("/api/expenses").send({
      title: 'Lunch, "Special"\nCombo',
      amount: 125.5,
      category: "Food",
      date: "2026-11-10",
    });
    await request(app).post("/api/expenses").send({
      title: "Train",
      amount: 80,
      category: "Travel",
      date: "2026-11-11",
    });

    const res = await request(app).get("/api/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("expenses.csv");
    expect(res.text).toContain("id,title,amount,category,date,created_at");
    expect(res.text).toContain('"Lunch, ""Special""\nCombo"');
    expect(res.text).toContain("Train,80,Travel,2026-11-11");

    const filtered = await request(app).get("/api/export.csv?category=Travel");
    expect(filtered.status).toBe(200);
    expect(filtered.text).toContain("Train,80,Travel,2026-11-11");
    expect(filtered.text).not.toContain("Special");

    const invalid = await request(app).get("/api/export.csv?category=Bad");
    expect(invalid.status).toBe(400);
  });
});

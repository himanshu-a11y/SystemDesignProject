const request = require("supertest");
const app = require("../src/app");

describe("Expense Tracker API", () => {
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

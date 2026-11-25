const mockQuery = jest.fn();
const mockPoolConstructor = jest.fn(() => ({ query: mockQuery }));

jest.mock("pg", () => ({
  Pool: mockPoolConstructor,
}));

const { createPostgresRepository } = require("../src/repository/postgresRepository");

describe("Postgres Repository", () => {
  let repo;

  beforeAll(() => {
    repo = createPostgresRepository(
      "postgresql://user:pass@ep-demo.neon.tech/neondb?sslmode=require"
    );
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  test("configures singleton Pool with max 3 and SSL for Neon", () => {
    expect(mockPoolConstructor).toHaveBeenCalledTimes(1);
    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        max: 3,
        ssl: { rejectUnauthorized: false },
      })
    );

    // Calling createPostgresRepository again reuses the singleton pool
    createPostgresRepository("postgres://localhost:5432/expenses");
    expect(mockPoolConstructor).toHaveBeenCalledTimes(1);
  });

  test("listExpenses uses parameterized queries and formats rows", async () => {
    const now = new Date("2026-11-25T10:00:00.000Z");
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "1",
          title: "Lunch",
          amount: "120.50",
          category: "Food",
          date: "2026-11-25",
          created_at: now,
        },
      ],
    });

    const result = await repo.listExpenses({
      category: "Food",
      from: "2026-11-01",
      to: "2026-11-30",
      sort: "amount_desc",
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE category = $1 AND date >= $2 AND date <= $3");
    expect(sql).toContain("ORDER BY amount DESC, id DESC");
    expect(params).toEqual(["Food", "2026-11-01", "2026-11-30"]);
    expect(result).toEqual([
      {
        id: 1,
        title: "Lunch",
        amount: 120.5,
        category: "Food",
        date: "2026-11-25",
        created_at: now.toISOString(),
      },
    ]);
  });

  test("getExpenseById, createExpense, updateExpense, deleteExpense work cleanly", async () => {
    const row = {
      id: 2,
      title: "Book",
      amount: "300.00",
      category: "Study",
      date: "2026-11-20",
      created_at: "2026-11-20T09:00:00.000Z",
    };

    mockQuery.mockResolvedValueOnce({ rows: [row] });
    const created = await repo.createExpense({
      title: "Book",
      amount: 300,
      category: "Study",
      date: "2026-11-20",
    });
    expect(created.id).toBe(2);
    expect(created.amount).toBe(300);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await repo.getExpenseById(999)).toBeNull();

    mockQuery.mockResolvedValueOnce({ rows: [row] });
    expect((await repo.getExpenseById(2)).title).toBe("Book");

    mockQuery.mockResolvedValueOnce({ rows: [{ ...row, amount: "350.00" }] });
    const updated = await repo.updateExpense(2, {
      title: "Book",
      amount: 350,
      category: "Study",
      date: "2026-11-20",
    });
    expect(updated.amount).toBe(350);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(
      await repo.updateExpense(999, {
        title: "X",
        amount: 10,
        category: "Other",
        date: "2026-11-20",
      })
    ).toBeNull();

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await repo.deleteExpense(2)).toBe(true);

    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await repo.deleteExpense(999)).toBe(false);
  });

  test("getSummary and getMonthlySummary aggregate SQL results", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { category: "Food", total: "150.50", count: 2 },
        { category: "Travel", total: "50.00", count: 1 },
      ],
    });
    const summary = await repo.getSummary({ from: "2026-11-01" });
    expect(summary).toEqual({
      total: 200.5,
      count: 3,
      byCategory: { Food: 150.5, Travel: 50 },
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{ month: "2026-11", total: "200.50", count: 3 }],
    });
    const monthly = await repo.getMonthlySummary();
    expect(monthly).toEqual([{ month: "2026-11", total: 200.5, count: 3 }]);
  });

  test("listBudgets, upsertBudget, and getBudgetStatus work cleanly", async () => {
    const updatedAt = new Date("2026-11-25T12:00:00.000Z");
    mockQuery.mockResolvedValueOnce({
      rows: [{ category: "Food", amount: "500.00", updated_at: updatedAt }],
    });
    const upserted = await repo.upsertBudget("Food", 500);
    expect(upserted).toEqual({
      category: "Food",
      amount: 500,
      updated_at: updatedAt.toISOString(),
    });

    mockQuery.mockResolvedValueOnce({
      rows: [
        { category: "Travel", amount: "200.00", updated_at: updatedAt.toISOString() },
        { category: "Food", amount: "500.00", updated_at: updatedAt.toISOString() },
      ],
    });
    const budgets = await repo.listBudgets();
    expect(budgets.map((b) => b.category)).toEqual(["Food", "Travel"]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ category: "Food", spent: "600.00" }] })
      .mockResolvedValueOnce({ rows: [{ category: "Food", amount: "500.00" }] });
    const status = await repo.getBudgetStatus("2026-11");
    const food = status.categories.find((c) => c.category === "Food");
    expect(food).toEqual({
      category: "Food",
      spent: 600,
      budget: 500,
      remaining: -100,
      overBudget: true,
    });
  });
});

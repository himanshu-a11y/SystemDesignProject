const CATEGORIES = ["Food", "Travel", "Study", "Shopping", "Other"];
const VALID_SORTS = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthISO() {
  return todayISO().slice(0, 7);
}

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function escapeCsvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function expensesToCsv(expenses) {
  const headers = ["id", "title", "amount", "category", "date", "created_at"];
  const lines = [headers.join(",")];
  for (const e of expenses) {
    lines.push(
      [
        escapeCsvCell(e.id),
        escapeCsvCell(e.title),
        escapeCsvCell(e.amount),
        escapeCsvCell(e.category),
        escapeCsvCell(e.date),
        escapeCsvCell(e.created_at),
      ].join(",")
    );
  }
  return lines.join("\n");
}

module.exports = {
  CATEGORIES,
  VALID_SORTS,
  round2,
  todayISO,
  currentMonthISO,
  isValidISODate,
  escapeCsvCell,
  expensesToCsv,
};

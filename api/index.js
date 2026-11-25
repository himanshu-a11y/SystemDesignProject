const { createApp } = require("../src/app");
const { createMemoryRepository } = require("../src/repository/memoryRepository");
const { createPostgresRepository } = require("../src/repository/postgresRepository");

const repo = process.env.DATABASE_URL
  ? createPostgresRepository(process.env.DATABASE_URL)
  : createMemoryRepository();

module.exports = createApp(repo);

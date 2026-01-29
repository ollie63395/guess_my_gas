const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("Missing Turso credentials. Ensure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set.");
}

const client = createClient({
  url,
  authToken,
});

module.exports = client;
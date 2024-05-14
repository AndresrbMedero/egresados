// db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: 'andres',
    host: 'localhost',
    database: 'egresados',
    password: '123',
    port: 5432,
});

module.exports = { pool };

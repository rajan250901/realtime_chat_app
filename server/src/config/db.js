const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// console.log({
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     database: process.env.DB_NAME,
//     user: process.env.DB_USER,
//     passwordType: typeof process.env.DB_PASSWORD,
//     passwordLength: process.env.DB_PASSWORD?.length
// });

const connectDB = async () => {
    try {
        // console.log("DB_PASSWORD exists:", !!process.env.DB_PASSWORD);
        // console.log("DB_PASSWORD type:", typeof process.env.DB_PASSWORD);

        const result = await pool.query("SELECT NOW()");

        console.log("Database connected successfully");
        // console.log("RESULTS =", result.rows);

    } catch (error) {
        console.error("Connection failed:", error);
        throw error;
    }
};

module.exports = {
    pool,
    connectDB
}
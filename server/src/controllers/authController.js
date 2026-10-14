require("dotenv").config();
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const safeUser = (user) => ({ id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, last_seen: user.last_seen, created_at: user.created_at });

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Please provide all fields" });
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (!result.rows.length) return res.status(400).json({ success: false, message: "Invalid login credentials" });
    const user = result.rows[0];
    const correct = await bcrypt.compare(password, user.password);
    if (!correct) return res.status(400).json({ success: false, message: "Invalid login credentials" });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });
    return res.json({ success: true, message: "User logged in successfully", user: safeUser(user), token });
  } catch (error) { console.error("Login error:", error); return res.status(500).json({ success: false, message: "Error in login API" }); }
};

const registerController = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: "Please provide all fields" });
    if (String(password).length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(`INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, avatar_url, last_seen, created_at`, [name.trim(), email.trim().toLowerCase(), hashedPassword]);
    return res.status(201).json({ success: true, message: "User registered successfully", user: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "Email already exists" });
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: "Error in register API" });
  }
};

module.exports = { loginController, registerController };

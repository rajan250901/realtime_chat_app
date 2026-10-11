require('dotenv').config();
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("email = ", email);
        if (!email || !password) {
            return res.status(400).send({
                success: false,
                message: "Please provide all fields",
            });
        } else {
            // console.log("2323")
            // const hashedpassword = bcrypt.compare(password, user.password);
            const user = await pool.query(
                `SELECT * FROM users WHERE email = $1`,
                [email],
            );

            // console.log("user data = ", user);
            if (user.rows.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid login credentials",
                });
            }
            // console.log("passfffff ",password,user.rows[0].password);
            const corrpassword = await bcrypt.compare(
                password,
                user.rows[0].password,
            );

            if (!corrpassword) {
                return res.status(400).send({
                    success: false,
                    message:
                        "Invalid login credentials, please provide valid details",
                });
            }

 // const token = jwt.sign({id : user.rows[0].id}, process.env.JWT_SECRET_KEY, {expiresIn : '30d'})
// console.log("jek", user.rows[0].id)
               const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET_KEY, { expiresIn: '30d' });

            // console.log(corrpassword)
            return res.status(200).send({
                success: true,
                message: "User logged in successfully",
                user: user.rows[0],
                token : token
            });
        }
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error in login API",
            error: error,
        });
    }
};

const registerController = async (req, res) => {
    // console.log("ppp");
    try {
        // console.log("o0000")
        const { name, email, password } = req.body;
        // console.log(name, email, password);
        if (!name || !email || !password) {
            return res.status(400).send({
                success: false,
                message: "Please provide all fields",
            });
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            // const user = await insertUser(name, email, password);
            // const userlists = await pool.query("SELECT * FROM users");
            // console.log(userlists.rows);
            const user = await pool.query(
                `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *`,
                [name, email, hashedPassword],
            );
            // console.log("user data = ", user);
            if (!user) {
                return res.status(400).send({
                    success: false,
                    message: "User not inserted successfully",
                });
            }
            return res.status(201).send({
                success: true,
                message: "User Registered successfully",
                user: user.rows[0],
            });
        }
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).send({
                success: false,
                message: "Email already exists",
            });
        }
        // console.log("resgister = ", error)
        return res.status(500).send({
            success: false,
            message: "Error in register API",
            error: error,
        });
    }
};

module.exports = { loginController, registerController };

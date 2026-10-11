
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

export async function register(req, res) {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || password.length < 8) {
        return res.status(400).json({
            error: "Name, valid email, and a password of at least 8 characters are required."
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email`,
            [name, email, passwordHash]
        );

        const user = result.rows[0];

        return res.status(201).json({
            message: "Account created successfully.",
            token: createToken(user),
            user
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error.message);
        return res.status(500).json({ error: "Could not create account." });
    }
}

export async function login(req, res) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    try {
        const result = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE email = $1`,
            [email]
        );

        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        return res.json({
            message: "Login successful.",
            token: createToken(user),
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({ error: "Could not log in." });
    }
}

export async function getMe(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, name, email, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: "Account not found." });
        }

        return res.json({ user });
    } catch (error) {
        console.error("Get account error:", error.message);
        return res.status(500).json({ error: "Could not retrieve account." });
    }
}


import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/database.js";

function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

export function register(req, res) {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || password.length < 8) {
        return res.status(400).json({
            error: "Name, valid email, and a password of at least 8 characters are required."
        });
    }

    try {
        const passwordHash = bcrypt.hashSync(password, 12);

        const result = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name, email, passwordHash);

        const user = { id: Number(result.lastInsertRowid), name, email };

        return res.status(201).json({
            message: "Account created successfully.",
            token: createToken(user),
            user
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        console.error("Registration error:", error.message);
        return res.status(500).json({ error: "Could not create account." });
    }
}

export function login(req, res) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    const user = db.prepare(`
    SELECT id, name, email, password_hash
    FROM users
    WHERE email = ?
  `).get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json({
        message: "Login successful.",
        token: createToken(user),
        user: { id: user.id, name: user.name, email: user.email }
    });
}

export function getMe(req, res) {
    const user = db.prepare(`
    SELECT id, name, email, created_at
    FROM users
    WHERE id = ?
  `).get(req.user.id);

    if (!user) {
        return res.status(404).json({ error: "Account not found." });
    }

    return res.json({ user });
}


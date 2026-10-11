
import pool from "../config/database.js";

export async function getProducts(req, res) {
    try {
        const result = await pool.query(`
            SELECT id, name, description, price, stock, image_url
            FROM products
            WHERE active = 1
            ORDER BY id DESC
        `);

        res.json({ products: result.rows });
    } catch (error) {
        console.error("Get products error:", error.message);
        res.status(500).json({ error: "Could not load products." });
    }
}


import db from "../config/database.js";

export function getProducts(req, res) {
    try {
        const products = db.prepare(`
      SELECT id, name, description, price, stock, image_url
      FROM products
      WHERE active = 1
      ORDER BY id DESC
    `).all();

        res.json({ products });
    } catch (error) {
        console.error("Get products error:", error.message);
        res.status(500).json({ error: "Could not load products." });
    }
}

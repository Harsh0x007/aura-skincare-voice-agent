
import pool from "../config/database.js";
import crypto from "node:crypto";

export async function checkout(req, res) {
    const userId = req.user.id;
    const items = req.body?.items;
    const address = String(req.body?.delivery_address || "").trim();

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Your cart is empty." });
    }

    if (items.length > 50) {
        return res.status(400).json({ error: "Too many items in cart." });
    }

    if (!address || address.length > 500) {
        return res.status(400).json({
            error: "Please provide a delivery address (maximum 500 characters)."
        });
    }

    const quantities = new Map();

    for (const item of items) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);

        if (
            !Number.isSafeInteger(productId) ||
            productId <= 0 ||
            !Number.isSafeInteger(quantity) ||
            quantity <= 0 ||
            quantity > 100
        ) {
            return res.status(400).json({
                error: "Each cart item needs a valid product ID and quantity."
            });
        }

        quantities.set(
            productId,
            (quantities.get(productId) || 0) + quantity
        );
    }

    if ([...quantities.values()].some((quantity) => quantity > 100)) {
        return res.status(400).json({
            error: "Maximum quantity per product is 100."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let total = 0;
        const orderItems = [];

        for (const [productId, quantity] of quantities) {
            const result = await client.query(
                `SELECT id, name, price, stock
                 FROM products
                 WHERE id = $1 AND active = 1
                 FOR UPDATE`,
                [productId]
            );

            const product = result.rows[0];

            if (!product) {
                const error = new Error(`Product ${productId} is unavailable.`);
                error.statusCode = 400;
                throw error;
            }

            if (product.stock < quantity) {
                const error = new Error(
                    `Only ${product.stock} units of ${product.name} are available.`
                );
                error.statusCode = 400;
                throw error;
            }

            total += product.price * quantity;

            if (!Number.isSafeInteger(total)) {
                const error = new Error("Order total is too large.");
                error.statusCode = 400;
                throw error;
            }

            orderItems.push({ product, quantity });
        }

        const orderId = `AURA-${crypto.randomUUID()
            .replaceAll("-", "")
            .slice(0, 12)
            .toUpperCase()}`;

        const orderResult = await client.query(
            `INSERT INTO orders (
                order_id, user_id, total_amount,
                status, payment_method, payment_status, delivery_address
             )
             VALUES ($1, $2, $3, 'Processing', 'COD', 'Pending', $4)
             RETURNING id`,
            [orderId, userId, total, address]
        );

        const databaseOrderId = orderResult.rows[0].id;

        for (const item of orderItems) {
            await client.query(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, quantity, unit_price
                 )
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    databaseOrderId,
                    item.product.id,
                    item.product.name,
                    item.quantity,
                    item.product.price
                ]
            );

            const update = await client.query(
                `UPDATE products
                 SET stock = stock - $1
                 WHERE id = $2 AND stock >= $1
                 RETURNING id`,
                [item.quantity, item.product.id]
            );

            if (update.rowCount !== 1) {
                const error = new Error(
                    `Stock changed for ${item.product.name}. Please retry.`
                );
                error.statusCode = 400;
                throw error;
            }
        }

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Order placed successfully.",
            order: {
                order_id: orderId,
                total_amount: total,
                payment_method: "COD",
                payment_status: "Pending",
                status: "Processing"
            }
        });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Checkout rollback error:", rollbackError.message);
        }

        if (error.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }

        console.error("Checkout error:", error.message);
        return res.status(500).json({ error: "Could not place your order." });
    } finally {
        client.release();
    }
}

export async function getMyOrders(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                o.id,
                o.order_id,
                o.total_amount,
                o.status,
                o.payment_method,
                o.payment_status,
                o.delivery_address,
                o.created_at
             FROM orders o
             WHERE o.user_id = $1
             ORDER BY o.id DESC`,
            [req.user.id]
        );

        const orders = await Promise.all(
            result.rows.map(async (order) => {
                const itemsResult = await pool.query(
                    `SELECT product_name, quantity, unit_price
                     FROM order_items
                     WHERE order_id = $1
                     ORDER BY id`,
                    [order.id]
                );

                const { id, ...publicOrder } = order;

                return {
                    ...publicOrder,
                    items: itemsResult.rows
                };
            })
        );

        return res.json({ orders });
    } catch (error) {
        console.error("Get my orders error:", error.message);
        return res.status(500).json({ error: "Could not load your orders." });
    }
}

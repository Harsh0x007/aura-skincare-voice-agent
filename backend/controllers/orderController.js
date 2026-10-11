
import db from "../config/database.js";
import crypto from "node:crypto";

export function checkout(req, res) {
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

    try {
        const placeOrder = db.transaction(() => {
            let total = 0;
            const orderItems = [];

            for (const [productId, quantity] of quantities) {
                const product = db.prepare(`
          SELECT id, name, price, stock
          FROM products
          WHERE id = ? AND active = 1
        `).get(productId);

                if (!product) {
                    throw new Error(`Product ${productId} is unavailable.`);
                }

                if (product.stock < quantity) {
                    throw new Error(
                        `Only ${product.stock} units of ${product.name} are available.`
                    );
                }

                total += product.price * quantity;

                if (!Number.isSafeInteger(total)) {
                    throw new Error("Order total is too large.");
                }

                orderItems.push({
                    product,
                    quantity
                });
            }

            const orderId = `AURA-${crypto.randomUUID()
                .replaceAll("-", "")
                .slice(0, 12)
                .toUpperCase()}`;

            const result = db.prepare(`
        INSERT INTO orders (
          order_id, user_id, total_amount,
          status, payment_method, payment_status, delivery_address
        )
        VALUES (?, ?, ?, 'Processing', 'COD', 'Pending', ?)
      `).run(orderId, userId, total, address);

            const insertItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, quantity, unit_price
        )
        VALUES (?, ?, ?, ?, ?)
      `);

            const reduceStock = db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ? AND stock >= ?
      `);

            for (const item of orderItems) {
                insertItem.run(
                    result.lastInsertRowid,
                    item.product.id,
                    item.product.name,
                    item.quantity,
                    item.product.price
                );

                const update = reduceStock.run(
                    item.quantity,
                    item.product.id,
                    item.quantity
                );

                if (update.changes !== 1) {
                    throw new Error(`Stock changed for ${item.product.name}. Please retry.`);
                }
            }

            return {
                order_id: orderId,
                total_amount: total,
                payment_method: "COD",
                payment_status: "Pending",
                status: "Processing"
            };
        });

        const order = placeOrder();
        return res.status(201).json({
            message: "Order placed successfully.",
            order
        });
    } catch (error) {
        if (
            error.message.includes("unavailable") ||
            error.message.includes("available.") ||
            error.message.includes("Stock changed") ||
            error.message === "Order total is too large."
        ) {
            return res.status(400).json({ error: error.message });
        }

        console.error("Checkout error:", error.message);
        return res.status(500).json({ error: "Could not place your order." });
    }
}

export function getMyOrders(req, res) {
    try {
        const orders = db.prepare(`
      SELECT
        o.order_id, o.total_amount, o.status,
        o.payment_method, o.payment_status,
        o.delivery_address, o.created_at
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.id DESC
    `).all(req.user.id);

        const getItems = db.prepare(`
      SELECT product_name, quantity, unit_price
      FROM order_items
      WHERE order_id = (
        SELECT id FROM orders WHERE order_id = ? AND user_id = ?
      )
    `);

        res.json({
            orders: orders.map((order) => ({
                ...order,
                items: getItems.all(order.order_id, req.user.id)
            }))
        });
    } catch (error) {
        console.error("Get my orders error:", error.message);
        res.status(500).json({ error: "Could not load your orders." });
    }
}

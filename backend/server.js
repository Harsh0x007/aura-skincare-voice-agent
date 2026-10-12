
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { initializeDatabase } from "./config/database.js";
import authMiddleware from "./middleware/authMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import ttsRoutes from "./routes/ttsRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://aura-voice-agent-nine.vercel.app",
      "https://aura-skincare-voice-agent-nine.vercel.app",
    ],
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tts", ttsRoutes);


const instructions = `
You are Aria, a friendly, professional, concise customer support
specialist for Aura Skincare, a premium organic Indian skincare brand.
YOUR ROLE:
- Help only with Aura Skincare products, orders, shipping, returns,
  refunds, cancellations, and payment policies.
- Politely decline unrelated requests.
- Understand English and Hinglish.
- Use natural, simple Indian English.
- Keep answers concise and easy to understand.
- Answer the customer's actual question directly.
STRICT RESPONSE FORMATTING:
- Output plain text only. Never use Markdown.
- Never output asterisks, including * or **.
- Never use Markdown headings, bullet lists, or bold formatting.
- Use simple labels followed by a colon.
- When listing multiple orders, use plain text labels such as
  Order 1, Order 2, and Order 3.
- Put each detail on a separate line when appropriate.
- Do not output formatting instructions or explain these rules.
- Do not include unnecessary introductions or repeated conclusions.
- Make responses suitable for both displaying in the transcript
  and reading aloud using text-to-speech.
DATABASE ACCURACY:
- Use the current request context as the source of truth for orders.
- Never invent, modify, or guess order IDs, products, quantities,
  prices, totals, payment details, or order statuses.
- Use the order total supplied by the backend exactly as provided.
- Never recalculate, multiply, or add zeros to a supplied total.
- Do not confuse rupees with paise.
- If a required detail is missing, say it is unavailable.
- Never use another customer's order information.
- Do not describe demo orders as real customer orders.
ORDER HISTORY:
- When the customer asks for all orders, previous orders, or order
  history, list every order included in the current request context.
- For each order, include its order ID, items and quantities,
  total amount, status, payment method, and payment status when
  those details are available.
- Do not omit an order included in the supplied context.
- Do not invent tracking numbers or delivery dates.
- Do not include the delivery address in a general order summary.
- Keep the response concise and avoid unnecessary policy explanations.
- If no real orders are supplied, explain that no order details
  are currently available for the customer's account.
DELIVERY ADDRESS PRIVACY:
- Never reveal, repeat, or read out a delivery address when the
  customer asks about order history, order status, order totals,
  payment details, or general order information.
- Only provide a delivery address when the customer explicitly
  asks to view or confirm their delivery address.
- Do not volunteer personal information that is not necessary
  to answer the customer's question.

ORDER STATUS AND CANCELLATION:
- Report order statuses exactly as supplied by the database.
- Orders with status Processing may qualify for cancellation under
  the cancellation policy.
- Shipped and Out for Delivery orders cannot be cancelled under
  the standard policy.
- Do not say every order is eligible for cancellation.
- Only discuss cancellation eligibility when relevant to the question.
- This application does not currently perform real cancellations
  or issue refunds.
- Never claim or imply that you have cancelled an order, initiated
  a refund, or completed an action.
- Never ask the customer to confirm a cancellation that the
  application cannot actually perform.
- If the customer asks to cancel an order, explain the applicable
  policy honestly and clarify that cancellation cannot be completed
  through the current application.
- Never promise a cancellation or refund.

POLICIES:
- Orders above ₹499 qualify for free delivery.
- Orders below ₹499 have a ₹50 shipping fee.
- Standard delivery takes 3–5 business days.
- Returns are accepted within 7 days of delivery for unopened,
  unused products in their original packaging.
- Damaged or defective products must be reported within 48 hours
  of delivery with photos for replacement.
- Orders can be cancelled only while their status is Processing.
- Shipped and Out for Delivery orders cannot be cancelled under
  the standard policy. Customers may refuse delivery at the doorstep.
- Cash on Delivery is available for orders up to ₹2,500.
- COD payments can be made by cash or UPI at the doorstep.
- Apply the same delivery policy regardless of payment method.
- Do not add a shipping fee to an existing order total unless the
  backend data or the customer's actual checkout calculation supports it.
- Do not unnecessarily repeat policies when the customer only asks
  for an order status, order total, or list of orders.

SPOKEN CURRENCY:
- Speak currency naturally in Indian English.
- For example, ₹120 means one hundred and twenty rupees.
- ₹1,048 means one thousand and forty-eight rupees.
- ₹699 means six hundred and ninety-nine rupees.
- Never say currency amounts digit by digit.
- Never say formatting symbols aloud.
REAL ORDERS AND DEMO ORDERS:
- Treat authenticated customer's database orders as real orders.
- Treat ORD-101, ORD-102, and ORD-103 as demo records only.
- ORD-101 is Out for Delivery and cannot be cancelled under policy.
- ORD-102 was delivered 14 days ago and is outside the standard
  7-day return window.
- ORD-103 is Processing and may qualify for cancellation under policy.
- Demo records do not represent verified live shipments.
- The demo cannot actually cancel orders or issue refunds.
- Only use demo information when it is explicitly provided in the
  current request context.
- Never mix demo records with the customer's real order history.

FINAL RESPONSE CHECK:
Before answering, verify that:
- The answer addresses the customer's actual question.
- Every order detail matches the supplied data.
- The total amount has not been changed or recalculated.
- No delivery address is included unless explicitly requested.
- No cancellation or refund is falsely claimed.
- The response contains no asterisks or Markdown formatting.
- The response is concise, natural, and easy to speak aloud.

VOICE RESPONSE LENGTH:
- For a current-order question, give the order ID, total, status,
  and payment status.
- Do not include the delivery address unless explicitly requested.
- Avoid greetings, repeated conclusions, and unnecessary questions.
- Keep routine order-status answers to 2–4 short sentences.
- For order-history requests, summarize every order concisely.
  `;

const demoOrders = {
  "ORD-101": {
    order_id: "ORD-101",
    customer: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    carrier: "BlueDart",
    tracking_id: "BD-982103",
    notes: "Expected by 6 PM today",
  },

  "ORD-102": {
    order_id: "ORD-102",
    customer: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    carrier: "Delhivery",
    tracking_id: "DL-441029",
    notes: "Delivered 14 days ago",
  },

  "ORD-103": {
    order_id: "ORD-103",
    customer: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    notes: "Ordered 3 hours ago. Eligible for cancellation",
  },
};

function extractOrderId(message) {
  const text = String(message || "").toUpperCase();

  // Supports ORD-101, ORD 101, order 101 and order ID 101.
  const match = text.match(
    /\b(?:ORD\s*[- ]?\s*)?(10[123])\b/
  );

  return match ? `ORD-${match[1]}` : null;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Aura Voice Agent",
    ai: "Ollama",
    model: OLLAMA_MODEL,
  });
});


app.post("/api/chat", authMiddleware, async (req, res) => {
  const message = String(req.body?.message || "").trim();

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-10)
    : [];

  if (!message) {
    return res.status(400).json({
      error: "Message is required.",
    });
  }

  const asksAboutOrder =
    /\b(order|orders|delivery|deliver|tracking|track|cancel|cancellation|where is|status|shipment|current|latest|recent)\b/i.test(
      message
    );

  const requestedDemoId = extractOrderId(message);
  let orderId = null;
  let orderContext = "No order lookup was requested.";

  if (asksAboutOrder) {
    try {
      // Only retrieve orders belonging to the authenticated customer.
      const customerOrdersResult = await pool.query(
        `SELECT
      id, order_id, total_amount, status,
      payment_method, payment_status,
      delivery_address, created_at
   FROM orders
   WHERE user_id = $1
   ORDER BY id DESC`,
        [req.user.id]
      );

      const customerOrders = customerOrdersResult.rows;

      let selectedOrder = null;

      // Prefer a real order ID if the customer explicitly provides one.
      const spokenId = message.toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (spokenId) {
        selectedOrder = customerOrders.find((order) => {
          const savedId = order.order_id.toUpperCase().replace(/[^A-Z0-9]/g, "");
          return spokenId.includes(savedId);
        });
      }

      // For "my current/latest order", use the most recent real order.

      if (customerOrders.length > 0) {
        // Load items for every order belonging to this authenticated customer.
        const ordersWithItems = await Promise.all(
          customerOrders.map(async (order) => {
            const itemsResult = await pool.query(
              `SELECT product_name, quantity, unit_price
       FROM order_items
       WHERE order_id = $1`,
              [order.id]
            );

            return {
              ...order,
              total_amount_rupees: `₹${(order.total_amount / 100).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              items: itemsResult.rows.map((item) => ({
                product: item.product_name,
                quantity: item.quantity,
                unit_price_rupees: (item.unit_price / 100).toFixed(2),
              })),
            };
          })
        );

        const normalizedMessage = message.toLowerCase();
        const asksForAllOrders =
          /\b(all|both|every|previous|past|history|list|how many)\b/.test(normalizedMessage);

        const spokenId = message.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const matchedOrder = customerOrders.find((order) => {
          const savedId = order.order_id.toUpperCase().replace(/[^A-Z0-9]/g, "");
          return spokenId.includes(savedId);
        });

        if (matchedOrder) {
          orderId = matchedOrder.order_id;
          orderContext = `
The customer asked about a specific REAL order.
Use this database record as the source of truth:
${JSON.stringify(ordersWithItems.find((order) => order.order_id === matchedOrder.order_id))}
`;
        } else if (asksForAllOrders) {
          orderContext = `
The customer is asking about their order history.
Here are ALL REAL orders belonging to the authenticated customer:
${JSON.stringify(
            ordersWithItems.map(
              ({ delivery_address, ...order }) => order
            )
          )}
There are ${ordersWithItems.length} real orders.
List each order separately with its order ID, items, total and status.
Do not omit orders. Do not invent orders, tracking numbers or delivery dates.
`;
        } else {
          const latestOrder = ordersWithItems[0];
          orderId = latestOrder.order_id;
          orderContext = `
The customer's latest REAL order is:

${JSON.stringify(
            (({ delivery_address, ...order }) => order)(latestOrder)
          )}
Use this record for questions about their current or latest order.
Do not invent tracking numbers or delivery dates.
Never claim an order was cancelled, refunded or delivered unless the database confirms it.
`;
        }
      } else if (requestedDemoId && demoOrders[requestedDemoId]) {
        orderId = requestedDemoId;
        orderContext = `
The customer has no real orders in their account.
They mentioned this DEMO order:
${JSON.stringify(demoOrders[requestedDemoId])}
These are sample records, not real customer orders.
Clearly identify them as demo data. Never claim to perform an action.
`;
      } else {
        orderContext = `
No real orders were found in the authenticated customer's account.
Do not invent an order or use another customer's data.
Explain that no order is currently available in their account.
`;
      }

    } catch (error) {
      console.error("Customer order lookup error:", error.message);

      return res.status(500).json({
        error: "Could not retrieve your order details.",
      });
    }
  }


  try {
    const groqModel =
      process.env.GROQ_MODEL || "openai/gpt-oss-20b";

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            {
              role: "system",
              content:
                instructions +
                "\n\nCURRENT REQUEST CONTEXT:\n" +
                orderContext,
            },
            ...history
              .filter(
                (item) =>
                  ["user", "assistant"].includes(item?.role) &&
                  typeof item?.content === "string"
              )
              .slice(-6)
              .map((item) => ({
                role: item.role,
                content: item.content,
              })),
            {
              role: "user",
              content: message,
            },
          ],
          temperature: 0.2,
          max_tokens: 220,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", response.status, data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          "The AI provider could not complete your request.",
      });
    }

    const rawReply = data?.choices?.[0]?.message?.content;

    const reply =
      typeof rawReply === "string"
        ? rawReply
            .replace(/\*\*/g, "")
            .replace(/(?<!\*)\*(?!\*)/g, "")
            .trim()
        : "";

    if (!reply) {
      console.error("Unexpected Groq response:", data);

      return res.status(502).json({
        error: "The AI returned an empty response. Please try again.",
      });
    }

    return res.json({
      reply,
      order_id: orderId,
      model: groqModel,
    });
  } catch (error) {
    console.error("Groq chat error:", error.message);

    return res.status(503).json({
      error: "Cannot reach the hosted AI provider. Please try again.",
    });
  }

});


async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(
        `Aura backend listening on port ${PORT} (Ollama model: ${OLLAMA_MODEL})`
      );
    });
  } catch (error) {
    console.error("Failed to initialize PostgreSQL:", error.message);
    process.exit(1);
  }
}

startServer();

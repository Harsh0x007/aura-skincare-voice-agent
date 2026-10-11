
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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
    ],
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tts", ttsRoutes);

const instructions = `
You are Aria, a friendly, professional and concise Indian customer
support specialist for Aura Skincare, a premium organic Indian
skincare brand.

Answer in natural, concise English. Understand Hinglish if possible.
Only help with Aura Skincare products, orders, shipping, returns,
refunds, cancellations and payment policies. Politely decline
unrelated requests.

POLICIES:
- Free delivery on orders above ₹499.
- Orders below ₹499 have a ₹50 shipping fee.
- Standard delivery takes 3–5 business days.
- Returns are accepted within 7 days of delivery for unopened,
  unused products in original packaging.
- Damaged or defective products must be reported within 48 hours
  of delivery with photos for replacement.
- Orders can be cancelled only while status is Processing.
- Shipped or Out for Delivery orders cannot be cancelled.
  Customers may refuse delivery at the doorstep.
- COD is available for orders up to ₹2,500, payable by cash or UPI
  at the doorstep.

ORDER SAFETY:
- Use only order information supplied in CURRENT REQUEST CONTEXT.
- Never invent order details, delivery dates, tracking IDs, refunds,
  or actions.
- These three sample orders are DEMO DATA, not live shipments.
- ORD-101 is Out for Delivery and cannot be cancelled.
- ORD-102 was delivered 14 days ago, outside the standard 7-day
  return window.
- ORD-103 is Processing and may be eligible for cancellation.
  The demo cannot actually cancel orders or issue refunds.
- Never claim to have completed a cancellation or refund.
- If an order is not found in the supplied context, say so honestly.
- Do not describe demo order information as verified live database data.
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

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-10)
    : [];

  if (!message) {
    return res.status(400).json({
      error: "Message is required.",
    });
  }

  const orderId = extractOrderId(message);

  const asksAboutOrder =
    /\b(order|delivery|deliver|tracking|track|cancel|cancellation|where is|status|shipment)\b/i.test(
      message
    );

  let orderContext =
    "No order lookup was requested in this message.";

  if (asksAboutOrder) {
    if (!orderId) {
      orderContext =
        "The customer is asking about an order but has not " +
        "provided a recognizable order ID. Ask for the order ID. " +
        "Do not invent order details.";
    } else {
      const order = demoOrders[orderId];

      if (order) {
        orderContext =
          `The customer mentioned demo order ${orderId}. ` +
          "Here are the available sample details: " +
          JSON.stringify(order) +
          ". These details are hardcoded assessment demo data, " +
          "not a live database lookup or live shipment. " +
          "Answer using these details only. Do not claim to have " +
          "performed a cancellation or refund.";
      } else {
        orderContext =
          `No matching demo order was found for ${orderId}. ` +
          "Tell the customer the demo order was not found. " +
          "Do not invent details.";
      }
    }
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
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
            .map((item) => ({
              role: item.role,
              content: item.content,
            })),

          {
            role: "user",
            content: message,
          },
        ],
        options: {
          temperature: 0.2,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error:
          data?.error ||
          "Ollama request failed. Check that Ollama is running.",
      });
    }

    const reply = data?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({
        error:
          "The local AI returned an empty response. Please try again.",
      });
    }

    return res.json({
      reply,
      order_id: orderId,
      model: OLLAMA_MODEL,
    });
  } catch (error) {
    console.error("Ollama chat error:", error.message);

    return res.status(503).json({
      error:
        "Cannot reach Ollama. Check that Ollama is running.",
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Aura backend listening on http://localhost:${PORT} ` +
      `(Ollama model: ${OLLAMA_MODEL})`
  );
});

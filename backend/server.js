import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);


const instructions = `You are Aria, a friendly, professional, concise Indian customer support specialist for Aura Skincare, a premium organic Indian skincare brand. Answer in natural, concise English. Understand Hinglish if possible. Only help with Aura Skincare products, orders, shipping, returns, refunds, cancellations and payment policies. Politely decline unrelated requests.
POLICIES (follow exactly): Free delivery on orders above ₹499. Orders below ₹499 have a ₹50 shipping fee. Standard delivery takes 3–5 business days. Returns are accepted within 7 days of delivery only for unopened, unused products in original packaging. Damaged or defective products must be reported within 48 hours of delivery with photos for replacement. Orders can be cancelled only while status is Processing. Shipped or Out for Delivery orders cannot be cancelled; customers may refuse delivery at the doorstep. COD is available for orders up to ₹2,500; payment by cash or UPI at the doorstep.
Never invent order data, delivery dates, tracking IDs, refunds, or actions. If order data is provided in the current system message, use only those facts. If an order ID is missing, ask for it. If an order is not found, say so. The demo cannot actually cancel orders or issue refunds, so never claim you did. ORD-102 was delivered 14 days ago, outside the standard 7-day return window. ORD-101 is Out for Delivery and cannot be cancelled. ORD-103 is Processing and eligible for cancellation, but explain that the customer must contact support to complete it; do not claim to cancel it.`;

app.get("/api/health", (_req,res) => res.json({ ok:true, service:"Aura Voice Agent", ai:"Ollama", model:OLLAMA_MODEL }));
app.get("/api/orders", (_req,res) => res.json(Object.values(orders)));
app.post("/api/orders/lookup", (req,res) => {
  const orderId = String(req.body?.order_id || "").trim().toUpperCase();
  if (!orderId) return res.status(400).json({ error:"Please provide an order ID." });
  const order = orders[orderId];
  if (!order) return res.status(404).json({ error:`No order found with ID ${orderId}.` });
  return res.json(order);
});
app.post("/api/tools/get-order-details", (req,res) => {
  const orderId = String(req.body?.order_id || "").trim().toUpperCase();
  if (!orderId) return res.json({ found:false, message:"Order ID is missing." });
  const order = orders[orderId];
  if (!order) return res.json({ found:false, order_id:orderId, message:`No order found with ID ${orderId}.` });
  res.json({ found:true, order });
});

app.post("/api/chat", async (req,res) => {
  const message = String(req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  if (!message) return res.status(400).json({ error:"Message is required." });
  const orderId = message.toUpperCase().match(/ORD\s*[- ]?\s*\d{3}/)?.[0]?.replace(/\s/g,"").replace("ORD","ORD-").replace("--","-");
  let orderContext = "No order lookup was requested in this message.";
  if (/\b(order|delivery|deliver|tracking|track|cancel|cancellation|where is|status)\b/i.test(message)) {
    if (orderId && orders[orderId]) orderContext = `Verified order lookup result (use only these facts): ${JSON.stringify(orders[orderId])}`;
    else if (orderId) orderContext = `Order lookup result: no order exists with ID ${orderId}. Tell the customer you could not locate it and ask them to verify the ID. Do not guess.`;
    else orderContext = "The customer may be asking about an order but provided no recognizable order ID. Ask them to provide the order ID (for example ORD-101). Do not invent order details.";
  }
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:OLLAMA_MODEL, stream:false, messages:[
        { role:"system", content: instructions + "\n\nCURRENT REQUEST CONTEXT: " + orderContext },
        ...history.filter(m => ["user","assistant"].includes(m?.role) && typeof m?.content === "string").map(m => ({role:m.role, content:m.content})),
        { role:"user", content:message }
      ], options:{ temperature:0.2 } })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error:data?.error || "Ollama request failed. Check that Ollama is running." });
    const reply = data?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error:"The local AI returned an empty response. Please try again." });
    return res.json({ reply, order_id:orderId && orders[orderId] ? orderId : null, model:OLLAMA_MODEL });
  } catch (error) {
    console.error("Ollama chat error:", error.message);
    return res.status(503).json({ error:"Cannot reach Ollama. Open another PowerShell window and run: ollama serve" });
  }
});

app.listen(PORT, () => console.log(`Aura backend listening on http://localhost:${PORT} (Ollama model: ${OLLAMA_MODEL})`));

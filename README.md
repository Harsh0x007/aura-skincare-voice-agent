# Aria — Aura Skincare AI Voice Agent

A browser-based AI customer-support assistant built for the DataStraw AI Voice Agent assessment. Aria helps customers with Aura Skincare questions, product browsing, authenticated orders, order status, and brand policies. The application combines React/Vite, Node.js/Express, PostgreSQL, Groq-powered responses, and browser speech APIs.

## Live Demo

- **Application:** https://aura-skincare-voice-agent-nine.vercel.app/
- **Repository:** https://github.com/Harsh0x007/aura-skincare-voice-agent

Allow microphone access in a supported browser. Speech recognition and available voices depend on the browser and operating system.

## Features

- Browser voice interaction using speech recognition and browser text-to-speech.
- Customer registration, login, and authenticated account access.
- Product catalogue and order data stored in PostgreSQL.
- Order lookup scoped to the signed-in customer's records, including items, totals, status, and payment details when available.
- Shopping and checkout flows supported by the application.
- Brand-policy instructions for shipping, returns, damaged products, COD, and cancellation eligibility.
- Assessment demo orders (ORD-101, ORD-102, ORD-103), kept distinct from authenticated customers' real orders.
- Express route groups for authentication, products, orders, and TTS.
- Vercel frontend and Render backend deployment.

## Architecture

```text
Customer
  |
  v
React + Vite frontend (Vercel)
  |  chat, authentication, products, orders
  v
Node.js + Express API (Render / local)
  |---- Groq Chat Completions API (AI responses)
  |---- PostgreSQL (users, products, orders, order items)
  |---- Server-side TTS route (separate endpoint)
  |
  v
JSON response to frontend
  |
  v
Browser speech synthesis speaks Aria's response
```

### Technology stack

- **Frontend:** React, Vite, JavaScript, browser speech APIs.
- **Backend:** Node.js, Express, ES modules.
- **AI:** Groq API via `GROQ_API`; model defaults to `openai/gpt-oss-20b` and can be changed with `GROQ_MODEL`.
- **Database:** PostgreSQL via `pg`; required tables are initialized by the backend.
- **Authentication:** `bcryptjs` password hashing and `jsonwebtoken` tokens.
- **Deployment:** Vercel (frontend), Render (backend).

The active frontend voice playback uses browser speech synthesis. A separate server-side TTS route also exists; its availability depends on the configured service and should be tested separately.

## Run locally

### Prerequisites

- Node.js and npm
- A PostgreSQL database
- A Groq API key
- Chrome or Edge recommended for browser speech features

### 1. Backend setup

From the project root, run:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` and configure the values below:

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=false
GROQ_API=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

- `DATABASE_URL` is required and must point to your PostgreSQL database.
- Set `DATABASE_SSL=true` if your database provider requires SSL.
- `GROQ_API` is required for the current hosted AI chat flow.
- `GROQ_MODEL` is optional; the default is `openai/gpt-oss-20b`.
- The current chat handler uses Groq; Ollama variables remain for local model/configuration use and health information.

Never commit your real `.env`, API keys, database passwords, or tokens.

Start the backend:

```powershell
npm run dev
```

The API listens on port 4000 unless `PORT` is changed. Check http://localhost:4000/api/health.

### 2. Frontend setup

Open a second terminal from the project root:

```powershell
cd frontend
npm install
```

The frontend uses `VITE_API_URL` for the backend base URL and defaults to `http://localhost:4000`. To override it, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:4000
```

Start the frontend:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal, usually http://localhost:5173, and allow microphone access when prompted.

### 3. Production configuration

Configure `DATABASE_URL`, `GROQ_API`, and any required SSL/model settings in Render. Configure `VITE_API_URL` in Vercel to point to the deployed backend. Redeploy the frontend after changing Vite environment variables because they are applied at build time.

## API overview

- `/api/health` — service health/configuration.
- `/api/auth` — registration, login, and authenticated-user routes.
- `/api/products` — product catalogue operations.
- `/api/orders` — order operations.
- `/api/tts` — separate server-side text-to-speech route.

Chat responses use the configured Groq model. Authenticated order lookups are scoped to the signed-in customer. Demo records must not be presented as verified real shipments.

## Brand policies represented in agent instructions

- Free delivery for orders above ₹499; orders below ₹499 have a ₹50 shipping fee.
- Standard delivery takes 3–5 business days.
- Returns are accepted within 7 days of delivery for unopened, unused products in original packaging.
- Damaged or defective products must be reported within 48 hours with photos for replacement.
- Cancellation eligibility depends on order status. Processing orders may qualify; Shipped and Out for Delivery orders cannot be cancelled under the standard policy.
- COD is available for orders up to ₹2,500 and can be paid by cash or UPI at the doorstep.
- Aria must not claim to have cancelled an order or issued a refund unless the application actually performs that action.

## Assessment reflection

### 1. Why did you choose this architecture and technology stack?

I chose React and Vite for a responsive browser interface, and Node.js with Express to keep business logic, authentication, and database access on the server. PostgreSQL provides relational storage for users, products, orders, and order items. Groq provides the language-model response layer, while browser speech APIs let customers speak to Aria and hear responses without a separate paid TTS API in the active playback path.

### 2. What was the most difficult part, and how did you solve it?

One of the hardest parts was connecting voice interaction with reliable customer-specific order information while keeping spoken responses understandable. I separated frontend behavior, API routes, authentication, and database access, and added explicit instructions for using supplied order data, following brand policies, protecting delivery-address information, and avoiding false claims about cancellations or refunds.

### 3. If you had one more week, what would you improve first and why?

I would add automated tests for authentication, order ownership, checkout, and policy edge cases, then improve interruption handling and recovery when microphone input is unclear. I would also monitor response and speech playback times and test the full deployed flow across supported browsers.

### 4. What would need to change for 1,000 customer conversations per day?

I would load-test the API and database, add structured logging and monitoring, set timeouts and retry rules, and review database indexes and connection-pool sizing. I would add rate limits and abuse protection, automated tests, clear data-retention rules, and monitoring for AI-provider latency, availability, and cost. Concurrency and failure recovery should be validated under realistic traffic before scaling.

## Security and limitations

- Keep secrets in server-side environment variables; never place private API keys in frontend code.
- Use separate database credentials for development and production.
- Browser speech capabilities vary by browser, operating system, and installed voices.
- AI responses must be validated against database records and brand policies; this demo is not a production customer-support system.
- Do not represent cancellations or refunds as completed unless the backend implements and confirms the action.

## License

Created as a hiring-assessment project for demonstration and evaluation.

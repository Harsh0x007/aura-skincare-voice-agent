# Aria — Aura Skincare AI Voice Support

A browser-based AI voice support demo using React + Vite, Express, and the Ollama local model + browser speech APIs.

## Requirements
- Node.js 20.19+ (or a compatible current LTS release)
- An OpenAI API key with Realtime API access
- Chrome or Edge, microphone permission

## Run locally

### 1. Backend
```powershell
cd backend
npm install
Copy-Item .env.example .env
```
Open `backend/.env` and add your API key:
```env
OLLAMA_MODEL=your_api_key_here
PORT=4000
```
Then:
```powershell
npm run dev
```

### 2. Frontend (open a second VS Code terminal)
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## What is implemented
- Aura-themed support dashboard
- Start/End Call controls and live state indicator
- Browser microphone + WebRTC connection to the Realtime API
- Realtime tool declaration for order lookup
- Sample order helper for ORD-101, ORD-102 and ORD-103
- Transcript capture and basic structured post-call summary
- Policy-focused agent instructions
- Server-side API key; browser receives only a short-lived client secret

## Important
This is a starter project, not a production-ready customer support system. Test all flows before submission. The API key must remain in `backend/.env` and must never be placed in frontend code or committed to GitHub. API usage may incur charges.

The initial mock order database is stored on the server in `backend/server.js`. In a deployed version, configure environment variables and add authentication, rate limiting, monitoring, stronger validation, and persistent storage.

## Architecture
1. React requests a short-lived Realtime client secret from Express.
2. The browser establishes a WebRTC session and sends microphone audio.
3. The Realtime model can request `get_order_details`.
4. The frontend forwards that request to Express; Express returns the matching mock order.
5. The browser sends the tool result back to the model, which responds to the customer.
6. Transcript items are displayed and a structured summary is generated when the call ends.

## README assessment answers (edit these to reflect your actual experience)

### 1. Why this architecture?
I chose React and Vite for a fast browser UI, Express for server-side API access and order tools, and the Realtime API over WebRTC for conversational speech with low latency. The main API key stays on the backend; the browser receives a short-lived client secret.

### 2. Most difficult part
The most challenging part is coordinating realtime audio events with tool calls while keeping the customer experience responsive. I separated session setup from order lookup and return the tool result to the active conversation so the agent can answer using actual mock data.

### 3. What would I improve with one more week?
I would improve interruption handling, add automated tests for every policy, persist call logs, and add better evaluation of transcript accuracy and response latency.

### 4. What changes for 1,000 conversations/day?
I would add authenticated rate-limited endpoints, persistent database storage, queueing and observability, retry and timeout handling, cost monitoring, data-retention controls, and load tests. I would also evaluate privacy, concurrency, and failure recovery before scaling.


## Free local AI setup

1. Install Ollama from https://ollama.com and run `ollama pull qwen2.5:3b`.
2. In `backend`, copy `.env.example` to `.env` if needed. No API key is required.
3. Run `npm install` then `npm run dev` in `backend`.
4. In another terminal, run `npm install` then `npm run dev` in `frontend`.
5. Open the Vite URL in Chrome or Edge and allow microphone access. Browser speech recognition support varies by browser and may use an online browser service. The language model runs locally through Ollama.

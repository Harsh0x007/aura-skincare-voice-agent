# Aura Voice Agent — free local AI setup

This version uses React + Vite, Express, Ollama (`qwen2.5:3b`) and browser speech recognition/speech synthesis. It does not require an OpenAI API key.

## Requirements
- Node.js and npm
- Ollama installed with `qwen2.5:3b` pulled
- Google Chrome recommended for browser speech recognition

## Backend
From `backend/`:
1. Copy `.env.example` to `.env` if needed.
2. Run `npm install` (already installed in the original starter).
3. Run `npm run dev`.
4. Verify `http://localhost:4000/api/health` returns JSON.

Ollama must be running locally. Test with `ollama list`; if the backend cannot reach Ollama, open another terminal and run `ollama serve` (if it is not already running).

## Frontend
From `frontend/` in a second terminal:
1. Run `npm install` if needed.
2. Run `npm run dev`.
3. Open the URL Vite prints, usually `http://localhost:5173`.

Click Start Call and allow microphone access. The app uses the browser's Web Speech API for speech recognition and speech synthesis; browser support and voice availability vary. If voice recognition is unavailable, you can use the message input fallback when available.

## Important limitations
- The sample order data is mock data and does not update in real life.
- The app does not actually cancel orders or issue refunds.
- This free local setup is designed for development on the same computer. A public deployment cannot access your laptop's Ollama server unless you deliberately host/connect an AI service, so public hosting requires a separate architecture decision.
- Browser speech recognition may use browser-vendor online services; it is not guaranteed to be fully offline.

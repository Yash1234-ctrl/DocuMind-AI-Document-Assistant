# DocuMind RAG Assistant

Full-stack PDF question answering with workspace-scoped Atlas Vector Search, Groq answers, source citations, saved conversations, and SSE response streaming.

## Local development

Use Node.js 22 or newer. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, and `GROQ_API_KEY`. Keep `.env` out of source control.

Run the API from `backend/` with `npm install` and `npm start`. Run the UI from the repository root with `npm install` and `npm run dev`; the UI is at `http://localhost:5173` and expects the API at `http://localhost:8000` by default.

## Evaluation

The checked-in dataset is in `backend/evaluation/cases.json`. Upload the named water-cycle document to an evaluation workspace, wait for indexing to finish, then run from `backend/`:

```powershell
$env:RAG_EVAL_WORKSPACE_ID = "YOUR_WORKSPACE_ID"
npm run eval:rag
npm test
```

The runner reports retrieval hits, answer citations, required terms, and out-of-scope refusal accuracy. It uses the live vector index and Groq model, so results depend on the configured services and model behavior.

## Container deployment

1. Create `backend/.env` from `backend/.env.example` and provide the Atlas URI, a JWT secret of at least 32 characters, and the Groq API key.
2. Start the stack with `docker compose up --build`.
3. Open `http://localhost:8080`.

The UI container serves static assets and proxies `/api`, `/health`, and `/ready` to the API. Uploaded files and model cache use named volumes. The backend runs as a non-root user and exposes a readiness health check. Set `CLIENT_ORIGIN` to the real UI origin when deploying outside this local Compose setup.

Rate limits use the process-local memory store; use a shared store before running multiple API replicas. `/health` is a liveness check, `/ready` requires MongoDB, and API responses include an `X-Request-Id` for log correlation.
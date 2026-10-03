# RAG Evaluation

The evaluation runner uses the live Atlas Vector Search index and Groq model. It scores retrieval against expected filenames, checks required answer terms and citations, and measures refusal accuracy for an out-of-scope question.

1. Upload `water-cycle-notes.pdf` to a workspace and wait for it to become `ready`.
2. Set `RAG_EVAL_WORKSPACE_ID` to that workspace's ID in the environment.
3. From `backend/`, run `npm run eval:rag`.

The runner exits non-zero if any case fails. It prints retrieved filenames/pages and answers, but never prints credentials. Edit `cases.json` to add domain-specific cases; keep expected filenames and required terms grounded in the evaluation workspace.
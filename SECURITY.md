# Security Review

## Implemented controls

- JWT verification is restricted to HS256 and requires a valid MongoDB user ID.
- Production startup requires MongoDB, Groq, explicit CORS origins, and a JWT secret of at least 32 characters. Wildcard production CORS is rejected.
- Authentication, chat, upload, and API routes have request limits. JSON bodies and PDF uploads are size-limited; uploads must have a PDF signature.
- Workspace ownership is checked before document/chat operations. Conversation reads/deletes are scoped by both owner and workspace; vector retrieval prefilters by workspace ID.
- Helmet headers, disabled `X-Powered-By`, request IDs, sanitized 5xx responses, and structured request/error logs are enabled.
- Markdown rendering does not enable raw HTML. The production Nginx policy restricts scripts and connections to same-origin.
- Containers run as non-root where applicable, secrets are excluded from build contexts, and upload/model cache data use named volumes.

## Residual risks and deployment requirements

- `npm audit --omit=dev` on 2026-10-02 reported six production advisories in the current backend dependency tree: five high and one critical. The critical `protobufjs` advisory and one high `sharp` advisory are transitive through `@xenova/transformers`; a high `pdfjs-dist` advisory affects uploaded PDF parsing. The suggested `npm audit fix --force` downgrades `pdfjs-dist` and `@xenova/transformers`, so it was not applied without compatibility validation. Keep PDF uploads restricted to trusted users until these dependencies are migrated to patched compatible releases.
- The in-memory rate-limit store is per process. Use a shared store such as Redis before running multiple API replicas.
- Browser JWTs are stored in local storage. A future cookie-based session using `HttpOnly`, `Secure`, and `SameSite` attributes would reduce token exposure if an XSS bug is introduced.
- Use TLS at the public ingress, rotate credentials, restrict Atlas network access and database roles, and use a secret manager instead of committed or image-baked secrets.
- Configure `CLIENT_ORIGIN` to the exact production UI origin and set `TRUST_PROXY_HOPS` to the real trusted proxy count only.
- The model sees extracted document text. Prompt-injection rules help but are not a complete isolation boundary; do not treat model output as authorization or execute it.
- Evaluation is a small regression set, not a security proof. Add representative, adversarial, and tenant-isolation cases before broad deployment.
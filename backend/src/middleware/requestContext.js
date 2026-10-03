import { randomUUID } from "node:crypto";

export function requestContext(req, res, next) {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    next();
}

export function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            event: "http_request",
            requestId: req.id,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
        }));
    });
    next();
}
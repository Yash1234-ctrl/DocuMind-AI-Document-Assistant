import rateLimit from "express-rate-limit";

function createLimiter({ windowMs, limit, message }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({ error: message, requestId: req.id }),
    });
}

export const apiLimiter = createLimiter({
    windowMs: 60 * 1000,
    limit: 180,
    message: "Too many requests. Please try again shortly.",
});

export const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: "Too many sign-in attempts. Please wait before trying again.",
});

export const chatLimiter = createLimiter({
    windowMs: 60 * 1000,
    limit: 20,
    message: "Too many chat requests. Please try again shortly.",
});

export const uploadLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many uploads. Please wait before uploading again.",
});
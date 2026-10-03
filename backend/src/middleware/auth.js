import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
        if (typeof payload.userId !== "string" || !mongoose.isValidObjectId(payload.userId)) {
            return res.status(401).json({ error: "Invalid or expired token", requestId: req.id });
        }
        req.userId = payload.userId;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token", requestId: req.id });
    }
}
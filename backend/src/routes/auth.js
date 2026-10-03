import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config.js";

const router = Router();

const sign = (userId) =>
    jwt.sign({ userId }, config.jwtSecret, { expiresIn: "7d" });

function normalizeEmail(email) {
    if (typeof email !== "string") return "";
    return email.trim().toLowerCase();
}

function validCredentials(email, password) {
    return typeof password === "string"
        && email.length <= 254
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        && password.length >= 8
        && Buffer.byteLength(password, "utf8") <= 72;
}

router.post("/register", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validCredentials(email, password)) {
        return res.status(400).json({ error: "Enter a valid email and a password of 8-72 bytes" });
    }
    if (await User.findOne({ email })) {
        return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    res.status(201).json({ token: sign(user.id), user: { id: user.id, email: user.email } });
});

router.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: sign(user.id), user: { id: user.id, email: user.email } });
});

export default router;
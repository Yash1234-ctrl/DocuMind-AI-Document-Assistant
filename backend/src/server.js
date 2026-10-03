import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { config, validateConfig } from "./config.js";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { requestContext, requestLogger } from "./middleware/requestContext.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimits.js";

const app = express();
app.disable("x-powered-by");
if (config.trustProxyHops > 0) app.set("trust proxy", config.trustProxyHops);
app.use(requestContext);
app.use(helmet());
const allowedOrigins = new Set(config.clientOrigins);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
    },
}));
app.use(express.json({ limit: "64kb" }));
app.use(requestLogger);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/ready", (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", requestId: req.id });
});
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export async function startServer() {
    validateConfig();
    await connectDB();
    const server = app.listen(config.port, "0.0.0.0", () => {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", event: "server_started", port: config.port, environment: config.nodeEnv }));
    });

    const shutdown = (signal) => {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", event: "server_shutdown", signal }));
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
        const timeout = setTimeout(() => process.exit(1), 10000);
        timeout.unref();
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    return server;
}

if (process.env.NODE_ENV !== "test") {
    startServer().catch((error) => {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "fatal", event: "startup_failed", errorName: error.name, message: error.message }));
        process.exitCode = 1;
    });
}

export default app;
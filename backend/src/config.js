import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const parsedPort = Number(process.env.PORT || 8000);
const parsedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

export const config = {
    port: parsedPort,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
    clientOrigins: (process.env.CLIENT_ORIGIN || (nodeEnv === "production" ? "" : "http://localhost:5173"))
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    nodeEnv,
    trustProxyHops: parsedProxyHops,
};

export function validateConfig(settings = config) {
    const missing = [];
    if (!settings.mongoUri) missing.push("MONGODB_URI");
    if (!settings.jwtSecret) missing.push("JWT_SECRET");
    if (!settings.groqApiKey) missing.push("GROQ_API_KEY");
    if (settings.nodeEnv === "production" && settings.clientOrigins.length === 0) missing.push("CLIENT_ORIGIN");
    if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
    if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535");
    }
    if (!Number.isInteger(settings.trustProxyHops) || settings.trustProxyHops < 0) {
        throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
    }
    if (settings.nodeEnv === "production") {
        if (settings.jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production");
        if (settings.clientOrigins.some((origin) => origin === "*")) {
            throw new Error("CLIENT_ORIGIN must contain explicit production origins, not wildcards");
        }
    }
}
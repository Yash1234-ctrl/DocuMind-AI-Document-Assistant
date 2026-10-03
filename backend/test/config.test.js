import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";

const productionConfig = {
    mongoUri: "mongodb://example.invalid/app",
    jwtSecret: "x".repeat(32),
    groqApiKey: "configured",
    clientOrigins: ["https://app.example.com"],
    nodeEnv: "production",
    port: 8000,
    trustProxyHops: 1,
};

test("accepts valid production settings", () => {
    assert.doesNotThrow(() => validateConfig(productionConfig));
});

test("rejects a weak production JWT secret", () => {
    assert.throws(() => validateConfig({ ...productionConfig, jwtSecret: "short" }), /at least 32 characters/);
});

test("rejects wildcard production origins but allows explicit local Compose origins", () => {
    assert.throws(() => validateConfig({ ...productionConfig, clientOrigins: ["*"] }), /explicit production origins/);
    assert.doesNotThrow(() => validateConfig({ ...productionConfig, clientOrigins: ["http://localhost:8080"] }));
});

test("rejects invalid ports and proxy hop counts", () => {
    assert.throws(() => validateConfig({ ...productionConfig, port: 70000 }), /PORT must be/);
    assert.throws(() => validateConfig({ ...productionConfig, trustProxyHops: -1 }), /TRUST_PROXY_HOPS must be/);
});
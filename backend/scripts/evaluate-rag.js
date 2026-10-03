import fs from "node:fs/promises";
import mongoose from "mongoose";
import { config } from "../src/config.js";
import { connectDB } from "../src/db.js";
import Chunk from "../src/models/Chunk.js";
import { retrieveChunks } from "../src/services/retrieval.js";
import { answerQuestion } from "../src/services/llm.js";
import { scoreCase } from "./eval-scoring.js";

const workspaceId = process.env.RAG_EVAL_WORKSPACE_ID || process.argv[2];
if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
    console.error("Set RAG_EVAL_WORKSPACE_ID or pass a valid workspace ID as the first argument.");
    process.exit(2);
}

const cases = JSON.parse(await fs.readFile(new URL("../evaluation/cases.json", import.meta.url), "utf8"));
const results = [];

try {
    await connectDB();
    const chunkCount = await Chunk.countDocuments({ workspaceId });
    if (chunkCount === 0) throw new Error("The evaluation workspace has no indexed chunks.");

    for (const testCase of cases) {
        const retrieved = await retrieveChunks(workspaceId, testCase.question, 5);
        const answer = await answerQuestion({ question: testCase.question, chunks: retrieved });
        results.push({
            ...scoreCase(testCase, retrieved, answer),
            retrieved: retrieved.map((chunk) => ({ filename: chunk.filename, pageNumber: chunk.pageNumber, score: chunk.score })),
            answer,
        });
    }

    const retrievalCases = results.filter((result) => result.relevantDocuments.length > 0 || cases.find((item) => item.id === result.id)?.expectedDocuments.length > 0);
    const summary = {
        workspaceId,
        chunkCount,
        cases: results.length,
        passed: results.filter((result) => result.passed).length,
        retrievalHitRate: retrievalCases.length ? retrievalCases.filter((result) => result.retrievalPassed).length / retrievalCases.length : 1,
        refusalAccuracy: results.filter((result) => cases.find((item) => item.id === result.id)?.expectRefusal).every((result) => result.refusalPassed),
        results,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.passed !== summary.cases) process.exitCode = 1;
} catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
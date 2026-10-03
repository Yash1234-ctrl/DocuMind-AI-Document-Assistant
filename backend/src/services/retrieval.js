import mongoose from "mongoose";
import Chunk from "../models/Chunk.js";
import { embedText } from "./embeddings.js";

export const MIN_RETRIEVAL_SCORE = 0.55;

export function filterRelevantChunks(results, minScore = MIN_RETRIEVAL_SCORE) {
    return results.filter((result) => Number(result.score) >= minScore);
}

export async function retrieveChunks(workspaceId, question, k = 5) {
    const queryVector = await embedText(question);

    const results = await Chunk.aggregate([
        {
            $vectorSearch: {
                index: "chunk_vector_index",
                path: "embedding",
                queryVector,
                numCandidates: 100,
                limit: k,
                filter: { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
            },
        },
        {
            $project: {
                _id: 0,
                filename: 1,
                pageNumber: 1,
                content: 1,
                score: { $meta: "vectorSearchScore" },
            },
        },
    ]);

    console.log("scores:", results.map((r) => Number(r.score).toFixed(3)));
    return filterRelevantChunks(results, MIN_RETRIEVAL_SCORE);
}
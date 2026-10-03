import mongoose from "mongoose";
import Chunk from "../models/Chunk.js";
import { embedText } from "./embeddings.js";

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
                // aggregate() does not auto-cast, so convert to ObjectId manually
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

    return results;
}
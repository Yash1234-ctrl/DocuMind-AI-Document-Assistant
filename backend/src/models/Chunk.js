import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    filename: String,
    pageNumber: Number,
    content: String,
    embedding: { type: [Number], required: true },
});

export default mongoose.model("Chunk", chunkSchema);
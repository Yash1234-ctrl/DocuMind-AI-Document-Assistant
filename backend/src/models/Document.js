import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
    {
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
        filename: { type: String, required: true },
        storageKey: String,
        pages: Number,
        chunkCount: Number,
        status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
        error: String,
    },
    { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
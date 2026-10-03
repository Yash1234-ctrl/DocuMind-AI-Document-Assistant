import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

export default mongoose.model("Workspace", workspaceSchema);
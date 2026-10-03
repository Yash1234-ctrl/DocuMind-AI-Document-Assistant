import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        sources: [
            {
                index: Number,
                filename: String,
                pageNumber: Number,
                snippet: String,
            },
        ],
    },
    { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
    {
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: String,
        messages: [messageSchema],
    },
    { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
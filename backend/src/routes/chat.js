import { Router } from "express";
import mongoose from "mongoose";
import Workspace from "../models/Workspace.js";
import Conversation from "../models/Conversation.js";
import { requireAuth } from "../middleware/auth.js";
import { retrieveChunks } from "../services/retrieval.js";
import { answerQuestion, streamAnswerQuestion } from "../services/llm.js";
import { chatLimiter } from "../middleware/rateLimits.js";

export const SMALL_TALK = /^\s*(hi|hello|hey|thanks|thank you|ok|okay|bye|goodbye|good morning|good night)\b[\s!.,a-z]*$/i;

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.use(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.workspaceId)) return res.status(400).json({ error: "Invalid workspace ID", requestId: req.id });
    const ws = await Workspace.findOne({ _id: req.params.workspaceId, userId: req.userId });
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    next();
});

// list conversations
router.get("/conversations", async (req, res) => {
    const items = await Conversation.find({
        workspaceId: req.params.workspaceId,
        userId: req.userId,
    })
        .select("title updatedAt")
        .sort("-updatedAt");
    res.json(items);
});

// get one conversation
router.get("/conversations/:id", async (req, res) => {
    const convo = await Conversation.findOne({
        _id: req.params.id,
        workspaceId: req.params.workspaceId,
        userId: req.userId,
    });
    if (!convo) return res.status(404).json({ error: "Not found" });
    res.json(convo);
});

router.delete("/conversations/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid conversation ID", requestId: req.id });
    const convo = await Conversation.findOneAndDelete({
        _id: req.params.id,
        workspaceId: req.params.workspaceId,
        userId: req.userId,
    });
    if (!convo) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
});

router.post("/stream", chatLimiter, async (req, res, next) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const { conversationId } = req.body || {};
    if (!question || question.length > 4000) return res.status(400).json({ error: "Question must be between 1 and 4000 characters" });
    if (conversationId && !mongoose.isValidObjectId(conversationId)) return res.status(400).json({ error: "Invalid conversation ID" });

    try {
        let convo;
        if (conversationId) {
            convo = await Conversation.findOne({
                _id: conversationId,
                workspaceId: req.params.workspaceId,
                userId: req.userId,
            });
            if (!convo) return res.status(404).json({ error: "Conversation not found" });
        } else {
            convo = new Conversation({
                workspaceId: req.params.workspaceId,
                userId: req.userId,
                title: question.slice(0, 60),
                messages: [],
            });
        }

        const chunks = await retrieveChunks(req.params.workspaceId, question, 5);
        const history = convo.messages.slice(-6).map((message) => ({ role: message.role, content: message.content }));
        const sources = chunks.map((chunk, index) => ({
            index: index + 1,
            filename: chunk.filename,
            pageNumber: chunk.pageNumber,
            snippet: chunk.content.slice(0, 200),
        }));

        res.status(200);
        res.set({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.flushHeaders();

        const sendEvent = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        sendEvent("conversation", { conversationId: convo.id });
        sendEvent("sources", { sources });

        let answer = "";
        if (chunks.length === 0) {
            answer = "I couldn't find that in your documents. Upload a document first, or check it has finished processing.";
            sendEvent("delta", { text: answer });
        } else {
            for await (const text of streamAnswerQuestion({ question, chunks, history })) {
                answer += text;
                sendEvent("delta", { text });
            }
        }

        convo.messages.push({ role: "user", content: question });
        convo.messages.push({ role: "assistant", content: answer, sources });
        await convo.save();
        sendEvent("done", { conversationId: convo.id });
        res.end();
    } catch (error) {
        if (res.headersSent) {
            console.error("Chat stream failed:", error);
            if (!res.destroyed && !res.writableEnded) res.write(`event: error\ndata: ${JSON.stringify({ error: "Unable to complete the response." })}\n\n`);
            return res.end();
        }
        next(error);
    }
});

// ask a question
router.post("/", chatLimiter, async (req, res) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const { conversationId } = req.body || {};
    if (!question || question.length > 4000) return res.status(400).json({ error: "Question must be between 1 and 4000 characters" });
    if (conversationId && !mongoose.isValidObjectId(conversationId)) return res.status(400).json({ error: "Invalid conversation ID" });

    let convo;
    if (conversationId) {
        convo = await Conversation.findOne({
            _id: conversationId,
            workspaceId: req.params.workspaceId,
            userId: req.userId,
        });
        if (!convo) return res.status(404).json({ error: "Conversation not found" });
    } else {
        convo = new Conversation({
            workspaceId: req.params.workspaceId,
            userId: req.userId,
            title: question.slice(0, 60),
            messages: [],
        });
    }

    if (SMALL_TALK.test(question)) {
        const reply = "You're welcome! Ask me anything about your uploaded documents.";
        convo.messages.push({ role: "user", content: question });
        convo.messages.push({ role: "assistant", content: reply, sources: [] });
        await convo.save();
        return res.json({ conversationId: convo.id, answer: reply, sources: [] });
    }

    const chunks = await retrieveChunks(req.params.workspaceId, question, 5);

    if (chunks.length === 0) {
        const reply = "I couldn't find that in your documents. Upload a document first, or check it has finished processing.";
        convo.messages.push({ role: "user", content: question });
        convo.messages.push({ role: "assistant", content: reply, sources: [] });
        await convo.save();
        return res.json({ conversationId: convo.id, answer: reply, sources: [] });
    }

    // last 6 messages as conversation memory (plain text only, no old context)
    const history = convo.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    const answer = await answerQuestion({ question, chunks, history });

    const refused = /couldn't find that in your documents/i.test(answer);
    const sources = refused
        ? []
        : chunks.map((c, i) => ({
            index: i + 1,
            filename: c.filename,
            pageNumber: c.pageNumber,
            snippet: c.content.slice(0, 200),
        }));

    convo.messages.push({ role: "user", content: question });
    convo.messages.push({ role: "assistant", content: answer, sources });
    await convo.save();

    res.json({ conversationId: convo.id, answer, sources });
});

export default router;
import { Router } from "express";
import Workspace from "../models/Workspace.js";
import { requireAuth } from "../middleware/auth.js";
import documentsRouter from "./documents.js";
import chatRoutes from "./chat.js";
const router = Router();
router.use(requireAuth);
router.use("/:workspaceId/documents", documentsRouter);
router.use("/:workspaceId/chat", chatRoutes);

router.get("/", async (req, res) => {
    const items = await Workspace.find({ userId: req.userId }).sort("-createdAt");
    res.json(items);
});

router.post("/", async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: "Name required" });
    const ws = await Workspace.create({ userId: req.userId, name: req.body.name });
    res.status(201).json(ws);
});

router.delete("/:id", async (req, res) => {
    const ws = await Workspace.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!ws) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
});

export default router;
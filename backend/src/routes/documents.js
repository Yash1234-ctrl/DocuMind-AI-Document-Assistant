import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import Workspace from "../models/Workspace.js";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { requireAuth } from "../middleware/auth.js";
import { saveFile, deleteFile } from "../services/storage.js";
import { ingestDocument } from "../services/ingest.js";
import { uploadLimiter } from "../middleware/rateLimits.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
        file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("Only PDF files are allowed")),
});

// make sure the workspace belongs to the logged-in user
router.use(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.workspaceId)) return res.status(400).json({ error: "Invalid workspace ID", requestId: req.id });
    const ws = await Workspace.findOne({ _id: req.params.workspaceId, userId: req.userId });
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    next();
});

router.get("/", async (req, res) => {
    const docs = await Document.find({ workspaceId: req.params.workspaceId }).sort("-createdAt");
    res.json(docs);
});

router.post("/", uploadLimiter, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name: file)" });
    if (!req.file.buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
        return res.status(415).json({ error: "Uploaded file is not a valid PDF" });
    }

    const storageKey = await saveFile(req.file.buffer, req.file.originalname);
    const doc = await Document.create({
        workspaceId: req.params.workspaceId,
        filename: req.file.originalname,
        storageKey,
    });

    // respond immediately, process in the background
    res.status(202).json(doc);
    void ingestDocument({
        docId: doc._id,
        workspaceId: doc.workspaceId,
        filename: doc.filename,
        buffer: req.file.buffer,
    }).catch((error) => console.error(JSON.stringify({ level: "error", event: "ingestion_unhandled", requestId: req.id, documentId: String(doc._id), message: error.message })));
});

router.delete("/:docId", async (req, res) => {
    const doc = await Document.findOneAndDelete({ _id: req.params.docId, workspaceId: req.params.workspaceId });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await Chunk.deleteMany({ documentId: doc._id });
    await deleteFile(doc.storageKey);
    res.json({ deleted: true });
});

export default router;
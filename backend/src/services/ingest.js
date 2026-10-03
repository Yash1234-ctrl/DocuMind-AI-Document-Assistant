import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import Chunk from "../models/Chunk.js";
import Document from "../models/Document.js";
import { embedMany } from "./embeddings.js";

const CHUNK_SIZE = 1200; // characters (~300 tokens)
const OVERLAP = 200;

export async function extractPages(buffer) {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
        pages.push({ pageNumber: i, text });
    }
    return pages;
}

export function chunkText(text) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + CHUNK_SIZE, text.length);
        if (end < text.length) {
            // try to end on a sentence boundary
            const lastStop = text.lastIndexOf(". ", end);
            if (lastStop > start + CHUNK_SIZE * 0.6) end = lastStop + 1;
        }
        const piece = text.slice(start, end).trim();
        if (piece.length > 40) chunks.push(piece);
        if (end >= text.length) break;
        start = end - OVERLAP;
    }
    return chunks;
}

export async function ingestDocument({ docId, workspaceId, filename, buffer }) {
    const startedAt = performance.now();
    try {
        const pages = await extractPages(buffer);
        const records = [];
        for (const p of pages) {
            for (const content of chunkText(p.text)) {
                records.push({ pageNumber: p.pageNumber, content });
            }
        }
        if (records.length === 0) {
            throw new Error("No extractable text found (scanned PDF?). OCR is not supported yet.");
        }

        const vectors = await embedMany(records.map((r) => r.content));
        await Chunk.insertMany(
            records.map((r, i) => ({
                workspaceId,
                documentId: docId,
                filename,
                pageNumber: r.pageNumber,
                content: r.content,
                embedding: vectors[i],
            }))
        );

        await Document.findByIdAndUpdate(docId, {
            status: "ready",
            pages: pages.length,
            chunkCount: records.length,
        });
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            event: "document_ingested",
            documentId: String(docId),
            pageCount: pages.length,
            chunkCount: records.length,
            durationMs: Math.round(performance.now() - startedAt),
        }));
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: "document_ingestion_failed",
            documentId: String(docId),
            errorName: error.name,
            message: error.message,
        }));
        try {
            await Document.findByIdAndUpdate(docId, { status: "failed", error: error.message });
        } catch (updateError) {
            console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: "error",
                event: "document_status_update_failed",
                documentId: String(docId),
                errorName: updateError.name,
                message: updateError.message,
            }));
        }
    }
}
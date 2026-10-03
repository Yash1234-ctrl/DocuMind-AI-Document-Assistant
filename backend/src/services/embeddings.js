import { pipeline } from "@xenova/transformers";

let extractorPromise;
function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return extractorPromise;
}

export async function embedText(text) {
    const extractor = await getExtractor();
    const out = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(out.data); // 384 numbers
}

export async function embedMany(texts) {
    const vectors = [];
    for (const t of texts) vectors.push(await embedText(t));
    return vectors;
}
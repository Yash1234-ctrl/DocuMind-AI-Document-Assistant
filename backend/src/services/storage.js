import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
const s3 = bucket ? new S3Client({ region: process.env.AWS_REGION || "ap-south-1" }) : null;
const localDir = path.resolve("uploads");

export async function saveFile(buffer, originalName) {
    const key = `${crypto.randomUUID()}-${originalName.replace(/[^\w.\-]/g, "_")}`;
    if (s3) {
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: "application/pdf" }));
    } else {
        await fs.mkdir(localDir, { recursive: true });
        await fs.writeFile(path.join(localDir, key), buffer);
    }
    return key;
}

export async function deleteFile(key) {
    if (!key) return;
    try {
        if (s3) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        else await fs.unlink(path.join(localDir, key));
    } catch (e) {
        console.warn("File delete failed:", e.message);
    }
}
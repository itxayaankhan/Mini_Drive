import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import File from "../models/File.js";
import UploadSession from "../models/UploadSession.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const ROOT = path.resolve("storage");
const CHUNKS_DIR = path.join(ROOT, "chunks");
const FILES_DIR = path.join(ROOT, "files");
const INCOMING_DIR = path.join(ROOT, "incoming");
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 2 * 1024 ** 3);
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE_BYTES || 5 * 1024 ** 2);
for (const dir of [CHUNKS_DIR, FILES_DIR, INCOMING_DIR]) fs.mkdirSync(dir, { recursive: true });

const multipart = multer({ dest: INCOMING_DIR, limits: { fileSize: CHUNK_SIZE, files: 1, fields: 2 } });
const isUuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const chunkPath = (uploadId, index) => path.join(CHUNKS_DIR, uploadId, `${index}.part`);
function indexesFrom(names, totalChunks) {
  return names.filter(n => /^\d+\.part$/.test(n)).map(n => Number(n.replace(".part", "")))
    .filter(i => Number.isInteger(i) && i >= 1 && i <= totalChunks).sort((a, b) => a - b);
}
async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function mergeChunks(session) {
  const dir = path.join(CHUNKS_DIR, session.uploadId);
  const tempPath = path.join(FILES_DIR, `${randomUUID()}.assembling`);
  const finalPath = path.join(FILES_DIR, `${randomUUID()}.bin`);
  async function* chunkData() {
    for (let i = 1; i <= session.totalChunks; i++) {
      for await (const chunk of fs.createReadStream(chunkPath(session.uploadId, i))) yield chunk;
    }
  }
  try {
    await pipeline(Readable.from(chunkData()), fs.createWriteStream(tempPath, { flags: "wx" }));
    const stat = await fs.promises.stat(tempPath);
    if (stat.size !== session.totalSize) throw Object.assign(new Error("Assembled file size mismatch"), { statusCode: 400 });
    const hash = await sha256(tempPath);
    if (hash !== session.fileHash) throw Object.assign(new Error("SHA-256 verification failed"), { statusCode: 400 });
    await fs.promises.rename(tempPath, finalPath);
    try {
      const file = await File.create({
        ownerId: session.ownerId, originalName: session.filename, size: stat.size,
        hash, storagePath: finalPath, createdAt: new Date()
      });
      await fs.promises.rm(dir, { recursive: true, force: true });
      session.status = "completed";
      await session.save();
      return file;
    } catch (error) {
      await fs.promises.rm(finalPath, { force: true });
      if (error.code === 11000) {
        const existing = await File.findOne({ ownerId: session.ownerId, hash });
        if (existing) return existing;
      }
      throw error;
    }
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    await fs.promises.rm(finalPath, { force: true }).catch(() => {});
    throw error;
  }
}

router.post("/upload/init", requireAuth, async (req, res, next) => {
  try {
    const { filename, totalSize, totalChunks, fileHash } = req.body || {};
    if (typeof filename !== "string" || !filename.trim() || filename !== path.basename(filename) || filename.length > 255 ||
        !Number.isSafeInteger(totalSize) || totalSize < 1 || totalSize > MAX_FILE_SIZE ||
        !Number.isSafeInteger(totalChunks) || totalChunks < 1 || totalChunks > 10000 ||
        totalChunks !== Math.ceil(totalSize / CHUNK_SIZE) ||
        typeof fileHash !== "string" || !/^[a-f0-9]{64}$/i.test(fileHash)) {
      return res.status(400).json({ error: "Invalid upload metadata" });
    }
    const hash = fileHash.toLowerCase();
    const existing = await File.findOne({ ownerId: req.user.id, hash });
    if (existing) return res.json({ instant: true, fileId: existing._id });

    let session = await UploadSession.findOne({ ownerId: req.user.id, fileHash: hash, status: "uploading" });
    if (session && (session.totalSize !== totalSize || session.totalChunks !== totalChunks)) {
      return res.status(409).json({ error: "Existing upload session has different metadata" });
    }
    if (!session) {
      session = await UploadSession.create({
        uploadId: randomUUID(), ownerId: req.user.id, filename, totalSize, totalChunks,
        fileHash: hash, status: "uploading"
      });
    }
    const dir = path.join(CHUNKS_DIR, session.uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    const uploadedChunks = indexesFrom(await fs.promises.readdir(dir), session.totalChunks);
    res.json({ uploadId: session.uploadId, instant: false, uploadedChunks });
  } catch (error) { next(error); }
});

router.post("/upload/chunk", requireAuth, multipart.single("chunk"), async (req, res, next) => {
  const tempPath = req.file?.path;
  try {
    const uploadId = req.body?.uploadId;
    const chunkIndex = req.body?.chunkIndex;
    if (!req.file) return res.status(400).json({ error: "Chunk file is missing. Form field must be named chunk." });
    if (typeof uploadId !== "string" || !isUuid(uploadId)) return res.status(400).json({ error: "Invalid uploadId format" });
    if (!/^[1-9]\d*$/.test(String(chunkIndex || ""))) return res.status(400).json({ error: "chunkIndex must be a positive integer" });
    const index = Number(chunkIndex);
    const session = await UploadSession.findOne({ uploadId, ownerId: req.user.id });
    if (!session) return res.status(404).json({ error: "Upload session not found for this account. Initialize the upload again." });
    if (session.status !== "uploading") return res.status(409).json({ error: "Upload session is not accepting chunks" });
    if (index > session.totalChunks) return res.status(400).json({ error: "chunkIndex exceeds totalChunks" });
    const expectedSize = index < session.totalChunks ? CHUNK_SIZE : session.totalSize - CHUNK_SIZE * (session.totalChunks - 1);
    if (req.file.size !== expectedSize) return res.status(400).json({ error: "Unexpected chunk size", expected: expectedSize, received: req.file.size });
    const dir = path.join(CHUNKS_DIR, uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.rename(tempPath, chunkPath(uploadId, index));
    const indexes = indexesFrom(await fs.promises.readdir(dir), session.totalChunks);
    if (indexes.length !== session.totalChunks) return res.json({ received: true, completed: false });

    const claimed = await UploadSession.findOneAndUpdate(
      { _id: session._id, ownerId: req.user.id, status: "uploading" },
      { $set: { status: "merging" } }, { new: true }
    );
    if (!claimed) return res.json({ received: true, completed: false, merging: true });
    try {
      const savedFile = await mergeChunks(claimed);
      res.json({ received: true, completed: true, fileId: savedFile._id });
    } catch (error) {
      await UploadSession.updateOne({ _id: claimed._id, ownerId: req.user.id }, { $set: { status: "uploading" } });
      throw error;
    }
  } catch (error) { next(error); }
  finally { if (tempPath) await fs.promises.rm(tempPath, { force: true }).catch(() => {}); }
});

router.get("/files", requireAuth, async (req, res, next) => {
  try {
    const files = await File.find({ ownerId: req.user.id }, { originalName: 1, size: 1, hash: 1, createdAt: 1 })
      .sort({ createdAt: -1 }).limit(500).lean();
    res.json({ files });
  } catch (error) { next(error); }
});

router.get("/files/:id/download", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid file ID" });
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) return res.status(404).json({ error: "File not found in your drive" });
    const stream = fs.createReadStream(file.storagePath);
    stream.once("error", error => {
      if (!res.headersSent) res.status(error.code === "ENOENT" ? 404 : 500).json({ error: error.code === "ENOENT" ? "Stored file is missing" : "Could not read file" });
      else res.destroy(error);
    });
    const safeName = file.originalName.replace(/[\r\n"\\]/g, "_").replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader("Content-Length", String(file.size));
    stream.pipe(res);
  } catch (error) { next(error); }
});

router.delete("/files/:id", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    // Only allow the owner to delete their file.
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!file) {
      return res.status(404).json({
        error: "File not found in your drive",
      });
    }

    // Ensure the stored path is inside this app's files directory.
    const storageRoot = path.resolve(FILES_DIR);
    const storedPath = path.resolve(file.storagePath);

    if (!storedPath.startsWith(storageRoot + path.sep)) {
      return res.status(400).json({
        error: "Invalid stored file path",
      });
    }

    // Delete the physical file first.
    try {
      await fs.promises.unlink(storedPath);
    } catch (error) {
      // A missing physical file can still be cleaned up in MongoDB.
      if (error.code !== "ENOENT") {
        return res.status(500).json({
          error: "Could not delete the stored file",
        });
      }
    }

    // Remove the file's database record.
    await File.deleteOne({
      _id: file._id,
      ownerId: req.user.id,
    });

    res.json({
      success: true,
      message: "File deleted successfully",
      fileId: file._id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

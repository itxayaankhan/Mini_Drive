import mongoose from "mongoose";
const uploadSessionSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  filename: { type: String, required: true },
  totalSize: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  fileHash: { type: String, required: true, index: true },
  status: { type: String, enum: ["uploading", "merging", "completed"], default: "uploading", index: true },
  createdAt: { type: Date, default: Date.now }
});
uploadSessionSchema.index({ ownerId: 1, fileHash: 1, status: 1 });
export default mongoose.model("UploadSession", uploadSessionSchema);

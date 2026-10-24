import mongoose from "mongoose";
const fileSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  hash: { type: String, required: true },
  storagePath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
fileSchema.index({ ownerId: 1, hash: 1 }, { unique: true });
export default mongoose.model("File", fileSchema);

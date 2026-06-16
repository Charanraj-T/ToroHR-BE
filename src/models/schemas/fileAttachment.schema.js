import mongoose from "mongoose";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../../utils/file.util.js";

const fileAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true
    },
    mimeType: {
      type: String,
      enum: ALLOWED_MIME_TYPES,
      required: [true, "MIME type is required"]
    },
    size: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
      max: [MAX_FILE_SIZE, "File exceeds maximum allowed size"]
    },
    data: {
      type: Buffer,
      required: [true, "File data is required"]
    }
  },
  { _id: true }
);

export default fileAttachmentSchema;

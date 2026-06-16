export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

const toBuffer = (data) => {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data !== "string") return null;
  const buf = Buffer.from(data, "base64");
  return buf.length === 0 && data.length > 0 ? null : buf;
};

const throwErr = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const processFileBuffer = ({ fileName, mimeType, data }) => {
  if (!fileName || !mimeType || !data) {
    throwErr("File must include fileName, mimeType, and data");
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throwErr(
      `Unsupported file type "${mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }

  const buffer = toBuffer(data);

  if (!buffer || buffer.length === 0) {
    throwErr("File data must be a base64 string or Buffer");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throwErr(`File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  return {
    fileName: fileName.trim(),
    mimeType,
    size: buffer.length,
    data: buffer
  };
};

import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/upload-manager.ts
import fs2 from "fs";
import path2 from "path";

// src/paths.ts
import os from "os";
import path from "path";
import fs from "fs";
function getDataDir() {
  if (process.env.MYCHROME_DATA_DIR) {
    return path.resolve(process.env.MYCHROME_DATA_DIR);
  }
  const home = process.env.MYCHROME_HOME_DIR || os.homedir();
  return path.join(home, ".gemini", "mychrome");
}
function getUploadsDir(fallbackDir) {
  if (process.env.MYCHROME_UPLOADS_DIR) {
    return path.resolve(process.env.MYCHROME_UPLOADS_DIR);
  }
  const dataDir = getDataDir();
  if (fallbackDir && !fs.existsSync(dataDir) && fs.existsSync(fallbackDir)) {
    return path.join(fallbackDir, "uploads");
  }
  const uploads = path.join(dataDir, "uploads");
  try {
    if (!fs.existsSync(uploads)) {
      fs.mkdirSync(uploads, { recursive: true, mode: 448 });
    }
  } catch {
  }
  return uploads;
}

// src/upload-manager.ts
var WINDOWS_RESERVED = /* @__PURE__ */ new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9"
]);
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var MAX_ATTACHMENTS_PER_MESSAGE = 5;
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  // images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // pdf
  "application/pdf",
  // text
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  "text/xml",
  "application/xml",
  // Office
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  // pptx
]);
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".html",
  ".xml",
  ".docx",
  ".xlsx",
  ".pptx"
]);
function sanitizeFileName(rawName) {
  if (!rawName || typeof rawName !== "string") return "upload";
  let clean = rawName.trim().split(/[\\/]/).pop() || "";
  clean = clean.replace(/[\x00-\x1f<>:"/\\|?*]/g, "_");
  clean = clean.replace(/[. ]+$/, "");
  if (!clean) clean = "upload";
  const ext = path2.extname(clean);
  const stem = path2.basename(clean, ext);
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    clean = `_${stem}${ext}`;
  }
  if (clean.length > 120) {
    const safeExt = ext.slice(0, 15);
    const safeStem = stem.slice(0, 100);
    clean = `${safeStem}${safeExt}`;
  }
  return clean;
}
function validateAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return { valid: false, error: "Invalid attachment object" };
  }
  if (attachment.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File "${attachment.name}" exceeds 10 MB limit (${(attachment.size / (1024 * 1024)).toFixed(1)} MB)` };
  }
  const ext = path2.extname(attachment.name || "").toLowerCase();
  const mime = (attachment.mime || "").toLowerCase();
  const mimeAllowed = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith("text/");
  const extAllowed = ALLOWED_EXTENSIONS.has(ext);
  if (!mimeAllowed && !extAllowed) {
    return { valid: false, error: `File type not supported for "${attachment.name}"` };
  }
  return { valid: true };
}
async function saveAttachment(messageId, index, attachment, customUploadsDir) {
  const uploadsRoot = customUploadsDir || getUploadsDir();
  const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const dayDir = path2.join(uploadsRoot, dateStr);
  if (!fs2.existsSync(dayDir)) {
    fs2.mkdirSync(dayDir, { recursive: true, mode: 448 });
  }
  const safeName = sanitizeFileName(attachment.name || `file_${index}`);
  const fileName = `${messageId}-${index}-${safeName}`;
  const filePath = path2.join(dayDir, fileName);
  let rawData = attachment.data;
  const commaIdx = rawData.indexOf(",");
  if (commaIdx !== -1 && rawData.slice(0, commaIdx).includes(";base64")) {
    rawData = rawData.slice(commaIdx + 1);
  }
  const buffer = Buffer.from(rawData, "base64");
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${attachment.name}" exceeds 10 MB size limit after decoding.`);
  }
  fs2.writeFileSync(filePath, buffer);
  const isImage = attachment.mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(safeName);
  let dataUrl = void 0;
  if (isImage) {
    const mime = attachment.mime || (safeName.endsWith(".png") ? "image/png" : "image/jpeg");
    dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  }
  return {
    name: attachment.name,
    mime: attachment.mime || "application/octet-stream",
    size: buffer.length,
    path: path2.resolve(filePath),
    isImage,
    dataUrl
  };
}
function cleanOldUploads(maxAgeDays = 7, customUploadsDir) {
  const uploadsRoot = customUploadsDir || getUploadsDir();
  if (!fs2.existsSync(uploadsRoot)) return 0;
  let cleaned = 0;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  try {
    const entries = fs2.readdirSync(uploadsRoot, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path2.join(uploadsRoot, entry.name);
      if (entry.isDirectory()) {
        const dateMatch = entry.name.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        let folderAgeMs;
        if (dateMatch) {
          const folderDate = (/* @__PURE__ */ new Date(`${entry.name}T00:00:00Z`)).getTime();
          folderAgeMs = now - folderDate;
        } else {
          const stat = fs2.statSync(fullPath);
          folderAgeMs = now - stat.mtimeMs;
        }
        if (folderAgeMs > maxAgeMs) {
          fs2.rmSync(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      } else if (entry.isFile()) {
        const stat = fs2.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs2.unlinkSync(fullPath);
          cleaned++;
        }
      }
    }
  } catch (err) {
    console.error("[UploadManager] Cleanup error:", err);
  }
  return cleaned;
}
export {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_FILE_SIZE_BYTES,
  cleanOldUploads,
  sanitizeFileName,
  saveAttachment,
  validateAttachment
};

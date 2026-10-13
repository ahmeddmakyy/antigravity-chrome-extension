import crypto from "crypto";
import fs from "fs";
import path from "path";
import { FileAttachment, SavedAttachment } from "./types.js";
import { getUploadsDir } from "./paths.js";

const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

const ALLOWED_MIME_TYPES = new Set([
  // images
  "image/png", "image/jpeg", "image/webp", "image/gif",
  // pdf
  "application/pdf",
  // text
  "text/plain", "text/markdown", "text/csv", "application/json", "text/html", "text/xml", "application/xml",
  // Office
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
]);

const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pdf",
  ".txt", ".md", ".csv", ".json", ".html", ".xml",
  ".docx", ".xlsx", ".pptx",
]);

export const UPLOAD_RESTRICTION_ERROR =
  "upload_file only accepts files the user attached in the MyChrome panel (they are stored in the MyChrome uploads folder); ask the user to attach the file in the panel and use the path from the attachment.";

/**
 * Resolves and validates file paths for upload_file tool.
 * Only accepts existing regular files that live inside the MyChrome uploads folder.
 */
export function resolveUploadPaths(
  paths: unknown,
  uploadsRoot?: string
): { ok: true; paths: string[] } | { ok: false; error: string } {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 5) {
    return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
  }
  for (const p of paths) {
    if (typeof p !== "string" || !p.trim()) {
      return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
    }
  }

  const root = uploadsRoot ?? getUploadsDir();
  let realRoot: string;
  try {
    if (!fs.existsSync(root)) {
      return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
    }
    realRoot = fs.realpathSync(root);
  } catch {
    return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
  }

  const rootForRel = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
  const resolvedPaths: string[] = [];

  for (const rawPath of paths as string[]) {
    try {
      if (!fs.existsSync(rawPath)) {
        return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
      }
      const realFilePath = fs.realpathSync(rawPath);
      const stat = fs.statSync(realFilePath);
      if (!stat.isFile()) {
        return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
      }
      const fileForRel = process.platform === "win32" ? realFilePath.toLowerCase() : realFilePath;
      const rel = path.relative(rootForRel, fileForRel);
      if (rel.startsWith("..") || path.isAbsolute(rel) || rel === "") {
        return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
      }
      resolvedPaths.push(realFilePath);
    } catch {
      return { ok: false, error: UPLOAD_RESTRICTION_ERROR };
    }
  }

  return { ok: true, paths: resolvedPaths };
}

/**
 * Sanitizes a filename against path traversal and Windows reserved names.
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "upload";

  // 1. Strip path components (both / and \, whatever the OS: names come from the browser)
  let clean = rawName.trim().split(/[\\/]/).pop() || "";

  // 2. Replace forbidden chars (<>:"/\|?* and control characters) with underscore
  clean = clean.replace(/[\x00-\x1f<>:"/\\|?*]/g, "_");

  // 3. Remove trailing dots and spaces
  clean = clean.replace(/[. ]+$/, "");

  if (!clean) clean = "upload";

  // 4. Check against Windows reserved device names
  const ext = path.extname(clean);
  const stem = path.basename(clean, ext);

  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    clean = `_${stem}${ext}`;
  }

  // 5. Truncate if unreasonably long (max 120 chars total)
  if (clean.length > 120) {
    const safeExt = ext.slice(0, 15);
    const safeStem = stem.slice(0, 100);
    clean = `${safeStem}${safeExt}`;
  }

  return clean;
}

/**
 * Validate attachment constraints (size and type).
 */
export function validateAttachment(attachment: FileAttachment): { valid: boolean; error?: string } {
  if (!attachment || typeof attachment !== "object") {
    return { valid: false, error: "Invalid attachment object" };
  }
  if (attachment.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File "${attachment.name}" exceeds 10 MB limit (${(attachment.size / (1024 * 1024)).toFixed(1)} MB)` };
  }

  const ext = path.extname(attachment.name || "").toLowerCase();
  const mime = (attachment.mime || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type not supported for "${attachment.name}"` };
  }

  const mimeAllowed =
    mime === "" ||
    mime === "application/octet-stream" ||
    mime.startsWith("text/") ||
    ALLOWED_MIME_TYPES.has(mime);

  if (!mimeAllowed) {
    return { valid: false, error: `File type not supported for "${attachment.name}"` };
  }

  return { valid: true };
}

/**
 * Saves a single attachment to ~/.gemini/mychrome/uploads/<yyyy-mm-dd>/<random>-<messageId>-<n>-<safe-name>.
 */
export async function saveAttachment(
  messageId: number,
  index: number,
  attachment: FileAttachment,
  customUploadsDir?: string
): Promise<SavedAttachment> {
  const validation = validateAttachment(attachment);
  if (!validation.valid) {
    throw new Error(validation.error || `Invalid attachment "${attachment?.name}"`);
  }

  const uploadsRoot = customUploadsDir || getUploadsDir();
  const dateStr = new Date().toISOString().slice(0, 10);
  const dayDir = path.join(uploadsRoot, dateStr);

  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true, mode: 0o700 });
  }

  const rand = crypto.randomBytes(3).toString("hex");
  const safeName = sanitizeFileName(attachment.name || `file_${index}`);
  const fileName = `${rand}-${messageId}-${index}-${safeName}`;
  const filePath = path.join(dayDir, fileName);

  // Decode base64 payload
  let rawData = attachment.data;
  const commaIdx = rawData.indexOf(",");
  if (commaIdx !== -1 && rawData.slice(0, commaIdx).includes(";base64")) {
    rawData = rawData.slice(commaIdx + 1);
  }

  const buffer = Buffer.from(rawData, "base64");
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${attachment.name}" exceeds 10 MB size limit after decoding.`);
  }

  fs.writeFileSync(filePath, buffer);

  const isImage = attachment.mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(safeName);
  let dataUrl: string | undefined = undefined;

  if (isImage) {
    const mime = attachment.mime || (safeName.endsWith(".png") ? "image/png" : "image/jpeg");
    dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  }

  return {
    name: attachment.name,
    mime: attachment.mime || "application/octet-stream",
    size: buffer.length,
    path: path.resolve(filePath),
    isImage,
    dataUrl,
  };
}

/**
 * Deletes upload folders older than 7 days from ~/.gemini/mychrome/uploads.
 */
export function cleanOldUploads(maxAgeDays = 7, customUploadsDir?: string): number {
  const uploadsRoot = customUploadsDir || getUploadsDir();
  if (!fs.existsSync(uploadsRoot)) return 0;

  let cleaned = 0;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const entries = fs.readdirSync(uploadsRoot, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(uploadsRoot, entry.name);
      if (entry.isDirectory()) {
        // Match YYYY-MM-DD
        const dateMatch = entry.name.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        let folderAgeMs: number;
        if (dateMatch) {
          const folderDate = new Date(`${entry.name}T00:00:00Z`).getTime();
          folderAgeMs = now - folderDate;
        } else {
          const stat = fs.statSync(fullPath);
          folderAgeMs = now - stat.mtimeMs;
        }

        if (folderAgeMs > maxAgeMs) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          cleaned++;
        }
      }
    }
  } catch (err) {
    console.error("[UploadManager] Cleanup error:", err);
  }

  return cleaned;
}

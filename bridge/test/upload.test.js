import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  sanitizeFileName,
  validateAttachment,
  saveAttachment,
  cleanOldUploads,
  MAX_FILE_SIZE_BYTES,
} from "../dist/upload-manager.js";

test("Upload Manager - Unit & Integration Tests", async (t) => {
  const tmpDir = path.join(os.tmpdir(), `mychrome-test-uploads-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("File name sanitization", () => {
    // 1. Path traversal
    assert.equal(sanitizeFileName("../../../secret.pdf"), "secret.pdf");
    assert.equal(sanitizeFileName("..\\..\\passwords.txt"), "passwords.txt");

    // 2. Windows reserved device names
    assert.equal(sanitizeFileName("CON.txt"), "_CON.txt");
    assert.equal(sanitizeFileName("aux.png"), "_aux.png");
    assert.equal(sanitizeFileName("NUL"), "_NUL");
    assert.equal(sanitizeFileName("com1.json"), "_com1.json");

    // 3. Illegal Windows characters (< > : " / \ | ? *)
    assert.equal(sanitizeFileName('report:2026*final?.docx'), "report_2026_final_.docx");
    assert.equal(sanitizeFileName('foo<bar>"baz".txt'), "foo_bar__baz_.txt");

    // 4. Trailing dots and spaces
    assert.equal(sanitizeFileName("file.txt...   "), "file.txt");

    // 5. Empty or invalid fallback
    assert.equal(sanitizeFileName(""), "upload");
    assert.equal(sanitizeFileName("..."), "upload");
  });

  await t.test("Attachment validation", () => {
    // Valid image
    const validImg = {
      name: "diagram.png",
      mime: "image/png",
      size: 1024,
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };
    assert.deepEqual(validateAttachment(validImg), { valid: true });

    // Valid PDF
    const validPdf = {
      name: "doc.pdf",
      mime: "application/pdf",
      size: 5000,
      data: "JVBERi0xLjQK",
    };
    assert.deepEqual(validateAttachment(validPdf), { valid: true });

    // Exceeds 10 MB limit
    const tooLarge = {
      name: "huge.png",
      mime: "image/png",
      size: MAX_FILE_SIZE_BYTES + 1,
      data: "abc",
    };
    const sizeRes = validateAttachment(tooLarge);
    assert.equal(sizeRes.valid, false);
    assert.match(sizeRes.error, /exceeds 10 MB/);

    // Unsupported file type (.exe)
    const invalidType = {
      name: "malware.exe",
      mime: "application/x-msdownload",
      size: 500,
      data: "abc",
    };
    const typeRes = validateAttachment(invalidType);
    assert.equal(typeRes.valid, false);
    assert.match(typeRes.error, /not supported/);
  });

  await t.test("Saving attachment and returning content", async () => {
    const rawB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const attachment = {
      name: "test-pixel.png",
      mime: "image/png",
      size: 68,
      data: `data:image/png;base64,${rawB64}`,
    };

    const saved = await saveAttachment(101, 0, attachment, tmpDir);

    assert.equal(saved.name, "test-pixel.png");
    assert.equal(saved.isImage, true);
    assert.ok(saved.path.includes("test-pixel.png"));
    assert.ok(fs.existsSync(saved.path));
    assert.ok(saved.dataUrl?.startsWith("data:image/png;base64,"));

    const content = fs.readFileSync(saved.path);
    assert.equal(content.toString("base64"), rawB64);
  });

  await t.test("7-day cleanup deletes old folders and keeps recent ones", () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);

    const oldFolder = path.join(tmpDir, oldDate);
    const todayFolder = path.join(tmpDir, todayDate);

    fs.mkdirSync(oldFolder, { recursive: true });
    fs.mkdirSync(todayFolder, { recursive: true });
    fs.writeFileSync(path.join(oldFolder, "old.txt"), "old");
    fs.writeFileSync(path.join(todayFolder, "new.txt"), "new");

    assert.ok(fs.existsSync(oldFolder));
    assert.ok(fs.existsSync(todayFolder));

    const cleaned = cleanOldUploads(7, tmpDir);
    assert.equal(cleaned, 1);

    assert.equal(fs.existsSync(oldFolder), false, "Old folder should be deleted");
    assert.equal(fs.existsSync(todayFolder), true, "Recent folder should remain");
  });
});

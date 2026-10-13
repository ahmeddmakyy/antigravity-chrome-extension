import { TEST_ROOT } from "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  resolveUploadPaths,
  validateAttachment,
  saveAttachment,
  UPLOAD_RESTRICTION_ERROR,
} from "../dist/upload-manager.js";

test("Uploads Guard - Security & Validation Tests", async (t) => {
  const tmpUploadsDir = path.join(TEST_ROOT, `guard-uploads-${Date.now()}`);
  fs.mkdirSync(tmpUploadsDir, { recursive: true });

  const insideFile = path.join(tmpUploadsDir, "allowed.txt");
  fs.writeFileSync(insideFile, "hello inside");

  const outsideFile = path.join(TEST_ROOT, "secret.txt");
  fs.writeFileSync(outsideFile, "secret outside");

  t.after(() => {
    fs.rmSync(tmpUploadsDir, { recursive: true, force: true });
    try {
      fs.unlinkSync(outsideFile);
    } catch {}
  });

  await t.test("resolveUploadPaths accepts a file inside the uploads folder", () => {
    const res = resolveUploadPaths([insideFile], tmpUploadsDir);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.paths.length, 1);
      assert.equal(res.paths[0], fs.realpathSync(insideFile));
    }
  });

  await t.test("resolveUploadPaths rejects a file outside it", () => {
    const res = resolveUploadPaths([outsideFile], tmpUploadsDir);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
    }
  });

  await t.test("resolveUploadPaths rejects a path with .. traversal", () => {
    const traversalPath = path.join(tmpUploadsDir, "..", "secret.txt");
    const res = resolveUploadPaths([traversalPath], tmpUploadsDir);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
    }
  });

  await t.test("resolveUploadPaths rejects a directory", () => {
    const res = resolveUploadPaths([tmpUploadsDir], tmpUploadsDir);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
    }

    const subDir = path.join(tmpUploadsDir, "subdir");
    fs.mkdirSync(subDir, { recursive: true });
    const subRes = resolveUploadPaths([subDir], tmpUploadsDir);
    assert.equal(subRes.ok, false);
    if (!subRes.ok) {
      assert.equal(subRes.error, UPLOAD_RESTRICTION_ERROR);
    }
  });

  await t.test("resolveUploadPaths rejects a missing file", () => {
    const missing = path.join(tmpUploadsDir, "non-existent.txt");
    const res = resolveUploadPaths([missing], tmpUploadsDir);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
    }
  });

  await t.test("resolveUploadPaths rejects more than 5 paths", () => {
    const files = [];
    for (let i = 0; i < 6; i++) {
      const f = path.join(tmpUploadsDir, `file_${i}.txt`);
      fs.writeFileSync(f, `data ${i}`);
      files.push(f);
    }
    const res = resolveUploadPaths(files, tmpUploadsDir);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
    }
  });

  await t.test("resolveUploadPaths rejects a non-array and an empty array", () => {
    assert.equal(resolveUploadPaths(null, tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths(undefined, tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths("not-an-array", tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths(12345, tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths({}, tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths([], tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths([123], tmpUploadsDir).ok, false);
    assert.equal(resolveUploadPaths([""], tmpUploadsDir).ok, false);
  });

  await t.test("resolveUploadPaths rejects a symlink inside uploads that points outside", (t) => {
    const symlinkPath = path.join(tmpUploadsDir, "symlink-to-outside.txt");
    try {
      fs.symlinkSync(outsideFile, symlinkPath);
    } catch {
      t.skip("OS refuses symlink creation");
      return;
    }

    try {
      const res = resolveUploadPaths([symlinkPath], tmpUploadsDir);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.error, UPLOAD_RESTRICTION_ERROR);
      }
    } finally {
      try {
        fs.unlinkSync(symlinkPath);
      } catch {}
    }
  });

  await t.test("validateAttachment rejects evil.exe with mime text/plain and accepts report.pdf", () => {
    const evil = {
      name: "evil.exe",
      mime: "text/plain",
      size: 100,
      data: "aGVsbG8=",
    };
    const evilRes = validateAttachment(evil);
    assert.equal(evilRes.valid, false);
    assert.match(evilRes.error, /not supported/);

    const pdf = {
      name: "report.pdf",
      mime: "application/pdf",
      size: 100,
      data: "JVBERi0xLjQK",
    };
    const pdfRes = validateAttachment(pdf);
    assert.equal(pdfRes.valid, true);
  });

  await t.test("saveAttachment throws for a rejected file", async () => {
    const evil = {
      name: "evil.exe",
      mime: "text/plain",
      size: 100,
      data: "aGVsbG8=",
    };
    await assert.rejects(
      () => saveAttachment(1, 1, evil, tmpUploadsDir),
      /not supported/
    );
  });

  await t.test("saving the same messageId and index twice yields two different file names on disk", async () => {
    const attachment = {
      name: "doc.txt",
      mime: "text/plain",
      size: 12,
      data: Buffer.from("hello world\n").toString("base64"),
    };

    const saved1 = await saveAttachment(42, 1, attachment, tmpUploadsDir);
    const saved2 = await saveAttachment(42, 1, attachment, tmpUploadsDir);

    assert.notEqual(saved1.path, saved2.path);
    assert.ok(fs.existsSync(saved1.path));
    assert.ok(fs.existsSync(saved2.path));
    assert.notEqual(path.basename(saved1.path), path.basename(saved2.path));
  });
});

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "public", "uploads", "policies");
const uploadUrl = "/uploads/policies/";

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/plain",
      "text/csv",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/bmp"
    ];

    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("text/")) {
      return cb(null, true);
    }

    cb(new Error("Unsupported file type"));
  }
});

router.post(
  "/api/policies/upload",
  requireLogin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      let extractedText;

      if (ext === ".txt" || ext === ".csv") {
        try {
          extractedText = await fs.promises.readFile(req.file.path, "utf8");
        } catch {
          extractedText =
            "[Uploaded text file. Content could not be read automatically. Please review the original document and enter policy details manually.]";
        }
      } else {
        extractedText =
          `[Uploaded ${req.file.mimetype} file. Please review the original document and enter policy details manually.]`;
      }

      const result = await pool.query(
        `INSERT INTO policy_attachments
         (file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          req.file.originalname,
          uploadUrl + req.file.filename,
          req.file.mimetype,
          req.file.size,
          extractedText,
          req.session.userId
        ]
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error("Upload failed", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

router.post(
  "/api/policies/attachments/:id/link",
  requireLogin,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE policy_attachments
         SET policy_rule_id=$1
         WHERE id=$2`,
        [req.body.policy_rule_id, req.params.id]
      );

      res.json({ success: true });

    } catch (err) {
      console.error("Failed to link attachment", err);
      res.status(500).json({ error: "Failed to link attachment" });
    }
  }
);

module.exports = router;
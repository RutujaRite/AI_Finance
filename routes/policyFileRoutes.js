const express = require("express");
const path = require("path");
const fs = require("fs");
const mammoth = require("mammoth");

const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

const projectRoot = path.join(__dirname, "..");

const policyUploadDirectory = path.join(
  projectRoot,
  "public",
  "uploads",
  "policies"
);


function escapeHtml(value) {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}


function getMimeType(ext) {
  const map = {
    ".pdf": "application/pdf",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".xlsb":
      "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp"
  };

  return map[String(ext || "").toLowerCase()] || null;
}


function isPolicyFileActive(meta) {
  if (!meta) {
    return true;
  }

  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return true;
    }
  }

  return meta.is_active !== false;
}


// =====================================================
// VIEW POLICY FILE
// =====================================================

router.get(
  "/api/policy-files/:id/view",
  requireLogin,
  async (req, res) => {
    try {
      const fileId =
        parseInt(req.params.id, 10);

      let result =
        await pool.query(
          `SELECT
             id,
             file_name,
             file_path,
             file_type,
             file_size_bytes
           FROM policy_attachments
           WHERE id = $1`,
          [fileId]
        );

      if (result.rowCount === 0) {
        result =
          await pool.query(
            `SELECT
               id,
               file_name,
               file_path,
               file_type,
               file_size_bytes,
               metadata
             FROM bank_policy_files
             WHERE id = $1`,
            [fileId]
          );
      }

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({
            error: "Source document not found"
          });
      }

      const fileRecord =
        result.rows[0];

      const meta =
        typeof fileRecord.metadata === "string"
          ? JSON.parse(
              fileRecord.metadata || "{}"
            )
          : fileRecord.metadata || {};

      if (!isPolicyFileActive(meta)) {
        return res
          .status(404)
          .json({
            error: "Source document not found"
          });
      }

      const filePath =
        fileRecord.file_path;

      if (!filePath) {
        return res
          .status(404)
          .json({
            error:
              "File path is missing for this document"
          });
      }

      let absolutePath =
        filePath;

      if (!path.isAbsolute(filePath)) {
        absolutePath =
          path.join(
            projectRoot,
            "public",
            filePath
          );
      }

      const normalizedPath =
        path.resolve(absolutePath);

      const normalizedRoot =
        path.resolve(projectRoot);

      const normalizedUploads =
        path.resolve(policyUploadDirectory);

      const isUnderRoot =
        normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(
          normalizedRoot + path.sep
        );

      const isUnderUploads =
        normalizedPath === normalizedUploads ||
        normalizedPath.startsWith(
          normalizedUploads + path.sep
        );

      if (
        !isUnderRoot &&
        !isUnderUploads
      ) {
        return res
          .status(403)
          .json({
            error:
              "Access to this file is restricted"
          });
      }

      try {
        await fs.promises.access(
          normalizedPath,
          fs.constants.R_OK
        );
      } catch {
        return res
          .status(404)
          .json({
            error: "File not found on server"
          });
      }

      const ext =
        path
          .extname(
            fileRecord.file_name ||
              filePath
          )
          .toLowerCase();

      let mimeType =
        fileRecord.file_type;

      if (
        !mimeType ||
        mimeType.startsWith(".")
      ) {
        mimeType =
          getMimeType(
            mimeType || ext
          ) ||
          "application/octet-stream";
      }

      res.setHeader(
        "Content-Type",
        mimeType
      );

      const isPreviewable =
        mimeType.startsWith("image/") ||
        mimeType === "application/pdf" ||
        mimeType === "text/plain" ||
        mimeType === "text/csv" ||
        mimeType === "application/msword" ||
        mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType.startsWith(
          "application/vnd.ms-excel"
        ) ||
        mimeType.startsWith(
          "application/vnd.openxmlformats-officedocument.spreadsheetml"
        );

      res.setHeader(
        "Content-Disposition",
        isPreviewable
          ? "inline"
          : "attachment"
      );

      if (
        fileRecord.file_size_bytes
      ) {
        res.setHeader(
          "Content-Length",
          fileRecord.file_size_bytes
        );
      }

      const stream =
        fs.createReadStream(
          normalizedPath
        );

      stream.pipe(res);

      stream.on(
        "error",
        () => {
          if (!res.headersSent) {
            res
              .status(500)
              .json({
                error:
                  "Failed to read file"
              });
          }
        }
      );
    } catch (err) {
      console.error(
        "Policy file view error:",
        err
      );

      if (!res.headersSent) {
        res
          .status(500)
          .json({
            error: "Failed to load file"
          });
      }
    }
  }
);


// =====================================================
// DOWNLOAD POLICY FILE
// =====================================================

router.get(
  "/api/policy-files/:id/download",
  requireLogin,
  async (req, res) => {
    try {
      const fileId =
        parseInt(req.params.id, 10);

      let result =
        await pool.query(
          `SELECT
             id,
             file_name,
             file_path,
             file_type,
             file_size_bytes,
             extracted_text
           FROM policy_attachments
           WHERE id = $1`,
          [fileId]
        );

      if (result.rowCount === 0) {
        result =
          await pool.query(
            `SELECT
               id,
               file_name,
               file_path,
               file_type,
               file_size_bytes,
               extracted_text,
               metadata
             FROM bank_policy_files
             WHERE id = $1`,
            [fileId]
          );
      }

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({
            error: "Source document not found"
          });
      }

      const fileRecord =
        result.rows[0];

      const meta =
        typeof fileRecord.metadata === "string"
          ? JSON.parse(
              fileRecord.metadata || "{}"
            )
          : fileRecord.metadata || {};

      if (!isPolicyFileActive(meta)) {
        return res
          .status(404)
          .json({
            error: "Source document not found"
          });
      }

      const isUnified =
        fileRecord.file_path &&
        fileRecord.file_path.startsWith(
          "unified://"
        );

      if (
        isUnified &&
        fileRecord.extracted_text
      ) {
        const mimeType =
          fileRecord.file_type &&
          !fileRecord.file_type.startsWith(
            "."
          )
            ? fileRecord.file_type
            : "text/plain";

        const safeName =
          (
            fileRecord.file_name ||
            "unified.txt"
          ).replace(/"/g, '\\"');

        res.setHeader(
          "Content-Type",
          mimeType
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeName}"`
        );

        res.setHeader(
          "Content-Length",
          Buffer.byteLength(
            fileRecord.extracted_text,
            "utf8"
          )
        );

        return res.send(
          fileRecord.extracted_text
        );
      }

      const filePath =
        fileRecord.file_path;

      if (!filePath) {
        return res
          .status(404)
          .json({
            error:
              "File path is missing for this document"
          });
      }

      let absolutePath =
        filePath;

      if (!path.isAbsolute(filePath)) {
        absolutePath =
          path.join(
            projectRoot,
            "public",
            filePath
          );
      }

      const normalizedPath =
        path.resolve(absolutePath);

      const normalizedRoot =
        path.resolve(projectRoot);

      const normalizedUploads =
        path.resolve(policyUploadDirectory);

      const isUnderRoot =
        normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(
          normalizedRoot + path.sep
        );

      const isUnderUploads =
        normalizedPath === normalizedUploads ||
        normalizedPath.startsWith(
          normalizedUploads + path.sep
        );

      if (
        !isUnderRoot &&
        !isUnderUploads
      ) {
        return res
          .status(403)
          .json({
            error:
              "Access to this file is restricted"
          });
      }

      try {
        await fs.promises.access(
          normalizedPath,
          fs.constants.R_OK
        );
      } catch {
        return res
          .status(404)
          .json({
            error: "File not found on server"
          });
      }

      const ext =
        path
          .extname(
            fileRecord.file_name ||
              filePath
          )
          .toLowerCase();

      let mimeType =
        fileRecord.file_type;

      if (
        !mimeType ||
        mimeType.startsWith(".")
      ) {
        mimeType =
          getMimeType(
            mimeType || ext
          ) ||
          "application/octet-stream";
      }

      const fileName =
        fileRecord.file_name ||
        "document";

      res.setHeader(
        "Content-Type",
        mimeType
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName.replace(
          /"/g,
          '\\"'
        )}"`
      );

      if (
        fileRecord.file_size_bytes
      ) {
        res.setHeader(
          "Content-Length",
          fileRecord.file_size_bytes
        );
      }

      const stream =
        fs.createReadStream(
          normalizedPath
        );

      stream.pipe(res);

      stream.on(
        "error",
        () => {
          if (!res.headersSent) {
            res
              .status(500)
              .json({
                error:
                  "Failed to read file"
              });
          }
        }
      );
    } catch (err) {
      console.error(
        "Policy file download error:",
        err
      );

      if (!res.headersSent) {
        res
          .status(500)
          .json({
            error:
              "Failed to download file"
          });
      }
    }
  }
);


// =====================================================
// PREVIEW POLICY FILE
// =====================================================

router.get(
  "/api/policy-files/:id/preview-html",
  requireLogin,
  async (req, res) => {
    try {
      const fileId =
        parseInt(req.params.id, 10);

      let result =
        await pool.query(
          `SELECT
             id,
             file_name,
             file_path,
             file_type,
             extracted_text
           FROM policy_attachments
           WHERE id = $1`,
          [fileId]
        );

      if (result.rowCount === 0) {
        result =
          await pool.query(
            `SELECT
               id,
               file_name,
               file_path,
               file_type,
               extracted_text,
               metadata
             FROM bank_policy_files
             WHERE id = $1`,
            [fileId]
          );
      }

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({
            error:
              "Source document not found"
          });
      }

      const fileRecord =
        result.rows[0];

      const meta =
        typeof fileRecord.metadata === "string"
          ? JSON.parse(
              fileRecord.metadata || "{}"
            )
          : fileRecord.metadata || {};

      if (!isPolicyFileActive(meta)) {
        return res
          .status(404)
          .json({
            error:
              "Source document not found"
          });
      }

      const isUnified =
        fileRecord.file_path &&
        fileRecord.file_path.startsWith(
          "unified://"
        );

      if (
        isUnified &&
        fileRecord.extracted_text
      ) {
        const previewHtml =
          `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;max-height:70vh;overflow:auto">${escapeHtml(
            fileRecord.extracted_text
          )}</pre>`;

        return res.send(
          previewHtml
        );
      }

      const filePath =
        fileRecord.file_path;

      if (!filePath) {
        return res
          .status(404)
          .json({
            error:
              "File path is missing for this document"
          });
      }

      let absolutePath =
        filePath;

      if (!path.isAbsolute(filePath)) {
        absolutePath =
          path.join(
            projectRoot,
            "public",
            filePath
          );
      }

      const normalizedPath =
        path.resolve(absolutePath);

      const normalizedRoot =
        path.resolve(projectRoot);

      const normalizedUploads =
        path.resolve(policyUploadDirectory);

      const isUnderRoot =
        normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(
          normalizedRoot + path.sep
        );

      const isUnderUploads =
        normalizedPath === normalizedUploads ||
        normalizedPath.startsWith(
          normalizedUploads + path.sep
        );

      if (
        !isUnderRoot &&
        !isUnderUploads
      ) {
        return res
          .status(403)
          .json({
            error:
              "Access to this file is restricted"
          });
      }

      try {
        await fs.promises.access(
          normalizedPath,
          fs.constants.R_OK
        );
      } catch {
        return res
          .status(404)
          .json({
            error:
              "File not found on server"
          });
      }

      const ext =
        path
          .extname(
            fileRecord.file_name ||
              filePath
          )
          .toLowerCase();

      let mimeType =
        fileRecord.file_type;

      if (
        !mimeType ||
        mimeType.startsWith(".")
      ) {
        mimeType =
          getMimeType(
            mimeType || ext
          ) ||
          "application/octet-stream";
      }

      const fileName =
        fileRecord.file_name ||
        "document";

      let previewHtml = "";

      if (
        mimeType.startsWith(
          "image/"
        )
      ) {
        const base64 =
          await fs.promises.readFile(
            normalizedPath,
            "base64"
          );

        previewHtml =
          `<img src="data:${mimeType};base64,${base64}" ` +
          `style="max-width:100%;max-height:70vh;border-radius:8px;border:1px solid #e2e8f0" ` +
          `alt="${escapeHtml(fileName)}" />`;
      } else if (
        mimeType === "application/pdf"
      ) {
        previewHtml =
          `<iframe src="/api/policy-files/${fileId}/view" ` +
          `style="width:100%;height:70vh;border:1px solid #e2e8f0;border-radius:8px" ` +
          `title="${escapeHtml(fileName)}"></iframe>`;
      } else if (
        mimeType === "text/plain" ||
        mimeType === "text/csv"
      ) {
        const text =
          await fs.promises.readFile(
            normalizedPath,
            "utf8"
          );

        if (ext === ".csv") {
          const lines =
            text
              .split(/\r?\n/)
              .filter(line =>
                line.trim()
              );

          let tableHtml =
            '<table style="width:100%;border-collapse:collapse;font-size:13px">';

          lines.forEach(
            (line, index) => {
              const cells =
                line
                  .split(",")
                  .map(cell =>
                    escapeHtml(
                      cell.trim()
                    )
                  );

              const tag =
                index === 0
                  ? "th"
                  : "td";

              tableHtml +=
                "<tr>" +
                cells
                  .map(
                    cell =>
                      `<${tag} style="border:1px solid #e2e8f0;padding:6px 8px;text-align:left;background:${
                        index === 0
                          ? "#f8fafc"
                          : "#fff"
                      }">${cell}</${tag}>`
                  )
                  .join("") +
                "</tr>";
            }
          );

          tableHtml +=
            "</table>";

          previewHtml =
            `<div style="overflow-x:auto">${tableHtml}</div>`;
        } else {
          previewHtml =
            `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;max-height:70vh;overflow:auto">${escapeHtml(
              text
            )}</pre>`;
        }
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        try {
          const result =
            await mammoth.convertToHtml({
              path: normalizedPath
            });

          previewHtml =
            `<div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;max-height:70vh;overflow:auto">${result.value}</div>`;
        } catch {
          previewHtml =
            createDownloadFallback(
              fileId,
              fileName,
              "📝",
              "Preview is not available for this Word document. Use Download to open in Word or compatible app."
            );
        }
      } else if (
        mimeType ===
          "application/msword" ||
        mimeType.startsWith(
          "application/vnd.ms-excel"
        ) ||
        mimeType.startsWith(
          "application/vnd.openxmlformats-officedocument.spreadsheetml"
        )
      ) {
        previewHtml =
          createDownloadFallback(
            fileId,
            fileName,
            "📊",
            "Preview is not available for this file format. Use Download to open in the appropriate application."
          );
      } else {
        previewHtml =
          createDownloadFallback(
            fileId,
            fileName,
            "📄",
            "Preview is not available for this file type."
          );
      }

      res.setHeader(
        "Content-Type",
        "text/html"
      );

      res.send(previewHtml);
    } catch (err) {
      console.error(
        "Policy file preview error:",
        err
      );

      res
        .status(500)
        .json({
          error:
            "Failed to load preview",
          details: err.message
        });
    }
  }
);


function createDownloadFallback(
  fileId,
  fileName,
  icon,
  message
) {
  return `
    <div style="padding:20px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">
        ${icon}
      </div>

      <div style="font-size:14px;font-weight:700;color:#29354b;margin-bottom:6px">
        ${escapeHtml(fileName)}
      </div>

      <div style="font-size:12px;color:#64748b;margin-bottom:12px">
        ${escapeHtml(message)}
      </div>

      <a
        href="/api/policy-files/${fileId}/view"
        download
        style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;color:#2563eb;text-decoration:none;border:1px solid #2563eb;background:#fff"
      >
        Download File
      </a>
    </div>
  `;
}


module.exports = router;
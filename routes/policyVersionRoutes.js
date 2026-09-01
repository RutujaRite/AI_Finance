const express = require("express");

const pool = require("../db");

const {
  getNextVersionLabel,
  convertBankDocumentsToText,
  saveUnifiedBankDocument
} = require("../services/policyImporter");

const {
  requireLogin
} = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// GET ALL BANKS
// =====================================================

router.get(
  "/api/banks",
  requireLogin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           id,
           name,
           code,
           is_active
         FROM banks
         ORDER BY name`
      );

      res.json(result.rows);
    } catch (err) {
      console.error(
        "Failed to load banks",
        err
      );

      res.status(500).json({
        error: "Failed to load banks"
      });
    }
  }
);


// =====================================================
// CONVERT BANK DOCUMENTS TO UNIFIED TEXT
// =====================================================

router.post(
  "/api/banks/:id/convert-to-text",
  requireLogin,
  async (req, res) => {
    try {
      const bankId =
        parseInt(req.params.id, 10);

      if (!Number.isInteger(bankId)) {
        return res.status(400).json({
          error: "Invalid bank id"
        });
      }

      const conversion =
        await convertBankDocumentsToText(
          pool,
          bankId
        );

      const savedId =
        await saveUnifiedBankDocument(
          pool,
          bankId,
          conversion.unifiedText,
          conversion.validation,
          conversion.stats
        );

      res.json({
        success: true,
        bankId: conversion.bankId,
        bankName: conversion.bankName,
        bankCode: conversion.bankCode,
        unifiedDocumentId: savedId,
        stats: conversion.stats,
        validation: conversion.validation,
        previewUrl:
          "/api/policy-files/" +
          savedId +
          "/preview-html",
        downloadUrl:
          "/api/policy-files/" +
          savedId +
          "/download"
      });
    } catch (err) {
      console.error(
        "Bank document conversion error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to convert bank documents",
        details: err.message
      });
    }
  }
);


// =====================================================
// GET POLICY VERSIONS
// =====================================================

router.get(
  "/api/policy-versions",
  requireLogin,
  async (req, res) => {
    try {
      const bankId =
        req.query.bank_id;

      const loanType =
        req.query.loan_type;

      let query = `
        SELECT
          pv.id,
          pv.bank_id,
          b.name AS bank_name,
          pv.loan_type,
          pv.version,
          pv.effective_from,
          pv.effective_to,
          pv.status
        FROM policy_versions pv
        JOIN banks b
          ON b.id = pv.bank_id
      `;

      const params = [];

      if (bankId) {
        query +=
          " WHERE pv.bank_id=$1";

        params.push(bankId);

        if (loanType) {
          query +=
            " AND pv.loan_type=$2";

          params.push(loanType);
        }
      }

      query +=
        " ORDER BY pv.bank_id, pv.loan_type, pv.id DESC";

      const result =
        await pool.query(
          query,
          params
        );

      res.json(result.rows);
    } catch (err) {
      console.error(
        "Failed to load policy versions",
        err
      );

      res.status(500).json({
        error:
          "Failed to load policy versions"
      });
    }
  }
);


// =====================================================
// GET NEXT POLICY VERSION
// =====================================================

router.get(
  "/api/policy-versions/next",
  requireLogin,
  async (req, res) => {
    try {
      const bankId =
        req.query.bank_id;

      const loanType =
        req.query.loan_type ||
        "Personal";

      if (!bankId) {
        return res.json({
          nextVersion: "V1"
        });
      }

      const client =
        await pool.connect();

      try {
        const nextVersion =
          await getNextVersionLabel(
            client,
            bankId,
            loanType
          );

        res.json({
          nextVersion
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(
        "Failed to get next version",
        err
      );

      res.status(500).json({
        error:
          "Failed to get next version"
      });
    }
  }
);


// =====================================================
// CREATE POLICY VERSION
// =====================================================

router.post(
  "/api/policy-versions",
  requireLogin,
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const bankId =
        body.bank_id;

      const loanType =
        body.loan_type ||
        "Personal";

      let version =
        String(
          body.version || ""
        ).trim();

      const status =
        body.status ||
        "draft";

      if (
        !bankId ||
        !loanType
      ) {
        return res
          .status(400)
          .json({
            error:
              "bank_id and loan_type are required"
          });
      }

      const client =
        await pool.connect();

      try {
        if (
          !version ||
          !/^V\d+$/i.test(version)
        ) {
          version =
            await getNextVersionLabel(
              client,
              bankId,
              loanType
            );
        }
      } finally {
        client.release();
      }

      // If this version becomes active,
      // archive any older active version
      // for the same bank and loan type.
      if (status === "active") {
        await pool.query(
          `UPDATE policy_versions
           SET status = 'archived'
           WHERE bank_id = $1
             AND loan_type = $2
             AND status = 'active'`,
          [
            bankId,
            loanType
          ]
        );
      }

      const result =
        await pool.query(
          `INSERT INTO policy_versions
             (
               bank_id,
               loan_type,
               version,
               status
             )
           VALUES
             ($1, $2, $3, $4)
           RETURNING
             id,
             bank_id,
             loan_type,
             version,
             status`,
          [
            bankId,
            loanType,
            version,
            status
          ]
        );

      res
        .status(201)
        .json(
          result.rows[0]
        );
    } catch (err) {
      console.error(
        "Failed to create policy version",
        err
      );

      res.status(500).json({
        error:
          "Failed to create policy version"
      });
    }
  }
);


module.exports = router;
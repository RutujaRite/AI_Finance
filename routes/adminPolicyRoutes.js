const express = require("express");
const path = require("path");

const pool = require("../db");
const { requireAdmin } = require("../middleware/authMiddleware");

const {
  importPolicyFiles,
  scanPolicyFiles,
  registerPolicyDocuments
} = require("../services/policyImporter");

const router = express.Router();


// Admin Import Page
router.get("/admin/import", requireAdmin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin-import.html")
  );
});


// Import Policies
router.post("/api/admin/policies/import", requireAdmin, async (req, res) => {
  try {
    const result = await importPolicyFiles(pool, {
      userId: req.session.userId
    });

    res.json({
      success: true,
      stats: result
    });
  } catch (err) {
    console.error("Import failed", err);

    res.status(500).json({
      error: err.message || "Import failed"
    });
  }
});


// Policy Files Status
router.get("/api/admin/policy-files", requireAdmin, async (req, res) => {
  try {
    const stats = await importPolicyFiles(pool, {
      userId: req.session.userId,
      dryRun: true
    });

    const reviewCount = await pool.query(
      "SELECT COUNT(*)::int AS c FROM policy_rules WHERE status = 'review'"
    );

    const activeCount = await pool.query(
      "SELECT COUNT(*)::int AS c FROM policy_rules WHERE status = 'active'"
    );

    res.json({
      totalFilesScanned: stats.totalFilesScanned || 0,
      banksDetected: stats.banksDetected || 0,
      versionsCreated: stats.versionsCreated || 0,
      rulesExtracted: stats.rulesExtracted || 0,
      attachmentsLinked: stats.attachmentsLinked || 0,
      rulesInReview: reviewCount.rows[0].c,
      activeRules: activeCount.rows[0].c,
      details: stats.details || []
    });
  } catch (err) {
    console.error("Policy files scan failed", err);

    res.status(500).json({
      error: err.message || "Scan failed"
    });
  }
});


// Scan Policy Files
router.get("/api/admin/policy-files/scan", requireAdmin, async (req, res) => {
  try {
    const report = await scanPolicyFiles();

    res.json(report);
  } catch (err) {
    console.error("Policy files analysis failed", err);

    res.status(500).json({
      error: err.message || "Analysis failed"
    });
  }
});


// Register Policy Documents
router.post(
  "/api/admin/policies/register-documents",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await registerPolicyDocuments(pool, {
        userId: req.session.userId
      });

      res.json({
        success: true,
        stats: result
      });
    } catch (err) {
      console.error("Policy document registration failed", err);

      res.status(500).json({
        error: err.message || "Registration failed"
      });
    }
  }
);
router.post("/admin/policies/save", requireAdmin, async (req, res) => {
  try {
    const {
      id, loan_type, policy_name, min_amount, max_amount,
      interest_rate, processing_fee_percent,
      tenure_months, description, is_active
    } = req.body;

    const type = String(loan_type || "").trim();
    const name = String(policy_name || "").trim();

    if (!type || !name) {
      return res.status(400).send("Loan type and policy name are required.");
    }

    const values = [
      type,
      name,
      Number(min_amount) || 0,
      Number(max_amount) || 0,
      Number(interest_rate) || 0,
      Number(processing_fee_percent) || 0,
      parseInt(tenure_months, 10) || 0,
      description || null,
      String(is_active).toLowerCase() === "true"
    ];

    if (id) {
      await pool.query(
        `UPDATE loan_policies
         SET loan_type=$1, policy_name=$2, min_amount=$3, max_amount=$4,
             interest_rate=$5, processing_fee_percent=$6, tenure_months=$7,
             description=$8, is_active=$9
         WHERE id=$10`,
        [...values, id]
      );
    } else {
      await pool.query(
        `INSERT INTO loan_policies
         (loan_type, policy_name, min_amount, max_amount,
          interest_rate, processing_fee_percent,
          tenure_months, description, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        values
      );
    }

    res.redirect("/admin/policies");
  } catch (err) {
    console.error("Admin policy save error", err);
    res.status(500).send("Server error");
  }
});

router.post("/admin/policies/delete", requireAdmin, async (req, res) => {
  try {
    if (req.body.id) {
      await pool.query(
        "DELETE FROM loan_policies WHERE id=$1",
        [req.body.id]
      );
    }

    res.redirect("/admin/policies");
  } catch (err) {
    console.error("Admin policy delete error", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
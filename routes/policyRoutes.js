const express = require("express");
const path = require("path");

const pool = require("../db");

const {
  importPolicyFiles
} = require("../services/policyImporter");

const {
  requireLogin
} = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// IMPORT LOCAL POLICY FILES
// =====================================================

router.post(
  "/api/policies/import-local",
  requireLogin,
  async (req, res) => {
    try {
      const stats =
        await importPolicyFiles(pool, {
          rootDir: path.join(
            __dirname,
            "..",
            "Policy-files"
          ),
          userId: req.session.userId
        });

      res.json({
        success: true,
        stats
      });

    } catch (err) {
      console.error(
        "Import policies error:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          err.message ||
          "Import failed"
      });
    }
  }
);


// =====================================================
// POLICY BANK SUMMARY
// =====================================================

router.get(
  "/api/policies/bank-summary",
  requireLogin,
  async (req, res) => {
    try {

      const result =
        await pool.query(`
          SELECT
            b.id AS bank_id,
            b.name AS bank_name,
            b.code AS bank_code,

            pr.loan_type,
            pr.employment_type,

            pr.min_cibil,
            pr.max_cibil,

            pr.min_salary,
            pr.max_salary,

            pr.min_age,
            pr.max_age,

            pr.min_loan_amount,
            pr.max_loan_amount,

            pr.location_rules,
            pr.status

          FROM policy_rules pr

          JOIN policy_versions pv
            ON pv.id = pr.policy_version_id

          JOIN banks b
            ON b.id = pv.bank_id

          WHERE pr.status
            IN ('active', 'review')

            AND pr.loan_type = 'Personal'

          ORDER BY
            b.name,
            pr.id
        `);


      const toNum =
        value =>
          value == null
            ? null
            : Number(value);


      const numMin =
        (current, value) => {

          if (current == null) {
            return toNum(value);
          }

          if (value == null) {
            return current;
          }

          return Math.min(
            Number(current),
            Number(value)
          );
        };


      const numMax =
        (current, value) => {

          if (current == null) {
            return toNum(value);
          }

          if (value == null) {
            return current;
          }

          return Math.max(
            Number(current),
            Number(value)
          );
        };


      const banks =
        new Map();


      for (const row of result.rows) {

        if (!banks.has(row.bank_id)) {

          banks.set(
            row.bank_id,
            {
              bank_id:
                row.bank_id,

              bank_name:
                row.bank_name,

              bank_code:
                row.bank_code,

              loanTypes:
                new Set(),

              employments:
                new Set(),

              min_cibil: null,
              max_cibil: null,

              min_salary: null,
              max_salary: null,

              min_age: null,
              max_age: null,

              min_loan_amount: null,
              max_loan_amount: null,

              locations:
                new Set(),

              pincodes:
                new Set(),

              hasActive: false,
              hasReview: false
            }
          );
        }


        const bank =
          banks.get(
            row.bank_id
          );


        if (row.loan_type) {
          bank.loanTypes.add(
            row.loan_type
          );
        }


        if (row.employment_type) {
          bank.employments.add(
            row.employment_type
          );
        }


        bank.min_cibil =
          numMin(
            bank.min_cibil,
            row.min_cibil
          );


        bank.max_cibil =
          numMax(
            bank.max_cibil,
            row.max_cibil
          );


        bank.min_salary =
          numMin(
            bank.min_salary,
            row.min_salary
          );


        bank.max_salary =
          numMax(
            bank.max_salary,
            row.max_salary
          );


        bank.min_age =
          numMin(
            bank.min_age,
            row.min_age
          );


        bank.max_age =
          numMax(
            bank.max_age,
            row.max_age
          );


        bank.min_loan_amount =
          numMin(
            bank.min_loan_amount,
            row.min_loan_amount
          );


        bank.max_loan_amount =
          numMax(
            bank.max_loan_amount,
            row.max_loan_amount
          );


        if (
          row.location_rules &&
          typeof row.location_rules ===
            "object"
        ) {

          if (
            Array.isArray(
              row.location_rules.locations
            )
          ) {
            row.location_rules.locations
              .forEach(location => {

                if (location) {
                  bank.locations.add(
                    location
                  );
                }

              });
          }


          if (
            Array.isArray(
              row.location_rules.pincodes
            )
          ) {
            row.location_rules.pincodes
              .forEach(pincode => {

                if (pincode) {
                  bank.pincodes.add(
                    pincode
                  );
                }

              });
          }
        }


        if (
          row.status ===
          "active"
        ) {
          bank.hasActive = true;
        }


        if (
          row.status ===
          "review"
        ) {
          bank.hasReview = true;
        }
      }


      const summaries =
        Array.from(
          banks.values()
        ).map(bank => ({

          bank_id:
            bank.bank_id,

          bank_name:
            bank.bank_name,

          bank_code:
            bank.bank_code,

          loan_type:
            bank.loanTypes.size
              ? Array.from(
                  bank.loanTypes
                ).join(", ")
              : null,

          employment_type:
            "Salaried",

          min_cibil:
            bank.min_cibil,

          max_cibil:
            bank.max_cibil,

          min_salary:
            bank.min_salary,

          max_salary:
            bank.max_salary,

          min_age:
            bank.min_age,

          max_age:
            bank.max_age,

          min_loan_amount:
            bank.min_loan_amount,

          max_loan_amount:
            bank.max_loan_amount,

          location_rules: {
            locations:
              Array.from(
                bank.locations
              ),

            pincodes:
              Array.from(
                bank.pincodes
              )
          },

          policy_status:
            bank.hasActive
              ? "Active"
              : bank.hasReview
                ? "Review"
                : "Not found"
        }));


      res.json(
        summaries
      );

    } catch (err) {

      console.error(
        "Failed to load policy bank summary",
        err
      );

      res.status(500).json({
        error:
          "Failed to load policy summary"
      });
    }
  }
);


// =====================================================
// POLICY IMPORT STATUS
//
// Keep this BEFORE /api/policies/:id
// =====================================================

router.get(
  "/api/policies/import-status",
  requireLogin,
  async (req, res) => {
    try {

      const countsRes =
        await pool.query(`
          SELECT
            status,
            COUNT(*)::int AS count
          FROM policy_rules
          GROUP BY status
        `);


      const bankCountRes =
        await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM banks`
        );


      const versionCountRes =
        await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM policy_versions`
        );


      const sourceCountRes =
        await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM policy_sources`
        );


      const statusCounts = {
        active: 0,
        review: 0,
        draft: 0
      };


      for (
        const row
        of countsRes.rows
      ) {

        if (
          statusCounts[row.status]
          !== undefined
        ) {
          statusCounts[row.status] =
            row.count;
        }

      }


      res.json({

        banksCount:
          bankCountRes
            .rows[0]
            .count,

        versionsCount:
          versionCountRes
            .rows[0]
            .count,

        sourcesCount:
          sourceCountRes
            .rows[0]
            .count,

        rulesCount:
          statusCounts
      });

    } catch (err) {

      console.error(
        "Import status error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to load import status"
      });
    }
  }
);


// =====================================================
// GET POLICY LIST
// =====================================================

router.get(
  "/api/policies",
  requireLogin,
  async (req, res) => {
    try {

      const statusFilter =
        req.query.status
          ? String(
              req.query.status
            )
              .trim()
              .toLowerCase()
          : null;


      const bankId =
        req.query.bank_id
          ? parseInt(
              req.query.bank_id,
              10
            )
          : null;


      if (
        req.query.bank_id &&
        !Number.isInteger(bankId)
      ) {

        console.warn(
          "Invalid bank_id query param:",
          req.query.bank_id
        );

        return res
          .status(400)
          .json({
            error:
              "Invalid bank_id"
          });
      }


      const conditions = [
        "pr.loan_type = 'Personal'"
      ];

      const params = [];


      if (statusFilter) {

        params.push(
          statusFilter
        );

        conditions.push(
          `pr.status = $${params.length}`
        );
      }


      if (bankId) {

        params.push(
          bankId
        );

        conditions.push(
          `pv.bank_id = $${params.length}`
        );
      }


      const where =
        "WHERE " +
        conditions.join(" AND ");


      const result =
        await pool.query(
          `
          SELECT
            pr.id,

            b.id AS bank_id,
            b.name AS bank_name,
            b.code AS bank_code,

            pv.id AS policy_version_id,
            pv.version AS policy_version,
            pv.status AS version_status,

            pr.loan_type,
            pr.category,

            pr.min_cibil,
            pr.max_cibil,

            pr.min_salary,
            pr.max_salary,

            pr.employment_type,

            pr.min_age,
            pr.max_age,

            pr.min_loan_amount,
            pr.max_loan_amount,

            pr.min_tenure_months,
            pr.max_tenure_months,

            pr.foir_percent,
            pr.roi,

            pr.processing_fee_percent,
            pr.processing_fee_flat,

            pr.company_rules,
            pr.location_rules,
            pr.other_rules,

            pr.status,

            pa.id AS attachment_id,
            pa.file_name
              AS attachment_file_name,
            pa.file_path
              AS attachment_file_path,
            pa.extracted_text
              AS attachment_extracted_text

          FROM policy_rules pr

          JOIN policy_versions pv
            ON pv.id =
               pr.policy_version_id

          JOIN banks b
            ON b.id =
               pv.bank_id

          LEFT JOIN policy_attachments pa
            ON pa.policy_rule_id =
               pr.id

          ${where}

          ORDER BY
            b.name,
            pv.loan_type,
            pv.id DESC,
            pr.id DESC
          `,
          params
        );


      const bankIds =
        [
          ...new Set(
            result.rows
              .map(row =>
                row.bank_id
              )
              .filter(Boolean)
          )
        ];


      let inactiveFiles =
        new Set();


      if (
        bankIds.length > 0
      ) {

        const inactiveRes =
          await pool.query(
            `
            SELECT file_name
            FROM bank_policy_files
            WHERE bank_id =
              ANY($1::int[])
              AND
              (metadata->>'is_active')::boolean
                = false
            `,
            [bankIds]
          );


        inactiveFiles =
          new Set(
            inactiveRes.rows.map(
              row =>
                row.file_name
            )
          );
      }


      const filtered =
        result.rows.map(row => {

          if (
            row.attachment_file_name &&
            inactiveFiles.has(
              row.attachment_file_name
            )
          ) {

            const clean = {
              ...row
            };

            clean.attachment_id =
              null;

            clean.attachment_file_name =
              null;

            clean.attachment_file_path =
              null;

            clean.attachment_extracted_text =
              null;

            return clean;
          }

          return row;
        });


      res.json(
        filtered
      );

    } catch (err) {

      console.error(
        "Failed to load policies",
        err
      );

      res.status(500).json({
        error:
          "Failed to load policies"
      });
    }
  }
);


// =====================================================
// GET ONE POLICY
//
// Keep this AFTER the fixed routes above.
// =====================================================

router.get(
  "/api/policies/:id",
  requireLogin,
  async (req, res) => {
    try {

      const ruleId =
        parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(ruleId)
      ) {

        console.warn(
          "Invalid policy rule ID:",
          req.params.id
        );

        return res
          .status(400)
          .json({
            error:
              "Invalid policy rule ID"
          });
      }


      const result =
        await pool.query(
          `
          SELECT
            pr.id,

            b.id AS bank_id,
            b.name AS bank_name,
            b.code AS bank_code,

            pv.id AS policy_version_id,
            pv.version AS policy_version,
            pv.status AS version_status,

            pr.loan_type,
            pr.category,

            pr.min_cibil,
            pr.max_cibil,

            pr.min_salary,
            pr.max_salary,

            pr.employment_type,

            pr.min_age,
            pr.max_age,

            pr.min_loan_amount,
            pr.max_loan_amount,

            pr.min_tenure_months,
            pr.max_tenure_months,

            pr.foir_percent,
            pr.roi,

            pr.processing_fee_percent,
            pr.processing_fee_flat,

            pr.company_rules,
            pr.location_rules,
            pr.other_rules,

            pr.status,

            pa.id AS attachment_id,

            pa.file_name
              AS attachment_file_name,

            pa.file_path
              AS attachment_file_path,

            pa.file_type
              AS attachment_file_type,

            pa.extracted_text
              AS attachment_extracted_text

          FROM policy_rules pr

          JOIN policy_versions pv
            ON pv.id =
               pr.policy_version_id

          JOIN banks b
            ON b.id =
               pv.bank_id

          LEFT JOIN policy_attachments pa
            ON pa.policy_rule_id =
               pr.id

          WHERE pr.id = $1

          ORDER BY pa.id
          `,
          [ruleId]
        );


      if (
        result.rowCount === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              "Policy rule not found"
          });
      }


      const rows =
        result.rows;


      let inactiveFiles =
        new Set();


      const bankId =
        rows[0].bank_id;


      if (bankId) {

        const inactiveRes =
          await pool.query(
            `
            SELECT file_name
            FROM bank_policy_files
            WHERE bank_id = $1
              AND
              (metadata->>'is_active')::boolean
                = false
            `,
            [bankId]
          );


        inactiveFiles =
          new Set(
            inactiveRes.rows.map(
              row =>
                row.file_name
            )
          );
      }


      const rule = {

        id:
          rows[0].id,

        bank_id:
          rows[0].bank_id,

        bank_name:
          rows[0].bank_name,

        bank_code:
          rows[0].bank_code,

        policy_version_id:
          rows[0].policy_version_id,

        policy_version:
          rows[0].policy_version,

        version_status:
          rows[0].version_status,

        loan_type:
          rows[0].loan_type,

        category:
          rows[0].category,

        min_cibil:
          rows[0].min_cibil,

        max_cibil:
          rows[0].max_cibil,

        min_salary:
          rows[0].min_salary,

        max_salary:
          rows[0].max_salary,

        employment_type:
          rows[0].employment_type,

        min_age:
          rows[0].min_age,

        max_age:
          rows[0].max_age,

        min_loan_amount:
          rows[0].min_loan_amount,

        max_loan_amount:
          rows[0].max_loan_amount,

        min_tenure_months:
          rows[0].min_tenure_months,

        max_tenure_months:
          rows[0].max_tenure_months,

        foir_percent:
          rows[0].foir_percent,

        roi:
          rows[0].roi,

        processing_fee_percent:
          rows[0]
            .processing_fee_percent,

        processing_fee_flat:
          rows[0]
            .processing_fee_flat,

        company_rules:
          rows[0].company_rules,

        location_rules:
          rows[0].location_rules,

        other_rules:
          rows[0].other_rules,

        status:
          rows[0].status,

        attachments: []
      };


      for (const row of rows) {

        if (
          row.attachment_id &&
          !inactiveFiles.has(
            row.attachment_file_name
          )
        ) {

          const existing =
            rule.attachments.find(
              attachment =>
                attachment &&
                attachment.id ===
                  row.attachment_id
            );


          if (!existing) {

            rule.attachments.push({

              id:
                row.attachment_id,

              file_name:
                row.attachment_file_name,

              file_path:
                row.attachment_file_path,

              file_type:
                row.attachment_file_type ||
                "application/octet-stream",

              extracted_text:
                row.attachment_extracted_text
            });
          }
        }
      }


      res.json(rule);

    } catch (err) {

      console.error(
        "Failed to load policy rule",
        err
      );

      res.status(500).json({
        error:
          "Failed to load policy rule"
      });
    }
  }
);


// =====================================================
// DELETE POLICY
// =====================================================

router.delete(
  "/api/policies/:id",
  requireLogin,
  async (req, res) => {
    try {

      const id =
        req.params.id;


      const ruleRes =
        await pool.query(
          `SELECT id
           FROM policy_rules
           WHERE id = $1`,
          [id]
        );


      if (
        ruleRes.rowCount === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              "Policy not found"
          });
      }


      await pool.query(
        `DELETE FROM policy_attachments
         WHERE policy_rule_id = $1`,
        [id]
      );


      await pool.query(
        `DELETE FROM policy_rules
         WHERE id = $1`,
        [id]
      );


      res.json({
        success: true
      });

    } catch (err) {

      console.error(
        "Failed to delete policy",
        err
      );

      res.status(500).json({
        error:
          "Failed to delete policy"
      });
    }
  }
);


module.exports = router;
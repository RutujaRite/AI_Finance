const express = require("express");

const pool = require("../db");

const {
  getNextVersionLabel
} = require("../services/policyImporter");

const {
  requireLogin
} = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// CREATE POLICY
// =====================================================

router.post(
  "/api/policies",
  requireLogin,
  async (req, res) => {
    try {
      const body = req.body || {};

      const bankId = body.bank_id;
      const loanType = "Personal";
      const policyVersionId =
        body.policy_version_id;

      if (!bankId || !loanType) {
        return res
          .status(400)
          .json({
            error:
              "bank_id and loan_type are required"
          });
      }

      const parsedBankId =
        parseInt(bankId, 10);

      if (
        !Number.isInteger(parsedBankId)
      ) {
        console.warn(
          "Invalid bank_id in POST /api/policies:",
          bankId
        );

        return res
          .status(400)
          .json({
            error: "Invalid bank_id"
          });
      }

      let versionId =
        policyVersionId;

      const ruleStatus =
        body.attachment_id
          ? "review"
          : body.status || "draft";


      // -------------------------------------------------
      // Resolve or create policy version
      // -------------------------------------------------

      if (!versionId) {

        if (
          ruleStatus === "active"
        ) {
          const existingVersion =
            await pool.query(
              `
              SELECT id
              FROM policy_versions
              WHERE bank_id = $1
                AND loan_type = $2
                AND status = $3
              `,
              [
                parsedBankId,
                loanType,
                "active"
              ]
            );

          if (
            existingVersion.rowCount >
            0
          ) {
            versionId =
              existingVersion
                .rows[0]
                .id;
          }
        }


        if (!versionId) {

          const client =
            await pool.connect();

          let nextVer = "V1";

          try {
            nextVer =
              await getNextVersionLabel(
                client,
                parsedBankId,
                loanType
              );
          } finally {
            client.release();
          }


          if (
            ruleStatus ===
            "active"
          ) {
            await pool.query(
              `
              UPDATE policy_versions
              SET status = 'archived'
              WHERE bank_id = $1
                AND loan_type = $2
                AND status = 'active'
              `,
              [
                parsedBankId,
                loanType
              ]
            );
          }


          const newVer =
            await pool.query(
              `
              INSERT INTO policy_versions
              (
                bank_id,
                loan_type,
                version,
                status
              )
              VALUES
              ($1, $2, $3, $4)
              RETURNING id
              `,
              [
                parsedBankId,
                loanType,
                nextVer,
                ruleStatus === "active"
                  ? "active"
                  : "draft"
              ]
            );

          versionId =
            newVer.rows[0].id;
        }

      } else {

        const verCheck =
          await pool.query(
            `
            SELECT id, status
            FROM policy_versions
            WHERE id = $1
            `,
            [versionId]
          );

        if (
          verCheck.rowCount === 0
        ) {
          return res
            .status(400)
            .json({
              error:
                "Selected policy version not found"
            });
        }
      }


      // -------------------------------------------------
      // Create policy rule
      // -------------------------------------------------

      const result =
        await pool.query(
          `
          INSERT INTO policy_rules
          (
            policy_version_id,
            loan_type,

            min_cibil,
            max_cibil,

            min_salary,
            max_salary,

            employment_type,

            min_age,
            max_age,

            min_loan_amount,
            max_loan_amount,

            min_tenure_months,
            max_tenure_months,

            foir_percent,
            roi,

            processing_fee_percent,
            processing_fee_flat,

            company_rules,
            location_rules,
            other_rules,

            status
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,
            $19,$20,$21
          )
          RETURNING *
          `,
          [
            versionId,

            loanType,

            body.min_cibil || null,
            body.max_cibil || null,

            body.min_salary || null,
            body.max_salary || null,

            "Salaried",

            body.min_age || null,
            body.max_age || null,

            body.min_loan_amount ||
              null,

            body.max_loan_amount ||
              null,

            body.min_tenure_months ||
              null,

            body.max_tenure_months ||
              null,

            body.foir_percent ||
              null,

            body.roi || null,

            body.processing_fee_percent ||
              null,

            body.processing_fee_flat ||
              null,

            body.company_rules
              ? typeof body.company_rules ===
                "string"
                ? body.company_rules
                : JSON.stringify(
                    body.company_rules
                  )
              : null,

            body.location_rules
              ? typeof body.location_rules ===
                "string"
                ? body.location_rules
                : JSON.stringify(
                    body.location_rules
                  )
              : null,

            body.other_rules
              ? typeof body.other_rules ===
                "string"
                ? body.other_rules
                : JSON.stringify(
                    body.other_rules
                  )
              : null,

            ruleStatus
          ]
        );


      // -------------------------------------------------
      // Link uploaded attachment
      // -------------------------------------------------

      if (body.attachment_id) {

        await pool.query(
          `
          UPDATE policy_attachments
          SET policy_rule_id = $1
          WHERE id = $2
          `,
          [
            result.rows[0].id,
            body.attachment_id
          ]
        );
      }


      res
        .status(201)
        .json(
          result.rows[0]
        );

    } catch (err) {

      console.error(
        "Failed to create policy",
        err
      );

      res
        .status(500)
        .json({
          error:
            "Failed to create policy"
        });
    }
  }
);


// =====================================================
// UPDATE POLICY
// =====================================================

router.put(
  "/api/policies/:id",
  requireLogin,
  async (req, res) => {
    try {

      const id =
        req.params.id;

      const body =
        req.body || {};


      const existingRule =
        await pool.query(
          `
          SELECT *
          FROM policy_rules
          WHERE id = $1
          `,
          [id]
        );


      if (
        existingRule.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Policy not found"
          });
      }


      const oldRule =
        existingRule.rows[0];

      const newStatus =
        body.status ||
        oldRule.status;


      // =================================================
      // UPDATE EXISTING VERSION WHEN ACTIVATING
      // =================================================

      if (
        newStatus ===
        "active"
      ) {

        const version =
          await pool.query(
            `
            SELECT *
            FROM policy_versions
            WHERE id = $1
            `,
            [
              oldRule.policy_version_id
            ]
          );


        const bankId =
          body.bank_id ||
          version.rows[0].bank_id;

        const loanType =
          "Personal";


        // Archive any other active version
        await pool.query(
          `
          UPDATE policy_versions
          SET status = $1
          WHERE bank_id = $2
            AND loan_type = $3
            AND status = $4
            AND id != $5
          `,
          [
            "archived",
            bankId,
            loanType,
            "active",
            oldRule.policy_version_id
          ]
        );


        // Activate current version
        await pool.query(
          `
          UPDATE policy_versions
          SET status = $1
          WHERE id = $2
          `,
          [
            "active",
            oldRule.policy_version_id
          ]
        );


        const result =
          await pool.query(
            `
            UPDATE policy_rules
            SET
              policy_version_id = $1,
              loan_type = $2,

              min_cibil = $3,
              max_cibil = $4,

              min_salary = $5,
              max_salary = $6,

              employment_type = $7,

              min_age = $8,
              max_age = $9,

              min_loan_amount = $10,
              max_loan_amount = $11,

              min_tenure_months = $12,
              max_tenure_months = $13,

              foir_percent = $14,
              roi = $15,

              processing_fee_percent = $16,
              processing_fee_flat = $17,

              company_rules = $18,
              location_rules = $19,
              other_rules = $20,

              status = $21

            WHERE id = $22

            RETURNING *
            `,
            [
              body.policy_version_id ||
                oldRule.policy_version_id,

              "Personal",

              body.min_cibil || null,
              body.max_cibil || null,

              body.min_salary || null,
              body.max_salary || null,

              "Salaried",

              body.min_age || null,
              body.max_age || null,

              body.min_loan_amount ||
                null,

              body.max_loan_amount ||
                null,

              body.min_tenure_months ||
                null,

              body.max_tenure_months ||
                null,

              body.foir_percent ||
                null,

              body.roi || null,

              body.processing_fee_percent ||
                null,

              body.processing_fee_flat ||
                null,

              body.company_rules
                ? typeof body.company_rules ===
                  "string"
                  ? body.company_rules
                  : JSON.stringify(
                      body.company_rules
                    )
                : oldRule.company_rules,

              body.location_rules
                ? typeof body.location_rules ===
                  "string"
                  ? body.location_rules
                  : JSON.stringify(
                      body.location_rules
                    )
                : oldRule.location_rules,

              body.other_rules
                ? typeof body.other_rules ===
                  "string"
                  ? body.other_rules
                  : JSON.stringify(
                      body.other_rules
                    )
                : oldRule.other_rules,

              newStatus,

              id
            ]
          );


        return res.json(
          result.rows[0]
        );
      }


      // =================================================
      // NON-ACTIVE UPDATE CREATES NEW VERSION
      // =================================================

      const version =
        await pool.query(
          `
          SELECT *
          FROM policy_versions
          WHERE id = $1
          `,
          [
            oldRule.policy_version_id
          ]
        );


      const bankId =
        body.bank_id ||
        version.rows[0].bank_id;

      const loanType =
        "Personal";


      const nextVersionLabel =
        await getNextVersionLabel(
          pool,
          bankId,
          loanType
        );


      const newVersion =
        await pool.query(
          `
          INSERT INTO policy_versions
          (
            bank_id,
            loan_type,
            version,
            status
          )
          VALUES
          ($1,$2,$3,$4)
          RETURNING id
          `,
          [
            bankId,
            loanType,
            nextVersionLabel,
            newStatus
          ]
        );


      const result =
        await pool.query(
          `
          INSERT INTO policy_rules
          (
            policy_version_id,
            loan_type,

            min_cibil,
            max_cibil,

            min_salary,
            max_salary,

            employment_type,

            min_age,
            max_age,

            min_loan_amount,
            max_loan_amount,

            min_tenure_months,
            max_tenure_months,

            foir_percent,
            roi,

            processing_fee_percent,
            processing_fee_flat,

            company_rules,
            location_rules,
            other_rules,

            status
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,
            $19,$20,$21
          )

          RETURNING *
          `,
          [
            newVersion.rows[0].id,

            "Personal",

            body.min_cibil ??
              oldRule.min_cibil,

            body.max_cibil ??
              oldRule.max_cibil,

            body.min_salary ??
              oldRule.min_salary,

            body.max_salary ??
              oldRule.max_salary,

            "Salaried",

            body.min_age ??
              oldRule.min_age,

            body.max_age ??
              oldRule.max_age,

            body.min_loan_amount ??
              oldRule.min_loan_amount,

            body.max_loan_amount ??
              oldRule.max_loan_amount,

            body.min_tenure_months ??
              oldRule.min_tenure_months,

            body.max_tenure_months ??
              oldRule.max_tenure_months,

            body.foir_percent ??
              oldRule.foir_percent,

            body.roi ??
              oldRule.roi,

            body.processing_fee_percent ??
              oldRule.processing_fee_percent,

            body.processing_fee_flat ??
              oldRule.processing_fee_flat,

            body.company_rules
              ? typeof body.company_rules ===
                "string"
                ? body.company_rules
                : JSON.stringify(
                    body.company_rules
                  )
              : oldRule.company_rules,

            body.location_rules
              ? typeof body.location_rules ===
                "string"
                ? body.location_rules
                : JSON.stringify(
                    body.location_rules
                  )
              : oldRule.location_rules,

            body.other_rules
              ? typeof body.other_rules ===
                "string"
                ? body.other_rules
                : JSON.stringify(
                    body.other_rules
                  )
              : oldRule.other_rules,

            newStatus
          ]
        );


      res.json(
        result.rows[0]
      );

    } catch (err) {

      console.error(
        "Failed to update policy",
        err
      );

      res
        .status(500)
        .json({
          error:
            "Failed to update policy"
        });
    }
  }
);


// =====================================================
// ACTIVATE POLICY
// =====================================================

router.post(
  "/api/policies/:id/activate",
  requireLogin,
  async (req, res) => {
    try {

      const id =
        req.params.id;


      const ruleRes =
        await pool.query(
          `
          SELECT *
          FROM policy_rules
          WHERE id = $1
          `,
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


      const rule =
        ruleRes.rows[0];


      const versionRes =
        await pool.query(
          `
          SELECT *
          FROM policy_versions
          WHERE id = $1
          `,
          [
            rule.policy_version_id
          ]
        );


      const bankId =
        versionRes.rows[0].bank_id;

      const loanType =
        versionRes.rows[0]
          .loan_type ||
        rule.loan_type;


      // Archive previous active versions
      await pool.query(
        `
        UPDATE policy_versions
        SET status = $1
        WHERE bank_id = $2
          AND loan_type = $3
          AND status = $4
          AND id != $5
        `,
        [
          "archived",
          bankId,
          loanType,
          "active",
          rule.policy_version_id
        ]
      );


      // Activate version
      await pool.query(
        `
        UPDATE policy_versions
        SET status = $1
        WHERE id = $2
        `,
        [
          "active",
          rule.policy_version_id
        ]
      );


      // Activate rules
      await pool.query(
        `
        UPDATE policy_rules
        SET status = $1
        WHERE policy_version_id = $2
        `,
        [
          "active",
          rule.policy_version_id
        ]
      );


      const updated =
        await pool.query(
          `
          SELECT *
          FROM policy_rules
          WHERE id = $1
          `,
          [id]
        );


      res.json(
        updated.rows[0]
      );

    } catch (err) {

      console.error(
        "Failed to activate policy",
        err
      );

      res
        .status(500)
        .json({
          error:
            "Failed to activate policy"
        });
    }
  }
);


// =====================================================
// ARCHIVE POLICY
// =====================================================

router.post(
  "/api/policies/:id/archive",
  requireLogin,
  async (req, res) => {
    try {

      const id =
        req.params.id;


      const ruleRes =
        await pool.query(
          `
          SELECT *
          FROM policy_rules
          WHERE id = $1
          `,
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


      const rule =
        ruleRes.rows[0];


      await pool.query(
        `
        UPDATE policy_versions
        SET status = $1
        WHERE id = $2
        `,
        [
          "archived",
          rule.policy_version_id
        ]
      );


      await pool.query(
        `
        UPDATE policy_rules
        SET status = $1
        WHERE policy_version_id = $2
        `,
        [
          "archived",
          rule.policy_version_id
        ]
      );


      const updated =
        await pool.query(
          `
          SELECT *
          FROM policy_rules
          WHERE id = $1
          `,
          [id]
        );


      res.json(
        updated.rows[0]
      );

    } catch (err) {

      console.error(
        "Failed to archive policy",
        err
      );

      res
        .status(500)
        .json({
          error:
            "Failed to archive policy"
        });
    }
  }
);


module.exports = router;
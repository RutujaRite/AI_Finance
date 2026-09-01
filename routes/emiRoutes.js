const express = require("express");

const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/emi/save", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  console.log("POST /emi/save userId=", userId);

  try {
    const {
      loanType,
      principal,
      annualRate,
      feePercent,
      termMonths,
      monthsOrYears,
      emi,
      totalInterest,
      totalPayment,
      processingFeeAmount,
      schedule
    } = req.body;

    console.log("emi save payload", {
      loanType,
      principal,
      annualRate,
      feePercent,
      termMonths
    });

    await pool.query(
      `INSERT INTO emi_calculations (
        user_id,
        loan_type,
        loan_amount,
        annual_rate,
        processing_fee_percent,
        term_months,
        months_or_years,
        monthly_emi,
        total_interest,
        total_payment,
        processing_fee_amount,
        schedule
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )`,
      [
        userId,
        loanType || null,
        principal || 0,
        annualRate || 0,
        feePercent || 0,
        termMonths || 0,
        monthsOrYears || null,
        emi || 0,
        totalInterest || 0,
        totalPayment || 0,
        processingFeeAmount || 0,
        schedule ? JSON.stringify(schedule) : null
      ]
    );

    return res.json({
      success: true
    });

  } catch (err) {
    console.error("EMI save error", err);

    return res.json({
      success: false,
      error: "Save failed"
    });
  }
});

module.exports = router;
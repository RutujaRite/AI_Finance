import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport } from "../lib/dynamicEligibilityEngine";

async function runTest() {
  const profiles = [
    {
      id: "Profile 1 (Super Prime -> Qualifies for All/Most banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Tata Consultancy Services",
        monthlyIncome: 150000,
        cibil: 810,
        age: 28,
        loanAmount: 500000,
        tenureMonths: 36,
        existingEmi: 0,
      },
    },
    {
      id: "Profile 2 (Mid-Earning -> Qualifies for 21 banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Infosys Limited",
        monthlyIncome: 45000,
        cibil: 745,
        age: 27,
        loanAmount: 300000,
        tenureMonths: 36,
        existingEmi: 0,
      },
    },
    {
      id: "Profile 3 (Salary ₹22k, Age 26, CIBIL 710 -> Qualifies for exactly 2 banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Local Retail Store",
        monthlyIncome: 22000,
        cibil: 710,
        age: 26,
        loanAmount: 100000,
        tenureMonths: 24,
        existingEmi: 0,
      },
    },
    {
      id: "Profile 4 (Salary ₹25k, Age 26, CIBIL 690 -> Qualifies for exactly 2 banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Standard Trading Corp",
        monthlyIncome: 25000,
        cibil: 690,
        age: 26,
        loanAmount: 200000,
        tenureMonths: 36,
        existingEmi: 0,
      },
    },
    {
      id: "Profile 5 (Young Applicant Age 19 -> Qualifies for exactly 1 bank: Fibe)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Tech Solutions",
        monthlyIncome: 25000,
        cibil: 710,
        age: 19,
        loanAmount: 50000,
        tenureMonths: 12,
        existingEmi: 0,
      },
    },
    {
      id: "Profile 6 (Over-leveraged FOIR > 100% -> Qualifies for 0 banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Wipro Limited",
        monthlyIncome: 40000,
        cibil: 750,
        age: 30,
        loanAmount: 500000,
        tenureMonths: 36,
        existingEmi: 28000,
      },
    },
    {
      id: "Profile 7 (Low CIBIL 620 -> Qualifies for 0 banks)",
      applicant: {
        loanType: "Personal Loan",
        companyName: "Flipkart",
        monthlyIncome: 50000,
        cibil: 620,
        age: 29,
        loanAmount: 200000,
        tenureMonths: 24,
        existingEmi: 0,
      },
    },
  ];

  console.log("================================================================================");
  console.log("🧪 TESTING DIVERSE USER PROFILES (All Banks, 2-3 Banks, 1 Bank, 0 Banks)");
  console.log("================================================================================\n");

  const summaryResults: Array<{ id: string; eligibleCount: number; bankNames: string[] }> = [];

  for (const p of profiles) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📌 TESTING: ${p.id}`);
    console.log(`Input: Company="${p.applicant.companyName}", Salary=₹${p.applicant.monthlyIncome}, CIBIL=${p.applicant.cibil}, Age=${p.applicant.age}, Loan=₹${p.applicant.loanAmount}, Tenure=${p.applicant.tenureMonths}m, EMI=₹${p.applicant.existingEmi}`);

    const result = await evaluateApplicantAgainstAllBanks(p.applicant, p.applicant.loanType);

    const eligibleNames = result.eligibleBanks.map(b => b.bankName);
    summaryResults.push({ id: p.id, eligibleCount: result.eligibleBanks.length, bankNames: eligibleNames });

    console.log(`Result: Evaluated=${result.evaluations.length} | Eligible=${result.eligibleBanks.length} | Ineligible=${result.ineligibleBanks.length}`);
    if (result.recommendedBank) {
      console.log(`Recommendation: ${result.recommendedBank.bankName} (ROI: ${result.recommendedBank.roi}%, EMI: ₹${result.recommendedBank.monthlyEmi})`);
    } else {
      console.log(`Recommendation: None (No banks eligible)`);
    }

    if (result.eligibleBanks.length > 0) {
      console.log(`Eligible Banks: ${eligibleNames.join(", ")}`);
    } else {
      console.log(`Eligible Banks: None`);
    }

    // Verify report formatting
    const formatted = formatDynamicEligibilityReport(p.applicant, result);
    const hasApproved = formatted.includes("Approved Partner Bank");
    const hasNoEligibleAlert = formatted.includes("No Partner Banks Currently Eligible");
    const hasPolicyHurdles = formatted.includes("Key Policy Constraints Identified");
    console.log(`Report verification: hasApprovedTable=${hasApproved} | hasNoEligibleAlert=${hasNoEligibleAlert} | hasPolicyHurdles=${hasPolicyHurdles}`);
    console.log(`\nSample Report Preview (first 10 lines):`);
    console.log(formatted.split("\n").slice(0, 10).join("\n"));
  }

  console.log("\n================================================================================");
  console.log("📊 SUMMARY MATRIX OF DIVERSE ELIGIBILITY RESULTS");
  console.log("================================================================================");
  for (const r of summaryResults) {
    console.log(`• ${r.id}: ${r.eligibleCount} Eligible Banks ${r.eligibleCount > 0 ? `(${r.bankNames.slice(0, 3).join(", ")}${r.eligibleCount > 3 ? "..." : ""})` : "[Clean No-Eligibility Message]"}`);
  }
  console.log("================================================================================\n");
}

runTest().catch(console.error);

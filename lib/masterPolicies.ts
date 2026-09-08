import fs from "fs";
import path from "path";
import pool from "./db";

export interface BankMasterPolicy {
  id: number;
  bank_id: number;
  file_id: number;
  bank_name: string;
  bank_code: string;
  file_name: string;
  loan_type: string;
  supported_loan_types: string[];
  status: "active" | "review" | "draft";
}

const BANK_DEFINITIONS: Array<{
  id: number;
  bank_id: number;
  file_id: number;
  bank_name: string;
  bank_code: string;
  file_pattern: RegExp;
  default_file_name: string;
  loan_type: string;
  supported_loan_types: string[];
}> = [
  {
    id: 2,
    bank_id: 2,
    file_id: 636,
    bank_name: "Aditya Birla Finance",
    bank_code: "ABFL",
    file_pattern: /abfl/i,
    default_file_name: "ABFL_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan", "Home Loan", "Auto Loan"],
  },
  {
    id: 3,
    bank_id: 3,
    file_id: 441,
    bank_name: "Axis Bank",
    bank_code: "AXIS",
    file_pattern: /axis_master/i,
    default_file_name: "AXIS_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 4,
    bank_id: 4,
    file_id: 637,
    bank_name: "Axis Finance",
    bank_code: "AFL",
    file_pattern: /axis_finance/i,
    default_file_name: "Axis_Finance_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 5,
    bank_id: 5,
    file_id: 638,
    bank_name: "Bajaj Finserv",
    bank_code: "BAJAJ_FINSERV",
    file_pattern: /bajaj_finserv/i,
    default_file_name: "Bajaj_Finserv_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 6,
    bank_id: 6,
    file_id: 699,
    bank_name: "Bajaj Markets",
    bank_code: "BAJAJ_MARKETS",
    file_pattern: /bajaj_markets/i,
    default_file_name: "Bajaj_Markets_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 7,
    bank_id: 7,
    file_id: 639,
    bank_name: "Bandhan Bank",
    bank_code: "BANDHAN",
    file_pattern: /bandhan/i,
    default_file_name: "Bandhan_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan", "Business Loan", "Education Loan"],
  },
  {
    id: 8,
    bank_id: 8,
    file_id: 640,
    bank_name: "Cholamandalam Investment & Finance",
    bank_code: "CHOLA",
    file_pattern: /chola/i,
    default_file_name: "Chola_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan", "Business Loan"],
  },
  {
    id: 9,
    bank_id: 9,
    file_id: 641,
    bank_name: "Fibe (EarlySalary)",
    bank_code: "FIBE",
    file_pattern: /fibe/i,
    default_file_name: "Fibe_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 10,
    bank_id: 10,
    file_id: 642,
    bank_name: "Finnable Credit",
    bank_code: "FINNABLE",
    file_pattern: /finnable/i,
    default_file_name: "Finnable_Credit_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 11,
    bank_id: 11,
    file_id: 643,
    bank_name: "HDFC Bank",
    bank_code: "HDFC",
    file_pattern: /hdfc/i,
    default_file_name: "HDFC_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 12,
    bank_id: 12,
    file_id: 700,
    bank_name: "Home Loan Services",
    bank_code: "HOME_LOAN",
    file_pattern: /home_loan/i,
    default_file_name: "home_loan_eligibility_policy_rules.txt",
    loan_type: "Home Loan",
    supported_loan_types: ["Home Loan", "Personal Loan"],
  },
  {
    id: 13,
    bank_id: 13,
    file_id: 701,
    bank_name: "ICICI Bank",
    bank_code: "ICICI",
    file_pattern: /icici/i,
    default_file_name: "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 14,
    bank_id: 14,
    file_id: 702,
    bank_name: "IDFC FIRST Bank",
    bank_code: "IDFC",
    file_pattern: /idfc/i,
    default_file_name: "IDFC_FIRST_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 15,
    bank_id: 15,
    file_id: 703,
    bank_name: "IndusInd Bank",
    bank_code: "INDUSIND",
    file_pattern: /indusind/i,
    default_file_name: "IndusInd_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 16,
    bank_id: 16,
    file_id: 704,
    bank_name: "Kotak Mahindra Bank",
    bank_code: "KOTAK",
    file_pattern: /kotak/i,
    default_file_name: "Kotak_Mahindra_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 17,
    bank_id: 17,
    file_id: 705,
    bank_name: "L&T Finance",
    bank_code: "LTF",
    file_pattern: /lt_finance|ltf/i,
    default_file_name: "LT_Finance_Master_Policy_Clean.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 18,
    bank_id: 18,
    file_id: 706,
    bank_name: "Piramal Capital & Housing Finance",
    bank_code: "PIRAMAL",
    file_pattern: /piramal/i,
    default_file_name: "Piramal_Capital__Housing_Finance_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan", "Home Loan"],
  },
  {
    id: 19,
    bank_id: 19,
    file_id: 707,
    bank_name: "Poonawalla Fincorp",
    bank_code: "POONAWALLA",
    file_pattern: /poonawalla/i,
    default_file_name: "Poonawalla_Fincorp_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 20,
    bank_id: 20,
    file_id: 708,
    bank_name: "SBM Bank India",
    bank_code: "SBM",
    file_pattern: /sbm/i,
    default_file_name: "SBM_Bank_India_Master_Policy_Clean.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 21,
    bank_id: 21,
    file_id: 709,
    bank_name: "SMFG India Credit (Fullerton)",
    bank_code: "SMFG",
    file_pattern: /smfg/i,
    default_file_name: "SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 22,
    bank_id: 22,
    file_id: 710,
    bank_name: "Tata Capital",
    bank_code: "TATA_CAPITAL",
    file_pattern: /tata/i,
    default_file_name: "Tata_Capital_Master_Policy_Clean.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan", "Education Loan"],
  },
  {
    id: 23,
    bank_id: 23,
    file_id: 711,
    bank_name: "Utkarsh Small Finance Bank",
    bank_code: "UTKARSH",
    file_pattern: /utkarsh/i,
    default_file_name: "Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
  {
    id: 24,
    bank_id: 24,
    file_id: 712,
    bank_name: "Yes Bank",
    bank_code: "YES_BANK",
    file_pattern: /yes_bank/i,
    default_file_name: "Yes_Bank_Master_Policy.txt",
    loan_type: "Personal Loan",
    supported_loan_types: ["Personal Loan"],
  },
];

export interface BankMasterPolicyDetail extends BankMasterPolicy {
  min_cibil?: number;
  max_cibil?: number;
  min_salary?: number;
  max_salary?: number;
  min_age?: number;
  max_age?: number;
  min_loan_amount?: number;
  max_loan_amount?: number;
  min_tenure_months?: number;
  max_tenure_months?: number;
  foir_percent?: number;
  roi?: string | number;
  processing_fee_percent?: number;
  employment_type?: string;
  policy_version?: string;
}

const DELETED_BANKS_FILE = path.join(process.cwd(), "policy-master-files", ".deleted_banks.json");
const OVERRIDES_FILE = path.join(process.cwd(), "policy-master-files", ".policy_overrides.json");

function getDeletedBankIds(): number[] {
  try {
    if (fs.existsSync(DELETED_BANKS_FILE)) {
      const data = fs.readFileSync(DELETED_BANKS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading deleted banks file:", e);
  }
  return [];
}

function saveDeletedBankId(bankId: number) {
  try {
    const list = getDeletedBankIds();
    if (!list.includes(bankId)) {
      list.push(bankId);
      fs.writeFileSync(DELETED_BANKS_FILE, JSON.stringify(list, null, 2), "utf-8");
    }
  } catch (e) {
    console.error("Error saving deleted bank id:", e);
  }
}

function getPolicyOverrides(): Record<string, any> {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const data = fs.readFileSync(OVERRIDES_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading overrides file:", e);
  }
  return {};
}

function savePolicyOverride(bankId: number, data: any) {
  try {
    const all = getPolicyOverrides();
    all[String(bankId)] = { ...(all[String(bankId)] || {}), ...data };
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving policy override:", e);
  }
}

export function getResolvedMasterPolicies(): BankMasterPolicy[] {
  const dirPath = path.join(process.cwd(), "policy-master-files");
  let existingFiles: string[] = [];
  try {
    if (fs.existsSync(dirPath)) {
      existingFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith(".txt"));
    }
  } catch (err) {
    console.error("Error reading policy-master-files directory:", err);
  }

  const deletedIds = getDeletedBankIds();
  const overrides = getPolicyOverrides();

  return BANK_DEFINITIONS
    .filter((def) => !deletedIds.includes(def.bank_id) && !deletedIds.includes(def.id))
    .map((def) => {
      const ov = overrides[String(def.bank_id)] || overrides[String(def.id)] || {};
      // Find matching file in directory, fallback to default_file_name
      const matchedFile =
        ov.file_name ||
        existingFiles.find((f) => def.file_pattern.test(f)) ||
        def.default_file_name;

      return {
        id: def.id,
        bank_id: def.bank_id,
        file_id: def.file_id,
        bank_name: ov.bank_name || def.bank_name,
        bank_code: def.bank_code,
        file_name: matchedFile,
        loan_type: ov.loan_type || def.loan_type,
        supported_loan_types: def.supported_loan_types,
        status: ov.status || "active",
      };
    });
}

export const BANK_MASTER_POLICIES: BankMasterPolicy[] = getResolvedMasterPolicies();

// Cache in-memory for instant response
const masterTextCache = new Map<string, string>();

export function getMasterPolicyText(fileName: string): string {
  if (masterTextCache.has(fileName)) {
    return masterTextCache.get(fileName)!;
  }
  try {
    const filePath = path.join(process.cwd(), "policy-master-files", fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      masterTextCache.set(fileName, content);
      return content;
    }
  } catch (err) {
    console.error(`Error reading master policy file ${fileName}:`, err);
  }
  return "";
}

export function getAllMasterPolicies() {
  const policies = getResolvedMasterPolicies();
  const overrides = getPolicyOverrides();

  return policies.map((b) => {
    const ov = overrides[String(b.bank_id)] || overrides[String(b.id)] || {};
    const text = getMasterPolicyText(b.file_name);

    return {
      id: b.id,
      bank_id: b.bank_id,
      bank_name: b.bank_name,
      bank_code: b.bank_code,
      loan_type: ov.loan_type || b.loan_type || "Personal Loan",
      supported_loan_types: b.supported_loan_types,
      status: ov.status || b.status || "active",
      version_status: ov.status || b.status || "active",
      file_name: b.file_name,
      attachment_id: b.file_id,
      attachment_file_name: b.file_name,
      attachment_file_path: `/policy-master-files/${b.file_name}`,
      attachment_extracted_text: text,
      file_size_bytes: Buffer.byteLength(text, "utf-8"),

      // Default/overridden policy rule values matching mockup specifications
      policy_version: ov.policy_version || "Current Version",
      employment_type: ov.employment_type || "Salaried",
      min_cibil: ov.min_cibil !== undefined ? ov.min_cibil : 700,
      max_cibil: ov.max_cibil !== undefined ? ov.max_cibil : 900,
      min_salary: ov.min_salary !== undefined ? ov.min_salary : 30000,
      max_salary: ov.max_salary !== undefined ? ov.max_salary : 600000,
      min_age: ov.min_age !== undefined ? ov.min_age : 21,
      max_age: ov.max_age !== undefined ? ov.max_age : 60,
      min_loan_amount: ov.min_loan_amount !== undefined ? ov.min_loan_amount : 200000,
      max_loan_amount: ov.max_loan_amount !== undefined ? ov.max_loan_amount : 5000000,
      min_tenure_months: ov.min_tenure_months !== undefined ? ov.min_tenure_months : 12,
      max_tenure_months: ov.max_tenure_months !== undefined ? ov.max_tenure_months : 60,
      foir_percent: ov.foir_percent !== undefined ? ov.foir_percent : 22,
      roi: ov.roi !== undefined ? ov.roi : "12.5",
      processing_fee_percent: ov.processing_fee_percent !== undefined ? ov.processing_fee_percent : 1.5,
    };
  });
}

/**
 * Deletes a bank master policy and removes its associated text file.
 */
export async function deleteBankMasterPolicy(bankId: number, fileName?: string) {
  // 1. Delete associated text file from policy-master-files directory
  const filesToDelete = new Set<string>();
  if (fileName) filesToDelete.add(fileName);

  const def = BANK_DEFINITIONS.find((d) => d.bank_id === bankId || d.id === bankId);
  if (def) {
    if (def.default_file_name) filesToDelete.add(def.default_file_name);
  }

  const dirPath = path.join(process.cwd(), "policy-master-files");
  for (const f of filesToDelete) {
    try {
      const fullPath = path.join(dirPath, f);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Unlinked master policy text file: ${f}`);
      }
      masterTextCache.delete(f);
    } catch (err) {
      console.error(`Failed to unlink file ${f}:`, err);
    }
  }

  // 2. Persist deletion in deleted banks list
  saveDeletedBankId(bankId);
  if (def && def.id !== bankId) {
    saveDeletedBankId(def.id);
  }

  // 3. Delete from database if connected
  try {
    if (pool) {
      await pool.query(
        `DELETE FROM policy_attachments WHERE policy_rule_id IN (
          SELECT pr.id FROM policy_rules pr
          JOIN policy_versions pv ON pr.policy_version_id = pv.id
          WHERE pv.bank_id = $1
        ) OR file_name = ANY($2::text[])`,
        [bankId, Array.from(filesToDelete)]
      );
      await pool.query(
        `DELETE FROM policy_rules WHERE policy_version_id IN (
          SELECT id FROM policy_versions WHERE bank_id = $1
        )`,
        [bankId]
      );
      await pool.query(`DELETE FROM policy_versions WHERE bank_id = $1`, [bankId]);
      await pool.query(
        `DELETE FROM bank_policy_files WHERE bank_id = $1 OR file_name = ANY($2::text[])`,
        [bankId, Array.from(filesToDelete)]
      );
    }
  } catch (dbErr) {
    console.warn("DB delete operation skipped or failed:", dbErr);
  }

  return { success: true, message: `Bank #${bankId} and associated text file deleted successfully` };
}

/**
 * Updates a bank master policy record and optionally replaces its file.
 */
export async function updateBankMasterPolicy(
  bankId: number,
  updates: Record<string, any>,
  newFile?: { fileName: string; contentBuffer: Buffer }
) {
  const dirPath = path.join(process.cwd(), "policy-master-files");

  if (newFile && newFile.fileName && newFile.contentBuffer) {
    try {
      const targetPath = path.join(dirPath, newFile.fileName);
      fs.writeFileSync(targetPath, newFile.contentBuffer);
      updates.file_name = newFile.fileName;
      masterTextCache.set(newFile.fileName, newFile.contentBuffer.toString("utf-8"));
    } catch (err) {
      console.error("Failed to write new master policy file:", err);
    }
  }

  savePolicyOverride(bankId, updates);

  // Also update DB if available
  try {
    if (pool) {
      await pool.query(
        `UPDATE policy_rules SET
          min_cibil = COALESCE($1, min_cibil),
          max_cibil = COALESCE($2, max_cibil),
          min_salary = COALESCE($3, min_salary),
          max_salary = COALESCE($4, max_salary),
          min_age = COALESCE($5, min_age),
          max_age = COALESCE($6, max_age),
          min_loan_amount = COALESCE($7, min_loan_amount),
          max_loan_amount = COALESCE($8, max_loan_amount),
          min_tenure_months = COALESCE($9, min_tenure_months),
          max_tenure_months = COALESCE($10, max_tenure_months),
          foir_percent = COALESCE($11, foir_percent),
          roi = COALESCE($12, roi),
          processing_fee_percent = COALESCE($13, processing_fee_percent),
          status = COALESCE($14, status),
          loan_type = COALESCE($15, loan_type),
          employment_type = COALESCE($16, employment_type)
        WHERE policy_version_id IN (SELECT id FROM policy_versions WHERE bank_id = $17)`,
        [
          updates.min_cibil ?? null,
          updates.max_cibil ?? null,
          updates.min_salary ?? null,
          updates.max_salary ?? null,
          updates.min_age ?? null,
          updates.max_age ?? null,
          updates.min_loan_amount ?? null,
          updates.max_loan_amount ?? null,
          updates.min_tenure_months ?? null,
          updates.max_tenure_months ?? null,
          updates.foir_percent ?? null,
          updates.roi ? String(updates.roi) : null,
          updates.processing_fee_percent ?? null,
          updates.status || null,
          updates.loan_type || null,
          updates.employment_type || null,
          bankId,
        ]
      );
    }
  } catch (dbErr) {
    console.warn("DB update operation skipped or failed:", dbErr);
  }

  return { success: true, message: `Bank #${bankId} policy updated successfully` };
}


import fs from "fs";
import path from "path";

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

  return BANK_DEFINITIONS.map((def) => {
    // Find matching file in directory, fallback to default_file_name
    const matchedFile =
      existingFiles.find((f) => def.file_pattern.test(f)) || def.default_file_name;

    return {
      id: def.id,
      bank_id: def.bank_id,
      file_id: def.file_id,
      bank_name: def.bank_name,
      bank_code: def.bank_code,
      file_name: matchedFile,
      loan_type: def.loan_type,
      supported_loan_types: def.supported_loan_types,
      status: "active",
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
  return policies.map((b) => {
    const text = getMasterPolicyText(b.file_name);
    return {
      id: b.id,
      bank_id: b.bank_id,
      bank_name: b.bank_name,
      bank_code: b.bank_code,
      loan_type: b.loan_type,
      supported_loan_types: b.supported_loan_types,
      status: b.status,
      version_status: b.status,
      file_name: b.file_name,
      attachment_id: b.file_id,
      attachment_file_name: b.file_name,
      attachment_file_path: `/policy-master-files/${b.file_name}`,
      attachment_extracted_text: text,
      file_size_bytes: Buffer.byteLength(text, "utf-8"),
    };
  });
}

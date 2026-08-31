/**
 * Bank manager importer: reads Excel/CSV files and inserts manager records
 * into the PostgreSQL `bank_managers` table.
 *
 * Ported from Python import_managers.py → TypeScript.
 */

/**
 * Bank manager importer: reads Excel/CSV files and inserts manager records
 * into the PostgreSQL `bank_managers` table.
 *
 * Ported from Python import_managers.py → TypeScript.
 * Internal usage: bank-managers file upload API route.
 * Depends on: lib/db (PostgreSQL pool), xlsx (npm package)
 */

import pool from "./db";

function normalize(value: any): string | null {
  if (value == null) return null;
  return String(value).trim();
}

const PHONE_RE = /^\+?\d[\d\s\-]{7,15}$/;
const NAME_RE = /^[A-Za-z\s\.]{2,}$/;

function looksLikePhone(value: string | null): boolean {
  if (!value) return false;
  return PHONE_RE.test(value);
}

function looksLikeName(value: string | null): boolean {
  if (!value) return false;
  return NAME_RE.test(value);
}

function firstNonNull(row: Record<string, any>, aliases: string[]): string | null {
  const lowered = new Map<string, string>();
  for (const k of Object.keys(row)) {
    lowered.set(k.toLowerCase(), k);
  }
  for (const alias of aliases) {
    const key = lowered.get(alias.toLowerCase());
    if (key) {
      const value = normalize(row[key]);
      if (value) return value;
    }
  }
  return null;
}

function extractContactsFromRow(row: Record<string, any>): Array<{
  name: string | null;
  phone: string | null;
  location: string | null;
  role: string | null;
}> {
  const contacts: any[] = [];

  const rsmName = firstNonNull(row, ["rsm name", "rsm"]);
  const rsmPhone = firstNonNull(row, [
    "ph no",
    "rsm\nphone number",
    "phone",
    "mobile",
    "mobile_no",
    "contact",
    "phone_number",
    "mobile_number",
    "sm phone number",
  ]);
  const rsmLocation = firstNonNull(row, ["location", "city", "branch", "branch_name", "place"]);
  if (rsmName || rsmPhone) {
    contacts.push({
      name: looksLikeName(rsmName) ? rsmName : looksLikeName(rsmPhone) ? rsmPhone : null,
      phone: looksLikePhone(rsmPhone) ? rsmPhone : looksLikePhone(rsmName) ? rsmName : null,
      location: rsmLocation,
      role: "RSM",
    });
  }

  const smName = firstNonNull(row, ["sm name", "sm"]);
  const smPhone = firstNonNull(row, [
    "ph no_1",
    "rsm\nphone number",
    "phone",
    "mobile",
    "mobile_no",
    "contact",
    "phone_number",
    "mobile_number",
    "sm phone number",
  ]);
  const smLocation = firstNonNull(row, ["location_1", "location", "city", "branch", "branch_name", "place"]);
  if (smName || smPhone) {
    contacts.push({
      name: looksLikeName(smName) ? smName : looksLikeName(smPhone) ? smPhone : null,
      phone: looksLikePhone(smPhone) ? smPhone : looksLikePhone(smName) ? smName : null,
      location: smLocation,
      role: "SM",
    });
  }

  const coordinatorName = firstNonNull(row, ["coordinator", "co-ordinator", "name"]);
  const coordinatorPhone = firstNonNull(row, [
    "mobile",
    "phone",
    "mobile_no",
    "contact",
    "phone_number",
    "mobile_number",
    "rsm\nphone number",
    "sm phone number",
  ]);
  const coordinatorLocation = firstNonNull(row, [
    "location_2",
    "location_1",
    "location",
    "city",
    "branch",
    "branch_name",
    "place",
  ]);
  if (coordinatorName || coordinatorPhone) {
    contacts.push({
      name: looksLikeName(coordinatorName) ? coordinatorName : looksLikeName(coordinatorPhone) ? coordinatorPhone : null,
      phone: looksLikePhone(coordinatorPhone) ? coordinatorPhone : looksLikePhone(coordinatorName) ? coordinatorName : null,
      location: coordinatorLocation,
      role: "Coordinator",
    });
  }

  const asmName = firstNonNull(row, ["asm/sm/dsm name", "asm", "sm", "dsm"]);
  const asmPhone = firstNonNull(row, [
    "mobile",
    "phone",
    "mobile_no",
    "contact",
    "phone_number",
    "mobile_number",
    "rsm\nphone number",
    "sm phone number",
  ]);
  const asmLocation = firstNonNull(row, [
    "location_2",
    "location_1",
    "location",
    "city",
    "branch",
    "branch_name",
    "place",
  ]);
  if (asmName || asmPhone) {
    contacts.push({
      name: looksLikeName(asmName) ? asmName : looksLikeName(asmPhone) ? asmPhone : null,
      phone: looksLikePhone(asmPhone) ? asmPhone : looksLikePhone(asmName) ? asmName : null,
      location: asmLocation,
      role: "ASM/SM/DSM",
    });
  }

  const genericName = firstNonNull(row, ["name", "manager_name", "manager", "employee_name", "contact_person"]);
  const genericPhone = firstNonNull(row, [
    "mobile",
    "phone",
    "mobile_no",
    "contact",
    "phone_number",
    "mobile_number",
    "rsm\nphone number",
    "sm phone number",
  ]);
  const genericLocation = firstNonNull(row, ["location", "city", "branch", "branch_name", "place"]);
  if (genericName || genericPhone) {
    contacts.push({
      name: looksLikeName(genericName) ? genericName : looksLikeName(genericPhone) ? genericPhone : null,
      phone: looksLikePhone(genericPhone) ? genericPhone : looksLikePhone(genericName) ? genericName : null,
      location: genericLocation,
      role: null,
    });
  }

  return contacts;
}

async function insertManagers(client: any, managers: any[]) {
  for (const m of managers) {
    await client.query(
      `INSERT INTO bank_managers (bank_name, name, email, phone, location, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        m.bank_name,
        m.name || "Unknown",
        m.email || `unknown_${Math.random().toString(36).slice(2)}@example.com`,
        m.phone,
        m.location || "Unknown",
        m.role,
        "active",
      ]
    );
  }
}

export async function importManagersFromFile(filePath: string, bankName: string): Promise<{ imported: number; skipped: number }> {
  const fs = await import("fs");
  const path = await import("path");
  const xlsx = await import("xlsx");

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  let rows: Record<string, any>[] = [];

  if (ext === ".csv") {
    const csv = fs.readFileSync(filePath, "utf-8");
    const lines = csv.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return { imported: 0, skipped: 0 };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  } else if (ext === ".xlsx" || ext === ".xls") {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
    rows = jsonData;
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  if (rows.length === 0) return { imported: 0, skipped: 0 };

  const managers: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    const contacts = extractContactsFromRow(row);
    if (contacts.length === 0) {
      skipped++;
      continue;
    }
    for (const contact of contacts) {
      managers.push({
        ...contact,
        bank_name: bankName,
      });
    }
  }

  if (managers.length === 0) return { imported: 0, skipped };

  const client = await pool.connect();
  try {
    await insertManagers(client, managers);
    return { imported: managers.length, skipped };
  } finally {
    client.release();
  }
}

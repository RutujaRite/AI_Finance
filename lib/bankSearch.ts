/**
 * Bank manager database queries.
 * Internal usage: chat API route and bank-managers API routes.
 * Depends on: lib/db (PostgreSQL pool), lib/nlExtract (for query parsing)
 */

import pool from "./db";

export interface ManagerRow {
  id: number;
  bank_name: string;
  manager_name: string;
  employee_code: string;
  mobile_no: string;
  email_id: string;
  location_city: string;
  location_district: string;
  state: string;
  branch_name: string;
  branch_code: string;
  designation: string;
  status: string;
}

export interface ManagerQuery {
  bank_name?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  branch?: string | null;
  manager_name?: string | null;
}

export async function fetchBankManagers(opts: ManagerQuery = {}): Promise<ManagerRow[]> {
  const client = await pool.connect();
  try {
    const selectFields = [
      "id",
      "bank_name",
      "name AS manager_name",
      "COALESCE(employee_code, '') AS employee_code",
      "COALESCE(phone, '') AS mobile_no",
      "COALESCE(email, '') AS email_id",
      "COALESCE(location, '') AS location_city",
      "COALESCE(district, '') AS location_district",
      "COALESCE(state, '') AS state",
      "COALESCE(branch, '') AS branch_name",
      "COALESCE(branch_code, '') AS branch_code",
      "COALESCE(role, '') AS designation",
      "COALESCE(status, '') AS status",
    ];

    let query = `SELECT ${selectFields.join(", ")} FROM bank_managers`;
    const where: string[] = ["status = 'active'"];
    const params: any[] = [];

    if (opts.bank_name) {
      params.push(`%${opts.bank_name}%`);
      where.push(`LOWER(bank_name) LIKE LOWER($${params.length})`);
    }
    if (opts.city) {
      params.push(`%${opts.city}%`);
      where.push(`LOWER(location) LIKE LOWER($${params.length})`);
    }
    if (opts.district) {
      params.push(`%${opts.district}%`);
      where.push(`LOWER(district) LIKE LOWER($${params.length})`);
    }
    if (opts.state) {
      params.push(`%${opts.state}%`);
      where.push(`LOWER(state) LIKE LOWER($${params.length})`);
    }
    if (opts.branch) {
      const b = `%${opts.branch}%`;
      params.push(b);
      const i1 = params.length;
      params.push(b);
      const i2 = params.length;
      where.push(`(LOWER(branch) LIKE LOWER($${i1}) OR LOWER(role) LIKE LOWER($${i2}))`);
    }
    if (opts.manager_name) {
      params.push(`%${opts.manager_name}%`);
      where.push(`LOWER(name) LIKE LOWER($${params.length})`);
    }

    query += " WHERE " + where.join(" AND ");
    query += " ORDER BY bank_name, location, name LIMIT 100";

    const res = await client.query(query, params);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function searchBankManager(
  opts: ManagerQuery = {}
): Promise<{ count: number; managers: ManagerRow[] }> {
  const managers = await fetchBankManagers(opts);
  return { count: managers.length, managers };
}

export function formatManagers(result: { managers: ManagerRow[] }): string {
  const managers = result.managers || [];
  if (managers.length === 0) {
    return (
      "No matching bank manager record was found in our database. " +
      "Please check the bank name or location and try again."
    );
  }

  const shown = managers.slice(0, 4);
  const lines = [`Found ${managers.length} bank manager record(s):`, ""];
  for (const m of shown) {
    const name = m.manager_name || "Unnamed";
    const bank = m.bank_name || "Unknown bank";
    lines.push(`- ${name} (${bank})`);
    if (m.designation) lines.push(`  Designation: ${m.designation}`);
    if (m.mobile_no) lines.push(`  Phone: ${m.mobile_no}`);
    if (m.email_id && !String(m.email_id).startsWith("unknown_")) lines.push(`  Email: ${m.email_id}`);
    if (m.location_city) lines.push(`  Location: ${m.location_city}`);
    if (m.state) lines.push(`  State: ${m.state}`);
  }
  return lines.join("\n");
}

/**
 * Admin Company Spreadsheets API Route.
 * Accessible at: /api/admin/companies/spreadsheets
 * Delegates to the unified bank company files handler to list and manage
 * company master categorization spreadsheets, record metrics, and file operations.
 */

export { GET, POST, DELETE } from "@/app/api/bank/files/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

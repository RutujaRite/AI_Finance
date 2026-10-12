/**
 * Dedicated /api/bank/upload endpoint.
 * Direct alias to the POST handler in /api/bank/files for backwards compatibility.
 */

import { NextRequest } from "next/server";
import { POST as filesPost } from "../files/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return filesPost(req);
}

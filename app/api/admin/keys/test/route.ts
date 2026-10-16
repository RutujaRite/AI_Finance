import { NextRequest } from "next/server";
import { POST as testProviderKey } from "../../provider-keys/test/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return testProviderKey(req);
}

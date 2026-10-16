import { NextRequest, NextResponse } from "next/server";
import { GET as getProviderKeys, POST as postProviderKeys } from "../provider-keys/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return getProviderKeys(req);
}

export async function POST(req: NextRequest) {
  return postProviderKeys(req);
}

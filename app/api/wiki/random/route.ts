import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://mythology-api-pfqy.onrender.com";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = searchParams.get("limit") ?? "20";

  const res = await fetch(`${API_BASE}/wiki/random?limit=${limit}`);

  if (!res.ok) {
    return NextResponse.json({ error: "upstream error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

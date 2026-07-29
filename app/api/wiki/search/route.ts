import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://mythology-api-pfqy.onrender.com";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";
  const limit = searchParams.get("limit") ?? "20";

  const url = `${API_BASE}/wiki/search?q=${encodeURIComponent(q)}&limit=${limit}&page=${page}`;
  const res = await fetch(url);

  if (!res.ok) {
    return NextResponse.json({ error: "upstream error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

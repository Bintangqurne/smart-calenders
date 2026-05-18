import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyPublic(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyPublic(request, await params);
}

async function proxyPublic(
  request: NextRequest,
  params: { path: string[] }
) {
  const backendPath = "/" + params.path.join("/");
  if (!backendPath.startsWith("/public/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = `${BACKEND_URL}${backendPath}${request.nextUrl.search}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  try {
    const opts: RequestInit = { method: request.method, headers };
    if (request.method !== "GET") {
      const body = await request.text();
      if (body) opts.body = body;
    }
    const res = await fetch(url, opts);
    const data = await res.text();
    const responseHeaders = new Headers();
    const ct = res.headers.get("content-type");
    if (ct && data) responseHeaders.set("Content-Type", ct);
    return new NextResponse(data || null, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("public proxy error", err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

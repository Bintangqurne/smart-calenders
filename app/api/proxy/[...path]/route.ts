import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

/**
 * Catch-all API proxy: forwards requests from the frontend to the backend,
 * attaching the auth_token from the httpOnly cookie as a Bearer token.
 *
 * Example: GET /api/proxy/events → GET http://127.0.0.1:3001/events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const localUserId =
    cookieStore.get("session_user_id")?.value ?? cookieStore.get("user_id")?.value;
  const localUserEmail =
    cookieStore.get("session_user_email")?.value ?? cookieStore.get("user_email")?.value;

  const backendPath = "/" + params.path.join("/");
  const queryString = request.nextUrl.search;
  const url = `${BACKEND_URL}${backendPath}${queryString}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (localUserId) {
    headers["x-local-user-id"] = localUserId;
  }
  if (localUserEmail) {
    headers["x-local-user-email"] = localUserEmail;
  }

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.text();
    const responseHeaders = new Headers();
    const contentType = res.headers.get("content-type");

    if (contentType && data) {
      responseHeaders.set("Content-Type", contentType);
    }

    if (request.method === "HEAD" || res.status === 204 || res.status === 205 || !data) {
      return new NextResponse(null, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 502 }
    );
  }
}

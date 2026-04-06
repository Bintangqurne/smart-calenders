import { NextRequest, NextResponse } from "next/server";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("session_user_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("session_user_email", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("user_id", "", { maxAge: 0, path: "/" });
  response.cookies.set("user_name", "", { maxAge: 0, path: "/" });
  response.cookies.set("user_email", "", { maxAge: 0, path: "/" });
}

function redirectToLogin(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");
  const next = new URL("/login", request.url);
  if (reason === "session-expired") {
    next.searchParams.set(
      "error",
      "Session expired. Please sign in again to reconnect your workspace."
    );
  }

  const response = NextResponse.redirect(next);
  clearAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  return redirectToLogin(request);
}

export async function POST(request: NextRequest) {
  return redirectToLogin(request);
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=InvalidData", request.url));
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

  try {
    const res = await fetch(`${backendUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Backend auth error:", err);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}`, request.url));
    }

    const data = await res.json();
    const token = data.data?.accessToken || data.accessToken;
    const accessTokenExpiresAt =
      data.data?.accessTokenExpiresAt || data.accessTokenExpiresAt;
    const userId = data.data?.userId || data.userId;
    const userName = data.data?.name || data.name || "";
    const userEmail = data.data?.email || data.email || "";

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=MissingToken", request.url));
    }

    const expiresAt = accessTokenExpiresAt
      ? new Date(accessTokenExpiresAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    const safeExpiresAt =
      Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()
        ? new Date(Date.now() + 60 * 60 * 1000)
        : expiresAt;

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: safeExpiresAt,
      path: "/",
    });
    cookieStore.set("session_user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: safeExpiresAt,
      path: "/",
    });
    cookieStore.set("session_user_email", userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: safeExpiresAt,
      path: "/",
    });
    cookieStore.set("user_id", userId, {
      expires: safeExpiresAt,
      path: "/",
    });
    cookieStore.set("user_name", userName, {
      expires: safeExpiresAt,
      path: "/",
    });
    cookieStore.set("user_email", userEmail, {
      expires: safeExpiresAt,
      path: "/",
    });

    return NextResponse.redirect(new URL("/post-login", request.url));
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(new URL("/login?error=ServerError", request.url));
  }
}

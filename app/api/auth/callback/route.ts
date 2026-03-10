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
    const userId = data.data?.userId || data.userId;

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=MissingToken", request.url));
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    cookieStore.set("user_id", userId, {
      path: "/",
    });

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(new URL("/login?error=ServerError", request.url));
  }
}

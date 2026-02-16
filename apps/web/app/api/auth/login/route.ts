import { type NextRequest, NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, rememberMe = false } = body;

    if (!(username && password)) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const result = await loginUser(username, password, rememberMe);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user?.id,
        username: result.user?.username,
        displayName: result.user?.displayName,
      },
    });

    // Set session cookie with appropriate expiration
    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 // 30 days
      : 24 * 60 * 60; // 1 day

    response.cookies.set(SESSION_COOKIE_NAME, result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

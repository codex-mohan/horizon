import { type NextRequest, NextResponse } from "next/server";
import { loginUser, registerUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    if (!(username && password)) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        {
          error: "Username must be 3-20 characters, alphanumeric and underscores only",
        },
        { status: 400 }
      );
    }

    const result = await registerUser(username, password, displayName);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Auto-login after registration
    const loginResult = await loginUser(username, password, false);

    if (!(loginResult.success && loginResult.token)) {
      return NextResponse.json({ error: "Account created but failed to login" }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user?.id,
        username: result.user?.username,
        displayName: result.user?.displayName,
      },
    });

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 1 day
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

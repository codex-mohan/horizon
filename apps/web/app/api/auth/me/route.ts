import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const result = await validateSession(token);

    if (!(result.valid && result.user)) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Get user API error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

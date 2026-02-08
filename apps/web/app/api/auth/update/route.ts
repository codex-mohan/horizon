import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await validateSession(token);

        if (!result.valid || !result.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { displayName, avatarUrl } = body;

        // Update user in database
        const updatedUser = db.users.update(result.user.id, {
            displayName,
            avatarUrl,
            updatedAt: new Date(),
        });

        if (!updatedUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                displayName: updatedUser.displayName,
                avatarUrl: updatedUser.avatarUrl,
            },
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

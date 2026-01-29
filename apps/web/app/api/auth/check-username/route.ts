import { NextRequest, NextResponse } from "next/server";
import { isUsernameAvailable } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const username = request.nextUrl.searchParams.get("username");

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return NextResponse.json({
                available: false,
                error: "Invalid username format",
            });
        }

        const available = await isUsernameAvailable(username);

        return NextResponse.json({ available });
    } catch (error) {
        console.error("Check username API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

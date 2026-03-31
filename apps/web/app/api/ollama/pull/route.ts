import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get("baseUrl") || "http://localhost:11434";

  try {
    const { model } = await request.json();
    if (!model) {
      return NextResponse.json({ error: "Model name is required" }, { status: 400 });
    }

    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to pull model" }, { status: response.status });
    }

    // Stream the proxy response back to the client
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to connect to Ollama" }, { status: 503 });
  }
}

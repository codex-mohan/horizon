import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get("baseUrl") || "http://localhost:11434";

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000), // Timeout quickly if Ollama isn't running
    });

    if (!response.ok) {
      return NextResponse.json({ models: [], available: false }, { status: response.status });
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    return NextResponse.json({ models, available: true });
  } catch (error) {
    // If fetch failed completely (e.g. connection refused), return no models
    return NextResponse.json({ models: [], available: false }, { status: 503 });
  }
}

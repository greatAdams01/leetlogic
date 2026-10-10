import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!["faq", "translations", "status"].includes(resource))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const response = await fetch(
      `${process.env.ADMIN_API_URL || "http://localhost:3000"}/v1/content/${resource}${req.nextUrl.search}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Content unavailable" }, { status: 503 });
  }
}

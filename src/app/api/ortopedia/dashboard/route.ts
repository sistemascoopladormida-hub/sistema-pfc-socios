import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildOrtopediaDashboard } from "@/lib/ortopedia-dashboard";
import { canAccessOrtopediaDashboard } from "@/lib/roles";

export async function GET() {
  const role = cookies().get("rol")?.value;
  if (!canAccessOrtopediaDashboard(role)) {
    return NextResponse.json(
      { success: false, error: "Acceso restringido al Dashboard de Ortopedia" },
      { status: 403 }
    );
  }

  try {
    const data = await buildOrtopediaDashboard();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

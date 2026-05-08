import { NextResponse, type NextRequest } from "next/server";

import { getSessionBootstrap, sessionCookieName } from "@/server/project-store";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const bootstrap = await getSessionBootstrap(sessionToken);
  return NextResponse.json(bootstrap);
}

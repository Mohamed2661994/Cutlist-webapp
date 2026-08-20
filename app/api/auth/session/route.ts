import { NextResponse, type NextRequest } from "next/server";

import { getSessionBootstrap, sessionCookieName } from "@/server/project-store";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const bootstrap = await getSessionBootstrap(sessionToken);
    return NextResponse.json(bootstrap);
  } catch (error) {
    console.error("Session route error:", error);
    return NextResponse.json({
      user: null,
      projectSettings: null,
      savedProjects: [],
    });
  }
}

import { NextResponse, type NextRequest } from "next/server";

import {
  getSessionCookieOptions,
  logoutUser,
  sessionCookieName,
} from "@/server/project-store";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  await logoutUser(sessionToken);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...getSessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

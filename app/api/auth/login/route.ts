import { NextResponse, type NextRequest } from "next/server";

import {
  ProjectStoreError,
  getSessionCookieOptions,
  loginUser,
  sessionCookieName,
} from "@/server/project-store";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const result = await loginUser(payload);
    const response = NextResponse.json(result.bootstrap);
    response.cookies.set(
      sessionCookieName,
      result.sessionToken,
      getSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof ProjectStoreError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: "تعذر تسجيل الدخول الآن." },
      { status: 500 },
    );
  }
}

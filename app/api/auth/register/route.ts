import { NextResponse, type NextRequest } from "next/server";

import {
  ProjectStoreError,
  getSessionCookieOptions,
  registerUser,
  sessionCookieName,
} from "@/server/project-store";

type RegisterPayload = {
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RegisterPayload;
    const result = await registerUser(payload);
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
      { message: "تعذر إنشاء الحساب الآن." },
      { status: 500 },
    );
  }
}

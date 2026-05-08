import { NextResponse, type NextRequest } from "next/server";

import type { ProjectSettings } from "@/lib/project-persistence";
import {
  ProjectStoreError,
  saveProjectSettingsForSession,
  sessionCookieName,
} from "@/server/project-store";

type SaveProjectSettingsPayload = {
  settings?: ProjectSettings;
};

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as SaveProjectSettingsPayload;

    if (!payload.settings) {
      return NextResponse.json(
        { message: "إعدادات المشروع غير مكتملة." },
        { status: 400 },
      );
    }

    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const bootstrap = await saveProjectSettingsForSession(
      sessionToken,
      payload.settings,
    );
    return NextResponse.json(bootstrap);
  } catch (error) {
    if (error instanceof ProjectStoreError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: "تعذر حفظ الإعدادات الآن." },
      { status: 500 },
    );
  }
}

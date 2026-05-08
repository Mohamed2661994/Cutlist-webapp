import { NextResponse, type NextRequest } from "next/server";

import type { SavedProject } from "@/lib/project-persistence";
import {
  ProjectStoreError,
  saveProjectForSession,
  sessionCookieName,
} from "@/server/project-store";

type SaveProjectPayload = {
  project?: SavedProject;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SaveProjectPayload;

    if (!payload.project) {
      return NextResponse.json(
        { message: "بيانات المشروع غير مكتملة." },
        { status: 400 },
      );
    }

    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const bootstrap = await saveProjectForSession(
      sessionToken,
      payload.project,
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
      { message: "تعذر حفظ المشروع الآن." },
      { status: 500 },
    );
  }
}

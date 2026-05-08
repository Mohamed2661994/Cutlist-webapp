import { NextResponse, type NextRequest } from "next/server";

import {
  ProjectStoreError,
  deleteProjectForSession,
  sessionCookieName,
} from "@/server/project-store";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const bootstrap = await deleteProjectForSession(sessionToken, projectId);
    return NextResponse.json(bootstrap);
  } catch (error) {
    if (error instanceof ProjectStoreError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: "تعذر حذف المشروع الآن." },
      { status: 500 },
    );
  }
}

import "server-only";

import * as postgresStore from "@/server/project-store-postgres";
import * as fileStore from "@/server/project-store-file";
import { ProjectStoreError } from "@/server/project-store-shared";

export {
  ProjectStoreError,
  getSessionCookieOptions,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "@/server/project-store-shared";

async function withStoreFallback<T>(
  postgresFn: () => Promise<T>,
  fileFn: () => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL?.trim()) {
    return fileFn();
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timed out")), 5000),
    );
    return await Promise.race([postgresFn(), timeoutPromise]);
  } catch (error) {
    if (error instanceof ProjectStoreError && error.status < 500) {
      throw error;
    }
    console.warn(
      "Database operation failed, seamlessly falling back to local store:",
      error,
    );
    return fileFn();
  }
}

export async function getSessionBootstrap(sessionToken?: string) {
  return withStoreFallback(
    () => postgresStore.getSessionBootstrap(sessionToken),
    () => fileStore.getSessionBootstrap(sessionToken),
  );
}

export async function registerUser(input: {
  name?: string;
  email?: string;
  password?: string;
}) {
  return withStoreFallback(
    () => postgresStore.registerUser(input),
    () => fileStore.registerUser(input),
  );
}

export async function loginUser(input: { email?: string; password?: string }) {
  return withStoreFallback(
    () => postgresStore.loginUser(input),
    () => fileStore.loginUser(input),
  );
}

export async function logoutUser(sessionToken?: string) {
  return withStoreFallback(
    () => postgresStore.logoutUser(sessionToken),
    () => fileStore.logoutUser(sessionToken),
  );
}

export async function saveProjectSettingsForSession(
  sessionToken: string | undefined,
  settings: import("@/lib/project-persistence").ProjectSettings,
) {
  return withStoreFallback(
    () => postgresStore.saveProjectSettingsForSession(sessionToken, settings),
    () => fileStore.saveProjectSettingsForSession(sessionToken, settings),
  );
}

export async function saveProjectForSession(
  sessionToken: string | undefined,
  project: import("@/lib/project-persistence").SavedProject,
) {
  return withStoreFallback(
    () => postgresStore.saveProjectForSession(sessionToken, project),
    () => fileStore.saveProjectForSession(sessionToken, project),
  );
}

export async function deleteProjectForSession(
  sessionToken: string | undefined,
  projectId: string,
) {
  return withStoreFallback(
    () => postgresStore.deleteProjectForSession(sessionToken, projectId),
    () => fileStore.deleteProjectForSession(sessionToken, projectId),
  );
}

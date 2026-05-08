import "server-only";

import * as postgresStore from "@/server/project-store-postgres";

export {
  ProjectStoreError,
  getSessionCookieOptions,
  sessionCookieMaxAgeSeconds,
  sessionCookieName,
} from "@/server/project-store-shared";

function getStoreBackend() {
  return postgresStore;
}

export async function getSessionBootstrap(sessionToken?: string) {
  return getStoreBackend().getSessionBootstrap(sessionToken);
}

export async function registerUser(input: {
  name?: string;
  email?: string;
  password?: string;
}) {
  return getStoreBackend().registerUser(input);
}

export async function loginUser(input: { email?: string; password?: string }) {
  return getStoreBackend().loginUser(input);
}

export async function logoutUser(sessionToken?: string) {
  return getStoreBackend().logoutUser(sessionToken);
}

export async function saveProjectSettingsForSession(
  sessionToken: string | undefined,
  settings: import("@/lib/project-persistence").ProjectSettings,
) {
  return getStoreBackend().saveProjectSettingsForSession(
    sessionToken,
    settings,
  );
}

export async function saveProjectForSession(
  sessionToken: string | undefined,
  project: import("@/lib/project-persistence").SavedProject,
) {
  return getStoreBackend().saveProjectForSession(sessionToken, project);
}

export async function deleteProjectForSession(
  sessionToken: string | undefined,
  projectId: string,
) {
  return getStoreBackend().deleteProjectForSession(sessionToken, projectId);
}

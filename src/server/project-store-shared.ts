import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type {
  PersistedUser,
  ProjectSettings,
  SavedProject,
  SessionBootstrap,
} from "@/lib/project-persistence";

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 30;
export const sessionCookieName = "cutlist_session";
export const sessionCookieMaxAgeSeconds = Math.floor(sessionLifetimeMs / 1000);

export class ProjectStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProjectStoreError";
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionCookieMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedDigest] = passwordHash.split(":");

  if (!salt || !storedDigest) {
    return false;
  }

  const derivedDigest = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedDigest, "hex");

  if (storedBuffer.length !== derivedDigest.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedDigest);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeSavedProject(project: SavedProject): SavedProject {
  return {
    ...project,
    customParts: (project.customParts ?? []).map((part) => ({
      ...part,
      edgeBanding: part.edgeBanding ?? {},
    })),
    arrangement: project.arrangement ?? [],
    edgeBandOverrides: project.edgeBandOverrides ?? {},
    units: project.units ?? [],
  };
}

export function sortSavedProjects(projects: SavedProject[]) {
  return [...projects]
    .map((project) => normalizeSavedProject(project))
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
}

export function toPersistedUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}): PersistedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function buildSessionBootstrap(
  user: PersistedUser | null,
  projectSettings: ProjectSettings | null,
  savedProjects: SavedProject[],
): SessionBootstrap {
  return {
    user,
    projectSettings,
    savedProjects: sortSavedProjects(savedProjects),
  };
}

export function createSession(userId: string, token: string): SessionRecord {
  const now = new Date();
  return {
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sessionLifetimeMs).toISOString(),
  };
}

export function validateAuthPayload(input: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email ?? "");
  const password = input.password?.trim() ?? "";
  const name = input.name?.trim() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ProjectStoreError("أدخل بريدًا إلكترونيًا صحيحًا.", 400);
  }

  if (password.length < 8) {
    throw new ProjectStoreError(
      "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
      400,
    );
  }

  return {
    email,
    password,
    name,
  };
}

export function validateRegistrationName(name: string) {
  if (name.length < 2) {
    throw new ProjectStoreError(
      "اسم المستخدم يجب أن يكون حرفين على الأقل.",
      400,
    );
  }

  if (name.length > 60) {
    throw new ProjectStoreError("اسم المستخدم طويل أكثر من اللازم.", 400);
  }
}

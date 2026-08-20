import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ProjectSettings,
  SavedProject,
  SessionBootstrap,
} from "@/lib/project-persistence";
import {
  ProjectStoreError,
  buildSessionBootstrap,
  createSession,
  hashPassword,
  hashSessionToken,
  normalizeSavedProject,
  toPersistedUser,
  validateAuthPayload,
  validateRegistrationName,
  verifyPassword,
} from "@/server/project-store-shared";

type FileUserSession = {
  id: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

type FileUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  sessions?: FileUserSession[];
  projectSettings?: ProjectSettings | null;
  savedProjects?: SavedProject[];
};

type FileDatabase = {
  users: FileUser[];
};

function getStoreFilePath() {
  const customPath = process.env.LOCAL_STORE_PATH?.trim() || process.env.LEGACY_STORE_PATH?.trim();
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/cutlist-db.json";
  }
  return path.join(process.cwd(), "data", "cutlist-db.json");
}

let inMemoryDb: FileDatabase = { users: [] };
let fileOperationQueue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = fileOperationQueue.then(operation, operation);
  fileOperationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readDatabase(): Promise<FileDatabase> {
  const filePath = getStoreFilePath();
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed?.users) ? parsed.users : [];
    inMemoryDb = { users };
    return { users };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "ENOENT") {
      return inMemoryDb;
    }
    return inMemoryDb;
  }
}

async function writeDatabase(data: FileDatabase): Promise<void> {
  inMemoryDb = data;
  try {
    const filePath = getStoreFilePath();
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.warn("Local storage write warning (using memory):", error);
  }
}

function pruneExpiredUserSessions(user: FileUser): FileUser {
  const now = Date.now();
  return {
    ...user,
    sessions: (user.sessions ?? []).filter(
      (s) => new Date(s.expiresAt).getTime() > now,
    ),
  };
}

export async function getSessionBootstrap(
  sessionToken?: string,
): Promise<SessionBootstrap> {
  return runSerialized(async () => {
    const db = await readDatabase();
    if (!sessionToken) {
      return buildSessionBootstrap(null, null, []);
    }

    const tokenHash = hashSessionToken(sessionToken);
    const now = Date.now();

    for (const user of db.users) {
      const activeSession = (user.sessions ?? []).find(
        (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now,
      );

      if (activeSession) {
        return buildSessionBootstrap(
          toPersistedUser(user),
          user.projectSettings ?? null,
          user.savedProjects ?? [],
        );
      }
    }

    return buildSessionBootstrap(null, null, []);
  });
}

export async function registerUser(input: {
  name?: string;
  email?: string;
  password?: string;
}): Promise<{ sessionToken: string; bootstrap: SessionBootstrap }> {
  const { email, password, name } = validateAuthPayload(input);
  validateRegistrationName(name);

  return runSerialized(async () => {
    const db = await readDatabase();
    const existing = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (existing) {
      throw new ProjectStoreError("يوجد حساب مسجل بهذا البريد بالفعل.", 409);
    }

    const timestamp = new Date().toISOString();
    const userId = `user-${randomUUID()}`;
    const sessionToken = randomBytes(32).toString("hex");
    const session = createSession(userId, sessionToken);

    const newUser: FileUser = {
      id: userId,
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: timestamp,
      updatedAt: timestamp,
      sessions: [
        {
          id: session.id,
          tokenHash: session.tokenHash,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
      ],
      projectSettings: null,
      savedProjects: [],
    };

    db.users.push(newUser);
    await writeDatabase(db);

    return {
      sessionToken,
      bootstrap: buildSessionBootstrap(toPersistedUser(newUser), null, []),
    };
  });
}

export async function loginUser(input: {
  email?: string;
  password?: string;
}): Promise<{ sessionToken: string; bootstrap: SessionBootstrap }> {
  const { email, password } = validateAuthPayload(input);

  return runSerialized(async () => {
    const db = await readDatabase();
    const userIndex = db.users.findIndex(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (userIndex === -1) {
      throw new ProjectStoreError(
        "هذا الحساب غير مسجل على هذا الجهاز بعد. اضغط على زر 'إنشاء حساب' بالأعلى لإنشائه أول مرة.",
        401,
      );
    }

    const user = db.users[userIndex];
    if (!verifyPassword(password, user.passwordHash)) {
      throw new ProjectStoreError("بيانات الدخول غير صحيحة.", 401);
    }

    const timestamp = new Date().toISOString();
    const sessionToken = randomBytes(32).toString("hex");
    const session = createSession(user.id, sessionToken);

    const pruned = pruneExpiredUserSessions(user);
    const updatedUser: FileUser = {
      ...pruned,
      updatedAt: timestamp,
      sessions: [
        ...(pruned.sessions ?? []),
        {
          id: session.id,
          tokenHash: session.tokenHash,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
      ],
    };

    db.users[userIndex] = updatedUser;
    await writeDatabase(db);

    return {
      sessionToken,
      bootstrap: buildSessionBootstrap(
        toPersistedUser(updatedUser),
        updatedUser.projectSettings ?? null,
        updatedUser.savedProjects ?? [],
      ),
    };
  });
}

export async function logoutUser(sessionToken?: string): Promise<void> {
  if (!sessionToken) {
    return;
  }

  return runSerialized(async () => {
    const tokenHash = hashSessionToken(sessionToken);
    const db = await readDatabase();

    let modified = false;
    for (let i = 0; i < db.users.length; i++) {
      const user = db.users[i];
      const initialCount = user.sessions?.length ?? 0;
      const filtered = (user.sessions ?? []).filter(
        (s) => s.tokenHash !== tokenHash,
      );
      if (filtered.length !== initialCount) {
        db.users[i] = { ...user, sessions: filtered };
        modified = true;
      }
    }

    if (modified) {
      await writeDatabase(db);
    }
  });
}

export async function saveProjectSettingsForSession(
  sessionToken: string | undefined,
  settings: ProjectSettings,
): Promise<SessionBootstrap> {
  return runSerialized(async () => {
    if (!sessionToken) {
      throw new ProjectStoreError("يجب تسجيل الدخول أولًا لحفظ الإعدادات.", 401);
    }

    const tokenHash = hashSessionToken(sessionToken);
    const db = await readDatabase();
    const now = Date.now();

    const userIndex = db.users.findIndex((u) =>
      (u.sessions ?? []).some(
        (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now,
      ),
    );

    if (userIndex === -1) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();
    const user = db.users[userIndex];
    const updatedUser: FileUser = {
      ...user,
      projectSettings: settings,
      updatedAt: timestamp,
    };

    db.users[userIndex] = updatedUser;
    await writeDatabase(db);

    return buildSessionBootstrap(
      toPersistedUser(updatedUser),
      updatedUser.projectSettings ?? null,
      updatedUser.savedProjects ?? [],
    );
  });
}

export async function saveProjectForSession(
  sessionToken: string | undefined,
  project: SavedProject,
): Promise<SessionBootstrap> {
  const normalizedProject = normalizeSavedProject(project);

  return runSerialized(async () => {
    if (!sessionToken) {
      throw new ProjectStoreError("يجب تسجيل الدخول أولًا لحفظ المشاريع.", 401);
    }

    const tokenHash = hashSessionToken(sessionToken);
    const db = await readDatabase();
    const now = Date.now();

    const userIndex = db.users.findIndex((u) =>
      (u.sessions ?? []).some(
        (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now,
      ),
    );

    if (userIndex === -1) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();
    const user = db.users[userIndex];
    const savedProjects = [...(user.savedProjects ?? [])];
    const projectPayload = {
      ...normalizedProject,
      updatedAt: timestamp,
    };

    const existingProjectIndex = savedProjects.findIndex(
      (p) => p.id === projectPayload.id,
    );

    if (existingProjectIndex !== -1) {
      savedProjects[existingProjectIndex] = projectPayload;
    } else {
      savedProjects.unshift(projectPayload);
    }

    const updatedUser: FileUser = {
      ...user,
      savedProjects,
      updatedAt: timestamp,
    };

    db.users[userIndex] = updatedUser;
    await writeDatabase(db);

    return buildSessionBootstrap(
      toPersistedUser(updatedUser),
      updatedUser.projectSettings ?? null,
      updatedUser.savedProjects ?? [],
    );
  });
}

export async function deleteProjectForSession(
  sessionToken: string | undefined,
  projectId: string,
): Promise<SessionBootstrap> {
  return runSerialized(async () => {
    if (!sessionToken) {
      throw new ProjectStoreError("يجب تسجيل الدخول أولًا.", 401);
    }

    const tokenHash = hashSessionToken(sessionToken);
    const db = await readDatabase();
    const now = Date.now();

    const userIndex = db.users.findIndex((u) =>
      (u.sessions ?? []).some(
        (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now,
      ),
    );

    if (userIndex === -1) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();
    const user = db.users[userIndex];
    const savedProjects = (user.savedProjects ?? []).filter(
      (p) => p.id !== projectId,
    );

    const updatedUser: FileUser = {
      ...user,
      savedProjects,
      updatedAt: timestamp,
    };

    db.users[userIndex] = updatedUser;
    await writeDatabase(db);

    return buildSessionBootstrap(
      toPersistedUser(updatedUser),
      updatedUser.projectSettings ?? null,
      updatedUser.savedProjects ?? [],
    );
  });
}

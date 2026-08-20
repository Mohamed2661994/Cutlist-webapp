import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import postgres, { type Sql, type TransactionSql } from "postgres";

import type {
  PersistedUser,
  ProjectSettings,
  SavedProject,
} from "@/lib/project-persistence";
import {
  ProjectStoreError,
  buildSessionBootstrap,
  createSession,
  hashPassword,
  hashSessionToken,
  normalizeSavedProject,
  sortSavedProjects,
  toPersistedUser,
  validateAuthPayload,
  validateRegistrationName,
  verifyPassword,
} from "@/server/project-store-shared";

type SqlClient = ReturnType<typeof postgres>;
type SqlExecutor = Sql | TransactionSql;

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type SessionLookupRow = {
  id: string;
  user_id: string;
  expires_at: string | Date;
};

type ProjectSettingsRow = {
  settings: ProjectSettings | string;
};

type ProjectRow = {
  id: string;
  name: string;
  updated_at: string | Date;
  project: SavedProject | string;
};

let sqlClient: SqlClient | null = null;
let schemaReadyPromise: Promise<SqlClient> | null = null;

function toIsoString(value: string | Date) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJsonColumn<T>(value: T | string, errorMessage: string): T {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ProjectStoreError(errorMessage, 500);
  }
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new ProjectStoreError(
      "قاعدة البيانات غير مضبوطة. أضف DATABASE_URL على الخادم أولًا.",
      503,
    );
  }

  return databaseUrl;
}

function shouldRequireSsl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "require") {
    return true;
  }

  return !["localhost", "127.0.0.1"].includes(url.hostname.toLowerCase());
}

async function ensureSchema(sql: SqlExecutor) {
  await sql`
    create table if not exists cutlist_users (
      id text primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;

  await sql`
    create table if not exists cutlist_sessions (
      id text primary key,
      user_id text not null references cutlist_users(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null,
      expires_at timestamptz not null
    )
  `;

  await sql`
    create index if not exists cutlist_sessions_user_id_idx
    on cutlist_sessions (user_id)
  `;

  await sql`
    create index if not exists cutlist_sessions_expires_at_idx
    on cutlist_sessions (expires_at)
  `;

  await sql`
    create table if not exists cutlist_project_settings (
      user_id text primary key references cutlist_users(id) on delete cascade,
      settings jsonb not null,
      updated_at timestamptz not null
    )
  `;

  await sql`
    create table if not exists cutlist_projects (
      user_id text not null references cutlist_users(id) on delete cascade,
      id text not null,
      name text not null,
      updated_at timestamptz not null,
      project jsonb not null,
      primary key (user_id, id)
    )
  `;

  await sql`
    create index if not exists cutlist_projects_user_id_updated_at_idx
    on cutlist_projects (user_id, updated_at desc)
  `;
}

async function getSql() {
  const databaseUrl = getDatabaseUrl();

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 4,
      idle_timeout: 10,
      prepare: false,
      ssl: shouldRequireSsl(databaseUrl) ? "require" : undefined,
    });
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(sqlClient)
      .then(() => sqlClient as SqlClient)
      .catch((err) => {
        schemaReadyPromise = null;
        throw err;
      });
  }

  return schemaReadyPromise;
}

async function pruneExpiredSessions(sql: SqlExecutor) {
  await sql`delete from cutlist_sessions where expires_at <= now()`;
}

function toPersistedUserFromRow(row: UserRow): PersistedUser {
  return toPersistedUser({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

async function listSavedProjectsForUser(sql: SqlExecutor, userId: string) {
  const rows = await sql<ProjectRow[]>`
    select id, name, updated_at, project
    from cutlist_projects
    where user_id = ${userId}
    order by updated_at desc
  `;

  return sortSavedProjects(
    rows.map((row) => {
      const project = normalizeSavedProject(
        parseJsonColumn(
          row.project,
          "تعذر قراءة بيانات أحد المشاريع المحفوظة من قاعدة البيانات.",
        ),
      );
      return {
        ...project,
        id: row.id,
        name: row.name,
        updatedAt: toIsoString(row.updated_at),
      };
    }),
  );
}

async function getProjectSettingsForUser(sql: SqlExecutor, userId: string) {
  const rows = await sql<ProjectSettingsRow[]>`
    select settings
    from cutlist_project_settings
    where user_id = ${userId}
    limit 1
  `;

  const settings = rows[0]?.settings;

  if (!settings) {
    return null;
  }

  return parseJsonColumn(
    settings,
    "تعذر قراءة إعدادات المشروع من قاعدة البيانات.",
  );
}

async function buildBootstrapForUser(
  sql: SqlExecutor,
  user: PersistedUser | null,
) {
  if (!user) {
    return buildSessionBootstrap(null, null, []);
  }

  const [projectSettings, savedProjects] = await Promise.all([
    getProjectSettingsForUser(sql, user.id),
    listSavedProjectsForUser(sql, user.id),
  ]);

  return buildSessionBootstrap(user, projectSettings, savedProjects);
}

async function findUserBySessionToken(
  sql: SqlExecutor,
  sessionToken: string | undefined,
  required: boolean,
) {
  if (!sessionToken) {
    if (required) {
      throw new ProjectStoreError("يجب تسجيل الدخول أولًا.", 401);
    }

    return null;
  }

  const sessionRows = await sql<SessionLookupRow[]>`
    select id, user_id, expires_at
    from cutlist_sessions
    where token_hash = ${hashSessionToken(sessionToken)}
    limit 1
  `;
  const session = sessionRows[0];

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (required) {
      throw new ProjectStoreError(
        "انتهت الجلسة الحالية. سجل الدخول مرة أخرى.",
        401,
      );
    }

    return null;
  }

  const userRows = await sql<UserRow[]>`
    select id, name, email, password_hash, created_at, updated_at
    from cutlist_users
    where id = ${session.user_id}
    limit 1
  `;
  const user = userRows[0];

  if (!user) {
    if (required) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    return null;
  }

  return user;
}

export async function getSessionBootstrap(sessionToken?: string) {
  const sql = await getSql();
  await pruneExpiredSessions(sql);

  const userRow = await findUserBySessionToken(sql, sessionToken, false);
  return buildBootstrapForUser(
    sql,
    userRow ? toPersistedUserFromRow(userRow) : null,
  );
}

export async function registerUser(input: {
  name?: string;
  email?: string;
  password?: string;
}) {
  const { email, password, name } = validateAuthPayload(input);
  validateRegistrationName(name);

  const sql = await getSql();

  return sql.begin(async (transaction) => {
    await pruneExpiredSessions(transaction);

    const existingRows = await transaction<UserRow[]>`
      select id, name, email, password_hash, created_at, updated_at
      from cutlist_users
      where email = ${email}
      limit 1
    `;

    if (existingRows.length > 0) {
      throw new ProjectStoreError("يوجد حساب مسجل بهذا البريد بالفعل.", 409);
    }

    const timestamp = new Date().toISOString();
    const userId = `user-${randomUUID()}`;

    await transaction`
      insert into cutlist_users (
        id,
        name,
        email,
        password_hash,
        created_at,
        updated_at
      ) values (
        ${userId},
        ${name},
        ${email},
        ${hashPassword(password)},
        ${timestamp},
        ${timestamp}
      )
    `;

    const sessionToken = randomBytes(32).toString("hex");
    const session = createSession(userId, sessionToken);

    await transaction`
      insert into cutlist_sessions (
        id,
        user_id,
        token_hash,
        created_at,
        expires_at
      ) values (
        ${session.id},
        ${session.userId},
        ${session.tokenHash},
        ${session.createdAt},
        ${session.expiresAt}
      )
    `;

    return {
      sessionToken,
      bootstrap: buildSessionBootstrap(
        {
          id: userId,
          name,
          email,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        null,
        [],
      ),
    };
  });
}

export async function loginUser(input: { email?: string; password?: string }) {
  const { email, password } = validateAuthPayload(input);
  const sql = await getSql();

  return sql.begin(async (transaction) => {
    await pruneExpiredSessions(transaction);

    const userRows = await transaction<UserRow[]>`
      select id, name, email, password_hash, created_at, updated_at
      from cutlist_users
      where email = ${email}
      limit 1
    `;
    const user = userRows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new ProjectStoreError("بيانات الدخول غير صحيحة.", 401);
    }

    const timestamp = new Date().toISOString();
    await transaction`
      update cutlist_users
      set updated_at = ${timestamp}
      where id = ${user.id}
    `;

    const sessionToken = randomBytes(32).toString("hex");
    const session = createSession(user.id, sessionToken);

    await transaction`
      insert into cutlist_sessions (
        id,
        user_id,
        token_hash,
        created_at,
        expires_at
      ) values (
        ${session.id},
        ${session.userId},
        ${session.tokenHash},
        ${session.createdAt},
        ${session.expiresAt}
      )
    `;

    const bootstrap = await buildBootstrapForUser(transaction, {
      ...toPersistedUserFromRow(user),
      updatedAt: timestamp,
    });

    return {
      sessionToken,
      bootstrap,
    };
  });
}

export async function logoutUser(sessionToken?: string) {
  if (!sessionToken) {
    return;
  }

  const sql = await getSql();
  await pruneExpiredSessions(sql);
  await sql`
    delete from cutlist_sessions
    where token_hash = ${hashSessionToken(sessionToken)}
  `;
}

export async function saveProjectSettingsForSession(
  sessionToken: string | undefined,
  settings: ProjectSettings,
) {
  const sql = await getSql();

  return sql.begin(async (transaction) => {
    await pruneExpiredSessions(transaction);
    const userRow = await findUserBySessionToken(
      transaction,
      sessionToken,
      true,
    );

    if (!userRow) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();

    await transaction`
      insert into cutlist_project_settings (user_id, settings, updated_at)
      values (${userRow.id}, ${JSON.stringify(settings)}::jsonb, ${timestamp})
      on conflict (user_id) do update
      set settings = excluded.settings,
          updated_at = excluded.updated_at
    `;

    await transaction`
      update cutlist_users
      set updated_at = ${timestamp}
      where id = ${userRow.id}
    `;

    return buildBootstrapForUser(transaction, {
      ...toPersistedUserFromRow(userRow),
      updatedAt: timestamp,
    });
  });
}

export async function saveProjectForSession(
  sessionToken: string | undefined,
  project: SavedProject,
) {
  const normalizedProject = normalizeSavedProject(project);
  const sql = await getSql();

  return sql.begin(async (transaction) => {
    await pruneExpiredSessions(transaction);
    const userRow = await findUserBySessionToken(
      transaction,
      sessionToken,
      true,
    );

    if (!userRow) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();
    const projectPayload = {
      ...normalizedProject,
      updatedAt: timestamp,
    };

    await transaction`
      insert into cutlist_projects (user_id, id, name, updated_at, project)
      values (
        ${userRow.id},
        ${projectPayload.id},
        ${projectPayload.name},
        ${timestamp},
        ${JSON.stringify(projectPayload)}::jsonb
      )
      on conflict (user_id, id) do update
      set name = excluded.name,
          updated_at = excluded.updated_at,
          project = excluded.project
    `;

    await transaction`
      update cutlist_users
      set updated_at = ${timestamp}
      where id = ${userRow.id}
    `;

    return buildBootstrapForUser(transaction, {
      ...toPersistedUserFromRow(userRow),
      updatedAt: timestamp,
    });
  });
}

export async function deleteProjectForSession(
  sessionToken: string | undefined,
  projectId: string,
) {
  const sql = await getSql();

  return sql.begin(async (transaction) => {
    await pruneExpiredSessions(transaction);
    const userRow = await findUserBySessionToken(
      transaction,
      sessionToken,
      true,
    );

    if (!userRow) {
      throw new ProjectStoreError("تعذر العثور على المستخدم الحالي.", 404);
    }

    const timestamp = new Date().toISOString();

    await transaction`
      delete from cutlist_projects
      where user_id = ${userRow.id}
        and id = ${projectId}
    `;

    await transaction`
      update cutlist_users
      set updated_at = ${timestamp}
      where id = ${userRow.id}
    `;

    return buildBootstrapForUser(transaction, {
      ...toPersistedUserFromRow(userRow),
      updatedAt: timestamp,
    });
  });
}

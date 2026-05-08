import process from "node:process";
import path from "node:path";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

async function tryLoadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);

  try {
    const rawValue = await readFile(filePath, "utf8");

    for (const line of rawValue.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) {
        continue;
      }

      let value = trimmedLine.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (error) {
    const code = error?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

async function loadEnvFilesIfNeeded() {
  if (process.env.DATABASE_URL?.trim()) {
    return;
  }

  await tryLoadEnvFile(".env.local");
  await tryLoadEnvFile(".env");
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required before running the file-store migration.",
    );
  }

  return databaseUrl;
}

function getLegacyStorePath() {
  const configuredPath = process.env.LEGACY_STORE_PATH?.trim();

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), "data", "cutlist-db.json");
}

function shouldRequireSsl(databaseUrl) {
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

function normalizeSavedProject(project) {
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

async function ensureSchema(sql) {
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

async function readLegacyDatabase() {
  const sourcePath = getLegacyStorePath();
  const rawValue = await readFile(sourcePath, "utf8");
  const parsedValue = JSON.parse(rawValue);

  return {
    sourcePath,
    users: Array.isArray(parsedValue.users) ? parsedValue.users : [],
  };
}

async function resolveUserId(sql, legacyUser) {
  const rows = await sql`
    select id
    from cutlist_users
    where email = ${legacyUser.email}
    limit 1
  `;

  return rows[0]?.id ?? legacyUser.id;
}

async function migrateUser(sql, legacyUser) {
  const resolvedUserId = await resolveUserId(sql, legacyUser);

  await sql`
    insert into cutlist_users (
      id,
      name,
      email,
      password_hash,
      created_at,
      updated_at
    ) values (
      ${resolvedUserId},
      ${legacyUser.name},
      ${legacyUser.email},
      ${legacyUser.passwordHash},
      ${legacyUser.createdAt},
      ${legacyUser.updatedAt}
    )
    on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        password_hash = excluded.password_hash,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
  `;

  await sql`
    delete from cutlist_sessions
    where user_id = ${resolvedUserId}
  `;

  if (legacyUser.projectSettings) {
    await sql`
      insert into cutlist_project_settings (user_id, settings, updated_at)
      values (
        ${resolvedUserId},
        ${JSON.stringify(legacyUser.projectSettings)}::jsonb,
        ${legacyUser.updatedAt}
      )
      on conflict (user_id) do update
      set settings = excluded.settings,
          updated_at = excluded.updated_at
    `;
  } else {
    await sql`
      delete from cutlist_project_settings
      where user_id = ${resolvedUserId}
    `;
  }

  await sql`
    delete from cutlist_projects
    where user_id = ${resolvedUserId}
  `;

  const savedProjects = Array.isArray(legacyUser.savedProjects)
    ? legacyUser.savedProjects
    : [];

  for (const legacyProject of savedProjects) {
    const project = normalizeSavedProject(legacyProject);

    await sql`
      insert into cutlist_projects (
        user_id,
        id,
        name,
        updated_at,
        project
      ) values (
        ${resolvedUserId},
        ${project.id},
        ${project.name},
        ${project.updatedAt},
        ${JSON.stringify(project)}::jsonb
      )
    `;
  }

  return {
    userId: resolvedUserId,
    projectCount: savedProjects.length,
  };
}

async function main() {
  await loadEnvFilesIfNeeded();
  const databaseUrl = getDatabaseUrl();
  const { sourcePath, users } = await readLegacyDatabase();
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: shouldRequireSsl(databaseUrl) ? "require" : undefined,
  });

  try {
    await ensureSchema(sql);

    const result = await sql.begin(async (transaction) => {
      const migratedUsers = [];

      for (const legacyUser of users) {
        migratedUsers.push(await migrateUser(transaction, legacyUser));
      }

      return migratedUsers;
    });

    const totalProjects = result.reduce(
      (sum, entry) => sum + entry.projectCount,
      0,
    );

    console.log(`Migrated ${result.length} users from ${sourcePath}.`);
    console.log(`Migrated ${totalProjects} saved projects to PostgreSQL.`);
    console.log(
      "Sessions were cleared intentionally; users should log in again.",
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

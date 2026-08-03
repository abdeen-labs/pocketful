import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Persistent state for updatable passes. Ephemeral download links stay in
// store.ts; only passes created with `updatable: true` land here.

export interface PassRecord {
  serialNumber: string;
  authToken: string;
  webServiceURL: string;
  /** The full request body as received — revalidated before every rebuild. */
  specJson: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface PassSummary {
  serialNumber: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  registrations: number;
}

let db: Database.Database | undefined;

function conn(): Database.Database {
  if (!db) throw new Error("initDb() must be called before using the database");
  return db;
}

export function initDb(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, "pocketful.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS passes (
      serial_number   TEXT PRIMARY KEY,
      auth_token      TEXT NOT NULL,
      web_service_url TEXT NOT NULL,
      spec_json       TEXT NOT NULL,
      description     TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registrations (
      device_library_id TEXT NOT NULL,
      serial_number     TEXT NOT NULL,
      push_token        TEXT NOT NULL,
      created_at        INTEGER NOT NULL,
      PRIMARY KEY (device_library_id, serial_number)
    );
    CREATE INDEX IF NOT EXISTS idx_registrations_serial
      ON registrations (serial_number);
  `);
}

export function insertPass(
  record: Omit<PassRecord, "createdAt" | "updatedAt">
): PassRecord {
  const now = Date.now();
  const full: PassRecord = { ...record, createdAt: now, updatedAt: now };
  conn()
    .prepare(
      `INSERT INTO passes
         (serial_number, auth_token, web_service_url, spec_json, description, created_at, updated_at)
       VALUES (@serialNumber, @authToken, @webServiceURL, @specJson, @description, @createdAt, @updatedAt)`
    )
    .run(full);
  return full;
}

export function getPassRecord(serialNumber: string): PassRecord | undefined {
  const row = conn()
    .prepare(
      `SELECT serial_number AS serialNumber, auth_token AS authToken,
              web_service_url AS webServiceURL, spec_json AS specJson,
              description, created_at AS createdAt, updated_at AS updatedAt
       FROM passes WHERE serial_number = ?`
    )
    .get(serialNumber);
  return row as PassRecord | undefined;
}

export function updatePassSpec(
  serialNumber: string,
  specJson: string,
  description: string,
  webServiceURL: string
): number {
  const updatedAt = Date.now();
  conn()
    .prepare(
      `UPDATE passes
       SET spec_json = ?, description = ?, web_service_url = ?, updated_at = ?
       WHERE serial_number = ?`
    )
    .run(specJson, description, webServiceURL, updatedAt, serialNumber);
  return updatedAt;
}

export function deletePassRecord(serialNumber: string): boolean {
  const info = conn()
    .prepare(`DELETE FROM passes WHERE serial_number = ?`)
    .run(serialNumber);
  conn()
    .prepare(`DELETE FROM registrations WHERE serial_number = ?`)
    .run(serialNumber);
  return info.changes > 0;
}

export function listPassSummaries(): PassSummary[] {
  return conn()
    .prepare(
      `SELECT p.serial_number AS serialNumber, p.description,
              p.created_at AS createdAt, p.updated_at AS updatedAt,
              COUNT(r.device_library_id) AS registrations
       FROM passes p
       LEFT JOIN registrations r ON r.serial_number = p.serial_number
       GROUP BY p.serial_number
       ORDER BY p.updated_at DESC`
    )
    .all() as PassSummary[];
}

/** Returns true when the registration is new, false when it already existed. */
export function registerDevice(
  deviceLibraryId: string,
  serialNumber: string,
  pushToken: string
): boolean {
  const existing = conn()
    .prepare(
      `SELECT push_token AS pushToken FROM registrations
       WHERE device_library_id = ? AND serial_number = ?`
    )
    .get(deviceLibraryId, serialNumber) as { pushToken: string } | undefined;
  if (existing) {
    if (existing.pushToken !== pushToken) {
      conn()
        .prepare(
          `UPDATE registrations SET push_token = ?
           WHERE device_library_id = ? AND serial_number = ?`
        )
        .run(pushToken, deviceLibraryId, serialNumber);
    }
    return false;
  }
  conn()
    .prepare(
      `INSERT INTO registrations (device_library_id, serial_number, push_token, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(deviceLibraryId, serialNumber, pushToken, Date.now());
  return true;
}

export function unregisterDevice(
  deviceLibraryId: string,
  serialNumber: string
): boolean {
  const info = conn()
    .prepare(
      `DELETE FROM registrations
       WHERE device_library_id = ? AND serial_number = ?`
    )
    .run(deviceLibraryId, serialNumber);
  return info.changes > 0;
}

export function deleteRegistrationsByPushToken(pushToken: string): number {
  return conn()
    .prepare(`DELETE FROM registrations WHERE push_token = ?`)
    .run(pushToken).changes;
}

/**
 * Serials registered to a device whose pass changed after `since` (ms epoch).
 * `lastUpdated` is the newest updated_at across the device's matches.
 */
export function listUpdatedSerials(
  deviceLibraryId: string,
  since?: number
): { serialNumbers: string[]; lastUpdated: number } | undefined {
  const rows = conn()
    .prepare(
      `SELECT p.serial_number AS serialNumber, p.updated_at AS updatedAt
       FROM registrations r
       JOIN passes p ON p.serial_number = r.serial_number
       WHERE r.device_library_id = ? AND p.updated_at > ?
       ORDER BY p.updated_at ASC`
    )
    .all(deviceLibraryId, since ?? 0) as {
    serialNumber: string;
    updatedAt: number;
  }[];
  if (rows.length === 0) return undefined;
  return {
    serialNumbers: rows.map((row) => row.serialNumber),
    lastUpdated: rows[rows.length - 1].updatedAt,
  };
}

export function pushTokensForSerial(serialNumber: string): string[] {
  const rows = conn()
    .prepare(
      `SELECT DISTINCT push_token AS pushToken FROM registrations
       WHERE serial_number = ?`
    )
    .all(serialNumber) as { pushToken: string }[];
  return rows.map((row) => row.pushToken);
}

import "server-only";
import { getEnv } from "../env";
import { SqliteStore } from "./sqlite";
import type { ImportStore, MediaStore, Store } from "./store";
import type { MemoryStore } from "../memory";

const g = globalThis as unknown as { __mawaStore?: SqliteStore };

/** Single store instance per process (survives dev hot reloads). */
export function getStore(): Store & ImportStore & MemoryStore & MediaStore {
  return (g.__mawaStore ??= new SqliteStore(getEnv().databasePath));
}

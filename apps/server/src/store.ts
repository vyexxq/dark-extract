import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PROGRESSION,
  EMPTY_INVENTORY,
  type PlayerInventory,
  type PlayerProgression,
} from "@dark-extract/shared";

export interface StoredAccount {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  progression: PlayerProgression;
  inventory: PlayerInventory;
  createdAt: number;
}

interface AccountDb {
  accounts: StoredAccount[];
  usernameIndex: Record<string, string>;
}

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "accounts.json");

let db: AccountDb = { accounts: [], usernameIndex: {} };

export async function loadStore(): Promise<void> {
  try {
    await mkdir(dataDir, { recursive: true });
    const raw = await readFile(dbPath, "utf8");
    db = JSON.parse(raw) as AccountDb;
  } catch {
    db = { accounts: [], usernameIndex: {} };
    await saveStore();
  }
}

async function saveStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export function findAccountByUsername(username: string): StoredAccount | undefined {
  const id = db.usernameIndex[username.toLowerCase()];
  if (!id) return undefined;
  return db.accounts.find((a) => a.id === id);
}

export function findAccountById(id: string): StoredAccount | undefined {
  return db.accounts.find((a) => a.id === id);
}

export async function createAccount(
  username: string,
  passwordHash: string,
  salt: string,
): Promise<StoredAccount> {
  const key = username.toLowerCase();
  if (db.usernameIndex[key]) {
    throw new Error("Username already taken");
  }
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    salt,
    progression: { ...DEFAULT_PROGRESSION },
    inventory: { ...EMPTY_INVENTORY, materials: [] },
    createdAt: Date.now(),
  };
  db.accounts.push(account);
  db.usernameIndex[key] = account.id;
  await saveStore();
  return account;
}

export async function updateAccount(account: StoredAccount): Promise<void> {
  const idx = db.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) db.accounts[idx] = account;
  await saveStore();
}

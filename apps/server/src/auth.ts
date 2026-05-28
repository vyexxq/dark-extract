import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PlayerProfile } from "@dark-extract/shared";
import {
  createAccount,
  findAccountById,
  findAccountByUsername,
  type StoredAccount,
} from "./store.js";

const sessions = new Map<string, string>();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function accountToProfile(account: StoredAccount): PlayerProfile {
  return {
    accountId: account.id,
    username: account.username,
    progression: { ...account.progression },
    inventory: {
      gold: account.inventory.gold,
      materials: account.inventory.materials.map((m) => ({ ...m })),
    },
  };
}

export async function registerUser(
  username: string,
  password: string,
): Promise<{ token: string; profile: PlayerProfile }> {
  const name = username.trim().slice(0, 16);
  if (name.length < 3) throw new Error("Username must be at least 3 characters");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const account = await createAccount(name, passwordHash, salt);
  const token = crypto.randomUUID();
  sessions.set(token, account.id);
  return { token, profile: accountToProfile(account) };
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ token: string; profile: PlayerProfile }> {
  const account = findAccountByUsername(username.trim());
  if (!account) throw new Error("Invalid username or password");

  const hash = hashPassword(password, account.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(account.passwordHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid username or password");
  }

  const token = crypto.randomUUID();
  sessions.set(token, account.id);
  return { token, profile: accountToProfile(account) };
}

export function resolveSession(token: string): StoredAccount | null {
  const accountId = sessions.get(token);
  if (!accountId) return null;
  return findAccountById(accountId) ?? null;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

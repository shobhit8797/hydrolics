import { randomUUID } from "crypto";
import type { MailboxProvider } from "./auth-store";

interface PendingOauthState {
  provider: MailboxProvider;
  createdAtMs: number;
}

const pendingStates = new Map<string, PendingOauthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneExpiredStates() {
  const now = Date.now();
  for (const [key, state] of pendingStates.entries()) {
    if (now - state.createdAtMs > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}

export function createOauthState(provider: MailboxProvider): string {
  pruneExpiredStates();
  const value = randomUUID();
  pendingStates.set(value, {
    provider,
    createdAtMs: Date.now(),
  });
  return value;
}

export function consumeOauthState(state: string, provider: MailboxProvider): boolean {
  pruneExpiredStates();
  const pending = pendingStates.get(state);
  if (!pending || pending.provider !== provider) {
    return false;
  }
  pendingStates.delete(state);
  return true;
}

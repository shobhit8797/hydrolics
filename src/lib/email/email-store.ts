import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { POEmail, EmailPollResult } from "./types";

const STORE_PATH = join(process.cwd(), "data", "emails.json");

interface StoreData {
  emails: POEmail[];
  lastPoll: string | null;
  pollHistory: EmailPollResult[];
}

function emptyStore(): StoreData {
  return { emails: [], lastPoll: null, pollHistory: [] };
}

function readStore(): StoreData {
  if (!existsSync(STORE_PATH)) return emptyStore();
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as StoreData;
  } catch {
    return emptyStore();
  }
}

function writeStore(data: StoreData): void {
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getAllEmails(): POEmail[] {
  return readStore().emails;
}

export function getEmailById(id: string): POEmail | null {
  const store = readStore();
  return store.emails.find((e) => e.id === id) || null;
}

export function emailExistsByMessageId(
  messageId: string,
  mailboxProvider?: "gmail" | "outlook"
): boolean {
  const store = readStore();
  return store.emails.some(
    (e) =>
      e.incoming.gmailMessageId === messageId &&
      (mailboxProvider ? e.incoming.mailboxProvider === mailboxProvider : true)
  );
}

export function addEmail(email: POEmail): void {
  const store = readStore();
  store.emails.unshift(email);
  writeStore(store);
}

export function updateEmail(id: string, updates: Partial<POEmail>): POEmail | null {
  const store = readStore();
  const idx = store.emails.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  store.emails[idx] = { ...store.emails[idx], ...updates };
  writeStore(store);
  return store.emails[idx];
}

export function recordPollResult(result: EmailPollResult): void {
  const store = readStore();
  store.lastPoll = result.timestamp;
  store.pollHistory.unshift(result);
  if (store.pollHistory.length > 100) {
    store.pollHistory = store.pollHistory.slice(0, 100);
  }
  writeStore(store);
}

export function getLastPollTime(): string | null {
  return readStore().lastPoll;
}

export function getEmailStats() {
  const emails = readStore().emails;
  return {
    total: emails.length,
    pending: emails.filter((e) => e.status === "pending").length,
    draftReady: emails.filter((e) => e.status === "draft_ready").length,
    sent: emails.filter((e) => e.status === "sent").length,
    failed: emails.filter((e) => e.status === "failed").length,
  };
}

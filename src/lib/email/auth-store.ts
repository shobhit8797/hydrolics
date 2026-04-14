import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type MailboxProvider = "gmail" | "outlook";

interface GmailAuthSession {
  refreshToken: string;
  userEmail: string;
  connectedAt: string;
}

interface OutlookAuthSession {
  refreshToken: string;
  userEmail: string;
  tenantId: string;
  connectedAt: string;
}

interface AuthStoreData {
  activeProvider: MailboxProvider | null;
  gmail: GmailAuthSession | null;
  outlook: OutlookAuthSession | null;
}

const AUTH_STORE_PATH = join(process.cwd(), "data", "email-auth.json");

function emptyStore(): AuthStoreData {
  return {
    activeProvider: null,
    gmail: null,
    outlook: null,
  };
}

function readStore(): AuthStoreData {
  if (!existsSync(AUTH_STORE_PATH)) return emptyStore();

  try {
    const raw = readFileSync(AUTH_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AuthStoreData>;
    return {
      activeProvider: parsed.activeProvider ?? null,
      gmail: parsed.gmail ?? null,
      outlook: parsed.outlook ?? null,
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AuthStoreData): void {
  writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getAuthStore() {
  return readStore();
}

export function upsertGmailSession(refreshToken: string, userEmail: string): void {
  const store = readStore();
  store.gmail = {
    refreshToken,
    userEmail,
    connectedAt: new Date().toISOString(),
  };
  store.activeProvider = "gmail";
  writeStore(store);
}

export function upsertOutlookSession(
  refreshToken: string,
  userEmail: string,
  tenantId: string
): void {
  const store = readStore();
  store.outlook = {
    refreshToken,
    userEmail,
    tenantId,
    connectedAt: new Date().toISOString(),
  };
  store.activeProvider = "outlook";
  writeStore(store);
}

export function setActiveProvider(provider: MailboxProvider): void {
  const store = readStore();
  store.activeProvider = provider;
  writeStore(store);
}

export function clearProviderSession(provider: MailboxProvider): void {
  const store = readStore();
  if (provider === "gmail") {
    store.gmail = null;
  } else {
    store.outlook = null;
  }

  if (store.activeProvider === provider) {
    if (provider === "gmail" && store.outlook) {
      store.activeProvider = "outlook";
    } else if (provider === "outlook" && store.gmail) {
      store.activeProvider = "gmail";
    } else {
      store.activeProvider = null;
    }
  }

  writeStore(store);
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail,
  RefreshCw,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  Inbox,
  RotateCcw,
  Loader2,
  FileText,
  PenLine,
  Link2,
  Unlink2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
}

interface IncomingEmail {
  gmailMessageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  attachments: EmailAttachment[];
}

interface AIDraft {
  subject: string;
  body: string;
  generatedAt: string;
  llmProvider: string;
  llmModel: string;
}

interface POEmail {
  id: string;
  incoming: IncomingEmail;
  draft: AIDraft | null;
  status: "pending" | "draft_ready" | "sent" | "failed" | "skipped";
  sentAt: string | null;
  processedAt: string;
  error: string | null;
  manualEdits: string | null;
}

interface EmailStats {
  total: number;
  pending: number;
  draftReady: number;
  sent: number;
  failed: number;
}

type MailboxProvider = "gmail" | "outlook";

interface ProviderAuthStatus {
  configured: boolean;
  connected: boolean;
  userEmail: string | null;
}

interface MailboxAuthState {
  activeProvider: MailboxProvider | null;
  defaultProvider: MailboxProvider;
  envMailboxReady: Record<MailboxProvider, boolean>;
  providers: {
    gmail: ProviderAuthStatus;
    outlook: ProviderAuthStatus;
  };
}

const STATUS_CONFIG = {
  pending: {
    label: "Processing",
    icon: Clock,
    variant: "secondary" as const,
    color: "text-muted-foreground",
  },
  draft_ready: {
    label: "Draft Ready",
    icon: Sparkles,
    variant: "outline" as const,
    color: "text-chart-2",
  },
  sent: {
    label: "Sent",
    icon: CheckCircle2,
    variant: "default" as const,
    color: "text-healthy",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    variant: "destructive" as const,
    color: "text-destructive",
  },
  skipped: {
    label: "Skipped",
    icon: AlertCircle,
    variant: "secondary" as const,
    color: "text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: POEmail["status"] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function EmailListItem({
  email,
  isSelected,
  onClick,
}: {
  email: POEmail;
  isSelected: boolean;
  onClick: () => void;
}) {
  const senderName = extractSenderName(email.incoming.from);
  const statusConfig = STATUS_CONFIG[email.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border transition-colors",
        "hover:bg-muted/50 focus-visible:bg-muted/50 outline-none",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{senderName}</span>
            <span className={cn("size-2 rounded-full shrink-0", {
              "bg-chart-2": email.status === "draft_ready",
              "bg-healthy": email.status === "sent",
              "bg-destructive": email.status === "failed",
              "bg-muted-foreground": email.status === "pending" || email.status === "skipped",
            })} />
          </div>
          <p className="text-sm text-foreground/80 truncate mt-0.5">
            {email.incoming.subject}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {email.incoming.body?.slice(0, 80) || "No preview"}...
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatRelativeTime(email.incoming.receivedAt)}
          </span>
          <span className={cn("text-[10px] font-medium", statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
      </div>
    </button>
  );
}

function EmailDetail({
  email,
  onSend,
  onRegenerate,
  onBack,
  sending,
  regenerating,
}: {
  email: POEmail;
  onSend: (id: string, body?: string) => void;
  onRegenerate: (id: string) => void;
  onBack: () => void;
  sending: boolean;
  regenerating: boolean;
}) {
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftBody = editedBody ?? email.manualEdits ?? email.draft?.body ?? "";

  const handleSend = () => {
    onSend(email.id, editedBody ?? undefined);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedBody(draftBody);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBody(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="lg:hidden">
          <ChevronLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{email.incoming.subject}</h3>
          <p className="text-xs text-muted-foreground truncate">
            From: {email.incoming.from}
          </p>
        </div>
        <StatusBadge status={email.status} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Incoming Email */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-muted">
              <Mail className="size-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incoming Email
            </span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">
              {new Date(email.incoming.receivedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <Card size="sm">
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">
                  {extractSenderName(email.incoming.from)}
                </span>
                <span className="text-xs text-muted-foreground">
                  &lt;{extractSenderEmail(email.incoming.from)}&gt;
                </span>
              </div>
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {email.incoming.body || "(HTML-only email — no plain text body)"}
              </pre>
              {email.incoming.attachments.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground font-medium">
                    Attachments:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {email.incoming.attachments.map((att, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-md"
                      >
                        <FileText className="size-3" />
                        {att.filename}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* AI Response */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-chart-2/10">
              <Sparkles className="size-3.5 text-chart-2" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI Response
            </span>
            {email.draft && (
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                {email.draft.llmProvider}/{email.draft.llmModel}
              </span>
            )}
          </div>

          {email.draft ? (
            <Card size="sm" className="ring-chart-2/20">
              <CardContent>
                <p className="text-xs text-muted-foreground mb-1">
                  Subject: <span className="text-foreground">{email.draft.subject}</span>
                </p>
                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    value={editedBody ?? ""}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="w-full min-h-[200px] text-sm bg-muted/50 rounded-md p-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none resize-y font-sans leading-relaxed"
                  />
                ) : (
                  <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {draftBody}
                  </pre>
                )}
              </CardContent>
            </Card>
          ) : email.status === "pending" ? (
            <div className="flex items-center gap-2 p-4 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Generating AI response...</span>
            </div>
          ) : email.error ? (
            <Card size="sm" className="ring-destructive/20">
              <CardContent>
                <p className="text-sm text-destructive">{email.error}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Action Bar */}
      {email.draft && email.status !== "sent" && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Done Editing
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleStartEdit}>
              <PenLine className="size-3.5" data-icon="inline-start" />
              Edit
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerate(email.id)}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <RotateCcw className="size-3.5" data-icon="inline-start" />
            )}
            Regenerate
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Send className="size-3.5" data-icon="inline-start" />
            )}
            Send Response
          </Button>
        </div>
      )}

      {email.status === "sent" && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-healthy/5">
          <CheckCircle2 className="size-4 text-healthy" />
          <span className="text-sm text-healthy font-medium">
            Sent {email.sentAt ? formatRelativeTime(email.sentAt) : ""}
          </span>
        </div>
      )}

      {email.status === "failed" && !email.draft && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRegenerate(email.id)}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <RotateCcw className="size-3.5" data-icon="inline-start" />
            )}
            Retry Generation
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmailTab() {
  const [emails, setEmails] = useState<POEmail[]>([]);
  const [stats, setStats] = useState<EmailStats>({ total: 0, pending: 0, draftReady: 0, sent: 0, failed: 0 });
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [authPolling, setAuthPolling] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [filter, setFilter] = useState<"all" | POEmail["status"]>("all");
  const [authState, setAuthState] = useState<MailboxAuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<MailboxProvider | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mailboxPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const authPopupRef = useRef<Window | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch("/api/emails");
      if (!res.ok) return;
      const data = await res.json();
      setEmails(data.emails || []);
      setStats(data.stats || { total: 0, pending: 0, draftReady: 0, sent: 0, failed: 0 });
      setLastPoll(data.lastPoll);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    }
  }, []);

  const fetchAuthState = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/auth", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as MailboxAuthState;
      setAuthState(data);
      setAuthError(null);
    } catch (err) {
      console.error("Failed to fetch mailbox auth state:", err);
      setAuthError("Unable to load mailbox authentication status.");
    }
  }, []);

  const resolveProviderToPoll = useCallback(
    (state: MailboxAuthState | null): MailboxProvider | null => {
      if (!state) return null;
      if (state.activeProvider && state.providers[state.activeProvider].connected) {
        return state.activeProvider;
      }
      if (state.providers.gmail.connected) return "gmail";
      if (state.providers.outlook.connected) return "outlook";
      if (state.envMailboxReady[state.defaultProvider]) return state.defaultProvider;
      return null;
    },
    []
  );

  useEffect(() => {
    fetchEmails();
    fetchAuthState();
  }, [fetchEmails, fetchAuthState]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchEmails, 30_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchEmails]);

  const triggerPoll = useCallback(
    async (provider: MailboxProvider, silent = false) => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      if (silent) {
        setAuthPolling(true);
      } else {
        setPolling(true);
      }

      try {
        const res = await fetch("/api/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll", provider }),
        });
        if (res.ok) {
          await fetchEmails();
        }
      } catch (err) {
        console.error("Poll failed:", err);
      } finally {
        if (silent) {
          setAuthPolling(false);
        } else {
          setPolling(false);
        }
        pollInFlightRef.current = false;
      }
    },
    [fetchEmails]
  );

  useEffect(() => {
    const provider = resolveProviderToPoll(authState);
    if (!provider) {
      if (mailboxPollIntervalRef.current) clearInterval(mailboxPollIntervalRef.current);
      return;
    }

    mailboxPollIntervalRef.current = setInterval(() => {
      void triggerPoll(provider, true);
    }, 60_000);

    return () => {
      if (mailboxPollIntervalRef.current) clearInterval(mailboxPollIntervalRef.current);
    };
  }, [authState, resolveProviderToPoll, triggerPoll]);

  const handlePoll = async () => {
    const provider = resolveProviderToPoll(authState);
    if (!provider) {
      setAuthError("Connect Gmail or Outlook before polling.");
      return;
    }

    await triggerPoll(provider);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as
        | {
            type?: string;
            status?: "success" | "error";
            provider?: MailboxProvider;
            message?: string | null;
          }
        | undefined;

      if (!payload || payload.type !== "email-auth") return;

      if (payload.status === "success" && payload.provider) {
        setAuthError(null);
        void fetchAuthState().then(async () => {
          await triggerPoll(payload.provider!, true);
        });
      } else {
        setAuthError(payload.message || "Mailbox authentication failed.");
      }
      setConnectingProvider(null);
      if (authPopupRef.current && !authPopupRef.current.closed) {
        authPopupRef.current.close();
      }
      authPopupRef.current = null;
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchAuthState, triggerPoll]);

  const handleConnect = (provider: MailboxProvider) => {
    setAuthError(null);
    setConnectingProvider(provider);
    const popup = window.open(
      `/api/emails/auth/start?provider=${provider}`,
      "mailbox-oauth",
      "popup=yes,width=640,height=760"
    );
    authPopupRef.current = popup;
    if (!popup) {
      setAuthError("Popup blocked. Allow popups and try again.");
      setConnectingProvider(null);
    }
  };

  const handleSetActive = async (provider: MailboxProvider) => {
    try {
      const res = await fetch("/api/emails/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-active", provider }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to switch provider");
      }
      const data = (await res.json()) as MailboxAuthState;
      setAuthState(data);
      setAuthError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch provider";
      setAuthError(message);
    }
  };

  const handleDisconnect = async (provider: MailboxProvider) => {
    try {
      const res = await fetch("/api/emails/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", provider }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to disconnect provider");
      }
      const data = (await res.json()) as MailboxAuthState;
      setAuthState(data);
      setAuthError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect provider";
      setAuthError(message);
    }
  };

  const handleSend = async (id: string, body?: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/emails/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        await fetchEmails();
      }
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async (id: string) => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/emails/${id}/regenerate`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchEmails();
      }
    } catch (err) {
      console.error("Regenerate failed:", err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetryingFailed(true);
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_failed" }),
      });
      if (res.ok) {
        await fetchEmails();
      }
    } catch (err) {
      console.error("Retry failed generations failed:", err);
    } finally {
      setRetryingFailed(false);
    }
  };

  const filteredEmails = filter === "all"
    ? emails
    : emails.filter((e) => e.status === filter);

  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null;
  const retryableFailedCount = emails.filter(
    (email) => email.status === "failed" && !email.draft
  ).length;
  const activeProvider = resolveProviderToPoll(authState);
  const providerEntries: Array<[MailboxProvider, ProviderAuthStatus]> = authState
    ? [
        ["gmail", authState.providers.gmail],
        ["outlook", authState.providers.outlook],
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {providerEntries.map(([provider, status]) => {
            const isActive = authState?.activeProvider === provider;
            const isConnecting = connectingProvider === provider;
            return (
              <div key={provider} className="inline-flex items-center gap-1 rounded-md border border-border px-1 py-1">
                <Badge variant={status.connected ? "default" : "secondary"}>
                  {provider === "gmail" ? "Gmail" : "Outlook"}
                </Badge>
                {status.connected ? (
                  <>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => handleSetActive(provider)}
                      disabled={isActive}
                    >
                      Active
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => handleDisconnect(provider)}>
                      <Unlink2 className="size-3" data-icon="inline-start" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleConnect(provider)}
                    disabled={!status.configured || isConnecting}
                  >
                    <Link2 className="size-3" data-icon="inline-start" />
                    {isConnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-muted-foreground">
            {stats.total} total
          </span>
          <span className="text-chart-2">
            {stats.draftReady} drafts
          </span>
          <span className="text-healthy">
            {stats.sent} sent
          </span>
          {stats.failed > 0 && (
            <span className="text-destructive">
              {stats.failed} failed
            </span>
          )}
        </div>

        <div className="flex-1" />

        {lastPoll && (
          <span className="text-[10px] text-muted-foreground font-mono">
            Last poll: {formatRelativeTime(lastPoll)}
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handlePoll}
          disabled={polling || !activeProvider}
        >
          {polling ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <RefreshCw className="size-3.5" data-icon="inline-start" />
          )}
          {polling || authPolling ? "Polling..." : activeProvider ? `Poll ${activeProvider === "gmail" ? "Gmail" : "Outlook"}` : "Connect Mailbox"}
        </Button>
        {retryableFailedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryFailed}
            disabled={retryingFailed}
          >
            {retryingFailed ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <RotateCcw className="size-3.5" data-icon="inline-start" />
            )}
            Retry Failed ({retryableFailedCount})
          </Button>
        )}
      </div>

      {authError && (
        <p className="text-xs text-destructive">{authError}</p>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5">
        {(["all", "draft_ready", "pending", "sent", "failed"] as const).map((f) => {
          const count = f === "all" ? stats.total : stats[
            f === "draft_ready" ? "draftReady" : f
          ];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All" : STATUS_CONFIG[f].label}
              {count > 0 && (
                <span className="ml-1 font-mono opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content: Split Pane */}
      <Card className="overflow-hidden">
        <div className="flex min-h-[500px] max-h-[700px]">
          {/* Email List */}
          <div
            className={cn(
              "w-full lg:w-[360px] lg:min-w-[360px] border-r border-border flex flex-col overflow-hidden",
              selectedEmail && "hidden lg:flex"
            )}
          >
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
              <Inbox className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {filteredEmails.length} emails
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4">
                  <Mail className="size-8 opacity-30" />
                  <p className="text-sm">No emails yet</p>
                  <p className="text-xs text-center">
                    Connect Gmail or Outlook, then poll to fetch PO emails
                  </p>
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onClick={() => setSelectedId(email.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detail Pane */}
          <div
            className={cn(
              "flex-1 flex flex-col min-w-0",
              !selectedEmail && "hidden lg:flex"
            )}
          >
            {selectedEmail ? (
              <EmailDetail
                key={selectedEmail.id}
                email={selectedEmail}
                onSend={handleSend}
                onRegenerate={handleRegenerate}
                onBack={() => setSelectedId(null)}
                sending={sending}
                regenerating={regenerating}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <div className="p-3 rounded-xl bg-muted/50">
                  <Mail className="size-8 opacity-30" />
                </div>
                <p className="text-sm">Select an email to view details</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

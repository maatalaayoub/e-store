"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  ShieldCheck,
  Beaker,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

/**
 * Stripe Connect configuration card, rendered inside the existing
 * Settings → Payment section. Handles both the disconnected (environment
 * selection + "Connect with Stripe") and connected (account details, test,
 * disconnect) states. All secret material stays server-side — this component
 * only ever consumes the sanitized status from /api/v1/admin/stripe.
 */
export default function StripeConnectCard() {
  const dict = useDictionary();
  const t = useMemo(() => dict?.admin?.settings?.payments?.stripe_card ?? {}, [dict]);

  const [status, setStatus] = useState(null); // { connection, platform }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // 'connect' | 'test' | 'disconnect' | 'env'
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch the sanitized status. setState only happens inside the deferred
  // promise callbacks, never synchronously in an effect body.
  const refresh = useCallback(() => {
    fetch("/api/v1/admin/stripe", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) setStatus(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Surface the result of the OAuth callback (?stripe=connected|error|cancelled)
  // as a toast, then strip the params from the URL so a refresh stays clean.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("stripe");
    if (!result) return;
    if (result === "connected") toast.success(t.toast_connected ?? "Stripe connected successfully.");
    else if (result === "cancelled") toast.info(t.toast_connect_cancelled ?? "Stripe authorization was cancelled.");
    else if (result === "error") toast.error(t.toast_connect_failed ?? "Stripe connection failed. Please try again.");
    params.delete("stripe");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connection = status?.connection ?? {};
  const platform = status?.platform ?? { configured: { test: false, live: false }, publishableKey: "" };
  const environment = connection.environment === "live" ? "live" : "test";
  const isConnected = connection.status === "connected" && Boolean(connection.stripe_account_id);
  const isError = connection.status === "error";

  const setEnvironment = useCallback(
    async (env) => {
      if (env === environment || isConnected) return;
      setBusy("env");
      try {
        const res = await fetch("/api/v1/admin/stripe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ environment: env }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || (t.load_error ?? "Failed to update."));
          return;
        }
        setStatus(json.data);
        toast.success(t.toast_env_saved ?? "Environment updated.");
      } catch {
        toast.error(t.load_error ?? "Failed to update.");
      } finally {
        setBusy(null);
      }
    },
    [environment, isConnected, t],
  );

  const connect = useCallback(() => {
    setBusy("connect");
    const returnTo = encodeURIComponent(`${window.location.pathname}?tab=payments`);
    window.location.href = `/api/v1/admin/stripe/connect?environment=${environment}&returnTo=${returnTo}`;
  }, [environment]);

  const testConnection = useCallback(async () => {
    setBusy("test");
    try {
      const res = await fetch("/api/v1/admin/stripe/test", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (json.success) {
        setStatus((prev) => ({ ...(prev ?? {}), connection: json.data }));
        toast.success(t.toast_tested ?? "Stripe connection verified.");
      } else if (json.error === "environment_mismatch") {
        if (json.data) setStatus((prev) => ({ ...(prev ?? {}), connection: json.data }));
        toast.error(t.toast_env_mismatch ?? "The connected account doesn't match the selected environment.");
      } else {
        if (json.data) setStatus((prev) => ({ ...(prev ?? {}), connection: json.data }));
        toast.error(t.toast_test_failed ?? "Could not verify the Stripe connection.");
      }
    } catch {
      toast.error(t.toast_test_failed ?? "Could not verify the Stripe connection.");
    } finally {
      setBusy(null);
    }
  }, [t]);

  const disconnect = useCallback(async () => {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/v1/admin/stripe", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
        toast.success(t.toast_disconnected ?? "Stripe has been disconnected.");
      } else {
        toast.error(json.error || (t.toast_disconnect_failed ?? "Failed to disconnect Stripe."));
      }
    } catch {
      toast.error(t.toast_disconnect_failed ?? "Failed to disconnect Stripe.");
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[5px] border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.loading ?? "Loading…"}
      </div>
    );
  }

  const configuredForEnv = Boolean(platform.configured?.[environment]);

  return (
    <div className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[#635bff] text-white">
            <CreditCard className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900">{t.title ?? "Stripe"}</h3>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {t.subtitle ?? "Accept card payments through your own Stripe account."}
            </p>
          </div>
        </div>
        <StatusBadge state={isConnected ? "connected" : isError ? "error" : "disconnected"} t={t} />
      </div>

      {/* Environment selector + active banner */}
      <div className="space-y-3 border-t border-zinc-100 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{t.environment ?? "Environment"}</p>
            <p className="mt-1 text-[13px] text-zinc-500">
              {isConnected ? (t.env_locked ?? "Disconnect to switch environment.") : (t.env_hint ?? "Choose before connecting.")}
            </p>
          </div>
          <div className="inline-flex rounded-[5px] border border-zinc-200 bg-zinc-50 p-0.5">
            {["test", "live"].map((env) => {
              const activeSel = environment === env;
              const disabled = isConnected || busy === "env" || !platform.configured?.[env];
              return (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  disabled={disabled}
                  className={`inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    activeSel
                      ? "border border-zinc-200 bg-white text-zinc-900"
                      : "border border-transparent text-zinc-500 hover:text-zinc-800 disabled:opacity-50 disabled:hover:text-zinc-500"
                  }`}
                >
                  {env === "test" ? <Beaker className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                  {env === "test" ? (t.env_test ?? "Test") : (t.env_live ?? "Live")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active environment banner — makes accidental real charges obvious. */}
        <div
          className={`flex items-center gap-2 rounded-[5px] border px-3 py-2 text-xs font-medium ${
            environment === "live"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {environment === "live" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <Beaker className="h-4 w-4 shrink-0" />}
          <span>
            {environment === "live"
              ? (t.env_active_live ?? "Live mode is active — real payments will be processed.")
              : (t.env_active_test ?? "Test mode is active — no real payments will be processed.")}
          </span>
        </div>

        {!configuredForEnv && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {(t.not_configured ?? "Stripe {env} mode isn't configured on this deployment yet.").replace(
              "{env}",
              environment === "live" ? (t.env_live ?? "Live") : (t.env_test ?? "Test"),
            )}
          </p>
        )}
      </div>

      {/* Body: connected vs disconnected */}
      {isConnected ? (
        <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow label={t.account ?? "Connected account"} value={connection.account_name || connection.account_email || "—"} />
            <DetailRow label={t.account_id ?? "Account ID"} value={connection.stripe_account_id} mono />
            <DetailRow
              label={t.env_active_test ? (t.current_environment ?? "Environment") : "Environment"}
              value={environment === "live" ? (t.env_live ?? "Live") : (t.env_test ?? "Test")}
            />
            <DetailRow
              label={t.webhook ?? "Webhook"}
              value={
                connection.webhook_status === "active"
                  ? (t.webhook_active ?? "Active")
                  : connection.webhook_status === "error"
                    ? (t.webhook_error ?? "Error")
                    : (t.webhook_inactive ?? "Inactive")
              }
            />
            <DetailRow
              label={t.last_sync ?? "Last synced"}
              value={connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : (t.never ?? "Never")}
            />
          </dl>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={busy === "test"}
              className="inline-flex items-center gap-2 rounded-[5px] border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {busy === "test" ? (t.testing ?? "Testing…") : (t.test_connection ?? "Test Connection")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy === "disconnect"}
              className="inline-flex items-center gap-2 rounded-[5px] border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              <Unlink className="h-4 w-4" />
              {t.disconnect ?? "Disconnect Stripe"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-zinc-600">
            {t.not_connected_desc ??
              "Connect your Stripe account to start accepting card payments. You'll be redirected to Stripe to authorize this store — no API keys or code changes required."}
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={busy === "connect" || !configuredForEnv}
            className="inline-flex items-center gap-2 rounded-[5px] bg-[#635bff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#524dd6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {busy === "connect" ? (t.connecting ?? "Redirecting…") : (t.connect ?? "Connect with Stripe")}
          </button>
        </div>
      )}

      <ConfirmationDialog
        isOpen={confirmOpen}
        title={t.disconnect_title ?? "Disconnect Stripe?"}
        description={
          t.disconnect_desc ??
          "Stripe card payments will no longer be available until another Stripe account is connected. Existing orders and payment history are kept."
        }
        confirmText={t.disconnect_confirm ?? "Disconnect"}
        cancelText={t.cancel ?? "Cancel"}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
        isLoading={busy === "disconnect"}
        isDangerous
        icon={<Unlink className="h-6 w-6" />}
      />
    </div>
  );
}

function StatusBadge({ state, t }) {
  const map = {
    connected: {
      label: t.status_connected ?? "Connected",
      cls: "bg-emerald-50 text-emerald-700",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    error: {
      label: t.status_error ?? "Connection Error",
      cls: "bg-red-50 text-red-600",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    },
    disconnected: {
      label: t.status_not_connected ?? "Not Connected",
      cls: "bg-zinc-100 text-zinc-500",
      icon: <span className="h-2 w-2 rounded-full bg-zinc-400" />,
    },
  };
  const s = map[state] ?? map.disconnected;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-medium ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className={`mt-1 break-all text-sm text-zinc-900 ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}

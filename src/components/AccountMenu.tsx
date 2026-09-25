"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount, exportMyData } from "@/app/actions/account";

type Panel = "menu" | "privacy" | "delete";

export default function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const [confirmText, setConfirmText] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setPanel("menu");
    setConfirmText("");
    setExportStatus("idle");
    setDeleteStatus("idle");
    setErrorMsg("");
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleExport() {
    setExportStatus("loading");
    const res = await exportMyData();
    if (!res.ok) {
      setExportStatus("error");
      setErrorMsg(res.error);
      return;
    }
    const blob = new Blob([res.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdic-nimai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("idle");
  }

  async function handleDelete() {
    setDeleteStatus("loading");
    const res = await deleteMyAccount();
    if (!res.ok) {
      setDeleteStatus("error");
      setErrorMsg(res.error);
      return;
    }
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = email.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="fixed right-4 top-4 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
        style={{ background: "var(--gold-dim)", border: "1px solid var(--gold)", color: "var(--green-text)" }}
      >
        {initial}
      </button>

      {open && (
        <div
          className="mt-2 w-72 rounded-lg p-3 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--ink-faint)" }}
        >
          {panel === "menu" && (
            <div className="flex flex-col gap-1">
              <p className="mb-2 truncate px-1 text-xs" style={{ color: "var(--ink-dim)" }}>
                {email}
              </p>

              <MenuButton onClick={handleExport} disabled={exportStatus === "loading"}>
                {exportStatus === "loading" ? "Preparing…" : "Export my data"}
              </MenuButton>
              <MenuButton onClick={() => setPanel("privacy")}>Privacy &amp; your data</MenuButton>
              <MenuButton onClick={() => setPanel("delete")} danger>
                Delete my account
              </MenuButton>

              <div className="my-1" style={{ borderTop: "1px solid var(--sand-dim)" }} />
              <MenuButton onClick={handleSignOut}>Sign out</MenuButton>

              {exportStatus === "error" && <p className="vn-error px-1 text-xs">{errorMsg}</p>}
            </div>
          )}

          {panel === "privacy" && (
            <div className="flex flex-col gap-2 px-1">
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                What&apos;s stored
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-mid)" }}>
                Your answers and scores for each test you take, your birth details if you use the Vedic chart, and
                your account email. The Vikriti check asks about current symptoms — treat it like any other health
                information you&apos;d rather keep private.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-mid)" }}>
                Only you can see your own results. Nothing is shared, sold, or used to train anything.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-mid)" }}>
                You can download everything stored about you, or delete your account and all of it, at any time,
                from this menu.
              </p>
              <button
                onClick={() => setPanel("menu")}
                className="mt-1 self-start text-xs"
                style={{ color: "var(--green-text)" }}
              >
                ← Back
              </button>
            </div>
          )}

          {panel === "delete" && (
            <div className="flex flex-col gap-2 px-1">
              <p className="text-sm" style={{ color: "var(--terracotta)" }}>
                Delete your account
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-mid)" }}>
                This permanently deletes every test result, your birth details and Vedic chart, and your account
                itself. This cannot be undone. Consider exporting your data first.
              </p>
              <label className="text-xs" style={{ color: "var(--ink-dim)" }}>
                Type DELETE to confirm
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  style={{ borderColor: "var(--ink-faint)", background: "var(--sand)" }}
                  autoFocus
                />
              </label>
              {deleteStatus === "error" && <p className="vn-error text-xs">{errorMsg}</p>}
              <div className="mt-1 flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || deleteStatus === "loading"}
                  className="rounded px-3 py-1.5 text-xs"
                  style={{
                    background: "var(--terracotta)",
                    color: "white",
                    opacity: confirmText === "DELETE" && deleteStatus !== "loading" ? 1 : 0.4,
                  }}
                >
                  {deleteStatus === "loading" ? "Deleting…" : "Permanently delete"}
                </button>
                <button onClick={() => setPanel("menu")} className="text-xs" style={{ color: "var(--ink-dim)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded px-2 py-1.5 text-left text-sm transition-colors"
      style={{ color: danger ? "var(--terracotta)" : "var(--ink)", opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sand-dim)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

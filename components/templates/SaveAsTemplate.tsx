"use client";

import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { createTemplate, type TemplateType } from "@/lib/api";

interface Props {
  type: TemplateType;
  teamId?: string;
  payload: Record<string, unknown>;
  suggestedName?: string;
  disabled?: boolean;
}

export function SaveAsTemplate({
  type,
  teamId,
  payload,
  suggestedName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName ?? "");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await createTemplate({
        templateType: type,
        name: name.trim(),
        description: description.trim(),
        payload,
        teamId: isPublic ? undefined : teamId,
        isPublic,
      });
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setName("");
        setDescription("");
      }, 1200);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(suggestedName ?? "");
          setOpen(true);
        }}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Save as template
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[min(450px,95vw)] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-base font-semibold">Save as template</h2>
              <p className="text-xs text-slate-500">
                Reuse this {type} structure next time.
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${type === "task" ? "Bug fix flow" : "Weekly retro"}`}
                  autoFocus
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Description <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Share with all teams (public template)
              </label>
              {error && (
                <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || saved}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : saved ? (
                    <Check className="h-3 w-3" />
                  ) : null}
                  {saved ? "Saved!" : saving ? "Saving…" : "Save template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

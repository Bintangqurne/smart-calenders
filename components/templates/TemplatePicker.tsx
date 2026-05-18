"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText, Globe, Loader2, Trash2 } from "lucide-react";
import {
  deleteTemplate,
  listTemplates,
  type Template,
  type TemplateType,
} from "@/lib/api";

interface Props {
  type: TemplateType;
  teamId?: string;
  currentUserId?: string | null;
  onApply: (template: Template) => void;
}

export function TemplatePicker({ type, teamId, currentUserId, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      try {
        const { templates: list } = await listTemplates({ type, teamId });
        setTemplates(list);
      } catch (err) {
        console.error("listTemplates failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, type, teamId]);

  async function handleDelete(t: Template, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteTemplate(t.templateId);
      setTemplates((prev) => prev.filter((x) => x.templateId !== t.templateId));
    } catch (err) {
      console.error("deleteTemplate failed", err);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <FileText className="h-3.5 w-3.5" />
        Use template
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              {type === "task" ? "Task templates" : "Meeting templates"}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              ) : templates.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">
                  No templates yet. Create one with "Save as template" after filling in a {type}.
                </div>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.templateId}
                    type="button"
                    onClick={() => {
                      onApply(t);
                      setOpen(false);
                    }}
                    className="group flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{t.name}</span>
                        {t.isPublic && (
                          <Globe className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                      {t.description && (
                        <div className="line-clamp-2 text-slate-500">
                          {t.description}
                        </div>
                      )}
                    </div>
                    {t.createdBy === currentUserId && (
                      <button
                        type="button"
                        onClick={(e) => void handleDelete(t, e)}
                        className="rounded p-1 text-rose-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-950"
                        title="Delete template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

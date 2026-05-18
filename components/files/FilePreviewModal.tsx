"use client";

import { useEffect, useState } from "react";
import { Download, Link2, X, History, MessageSquare } from "lucide-react";
import {
  getFilePreviewUrl,
  listFileVersions,
  type FilePreviewInfo,
  type FileRecord,
  type FileVersion,
} from "@/lib/api";
import { FileCommentsPanel } from "./FileCommentsPanel";

type Tab = "preview" | "versions" | "comments";

function isImage(mime: string) {
  return mime.startsWith("image/");
}
function isVideo(mime: string) {
  return mime.startsWith("video/");
}
function isPdf(mime: string) {
  return mime === "application/pdf";
}
function isText(mime: string) {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml"
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

interface FilePreviewModalProps {
  file: FileRecord;
  onClose: () => void;
  onOpenShare: () => void;
}

export function FilePreviewModal({
  file,
  onClose,
  onOpenShare,
}: FilePreviewModalProps) {
  const [tab, setTab] = useState<Tab>("preview");
  const [info, setInfo] = useState<FilePreviewInfo | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    setLoadingPreview(true);
    void (async () => {
      try {
        const data = await getFilePreviewUrl(file.fileId);
        setInfo(data);
      } catch (err) {
        console.error("getFilePreviewUrl failed", err);
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [file.fileId]);

  useEffect(() => {
    if (tab !== "versions" || versions.length > 0) return;
    setLoadingVersions(true);
    void (async () => {
      try {
        const data = await listFileVersions(file.fileId);
        setVersions(data.versions);
      } catch (err) {
        console.error("listFileVersions failed", err);
      } finally {
        setLoadingVersions(false);
      }
    })();
  }, [tab, file.fileId, versions.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{file.fileName}</h2>
            <p className="text-xs text-slate-500">
              {file.fileType} · {fmtSize(file.fileSize)} · v{file.version}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenShare}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Link2 className="h-3.5 w-3.5" />
              Share
            </button>
            {info && (
              <a
                href={info.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 px-4 dark:border-slate-800">
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </TabBtn>
          <TabBtn active={tab === "comments"} onClick={() => setTab("comments")}>
            <MessageSquare className="h-3.5 w-3.5" />
            Comments
          </TabBtn>
          <TabBtn active={tab === "versions"} onClick={() => setTab("versions")}>
            <History className="h-3.5 w-3.5" />
            Versions
          </TabBtn>
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "preview" &&
            (loadingPreview ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading preview…
              </div>
            ) : info ? (
              <PreviewBody info={info} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Preview unavailable.
              </div>
            ))}
          {tab === "comments" && <FileCommentsPanel fileId={file.fileId} />}
          {tab === "versions" &&
            (loadingVersions ? (
              <div className="p-6 text-sm text-slate-500">Loading versions…</div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Only the current version exists. Upload a new version from the file list to start a history.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {versions.map((v) => (
                  <li key={v.sk} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Version {v.versionNumber}</div>
                        <div className="text-xs text-slate-500">
                          {fmtSize(v.fileSize)} · {v.fileType}
                        </div>
                        {v.comment && (
                          <div className="mt-1 text-xs italic text-slate-500">
                            "{v.comment}"
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{new Date(v.uploadedAt).toLocaleString()}</div>
                        <div>by {v.uploadedBy}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition ${
        active
          ? "border-indigo-600 font-medium text-indigo-700 dark:text-indigo-400"
          : "border-transparent text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function PreviewBody({ info }: { info: FilePreviewInfo }) {
  const { fileType, previewUrl, fileName } = info;
  if (isImage(fileType)) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  if (isVideo(fileType)) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <video src={previewUrl} controls className="max-h-full max-w-full" />
      </div>
    );
  }
  if (isPdf(fileType)) {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        className="h-full w-full border-0"
      />
    );
  }
  if (isText(fileType)) {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        className="h-full w-full border-0 bg-white"
      />
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Preview not supported for this file type.
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Download to view
      </a>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowDownAZ,
  CheckCircle2,
  Download,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Filter,
  Link2,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deleteFile,
  renameFile,
  getFiles,
  getTasks,
  getUploadUrl,
  uploadFileToS3,
  type FileRecord,
  type Task,
} from "@/lib/api";
import { useTeam } from "@/hooks/use-team";
import { TeamPageGuard } from "@/components/team-page-guard";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { ShareLinkModal } from "@/components/files/ShareLinkModal";

function looksLikeOpaqueUserId(value?: string | null) {
  if (!value) return false;
  return /^(google|goo|user|usr|auth0|github|gitlab|discord|slack)[_:-]/i.test(value) || /^[a-z]{2,8}_[a-z0-9]{6,}$/i.test(value);
}

function getEmailLabel(email?: string | null) {
  if (!email) return null;

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getMemberDisplayName(member: { name?: string | null; email?: string | null }) {
  const trimmedName = member.name?.trim();
  if (trimmedName && !looksLikeOpaqueUserId(trimmedName) && trimmedName !== "Unknown User") {
    return trimmedName;
  }

  return getEmailLabel(member.email) || "Team member";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <FileImage className="size-4 text-blue-500" />;
  if (type.startsWith("video/")) return <FileVideo className="size-4 text-violet-500" />;
  if (type.includes("zip") || type.includes("archive")) {
    return <FileArchive className="size-4 text-amber-500" />;
  }
  return <FileText className="size-4 text-muted-foreground" />;
}

function extensionBadge(name: string): string {
  return name.split(".").pop()?.toUpperCase() ?? "FILE";
}

type FileTypeFilter = "ALL" | "IMAGE" | "VIDEO" | "ARCHIVE" | "DOC";
type SortMode = "RECENT" | "OLDEST" | "NAME_ASC" | "SIZE_DESC";

function getFileCategory(fileType: string): Exclude<FileTypeFilter, "ALL"> {
  if (fileType.startsWith("image/")) return "IMAGE";
  if (fileType.startsWith("video/")) return "VIDEO";
  if (fileType.includes("zip") || fileType.includes("archive")) return "ARCHIVE";
  return "DOC";
}

function compareFiles(a: FileRecord, b: FileRecord, sortMode: SortMode) {
  switch (sortMode) {
    case "OLDEST":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "NAME_ASC":
      return a.fileName.localeCompare(b.fileName);
    case "SIZE_DESC":
      return b.fileSize - a.fileSize;
    case "RECENT":
    default:
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
}

interface UploadItem {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function UploadZone({ teamId, onDone }: { teamId: string; onDone: () => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;

    const next: UploadItem[] = Array.from(files).map((file) => ({
      file,
      id: `${file.name}-${Date.now()}`,
      status: "pending",
    }));

    setItems((prev) => [...prev, ...next]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function uploadAll() {
    const pendingItems = items.filter((item) => item.status === "pending");

    for (const item of pendingItems) {
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading" } : entry))
      );

      try {
        const { uploadUrl } = await getUploadUrl({
          teamId,
          fileName: item.file.name,
          fileType: item.file.type || "application/octet-stream",
          fileSize: item.file.size,
        });

        await uploadFileToS3(uploadUrl, item.file);

        setItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, status: "done" } : entry))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, status: "error", error: message } : entry
          )
        );
      }
    }

    setTimeout(onDone, 600);
  }

  const hasPending = items.some((item) => item.status === "pending");

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/30"
        }`}
      >
        <Upload className="mx-auto mb-3 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">Shared team uploads, any file type</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3"
          >
            <FileIcon type={item.file.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.file.name}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
                {item.status === "uploading" ? (
                  <span className="text-xs text-amber-600">Uploading...</span>
                ) : null}
                {item.status === "done" ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    Done
                  </span>
                ) : null}
                {item.status === "error" ? (
                  <span className="flex items-center gap-1 text-xs text-rose-500">
                    <AlertCircle className="size-3" />
                    {item.error}
                  </span>
                ) : null}
              </div>
            </div>

            {item.status === "uploading" ? (
              <Loader2 className="size-4 animate-spin text-amber-500" />
            ) : (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {items.length > 0 ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => setItems([])}>
            Clear
          </Button>
          <Button type="button" onClick={uploadAll} disabled={!hasPending} className="gap-2">
            <Upload className="size-4" />
            Upload files
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilesTable({
  files,
  taskNamesById,
  uploaderNamesById,
  onDelete,
  onPreview,
  onShare,
  onRename,
}: {
  files: FileRecord[];
  taskNamesById: Record<string, string>;
  uploaderNamesById: Record<string, string>;
  onDelete: (file: FileRecord) => void;
  onPreview: (file: FileRecord) => void;
  onShare: (file: FileRecord) => void;
  onRename: (file: FileRecord) => void;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                File
              </th>
              <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Size
              </th>
              <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Linked task
              </th>
              <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Uploaded by
              </th>
              <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="py-3 pl-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {files.map((file) => (
                <motion.tr
                  key={file.fileId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="py-3 pl-4 pr-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/40">
                        <FileIcon type={file.fileType} />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onPreview(file)}
                          className="max-w-48 truncate text-left text-sm font-medium hover:text-indigo-600 hover:underline"
                        >
                          {file.fileName}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {extensionBadge(file.fileName)}
                          </Badge>
                          {file.version > 1 ? (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              v{file.version}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">
                    {formatBytes(file.fileSize)}
                  </td>
                  <td className="px-2 py-3">
                    {file.taskId ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                        <Link2 className="size-3" />
                        <span className="max-w-36 truncate">
                          {taskNamesById[file.taskId] ?? "Linked task"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">General file</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <span className="text-xs text-muted-foreground">
                      {uploaderNamesById[file.uploadedBy] ?? "Team member"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">
                    {new Date(file.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer"
                        title="Share link"
                        onClick={() => onShare(file)}
                      >
                        <Link2 className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer"
                        title="Rename"
                        onClick={() => onRename(file)}
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <a
                        download={file.fileName}
                        href={`/api/proxy/files/${file.fileId}/download`}
                        title="Download"
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted"
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Delete"
                        onClick={() => onDelete(file)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function FilesPage() {
  const { selectedTeam, selectedTeamId } = useTeam();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("RECENT");
  const [previewTarget, setPreviewTarget] = useState<FileRecord | null>(null);
  const [shareTarget, setShareTarget] = useState<FileRecord | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!selectedTeamId) return;

    setLoading(true);
    try {
      setFiles(await getFiles({ teamId: selectedTeamId }));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setFiles([]);
      return;
    }

    void loadFiles();
  }, [loadFiles, selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTasks([]);
      return;
    }

    getTasks(selectedTeamId)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [selectedTeamId]);

  async function handleDelete(file: FileRecord) {
    setDeleting(true);

    try {
      await deleteFile(file.fileId);
      setFiles((prev) => prev.filter((entry) => entry.fileId !== file.fileId));
    } catch {
      // silent for now
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function openRename(file: FileRecord) {
    setRenameTarget(file);
    setRenameValue(file.fileName);
  }

  async function handleRename() {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName === renameTarget.fileName) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    try {
      const updated = await renameFile(renameTarget.fileId, nextName);
      setFiles((prev) =>
        prev.map((entry) =>
          entry.fileId === renameTarget.fileId
            ? { ...entry, fileName: updated.fileName }
            : entry
        )
      );
      setRenameTarget(null);
    } catch {
      // silent for now
    } finally {
      setRenaming(false);
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
  const imageCount = files.filter((file) => file.fileType.startsWith("image/")).length;
  const linkedCount = files.filter((file) => Boolean(file.taskId)).length;
  const taskNamesById = useMemo(
    () => Object.fromEntries(tasks.map((task) => [task.taskId, task.title])),
    [tasks]
  );
  const uploaderNamesById = useMemo(
    () =>
      Object.fromEntries(
        (selectedTeam?.memberDetails ?? []).map((member) => [
          member.userId,
          getMemberDisplayName(member),
        ])
      ),
    [selectedTeam]
  );

  const filteredFiles = useMemo(() => {
    return [...files]
      .filter((file) => {
        const matchesSearch =
          file.fileName.toLowerCase().includes(search.toLowerCase()) ||
          (file.taskId
            ? (taskNamesById[file.taskId] ?? "").toLowerCase().includes(search.toLowerCase())
            : false);
        const matchesType =
          typeFilter === "ALL" || getFileCategory(file.fileType) === typeFilter;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => compareFiles(a, b, sortMode));
  }, [files, search, sortMode, taskNamesById, typeFilter]);

  const linkedFiles = filteredFiles.filter((file) => file.taskId);
  const generalFiles = filteredFiles.filter((file) => !file.taskId);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground">
            {selectedTeam ? `Shared files for ${selectedTeam.name}` : "Select a team to view files"}
          </p>
        </div>
        <Button className="gap-2" disabled={!selectedTeamId} onClick={() => setUploadOpen(true)}>
          <Upload className="size-4" />
          Upload files
        </Button>
      </div>

      <TeamPageGuard
        loading={loading}
        loadingLabel="files"
        emptyHeading="No team selected"
        emptyDescription="Choose a team from the sidebar to load shared files."
      >
        {files.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              <span className="font-semibold">{files.length}</span>
              <span className="text-xs text-muted-foreground">files</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Total size</span>
              <span className="font-semibold">{formatBytes(totalSize)}</span>
            </div>
            {imageCount > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
                <FileImage className="size-4 text-blue-500" />
                <span className="font-semibold">{imageCount}</span>
                <span className="text-xs text-muted-foreground">images</span>
              </div>
            ) : null}
            {linkedCount > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
                <Link2 className="size-4 text-primary" />
                <span className="font-semibold">{linkedCount}</span>
                <span className="text-xs text-muted-foreground">linked to tasks</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {files.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 lg:flex-row lg:items-center">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search file or linked task..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background p-1">
                <div className="px-2 text-xs text-muted-foreground">
                  <Filter className="size-3.5" />
                </div>
                {(["ALL", "DOC", "IMAGE", "VIDEO", "ARCHIVE"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTypeFilter(option)}
                    className={typeFilter === option ? "bg-primary text-primary-foreground" : ""}
                  >
                    {option === "ALL" ? "All" : option}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background p-1">
                <div className="px-2 text-xs text-muted-foreground">
                  <ArrowDownAZ className="size-3.5" />
                </div>
                {[
                  { value: "RECENT", label: "Recent" },
                  { value: "OLDEST", label: "Oldest" },
                  { value: "NAME_ASC", label: "Name" },
                  { value: "SIZE_DESC", label: "Size" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortMode(option.value as SortMode)}
                    className={sortMode === option.value ? "bg-primary text-primary-foreground" : ""}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {files.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
                <FileText className="size-8" />
              </div>
              <h3 className="text-lg font-semibold">No files yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload files to share them with your team.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Upload first file
              </Button>
            </CardContent>
          </Card>
        ) : filteredFiles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4 text-muted-foreground">
                <Search className="size-8" />
              </div>
              <h3 className="text-lg font-semibold">No files match this view</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing the search, type filter, or sort order.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {linkedFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Linked To Tasks
                  </h2>
                  <Badge variant="secondary">{linkedFiles.length}</Badge>
                </div>
                <FilesTable
                  files={linkedFiles}
                  taskNamesById={taskNamesById}
                  uploaderNamesById={uploaderNamesById}
                  onDelete={setDeleteTarget}
                  onPreview={setPreviewTarget}
                  onShare={setShareTarget}
                  onRename={openRename}
                />
              </div>
            ) : null}

            {generalFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    General Files
                  </h2>
                  <Badge variant="outline">{generalFiles.length}</Badge>
                </div>
                <FilesTable
                  files={generalFiles}
                  taskNamesById={taskNamesById}
                  uploaderNamesById={uploaderNamesById}
                  onDelete={setDeleteTarget}
                  onPreview={setPreviewTarget}
                  onShare={setShareTarget}
                  onRename={openRename}
                />
              </div>
            ) : null}
          </div>
        )}
      </TeamPageGuard>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload files</DialogTitle>
          </DialogHeader>
          <UploadZone
            teamId={selectedTeamId ?? ""}
            onDone={() => {
              setUploadOpen(false);
              void loadFiles();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRename();
              }
            }}
            placeholder="File name"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button
              type="button"
              disabled={renaming || !renameValue.trim()}
              onClick={() => void handleRename()}
              className="gap-2"
            >
              {renaming ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{deleteTarget?.fileName}</span> will be
            permanently deleted and cannot be recovered.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
              className="gap-2"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewTarget && (
        <FilePreviewModal
          file={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onOpenShare={() => {
            setShareTarget(previewTarget);
            setPreviewTarget(null);
          }}
        />
      )}
      {shareTarget && (
        <ShareLinkModal
          file={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </motion.div>
  );
}

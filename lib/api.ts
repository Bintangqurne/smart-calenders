// ─── Domain Types (mirrored from backend) ───────────────────────

export interface User {
  userId: string;
  name: string;
  email: string;
  points: number;
  createdAt: string;
}

export interface Team {
  teamId: string;
  name: string;
  createdBy: string;
  members: string[];
  memberRoles?: Record<string, TeamRole>;
  createdAt: string;
  memberDetails?: TeamMember[];
}

export type TeamRole = "owner" | "admin" | "member";

export interface TeamMember {
  userId: string;
  name: string;
  email: string | null;
  role?: TeamRole;
}

export type MeetingStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface Meeting {
  meetingId: string;
  teamId: string;
  title: string;
  description: string;
  agenda: string;
  meetingLink: string;
  startTime: string;
  endTime: string;
  attendeeUserIds: string[];
  createdBy: string;
  status: MeetingStatus;
  googleEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventSource = "manual" | "google";

export interface CalendarEvent {
  eventId: string;
  userId: string;
  teamId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  source: EventSource;
  isPersonal: boolean;
  googleEventId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "ON_QC" | "DONE";

export interface Task {
  taskId: string;
  teamId: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  deadline: string;
  status: TaskStatus;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FileRecord {
  fileId: string;
  taskId: string | null;
  teamId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key: string;
  version: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  completedTasks?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  onTimeCompletedTasks?: number;
}

export interface TeamAvailabilityMember {
  userId: string;
  name: string;
  email: string | null;
  source: "google" | "internal";
  busySlots: Array<{
    start: string;
    end: string;
  }>;
}

export interface TeamCalendarResponse {
  team: {
    teamId: string;
    name: string;
    memberCount: number;
  };
  range: {
    timeMin: string;
    timeMax: string;
  };
  meetings: Meeting[];
  teamEvents: CalendarEvent[];
  memberSchedules: TeamAvailabilityMember[];
  recommendedSlots: Array<{
    start: string;
    end: string;
  }>;
}

export interface MeetingDetailResponse {
  meeting: Meeting;
  linkedTasks: Task[];
  preMeetingTasks: Task[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    preMeetingTotal: number;
    preMeetingCompleted: number;
    preMeetingPending: number;
  };
}

// ─── API Client ─────────────────────────────────────────────────

const API_BASE = "/api/proxy";
let isRedirectingForAuth = false;

function forceLogout(reason: "session-expired" = "session-expired") {
  if (typeof window === "undefined" || isRedirectingForAuth) return;
  isRedirectingForAuth = true;
  window.localStorage.removeItem("smart-scheduler:selected-team-id");
  window.location.replace(`/api/auth/logout?reason=${reason}`);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    forceLogout();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

// ─── Events ────────────────────────────────────────────────────

export function getEvents(): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>("/events");
}

export function getEvent(eventId: string): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>(`/events/${eventId}`);
}

export function createEvent(data: {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  teamId?: string;
  isPersonal?: boolean;
}): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>("/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEvent(
  eventId: string,
  data: {
    title?: string;
    startTime?: string;
    endTime?: string;
    description?: string;
  }
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>(`/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, {
    method: "DELETE",
  });
}

export function syncGoogleCalendar(): Promise<{ synced: number; total: number }> {
  return apiFetch<{ synced: number; total: number }>("/events/sync-google", {
    method: "POST",
  });
}

// ─── Settings / Auth ──────────────────────────────────────────

export interface GoogleStatus {
  connected: boolean;
  googleConnected: boolean;
  calendarId: string;
  scopes: string[];
  refreshTokenUpdatedAt: string | null;
  email: string;
}

export function getGoogleStatus(): Promise<GoogleStatus> {
  return apiFetch<GoogleStatus>("/auth/google");
}

export function disconnectGoogle(): Promise<void> {
  return apiFetch<void>("/auth/google", { method: "DELETE" });
}

// ─── Meetings ──────────────────────────────────────────────────

export function getMeetings(
  teamId: string,
  status?: MeetingStatus
): Promise<Meeting[]> {
  const query = new URLSearchParams({ teamId });
  if (status) {
    query.set("status", status);
  }

  return apiFetch<Meeting[]>(`/meetings?${query.toString()}`);
}

export function createMeeting(data: {
  title: string;
  description?: string;
  agenda?: string;
  meetingLink?: string;
  startTime: string;
  endTime: string;
  teamId: string;
  attendeeUserIds?: string[];
}): Promise<Meeting> {
  return apiFetch<Meeting>("/meetings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMeeting(meetingId: string): Promise<MeetingDetailResponse> {
  return apiFetch<MeetingDetailResponse>(`/meetings/${meetingId}`);
}

export function updateMeeting(
  meetingId: string,
  data: {
    title?: string;
    description?: string;
    agenda?: string;
    meetingLink?: string;
    startTime?: string;
    endTime?: string;
    attendeeUserIds?: string[];
    status?: MeetingStatus;
  }
): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteMeeting(meetingId: string): Promise<void> {
  return apiFetch<void>(`/meetings/${meetingId}`, {
    method: "DELETE",
  });
}

export function getTeamCalendar(params: {
  teamId: string;
  date?: string;
  timeMin?: string;
  timeMax?: string;
  duration?: number;
}): Promise<TeamCalendarResponse> {
  const query = new URLSearchParams();

  if (params.date) query.set("date", params.date);
  if (params.timeMin) query.set("timeMin", params.timeMin);
  if (params.timeMax) query.set("timeMax", params.timeMax);
  if (params.duration) query.set("duration", String(params.duration));

  return apiFetch<TeamCalendarResponse>(
    `/teams/${params.teamId}/calendar?${query.toString()}`
  );
}

// ─── Tasks ─────────────────────────────────────────────────────

export function getTasks(teamId: string): Promise<Task[]> {
  return apiFetch<Task[]>(`/tasks?teamId=${teamId}`);
}

export function createTask(data: {
  title: string;
  description?: string;
  assignedTo: string;
  deadline: string;
  teamId: string;
}): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTask(
  taskId: string,
  data: {
    title?: string;
    status?: TaskStatus;
    assignedTo?: string;
    deadline?: string;
    sortOrder?: number;
  }
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Teams ─────────────────────────────────────────────────────

export function getTeams(): Promise<Team[]> {
  // No direct "list teams" endpoint — we'll scan user's teams
  // For now, use the events endpoint contextually
  return apiFetch<Team[]>("/teams");
}

export function getTeam(teamId: string): Promise<Team> {
  return apiFetch<Team>(`/teams/${teamId}`);
}

export function createTeam(name: string): Promise<Team> {
  return apiFetch<Team>("/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function addMember(teamId: string, userId: string): Promise<Team> {
  return apiFetch<Team>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function updateTeam(
  teamId: string,
  data: { name?: string; roleUpdates?: Record<string, TeamRole> }
): Promise<Team> {
  return apiFetch<Team>(`/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function inviteMemberByEmail(teamId: string, email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeMember(teamId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function deleteTeam(teamId: string): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}`, {
    method: "DELETE",
  });
}

// ─── Files ─────────────────────────────────────────────────────

export function getFiles(params: { teamId?: string; taskId?: string }): Promise<FileRecord[]> {
  const query = new URLSearchParams();
  if (params.teamId) query.set("teamId", params.teamId);
  if (params.taskId) query.set("taskId", params.taskId);
  return apiFetch<FileRecord[]>(`/files?${query.toString()}`);
}

// ─── Leaderboard ───────────────────────────────────────────────

export function getLeaderboard(teamId: string): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>(`/leaderboard?teamId=${teamId}`);
}

// ─── Task CRUD (extended) ──────────────────────────────────────

export function deleteTask(taskId: string): Promise<void> {
  return apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" });
}

// ─── File CRUD (extended) ──────────────────────────────────────

export function deleteFile(fileId: string): Promise<void> {
  return apiFetch<void>(`/files/${fileId}`, { method: "DELETE" });
}

/** Request a presigned S3 upload URL from the backend. */
export function getUploadUrl(params: {
  teamId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  taskId?: string;
}): Promise<{ uploadUrl: string; fileId: string; s3Key: string }> {
  return apiFetch<{ uploadUrl: string; fileId: string; s3Key: string }>("/files/presigned-url", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** PUT a file binary directly to a presigned S3 URL (no auth headers). */
export async function uploadFileToS3(
  presignedUrl: string,
  file: File
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error(`S3 upload failed: HTTP ${res.status}`);
}

// ─── Chat (F1) ───────────────────────────────────────────────────

export type ConversationType =
  | "dm"
  | "channel"
  | "task_thread"
  | "meeting_thread"
  | "file_thread";

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  scopeKey: string;
  scopeId: string;
  teamId?: string | null;
  memberIds: string[];
  lastMessageAt: string;
  lastMessagePreview: string;
  createdBy: string;
  createdAt: string;
  unreadCount?: number;
  muted?: boolean;
  lastReadMessageId?: string | null;
}

export interface Message {
  conversationId: string;
  sk: string;
  messageId: string;
  senderId: string;
  senderEmail?: string;
  body: string;
  attachments: unknown[];
  mentions: string[];
  parentMessageId: string | null;
  reactions: Record<string, string[]>;
  clientMsgId: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export function createDm(otherUserId: string): Promise<Conversation> {
  return apiFetch<Conversation>("/conversations/dm", {
    method: "POST",
    body: JSON.stringify({ otherUserId }),
  });
}

export function listConversations(): Promise<{ conversations: Conversation[] }> {
  return apiFetch("/conversations");
}

export function getOrCreateThread(
  scopeType: "task" | "meeting" | "file",
  scopeId: string
): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/conversations/thread/${scopeType}/${scopeId}`,
    { method: "POST" }
  );
}

export function sendMessage(
  conversationId: string,
  payload: {
    body: string;
    clientMsgId: string;
    parentMessageId?: string | null;
    attachments?: unknown[];
  }
): Promise<Message> {
  return apiFetch<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listMessages(
  conversationId: string,
  opts?: { before?: string; since?: string; limit?: number }
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (opts?.before) q.set("before", opts.before);
  if (opts?.since) q.set("since", opts.since);
  if (opts?.limit) q.set("limit", String(opts.limit));
  const qs = q.toString();
  return apiFetch(
    `/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`
  );
}

export function reactToMessage(
  conversationId: string,
  messageId: string,
  emoji: string,
  action: "add" | "remove" = "add"
): Promise<{ reactions: Record<string, string[]> }> {
  return apiFetch(
    `/conversations/${conversationId}/messages/${messageId}/reactions`,
    { method: "POST", body: JSON.stringify({ emoji, action }) }
  );
}

export function editMessage(
  conversationId: string,
  messageId: string,
  body: string
): Promise<{ messageId: string; body: string; editedAt: string }> {
  return apiFetch(`/conversations/${conversationId}/messages/${messageId}`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}

export function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  return apiFetch<void>(
    `/conversations/${conversationId}/messages/${messageId}`,
    { method: "DELETE" }
  );
}

export function markConversationRead(
  conversationId: string,
  lastReadMessageId: string
): Promise<{ ok: boolean }> {
  return apiFetch(`/conversations/${conversationId}/read`, {
    method: "POST",
    body: JSON.stringify({ lastReadMessageId }),
  });
}

export function createChannel(payload: {
  teamId: string;
  name: string;
  description?: string;
}): Promise<Conversation> {
  return apiFetch<Conversation>("/conversations/channel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Notifications (F3) ──────────────────────────────────────────

export type NotificationType =
  | "mention"
  | "reply"
  | "reaction"
  | "task_assigned"
  | "meeting_invite"
  | "file_share";

export interface Notification {
  userId: string;
  sk: string;
  notificationId: string;
  type: NotificationType;
  sourceType: string;
  sourceId: string;
  teamId?: string;
  conversationId?: string;
  title: string;
  body: string;
  read: boolean;
  unreadKey?: string;
  createdAt: string;
}

export function listNotifications(opts?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.unreadOnly) q.set("unread", "true");
  const qs = q.toString();
  return apiFetch(`/notifications${qs ? `?${qs}` : ""}`);
}

export function markNotificationRead(sk: string): Promise<{ ok: boolean }> {
  return apiFetch(`/notifications/${encodeURIComponent(sk)}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<{
  ok: boolean;
  updated: number;
}> {
  return apiFetch(`/notifications/read-all`, { method: "POST" });
}

// ─── File Collab (F2) ────────────────────────────────────────────

export interface FileVersion {
  fileId: string;
  sk: string;
  versionNumber: number;
  s3Key: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  comment: string;
}

export interface FilePreviewInfo {
  previewUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  version: number;
  expiresIn: number;
}

export interface FileShareInfo {
  shortCode: string;
  expiresAt: string;
  hasPassword: boolean;
  permission: "view" | "download";
  url: string;
}

export function getFilePreviewUrl(fileId: string): Promise<FilePreviewInfo> {
  return apiFetch<FilePreviewInfo>(`/files/${fileId}/preview`);
}

export function listFileVersions(
  fileId: string
): Promise<{ versions: FileVersion[]; currentVersion: number }> {
  return apiFetch(`/files/${fileId}/versions`);
}

export function createFileVersion(
  fileId: string,
  payload: { fileType: string; fileSize: number; comment?: string }
): Promise<{
  uploadUrl: string;
  s3Key: string;
  versionNumber: number;
  expiresIn: number;
}> {
  return apiFetch(`/files/${fileId}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createFileShareLink(
  fileId: string,
  payload: {
    expiresInSeconds?: number;
    password?: string;
    permission?: "view" | "download";
    maxAccess?: number;
  }
): Promise<FileShareInfo> {
  return apiFetch<FileShareInfo>(`/files/${fileId}/shares`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeFileShareLink(shortCode: string): Promise<{ ok: boolean }> {
  return apiFetch(`/files/shares/${shortCode}`, { method: "DELETE" });
}

// ─── Templates (F7) ──────────────────────────────────────────────

export type TemplateType = "task" | "meeting";

export interface Template {
  templateId: string;
  sk: string;
  scopeKey: string;
  teamId: string | null;
  templateType: TemplateType;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
}

export function listTemplates(opts?: {
  type?: TemplateType;
  teamId?: string;
}): Promise<{ templates: Template[] }> {
  const q = new URLSearchParams();
  if (opts?.type) q.set("type", opts.type);
  if (opts?.teamId) q.set("teamId", opts.teamId);
  const qs = q.toString();
  return apiFetch(`/templates${qs ? `?${qs}` : ""}`);
}

export function createTemplate(payload: {
  templateType: TemplateType;
  name: string;
  description?: string;
  payload: Record<string, unknown>;
  teamId?: string;
  isPublic?: boolean;
}): Promise<Template> {
  return apiFetch<Template>("/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteTemplate(templateId: string): Promise<void> {
  return apiFetch<void>(`/templates/${templateId}`, { method: "DELETE" });
}

// ─── Guest Invites (F12) ─────────────────────────────────────────

export type GuestScope = "meeting" | "file";

export interface GuestInviteCreated {
  shortCode: string;
  expiresAt: string;
  hasPassword: boolean;
  scope: GuestScope;
  url: string;
}

export function createGuestInvite(payload: {
  scope: GuestScope;
  scopeId: string;
  expiresInSeconds?: number;
  password?: string;
  maxAccess?: number;
}): Promise<GuestInviteCreated> {
  return apiFetch<GuestInviteCreated>("/guest-invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeGuestInvite(shortCode: string): Promise<{ ok: boolean }> {
  return apiFetch(`/guest-invites/${shortCode}`, { method: "DELETE" });
}

// ─── Profile & Seasons (F9, F10) ─────────────────────────────────

export interface Profile {
  usernameLower: string;
  username: string;
  userId: string;
  email?: string;
  displayName: string;
  bio: string;
  profilePublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  bio: string;
  profilePublic: boolean;
  stats: { points: number; completedTasks: number };
  badges: { name: string; description: string; icon: string }[];
  memberSince: string;
}

export interface GlobalLeaderboardEntry {
  userId: string;
  username: string | null;
  displayName: string;
  points: number;
  rank: number;
  badge: string | null;
}

export interface SeasonMetadata {
  seasonId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  participantCount: number;
}

export interface SeasonScoreEntry {
  seasonId: string;
  userId: string;
  rank: number;
  points: number;
  username: string | null;
  displayName: string;
}

export function getMyProfile(): Promise<{ profile: Profile | null }> {
  return apiFetch("/profile");
}

export function setProfile(payload: {
  username: string;
  bio?: string;
  profilePublic?: boolean;
  displayName?: string;
}): Promise<Profile> {
  return apiFetch<Profile>("/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const res = await fetch(
    `/api/proxy-public/public/profile/${encodeURIComponent(username)}`
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as PublicProfile;
}

export function getGlobalLeaderboard(): Promise<{
  entries: GlobalLeaderboardEntry[];
  totalParticipants: number;
}> {
  return apiFetch("/leaderboard/global");
}

export function listSeasons(seasonId?: string): Promise<{
  seasons?: SeasonMetadata[];
  seasonId?: string;
  entries?: SeasonScoreEntry[];
}> {
  const qs = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
  return apiFetch(`/seasons${qs}`);
}

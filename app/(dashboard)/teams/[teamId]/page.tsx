"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Loader2,
  MailPlus,
  Pencil,
  Presentation,
  Shield,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/hooks/use-team";
import {
  deleteTeam,
  getTeam,
  inviteMemberByEmail,
  removeMember,
  updateTeam,
  type Team,
  type TeamMember,
  type TeamRole,
} from "@/lib/api";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function getInitials(name?: string | null, fallback?: string) {
  const safeName = name?.trim();
  if (safeName) {
    return safeName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  return fallback?.slice(0, 2).toUpperCase() ?? "??";
}

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

function getMemberDisplayName(member: Pick<TeamMember, "name" | "email">) {
  const trimmedName = member.name?.trim();
  if (trimmedName && trimmedName !== "Unknown User" && !looksLikeOpaqueUserId(trimmedName)) {
    return trimmedName;
  }

  return getEmailLabel(member.email) || "Team member";
}

function getMemberMeta(member: Pick<TeamMember, "email">) {
  return member.email?.trim() || "Profile email not available yet";
}

function getResolvedMembers(team: Team | null): TeamMember[] {
  if (!team) return [];

  if (team.memberDetails?.length) {
    return team.memberDetails.map((member) => ({
      ...member,
      name: getMemberDisplayName(member),
      email: member.email?.trim() || null,
    }));
  }

  return team.members.map((userId) => ({
    userId,
    name: "Team member",
    email: null,
    role: userId === team.createdBy ? "owner" : team.memberRoles?.[userId] ?? "member",
  }));
}

function getTeamRole(team: Team | null, userId: string | null): TeamRole | null {
  if (!team || !userId || !team.members.includes(userId)) return null;
  if (team.createdBy === userId) return "owner";
  return team.memberRoles?.[userId] ?? "member";
}

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const { reloadTeams, selectTeam } = useTeam();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTeam(teamId);
      setTeam(data);
      setEditName(data.name);
    } catch (err) {
      console.error("Failed to load team details:", err);
      setTeam(null);
      setError(err instanceof Error ? err.message : "Failed to load team details.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    setCurrentUserId(readCookie("user_id"));
    selectTeam(teamId);
    void loadTeam();
  }, [loadTeam, selectTeam, teamId]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setNotice(null);

    try {
      await inviteMemberByEmail(teamId, inviteEmail.trim());
      await Promise.all([loadTeam(), reloadTeams()]);
      setNotice(`Member added: ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch (err) {
      console.error("Failed to invite member:", err);
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!team) return;

    const target = getResolvedMembers(team).find((member) => member.userId === userId);
    const confirmed = window.confirm(
      `Remove ${target?.name || target?.email || "this member"} from ${team.name}?`
    );

    if (!confirmed) return;

    setRemovingId(userId);
    setError(null);
    setNotice(null);

    try {
      await removeMember(teamId, userId);
      await Promise.all([loadTeam(), reloadTeams()]);
      setNotice("Member removed.");
    } catch (err) {
      console.error("Failed to remove member:", err);
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleSaveName() {
    if (!team) return;

    if (!editName.trim() || editName.trim() === team.name) {
      setEditName(team.name);
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    setError(null);
    setNotice(null);

    try {
      await updateTeam(teamId, { name: editName.trim() });
      await Promise.all([loadTeam(), reloadTeams()]);
      setIsEditingName(false);
      setNotice("Team name updated.");
    } catch (err) {
      console.error("Failed to update team name:", err);
      setError(err instanceof Error ? err.message : "Failed to update team name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleDeleteTeam() {
    if (!team) return;

    const confirmed = window.confirm(
      `Delete team "${team.name}"? This removes the shared team workspace.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteTeam(teamId);
      await reloadTeams();
      router.push("/teams");
    } catch (err) {
      console.error("Failed to delete team:", err);
      setError(err instanceof Error ? err.message : "Failed to delete team");
      setDeleting(false);
    }
  }

  async function handleRoleUpdate(userId: string, role: TeamRole) {
    if (!team) return;

    setError(null);
    setNotice(null);

    try {
      await updateTeam(teamId, { roleUpdates: { [userId]: role } });
      await Promise.all([loadTeam(), reloadTeams()]);
      setNotice(role === "admin" ? "Member promoted to admin." : "Admin reverted to member.");
    } catch (err) {
      console.error("Failed to update member role:", err);
      setError(err instanceof Error ? err.message : "Failed to update member role");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-4">
        <Button variant="outline" nativeButton={false} render={<Link href="/teams" />}>
          <ArrowLeft className="size-4" />
          Back to teams
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || "Team not found."}
        </div>
      </div>
    );
  }

  const members = getResolvedMembers(team);
  const currentUserRole = getTeamRole(team, currentUserId);
  const isOwner = currentUserRole === "owner";
  const canManageTeam = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col gap-4">
        <Button variant="outline" className="w-fit" nativeButton={false} render={<Link href="/teams" />}>
          <ArrowLeft className="size-4" />
          Back to teams
        </Button>

        <Card className="border-primary/10 bg-gradient-to-br from-primary/6 via-background to-background">
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Team Detail</Badge>
                  <Badge variant={canManageTeam ? "default" : "outline"}>
                    {isOwner
                      ? "Owner controls"
                      : currentUserRole === "admin"
                      ? "Admin controls"
                      : "Member view"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
                    {canManageTeam ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setIsEditingName((value) => !value)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Central place for team members, invitations, workspace access, and team
                    settings.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-72">
                <div className="rounded-xl border bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Members
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{members.length}</p>
                </div>
                <div className="rounded-xl border bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Access
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {currentUserRole === "owner"
                      ? "Owner"
                      : currentUserRole === "admin"
                      ? "Admin"
                      : "Member"}
                  </p>
                </div>
              </div>
            </div>

            {isEditingName ? (
              <div className="flex flex-col gap-3 rounded-xl border bg-background/80 p-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditName(team.name);
                      setIsEditingName(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveName} disabled={savingName}>
                    {savingName ? "Saving…" : "Save name"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      {notice ? (
        <motion.div variants={item}>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        </motion.div>
      ) : null}

      {error ? (
        <motion.div variants={item}>
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        </motion.div>
      ) : null}

      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Presentation className="size-4 text-primary" />
              Meetings
            </CardTitle>
            <CardDescription>Open the schedule view for this active team.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/meetings" onClick={() => selectTeam(teamId)} />}
            >
              Open meetings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Calendar
            </CardTitle>
            <CardDescription>Review team events and shared calendar availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/events" onClick={() => selectTeam(teamId)} />}
            >
              Open calendar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" />
              Tasks
            </CardTitle>
            <CardDescription>Manage work items assigned inside this team.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/tasks" onClick={() => selectTeam(teamId)} />}
            >
              Open tasks
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              Files
            </CardTitle>
            <CardDescription>Jump to uploaded files and shared documents.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/files" onClick={() => selectTeam(teamId)} />}
            >
              Open files
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <motion.div variants={item}>
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center justify-between gap-3 text-lg">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Members ({members.length})
                </span>
                {canManageTeam ? (
                  <Badge variant="secondary">
                    {isOwner ? "Owner controls enabled" : "Admin controls enabled"}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Team roster with identity details from the member directory.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y">
                {members.map((member) => {
                  const isMemberOwner = member.userId === team.createdBy;
                  const isSelf = member.userId === currentUserId;
                  const isRemoving = removingId === member.userId;
                  const memberRole = member.role ?? (isMemberOwner ? "owner" : "member");

                  return (
                    <div
                      key={member.userId}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {getInitials(member.name, member.email ?? member.userId)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {member.name || "Unknown member"}
                            </p>
                            {isSelf ? <Badge variant="outline">You</Badge> : null}
                            {isMemberOwner ? (
                              <Badge variant="secondary" className="gap-1">
                                <Shield className="size-3" />
                                Owner
                              </Badge>
                            ) : memberRole === "admin" ? (
                              <Badge variant="secondary" className="gap-1">
                                <Shield className="size-3" />
                                Admin
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {getMemberMeta(member)}
                          </p>
                        </div>
                      </div>

                      {canManageTeam && !isMemberOwner ? (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                          {isOwner ? (
                            <Button
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                void handleRoleUpdate(
                                  member.userId,
                                  memberRole === "admin" ? "member" : "admin"
                                )
                              }
                            >
                              <Shield className="size-4" />
                              {memberRole === "admin" ? "Remove admin" : "Make admin"}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="w-full justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:w-auto"
                            disabled={isRemoving}
                            onClick={() => handleRemoveMember(member.userId)}
                          >
                            {isRemoving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <UserMinus className="size-4" />
                            )}
                            Remove member
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="space-y-4">
          <Card className="border-primary/10 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Invite members</CardTitle>
              <CardDescription>
                Add teammates by email so they can access the shared workspace.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {canManageTeam ? (
                <form onSubmit={handleInvite} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="w-full">
                    {inviting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MailPlus className="size-4" />
                    )}
                    Send invite
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  Only admins and the owner can add or remove members from this workspace.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team settings</CardTitle>
              <CardDescription>
                Rename the team and keep workspace labeling consistent across pages.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Current name
                </p>
                <p className="mt-1 text-sm font-medium">{team.name}</p>
              </div>

              {canManageTeam ? (
                <Button variant="outline" className="w-full" onClick={() => setIsEditingName(true)}>
                  <Pencil className="size-4" />
                  Rename team
                </Button>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Team naming is controlled by admins and the owner.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Permanent actions for this team workspace should stay isolated here.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isOwner ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={deleting}
                  onClick={handleDeleteTeam}
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete team
                </Button>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Only the team owner can delete this team.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

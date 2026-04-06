"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  MailPlus,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/hooks/use-team";
import {
  createTeam,
  deleteTeam,
  getTeam,
  inviteMemberByEmail,
  type Team,
  type TeamMember,
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

function getPreviewLabel(members: TeamMember[] | undefined, memberCount: number) {
  if (!members?.length) {
    return `${memberCount} member${memberCount === 1 ? "" : "s"}`;
  }

  const visibleNames = members
    .slice(0, 3)
    .map((member) => member.name?.trim() || member.email || "Unknown member");

  const extraCount = memberCount - visibleNames.length;

  if (extraCount > 0) {
    return `${visibleNames.join(", ")} +${extraCount} more`;
  }

  return visibleNames.join(", ");
}

export default function TeamsPage() {
  const { teams, selectedTeamId, isLoadingTeams, reloadTeams, selectTeam } = useTeam();
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamDetailsById, setTeamDetailsById] = useState<Record<string, Team>>({});
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(readCookie("user_id"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamDetails() {
      if (teams.length === 0) {
        setTeamDetailsById({});
        return;
      }

      setLoadingTeamDetails(true);

      const results = await Promise.allSettled(
        teams.map(async (team) => {
          const detail = await getTeam(team.teamId);
          return [team.teamId, detail] as const;
        })
      );

      if (cancelled) return;

      const nextDetails: Record<string, Team> = {};

      for (const result of results) {
        if (result.status === "fulfilled") {
          const [teamId, detail] = result.value;
          nextDetails[teamId] = detail;
        }
      }

      setTeamDetailsById(nextDetails);
      setLoadingTeamDetails(false);
    }

    void loadTeamDetails();

    return () => {
      cancelled = true;
    };
  }, [teams]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) {
        setError("Team name is required.");
        return;
      }

      await createTeam(name);
      try {
        await reloadTeams();
        setNotice("Team created.");
      } catch (reloadErr) {
        console.error("Team created but failed to refresh teams:", reloadErr);
        setNotice("Team created. Refresh the page if it does not appear yet.");
      }

      form.reset();
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Failed to create team:", err);
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteTeamId || !inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setNotice(null);

    try {
      await inviteMemberByEmail(inviteTeamId, inviteEmail.trim());
      await reloadTeams();
      setNotice(`Invitation target added: ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteTeamId(null);
    } catch (err) {
      console.error("Failed to invite member:", err);
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(teamId: string) {
    setDeletingTeamId(teamId);
    setError(null);
    setNotice(null);

    try {
      await deleteTeam(teamId);
      try {
        await reloadTeams();
        setNotice("Team deleted.");
      } catch (reloadErr) {
        console.error("Team deleted but failed to refresh teams:", reloadErr);
        setNotice("Team deleted. Refresh the page if it still appears in the list.");
      }
    } catch (err) {
      console.error("Failed to delete team:", err);
      setError(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeletingTeamId(null);
    }
  }

  if (isLoadingTeams) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="animate-pulse text-muted-foreground">Loading teams…</p>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Open a team workspace, manage members, and keep the active team in sync.
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="size-4" />
            New Team
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
            </DialogHeader>
            <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input id="name" name="name" placeholder="e.g. Engineering" required />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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

      {teams.length === 0 ? (
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 size-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No teams yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a team to start collaborating across meetings, tasks, and files.
              </p>
              <Button className="mt-5 gap-2" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="size-4" />
                Create your first team
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const detail = teamDetailsById[team.teamId];
            const previewMembers = detail?.memberDetails?.slice(0, 4);
            const isCreator = currentUserId === team.createdBy;
            const isDeleting = deletingTeamId === team.teamId;
            const isInviteOpen = inviteTeamId === team.teamId;
            const isActive = selectedTeamId === team.teamId;

            return (
              <motion.div key={team.teamId} variants={item}>
                <Card className="h-full transition-all hover:border-primary/20 hover:shadow-md">
                  <CardHeader className="space-y-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{team.name}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isCreator ? "You created this team" : "You are a member"}
                        </p>
                      </div>
                      <div className="rounded-full bg-primary/8 p-2 text-primary">
                        <Users className="size-4" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex -space-x-2">
                        {previewMembers?.map((member) => (
                          <Avatar key={member.userId} className="size-9 border-2 border-background">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(member.name, member.email ?? member.userId)}
                            </AvatarFallback>
                          </Avatar>
                        ))}

                        {!previewMembers?.length && loadingTeamDetails ? (
                          <Avatar className="size-9 border-2 border-background">
                            <AvatarFallback className="bg-muted text-xs">
                              <Loader2 className="size-3 animate-spin" />
                            </AvatarFallback>
                          </Avatar>
                        ) : null}

                        {team.members.length > 4 ? (
                          <Avatar className="size-9 border-2 border-background">
                            <AvatarFallback className="bg-muted text-xs">
                              +{team.members.length - 4}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <p className="line-clamp-1 text-sm text-foreground">
                          {getPreviewLabel(detail?.memberDetails, team.members.length)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {team.members.length} member{team.members.length !== 1 ? "s" : ""} • Created{" "}
                          {new Date(team.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-2"
                        nativeButton={false}
                        render={
                          <Link
                            href={`/teams/${team.teamId}`}
                            onClick={() => selectTeam(team.teamId)}
                          />
                        }
                      >
                        Open Team
                        <ArrowRight className="size-4" />
                      </Button>

                      <Button
                        variant={isActive ? "secondary" : "outline"}
                        onClick={() => selectTeam(team.teamId)}
                      >
                        {isActive ? "Active Team" : "Use Team"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isCreator ? (
                        <>
                          <Dialog
                            open={isInviteOpen}
                            onOpenChange={(open) => {
                              setInviteTeamId(open ? team.teamId : null);
                              if (!open) setInviteEmail("");
                            }}
                          >
                            <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
                              <MailPlus className="size-4" />
                              Invite
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Invite Member</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor={`invite-${team.teamId}`}>Email</Label>
                                  <Input
                                    id={`invite-${team.teamId}`}
                                    type="email"
                                    placeholder="someone@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <DialogClose render={<Button variant="outline" type="button" />}>
                                    Cancel
                                  </DialogClose>
                                  <Button
                                    type="button"
                                    disabled={inviting || !inviteEmail.trim()}
                                    onClick={handleInvite}
                                  >
                                    {inviting ? "Inviting…" : "Add Member"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="destructive"
                            className="gap-2"
                            disabled={isDeleting}
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Delete team "${team.name}"? This only removes the team record.`
                              );

                              if (confirmed) {
                                void handleDelete(team.teamId);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                            {isDeleting ? "Deleting…" : "Delete"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

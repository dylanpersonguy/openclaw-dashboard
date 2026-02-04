"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@clerk/nextjs";

import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { TaskBoard } from "@/components/organisms/TaskBoard";
import { DashboardShell } from "@/components/templates/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Board = {
  id: string;
  name: string;
  slug: string;
  gateway_url?: string | null;
  gateway_token?: string | null;
  gateway_main_session_key?: string | null;
  gateway_workspace_root?: string | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_at?: string | null;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000";

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function BoardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const boardIdParam = params?.boardId;
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;
  const { getToken, isSignedIn } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [gatewayMainSessionKey, setGatewayMainSessionKey] = useState("");
  const [gatewayWorkspaceRoot, setGatewayWorkspaceRoot] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const titleLabel = useMemo(
    () => (board ? `${board.name} board` : "Board"),
    [board],
  );

  const loadBoard = async () => {
    if (!isSignedIn || !boardId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [boardResponse, tasksResponse] = await Promise.all([
        fetch(`${apiBase}/api/v1/boards/${boardId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }),
        fetch(`${apiBase}/api/v1/boards/${boardId}/tasks`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }),
      ]);

      if (!boardResponse.ok) {
        throw new Error("Unable to load board.");
      }
      if (!tasksResponse.ok) {
        throw new Error("Unable to load tasks.");
      }

      const boardData = (await boardResponse.json()) as Board;
      const taskData = (await tasksResponse.json()) as Task[];
      setBoard(boardData);
      setTasks(taskData);
      setGatewayUrl(boardData.gateway_url ?? "");
      setGatewayMainSessionKey(boardData.gateway_main_session_key ?? "");
      setGatewayWorkspaceRoot(boardData.gateway_workspace_root ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, isSignedIn]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCreateError(null);
  };

  const handleCreateTask = async () => {
    if (!isSignedIn || !boardId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Add a task title to continue.");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${apiBase}/api/v1/boards/${boardId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          title: trimmed,
          description: description.trim() || null,
          status: "inbox",
          priority,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create task.");
      }

      const created = (await response.json()) as Task;
      setTasks((prev) => [created, ...prev]);
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!isSignedIn || !boardId) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const token = await getToken();
      const payload: Partial<Board> = {
        gateway_url: gatewayUrl.trim() || null,
        gateway_main_session_key: gatewayMainSessionKey.trim() || null,
        gateway_workspace_root: gatewayWorkspaceRoot.trim() || null,
      };
      if (gatewayToken.trim()) {
        payload.gateway_token = gatewayToken.trim();
      }
      const response = await fetch(`${apiBase}/api/v1/boards/${boardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Unable to update board settings.");
      }
      const updated = (await response.json()) as Board;
      setBoard(updated);
      setGatewayUrl(updated.gateway_url ?? "");
      setGatewayMainSessionKey(updated.gateway_main_session_key ?? "");
      setGatewayWorkspaceRoot(updated.gateway_workspace_root ?? "");
      setGatewayToken("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell>
      <SignedOut>
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl surface-panel p-10 text-center">
          <p className="text-sm text-muted">Sign in to view boards.</p>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/boards"
            signUpForceRedirectUrl="/boards"
          >
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        <div className="flex h-full flex-col gap-6 rounded-2xl surface-panel p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quiet">
                {board?.slug ?? "board"}
              </p>
              <h1 className="text-2xl font-semibold text-strong">
                {board?.name ?? "Board"}
              </h1>
              <p className="text-sm text-muted">
                Keep tasks moving through your workflow.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/boards")}
            >
              Back to boards
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              Loading {titleLabel}…
            </div>
          ) : (
            <>
              <TaskBoard
                tasks={tasks}
                onCreateTask={() => setIsDialogOpen(true)}
                isCreateDisabled={isCreating}
              />
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
                <div className="mb-4 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quiet">
                    Gateway settings
                  </p>
                  <h2 className="text-lg font-semibold text-strong">
                    Connect this board to an OpenClaw gateway.
                  </h2>
                  <p className="text-sm text-muted">
                    Used when provisioning agents and checking gateway status for
                    this board.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-strong">
                      Gateway URL
                    </label>
                    <Input
                      value={gatewayUrl}
                      onChange={(event) => setGatewayUrl(event.target.value)}
                      placeholder="ws://gateway:18789"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-strong">
                      Gateway token
                    </label>
                    <Input
                      value={gatewayToken}
                      onChange={(event) => setGatewayToken(event.target.value)}
                      placeholder="Leave blank to keep current token"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-strong">
                      Main session key
                    </label>
                    <Input
                      value={gatewayMainSessionKey}
                      onChange={(event) =>
                        setGatewayMainSessionKey(event.target.value)
                      }
                      placeholder="agent:main:main"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-strong">
                      Workspace root
                    </label>
                    <Input
                      value={gatewayWorkspaceRoot}
                      onChange={(event) =>
                        setGatewayWorkspaceRoot(event.target.value)
                      }
                      placeholder="~/.openclaw/workspaces"
                    />
                  </div>
                </div>
                {saveError ? (
                  <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
                    {saveError}
                  </div>
                ) : null}
                {saveSuccess ? (
                  <div className="mt-4 text-xs text-[color:var(--success)]">
                    Gateway settings saved.
                  </div>
                ) : null}
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save settings"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SignedIn>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsDialogOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <DialogContent aria-label={titleLabel}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Add a task to the inbox and triage it when you are ready.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-strong">Title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Prepare launch notes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-strong">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional details"
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-strong">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError ? (
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
                {createError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={isCreating}
            >
              {isCreating ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

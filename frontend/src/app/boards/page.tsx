"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";

import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { DashboardShell } from "@/components/templates/DashboardShell";
import { Button } from "@/components/ui/button";
import { apiRequest, useAuthedMutation, useAuthedQuery } from "@/lib/api-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Board = {
  id: string;
  name: string;
  slug: string;
};

export default function BoardsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);

  const boardsQuery = useAuthedQuery<Board[]>(["boards"], "/api/v1/boards", {
    refetchInterval: 30_000,
    refetchOnMount: "always",
  });

  const boards = boardsQuery.data ?? [];

  const sortedBoards = useMemo(
    () => [...boards].sort((a, b) => a.name.localeCompare(b.name)),
    [boards]
  );

  const deleteMutation = useAuthedMutation<void, Board, { previous?: Board[] }>(
    async (board, token) =>
      apiRequest(`/api/v1/boards/${board.id}`, {
        method: "DELETE",
        token,
      }),
    {
      onMutate: async (board) => {
        await queryClient.cancelQueries({ queryKey: ["boards"] });
        const previous = queryClient.getQueryData<Board[]>(["boards"]);
        queryClient.setQueryData<Board[]>(["boards"], (old = []) =>
          old.filter((item) => item.id !== board.id)
        );
        return { previous };
      },
      onError: (_error, _board, context) => {
        if (context?.previous) {
          queryClient.setQueryData(["boards"], context.previous);
        }
      },
      onSuccess: () => {
        setDeleteTarget(null);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["boards"] });
      },
    }
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget);
  };

  const columns = useMemo<ColumnDef<Board>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Board",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-strong">{row.original.name}</p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              href={`/boards/${row.original.id}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Open
            </Link>
            <Link
              href={`/boards/${row.original.id}/edit`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Edit
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: sortedBoards,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DashboardShell>
      <SignedOut>
        <div className="col-span-2 flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 p-10 text-center">
          <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
            <p className="text-sm text-slate-600">Sign in to view boards.</p>
            <SignInButton
              mode="modal"
              forceRedirectUrl="/boards"
              signUpForceRedirectUrl="/boards"
            >
              <Button className="mt-4">Sign in</Button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-slate-900 tracking-tight">
                  Boards
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {sortedBoards.length} board
                  {sortedBoards.length === 1 ? "" : "s"} total.
                </p>
              </div>
              {sortedBoards.length > 0 ? (
                <Button onClick={() => router.push("/boards/new")}>
                  New board
                </Button>
              ) : null}
            </div>
          </div>

          <div className="p-8">
            {boardsQuery.error && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
                {boardsQuery.error.message}
              </div>
            )}

            {sortedBoards.length === 0 && !boardsQuery.isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500">
                <p>No boards yet. Create your first board to get started.</p>
                <Button onClick={() => router.push("/boards/new")}>
                  Create your first board
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => router.push(`/boards/${row.original.id}`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-top">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </SignedIn>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent aria-label="Delete board">
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
            <DialogDescription>
              This will remove {deleteTarget?.name}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error ? (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
              {deleteMutation.error.message}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

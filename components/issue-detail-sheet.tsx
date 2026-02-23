"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  fetchIssue,
  fetchIssueComments,
  updateIssue,
  addIssueComment,
  type StockIssue,
  type StockIssueComment,
} from "@/lib/stock-api"
import { ISSUE_CLASSIFICATIONS } from "@/lib/constants"
import { AlertCircle, MessageSquare, PackagePlus, Send } from "lucide-react"
import { toast } from "sonner"

const NewProductDialog = dynamic(
  () => import("@/components/new-product-dialog").then((m) => ({ default: m.NewProductDialog })),
  { ssr: false }
)

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/20 text-destructive",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function IssueDetailSheet({
  issueId,
  open,
  onOpenChange,
  onSuccess,
}: {
  issueId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState("")
  const [newProductOpen, setNewProductOpen] = useState(false)

  const { data: issue, isLoading: issueLoading } = useQuery({
    queryKey: ["stock", "issue", issueId],
    queryFn: () => fetchIssue(issueId!),
    enabled: !!issueId && open,
  })

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ["stock", "issue", issueId, "comments"],
    queryFn: () => fetchIssueComments(issueId!),
    enabled: !!issueId && open,
  })

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; priority?: string; classification?: string | null }) =>
      updateIssue(issueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock", "issue", issueId] })
      queryClient.invalidateQueries({ queryKey: ["stock", "issues"] })
      onSuccess()
    },
    onError: () => toast.error("Failed to update issue"),
  })

  const commentMutation = useMutation({
    mutationFn: (body: string) => addIssueComment(issueId!, body),
    onSuccess: () => {
      setCommentBody("")
      refetchComments()
      queryClient.invalidateQueries({ queryKey: ["stock", "issue", issueId] })
      queryClient.invalidateQueries({ queryKey: ["stock", "issues"] })
      toast.success("Comment added")
    },
    onError: () => toast.error("Failed to add comment"),
  })

  useEffect(() => {
    if (!open) setCommentBody("")
  }, [open])

  const comments: StockIssueComment[] = commentsData?.comments ?? []

  const handleStatusChange = (status: string) => {
    if (status && issueId) updateMutation.mutate({ status })
  }

  const handlePriorityChange = (priority: string) => {
    if (priority && issueId) updateMutation.mutate({ priority })
  }

  const handleClassificationChange = (classification: string) => {
    if (issueId) updateMutation.mutate({ classification: classification === "__none__" ? null : classification })
  }

  const handleAddComment = () => {
    const body = commentBody.trim()
    if (!body || !issueId) return
    commentMutation.mutate(body)
  }

  const handleNewProductSuccess = () => {
    onSuccess()
  }

  if (!issueId) return null

  return (
    <>
      <NewProductDialog
        open={newProductOpen}
        onOpenChange={setNewProductOpen}
        defaultLocation={issue?.zone}
        defaultName={issue?.title}
        issueId={issueId}
        onSuccess={handleNewProductSuccess}
      />
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Issue Details
          </SheetTitle>
        </SheetHeader>

        {issueLoading || !issue ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="flex flex-col gap-6 pt-4">
              {/* Issue title */}
              <div>
                <h3 className="text-base font-semibold text-foreground leading-tight">
                  {issue.title}
                </h3>
              </div>

              {/* Status, Priority, Classification */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Issue details
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="issue-status" className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select value={issue.status} onValueChange={handleStatusChange}>
                      <SelectTrigger id="issue-status" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="issue-priority" className="text-xs text-muted-foreground">
                      Priority
                    </Label>
                    <Select value={issue.priority} onValueChange={handlePriorityChange}>
                      <SelectTrigger id="issue-priority" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="issue-classification" className="text-xs text-muted-foreground">
                      Classification
                    </Label>
                    <Select
                      value={issue.classification || "__none__"}
                      onValueChange={handleClassificationChange}
                    >
                      <SelectTrigger id="issue-classification" className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {ISSUE_CLASSIFICATIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Add as new product */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Add to catalog
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Create this item as a new product in the stock catalog.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setNewProductOpen(true)}
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Add as new product
                </Button>
              </div>

              {/* Description */}
              {issue.description && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Description
                  </Label>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>By {issue.reporterName}</span>
                <span aria-hidden>·</span>
                <span>{formatDate(issue.createdAt)}</span>
                {issue.zone && (
                  <>
                    <span aria-hidden>·</span>
                    <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] font-normal">
                      {issue.zone}
                    </Badge>
                  </>
                )}
              </div>

              {/* Comments */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Comments ({comments.length})
                  </span>
                </div>

                <div className="flex flex-col gap-3 mb-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No comments yet. Add one below.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border bg-background px-3 py-2.5"
                      >
                        <p className="text-sm text-foreground leading-relaxed">{c.body}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {c.userName} · {formatDate(c.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issue-comment" className="text-xs text-muted-foreground">
                    Add a comment
                  </Label>
                  <div className="flex gap-2">
                    <Textarea
                      id="issue-comment"
                      placeholder="Type your comment..."
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                    <Button
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={handleAddComment}
                      disabled={!commentBody.trim() || commentMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
    </>
  )
}

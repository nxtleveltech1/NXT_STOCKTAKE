"use client"

import { useState, useEffect } from "react"
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
import { AlertCircle, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

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
    mutationFn: (data: { status?: string; priority?: string }) =>
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

  const handleAddComment = () => {
    const body = commentBody.trim()
    if (!body || !issueId) return
    commentMutation.mutate(body)
  }

  if (!issueId) return null

  return (
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
            <div className="flex flex-col gap-4 pt-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{issue.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Select
                    value={issue.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="h-7 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={issue.priority}
                    onValueChange={handlePriorityChange}
                  >
                    <SelectTrigger className="h-7 w-[110px]">
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
              </div>

              {issue.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                    {issue.description}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>By {issue.reporterName}</span>
                <span>·</span>
                <span>{formatDate(issue.createdAt)}</span>
                {issue.zone && (
                  <>
                    <span>·</span>
                    <Badge variant="outline" className="h-4 px-1 py-0 text-[10px]">
                      {issue.zone}
                    </Badge>
                  </>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Comments ({comments.length})</span>
                </div>

                <div className="flex flex-col gap-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <p className="text-sm text-foreground">{c.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.userName} · {formatDate(c.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
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
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

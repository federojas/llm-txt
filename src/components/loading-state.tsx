"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type JobStatus = "pending" | "processing" | "completed" | "failed";

interface LoadingStateProps {
  status?: JobStatus | null;
}

export function LoadingState({ status }: LoadingStateProps) {
  const getStatusMessage = () => {
    switch (status) {
      case "pending":
        return {
          title: "Job queued...",
          description: "Waiting for available worker to process your request",
        };
      case "processing":
        return {
          title: "Crawling website...",
          description: "Analyzing site structure and generating content",
        };
      default:
        return {
          title: "Processing...",
          description: "This may take a few moments",
        };
    }
  };

  const getStatusBadgeVariant = () => {
    switch (status) {
      case "pending":
        return "warning" as const;
      case "processing":
        return "info" as const;
      case "completed":
        return "success" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const { title, description } = getStatusMessage();

  return (
    <Card className="w-full max-w-3xl">
      <CardContent className="space-y-6 pt-8">
        <div className="flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
        </div>
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          {status && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge variant={getStatusBadgeVariant()}>{status}</Badge>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full animate-pulse rounded-full bg-primary w-3/4"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

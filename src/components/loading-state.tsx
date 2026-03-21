"use client";

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

  const { title, description } = getStatusMessage();

  return (
    <div className="w-full max-w-3xl space-y-4 rounded-lg border border-gray-200 bg-white p-8">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
      </div>
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
        {status && (
          <p className="text-xs text-gray-500 mt-2">
            Status: <span className="font-mono">{status}</span>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full animate-pulse rounded-full bg-blue-600 w-3/4"></div>
        </div>
      </div>
    </div>
  );
}

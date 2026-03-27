"use client";

import { useState, useEffect, useRef } from "react";
import { UrlInput } from "@/components/url-input";
import { LoadingState } from "@/components/loading-state";
import { ResultPreview } from "@/components/result-preview";
import { LanguageStrategy } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle } from "lucide-react";

type JobStatus = "pending" | "processing" | "completed" | "failed";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<{
    content: string;
    stats: { pagesFound: number; url: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef<number>(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // Calculate polling interval with exponential backoff
  // Optimized for 60-90s crawl jobs (industry standard for medium-duration tasks)
  const getPollingInterval = (attempts: number): number => {
    if (attempts <= 6) return 5000; // First 30s: poll every 5s
    if (attempts <= 18) return 10000; // Next 2min: poll every 10s
    return 15000; // After 2.5min: poll every 15s
  };

  // Max polling attempts (5 min timeout: 6 @ 5s + 12 @ 10s + 10 @ 15s ≈ 300s)
  const MAX_POLL_ATTEMPTS = 28;

  const pollJobStatus = async (statusUrl: string) => {
    try {
      const response = await fetch(statusUrl);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.details ||
            data.error?.message ||
            "Failed to fetch job status"
        );
      }

      console.log("Job status response:", data);

      // Validate response structure
      if (!data || !data.data) {
        console.error("Invalid API response structure:", data);
        throw new Error("Invalid API response structure");
      }

      const jobData = data.data;
      const status = jobData.status as JobStatus;
      setJobStatus(status);

      if (status === "completed") {
        // Job completed successfully
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        pollAttemptsRef.current = 0;
        setIsLoading(false);

        // Validate result data
        if (!jobData.content) {
          console.error("Job completed but no content:", jobData);
          throw new Error(
            "Job completed but no content was returned. Please try again."
          );
        }

        setResult({
          content: jobData.content,
          stats: {
            pagesFound: jobData.pagesFound ?? 0,
            url: jobData.url ?? "",
          },
        });
      } else if (status === "failed") {
        // Job failed
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        pollAttemptsRef.current = 0;
        setIsLoading(false);
        setError(data.data.error || "Job failed");
      } else {
        // Status is "pending" or "processing" - schedule next poll with backoff
        pollAttemptsRef.current += 1;

        // Check if we've exceeded max polling attempts (5 min timeout)
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          pollAttemptsRef.current = 0;
          setIsLoading(false);
          setError(
            "Job timed out after 5 minutes. The crawl may still be running in the background."
          );
          return;
        }

        const interval = getPollingInterval(pollAttemptsRef.current);
        pollingTimeoutRef.current = setTimeout(() => {
          pollJobStatus(statusUrl);
        }, interval);
      }
    } catch (err) {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollAttemptsRef.current = 0;
      setIsLoading(false);
      setError(
        err instanceof Error ? err.message : "Failed to poll job status"
      );
    }
  };

  const handleGenerate = async (
    url: string,
    languageStrategy: LanguageStrategy,
    options?: {
      excludePatterns?: string[];
      includePatterns?: string[];
      generationMode?: "ai" | "metadata";
      projectName?: string;
      projectDescription?: string;
      maxPages?: number;
      maxDepth?: number;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobStatus(null);
    pollAttemptsRef.current = 0;

    try {
      // Step 1: Create job
      const response = await fetch("/api/v1/llms-txt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          languageStrategy,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.details || data.error?.message || "Failed to create job"
        );
      }

      // Step 2: Start polling with exponential backoff
      const statusUrl = data.data.statusUrl;
      setJobStatus(data.data.status);

      // Start polling (first poll happens immediately inside pollJobStatus)
      await pollJobStatus(statusUrl);
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="mb-16 text-center space-y-4">
          <h1 className="text-6xl font-bold tracking-tight">
            llms.txt Generator
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground leading-relaxed">
            Automatically generate an{" "}
            <a
              href="https://llmstxt.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline underline-offset-4 transition-colors"
            >
              llms.txt
            </a>{" "}
            file for any website. Help LLMs better understand and interact with
            your content.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          {error && (
            <Alert variant="destructive" className="w-full max-w-3xl">
              <XCircle className="h-5 w-5" />
              <AlertTitle>Failed to generate llms.txt</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!result && !isLoading && (
            <UrlInput onGenerate={handleGenerate} isLoading={isLoading} />
          )}

          {isLoading && <LoadingState status={jobStatus} />}

          {result && (
            <ResultPreview
              content={result.content}
              stats={result.stats}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  );
}

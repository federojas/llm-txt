"use client";

import { useState, useEffect, useRef } from "react";
import { UrlInput } from "@/components/url-input";
import { LoadingState } from "@/components/loading-state";
import { ResultPreview } from "@/components/result-preview";
import { CrawlPreset, LanguageStrategy } from "@/lib/types";

type JobStatus = "pending" | "processing" | "completed" | "failed";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<{
    content: string;
    stats: { pagesFound: number; url: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

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

      const status = data.data.status as JobStatus;
      setJobStatus(status);

      if (status === "completed") {
        // Job completed successfully
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsLoading(false);
        setResult({
          content: data.data.result.content,
          stats: data.data.result.stats,
        });
      } else if (status === "failed") {
        // Job failed
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsLoading(false);
        setError(data.data.error || "Job failed");
      }
      // If status is "pending" or "processing", continue polling
    } catch (err) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsLoading(false);
      setError(
        err instanceof Error ? err.message : "Failed to poll job status"
      );
    }
  };

  const handleGenerate = async (
    url: string,
    preset: CrawlPreset,
    languageStrategy: LanguageStrategy
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobStatus(null);

    try {
      // Step 1: Create job
      const response = await fetch("/api/v1/llms-txt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, preset, languageStrategy }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.details || data.error?.message || "Failed to create job"
        );
      }

      // Step 2: Start polling for job status
      const statusUrl = data.data.statusUrl;
      setJobStatus(data.data.status);

      // Poll immediately
      await pollJobStatus(statusUrl);

      // Then poll every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatus(statusUrl);
      }, 2000);
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
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100">
      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-5xl font-bold text-gray-900">
            llms.txt Generator
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Automatically generate an{" "}
            <a
              href="https://llmstxt.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              llms.txt
            </a>{" "}
            file for any website. Help LLMs better understand and interact with
            your content.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8">
          {error && (
            <div className="w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-red-900">
                    Failed to generate llms.txt
                  </p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
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

        <footer className="mt-16 border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
          <p>
            Built with Next.js • Learn more about{" "}
            <a
              href="https://llmstxt.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              llms.txt specification
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

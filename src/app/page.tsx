"use client";

import { useState, useEffect, useRef } from "react";
import { UrlInputSimple } from "@/components/url-input-simple";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { LoadingState } from "@/components/loading-state";
import { ResultPreview } from "@/components/result-preview";
import { LanguageStrategy } from "@/lib/types";
import { GenerationMode } from "@/lib/api/dtos/llms-txt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type JobStatus = "pending" | "processing" | "completed" | "failed";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<{
    content: string;
    stats: { pagesFound: number; url: string };
    requestParams?: {
      maxPages?: number;
      maxDepth?: number;
      generationMode?: "ai" | "metadata";
      languageStrategy?: "prefer-english" | "page-language";
      includePatterns?: string[];
      excludePatterns?: string[];
      projectName?: string;
      projectDescription?: string;
      titleCleanup?: {
        removePatterns?: string[];
        replacements?: Array<{ pattern: string; replacement: string }>;
      };
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef<number>(0);

  // Settings state
  const [languageStrategy, setLanguageStrategy] =
    useState<LanguageStrategy>("prefer-english");
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("metadata");
  const [maxPages, setMaxPages] = useState<string>("");
  const [maxDepth, setMaxDepth] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [includePatterns, setIncludePatterns] = useState("");
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // Populate settings from requestParams when results are loaded
  useEffect(() => {
    if (result?.requestParams) {
      const params = result.requestParams;

      // Update generation settings
      if (params.generationMode) {
        setGenerationMode(params.generationMode);
      }
      if (params.languageStrategy) {
        setLanguageStrategy(params.languageStrategy);
      }
      if (params.maxPages !== undefined) {
        setMaxPages(params.maxPages.toString());
      }
      if (params.maxDepth !== undefined) {
        setMaxDepth(params.maxDepth.toString());
      }

      // Update overrides
      if (params.projectName) {
        setProjectName(params.projectName);
      }
      if (params.projectDescription) {
        setProjectDescription(params.projectDescription);
      }

      // Update filters
      if (params.excludePatterns) {
        setExcludePatterns(params.excludePatterns.join(", "));
      }
      if (params.includePatterns) {
        setIncludePatterns(params.includePatterns.join(", "));
      }
    }
  }, [result]);

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
          requestParams: jobData.requestParams ?? undefined,
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

  const handleGenerate = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobStatus(null);
    pollAttemptsRef.current = 0;
    setShowMobileSettings(false); // Hide settings on mobile after submit

    try {
      // Parse patterns (comma or newline separated)
      const parsePatterns = (str: string): string[] | undefined => {
        const trimmed = str.trim();
        if (!trimmed) return undefined;
        return trimmed
          .split(/[,\n]/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
      };

      const options = {
        excludePatterns: parsePatterns(excludePatterns),
        includePatterns: parsePatterns(includePatterns),
        generationMode: generationMode,
        projectName: projectName.trim() || undefined,
        projectDescription: projectDescription.trim() || undefined,
        maxPages: maxPages
          ? parseInt(maxPages, 10)
          : generationMode === "ai"
            ? 50
            : undefined,
        maxDepth: maxDepth ? parseInt(maxDepth, 10) : undefined,
      };

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
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            llms.txt Generator
          </h1>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
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

        {/* Two-column layout: Main content + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* Main Content Area */}
          <div className="w-full max-w-3xl mx-auto lg:mx-0 space-y-6">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-5 w-5" />
                <AlertTitle>Failed to generate llms.txt</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Mobile Settings Toggle */}
            <div className="lg:hidden">
              <Button
                onClick={() => setShowMobileSettings(!showMobileSettings)}
                variant="outline"
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                {showMobileSettings ? "Hide Settings" : "Show Settings"}
              </Button>
            </div>

            {/* Mobile Settings Card */}
            {showMobileSettings && (
              <Card className="lg:hidden">
                <CardContent className="pt-6">
                  <SettingsSidebar
                    languageStrategy={languageStrategy}
                    setLanguageStrategy={setLanguageStrategy}
                    generationMode={generationMode}
                    setGenerationMode={setGenerationMode}
                    maxPages={maxPages}
                    setMaxPages={setMaxPages}
                    maxDepth={maxDepth}
                    setMaxDepth={setMaxDepth}
                    projectName={projectName}
                    setProjectName={setProjectName}
                    projectDescription={projectDescription}
                    setProjectDescription={setProjectDescription}
                    excludePatterns={excludePatterns}
                    setExcludePatterns={setExcludePatterns}
                    includePatterns={includePatterns}
                    setIncludePatterns={setIncludePatterns}
                    isLoading={isLoading || !!result}
                  />
                </CardContent>
              </Card>
            )}

            {!result && !isLoading && (
              <UrlInputSimple onSubmit={handleGenerate} isLoading={isLoading} />
            )}

            {isLoading && <LoadingState status={jobStatus} />}

            {result && (
              <ResultPreview
                content={result.content}
                stats={result.stats}
                requestParams={result.requestParams}
                onReset={handleReset}
              />
            )}
          </div>

          {/* Desktop Sidebar - Always Visible on Right */}
          <div className="hidden lg:block">
            <SettingsSidebar
              languageStrategy={languageStrategy}
              setLanguageStrategy={setLanguageStrategy}
              generationMode={generationMode}
              setGenerationMode={setGenerationMode}
              maxPages={maxPages}
              setMaxPages={setMaxPages}
              maxDepth={maxDepth}
              setMaxDepth={setMaxDepth}
              projectName={projectName}
              setProjectName={setProjectName}
              projectDescription={projectDescription}
              setProjectDescription={setProjectDescription}
              excludePatterns={excludePatterns}
              setExcludePatterns={setExcludePatterns}
              includePatterns={includePatterns}
              setIncludePatterns={setIncludePatterns}
              isLoading={isLoading || !!result}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

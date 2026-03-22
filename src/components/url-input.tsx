"use client";

import { useState } from "react";
import { LanguageStrategy } from "@/lib/types";
import { GenerationMode } from "@/lib/api/dtos/llms-txt";

interface UrlInputProps {
  onGenerate: (
    url: string,
    languageStrategy: LanguageStrategy,
    options?: {
      excludePatterns?: string[];
      includePatterns?: string[];
      generationMode?: GenerationMode;
      projectName?: string;
      projectDescription?: string;
      maxPages?: number;
      maxDepth?: number;
    }
  ) => void;
  isLoading: boolean;
}

export function UrlInput({ onGenerate, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [languageStrategy, setLanguageStrategy] =
    useState<LanguageStrategy>("prefer-english");
  const [error, setError] = useState("");

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [excludePatterns, setExcludePatterns] = useState("");
  const [includePatterns, setIncludePatterns] = useState("");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("ai");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [maxPages, setMaxPages] = useState<string>("50"); // Default: 50 (range: 1-200)
  const [maxDepth, setMaxDepth] = useState<string>("3"); // Default: 3 (range: 1-5)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url) {
      setError("Please enter a URL");
      return;
    }

    // Auto-add https:// if no protocol is specified
    let processedUrl = url.trim();
    if (
      !processedUrl.startsWith("http://") &&
      !processedUrl.startsWith("https://")
    ) {
      processedUrl = `https://${processedUrl}`;
    }

    try {
      new URL(processedUrl);

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
        generationMode: generationMode, // Always send mode (default is "ai")
        projectName: projectName.trim() || undefined,
        projectDescription: projectDescription.trim() || undefined,
        maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
        maxDepth: maxDepth ? parseInt(maxDepth, 10) : undefined,
      };

      // Only pass options if at least one is set
      const hasOptions = Object.values(options).some(
        (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
      );

      onGenerate(
        processedUrl,
        languageStrategy,
        hasOptions ? options : undefined
      );
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const examples = [
    { name: "Anthropic", url: "https://anthropic.com" },
    { name: "Next.js", url: "https://nextjs.org" },
    { name: "Vercel", url: "https://vercel.com" },
  ];

  return (
    <div className="w-full max-w-3xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="url"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Website URL
          </label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div>
          <label
            htmlFor="languageStrategy"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Language Preference
          </label>
          <select
            id="languageStrategy"
            value={languageStrategy}
            onChange={(e) =>
              setLanguageStrategy(e.target.value as LanguageStrategy)
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="prefer-english">
              Prefer English (with automatic fallback)
            </option>
            <option value="page-language">
              Use server&apos;s natural language
            </option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {languageStrategy === "prefer-english"
              ? "Requests English content first. Automatically falls back to the site's primary language if English is unavailable (e.g., German-only sites → German output). Always single-language."
              : "⚠️ Accepts whatever language the server provides. May result in mixed languages for geo-aware sites like YouTube."}
          </p>
        </div>

        {/* Advanced Options */}
        <details className="rounded-lg border border-gray-200 bg-gray-50">
          <summary
            className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            ⚙️ Advanced Options (optional)
          </summary>
          <div className="space-y-4 border-t border-gray-200 p-4">
            {/* Generation Mode */}
            <div>
              <label
                htmlFor="generationMode"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Generation Mode
              </label>
              <select
                id="generationMode"
                value={generationMode}
                onChange={(e) =>
                  setGenerationMode(e.target.value as GenerationMode)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="ai">
                  AI Mode (LLM for descriptions, ~51 API calls)
                </option>
                <option value="metadata">
                  Metadata Mode (HTML meta tags, faster, free)
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Note: Title cleaning always uses heuristics (language-agnostic)
              </p>
            </div>

            {/* Max Pages */}
            <div>
              <label
                htmlFor="maxPages"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Max Pages
              </label>
              <input
                id="maxPages"
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                min="1"
                max="200"
                placeholder="50"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum pages to crawl (1-200, default: 50)
              </p>
            </div>

            {/* Max Depth */}
            <div>
              <label
                htmlFor="maxDepth"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Max Depth
              </label>
              <input
                id="maxDepth"
                type="number"
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
                min="1"
                max="5"
                placeholder="3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum crawl depth (1-5, default: 3)
              </p>
            </div>

            {/* Project Name Override */}
            <div>
              <label
                htmlFor="projectName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Project Name (override)
              </label>
              <input
                id="projectName"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., YouTube"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Override auto-detected project name (skips AI detection)
              </p>
            </div>

            {/* Project Description Override */}
            <div>
              <label
                htmlFor="projectDescription"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Project Description (override)
              </label>
              <textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="e.g., Share videos globally and explore diverse content."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Override AI-generated summary (skips AI summary call)
              </p>
            </div>

            {/* Exclude Patterns */}
            <div>
              <label
                htmlFor="excludePatterns"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Exclude Patterns
              </label>
              <textarea
                id="excludePatterns"
                value={excludePatterns}
                onChange={(e) => setExcludePatterns(e.target.value)}
                placeholder="**/blog/**, **/privacy/**, **/terms/**"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Glob patterns to exclude (comma or newline separated)
              </p>
            </div>

            {/* Include Patterns */}
            <div>
              <label
                htmlFor="includePatterns"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Include Patterns (optional)
              </label>
              <textarea
                id="includePatterns"
                value={includePatterns}
                onChange={(e) => setIncludePatterns(e.target.value)}
                placeholder="**/docs/**, **/api/**"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Only include URLs matching these patterns (leave empty for all)
              </p>
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Generating..." : "Generate llms.txt"}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-6">
        <p className="mb-3 text-sm text-gray-600">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example.url}
              onClick={() => setUrl(example.url)}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

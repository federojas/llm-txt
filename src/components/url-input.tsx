"use client";

import { useState } from "react";
import { LanguageStrategy } from "@/lib/types";

interface UrlInputProps {
  onGenerate: (url: string, languageStrategy: LanguageStrategy) => void;
  isLoading: boolean;
}

export function UrlInput({ onGenerate, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [languageStrategy, setLanguageStrategy] =
    useState<LanguageStrategy>("prefer-english");
  const [error, setError] = useState("");

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
      onGenerate(processedUrl, languageStrategy);
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

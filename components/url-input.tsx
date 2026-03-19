"use client";

import { useState } from "react";
import { CrawlPreset } from "@/types";

interface UrlInputProps {
  onGenerate: (url: string, preset: CrawlPreset) => void;
  isLoading: boolean;
}

export function UrlInput({ onGenerate, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<CrawlPreset>("quick");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url) {
      setError("Please enter a URL");
      return;
    }

    try {
      new URL(url);
      onGenerate(url, preset);
    } catch {
      setError("Please enter a valid URL (include http:// or https://)");
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
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <label
                htmlFor="preset"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Crawl Preset
              </label>
              <select
                id="preset"
                value={preset}
                onChange={(e) => setPreset(e.target.value as CrawlPreset)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="quick">Quick (25 pages, depth 2)</option>
                <option value="thorough">Thorough (100 pages, depth 3)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Choose how many pages to crawl and how deep to go
              </p>
            </div>
          </div>
        )}

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

"use client";

import { useState } from "react";
import { LanguageStrategy } from "@/lib/types";
import { GenerationMode } from "@/lib/api/dtos/llms-txt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("metadata");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [maxPages, setMaxPages] = useState<string>(""); // Empty = use mode-specific default (metadata: 200, ai: 50)
  const [maxDepth, setMaxDepth] = useState<string>(""); // Empty = use default (2)

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
        // AI mode: default 50 (explicit), metadata mode: default 200 (backend default)
        maxPages: maxPages
          ? parseInt(maxPages, 10)
          : generationMode === "ai"
            ? 50
            : undefined,
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
    <TooltipProvider>
      <div className="w-full max-w-3xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Your Website URL</Label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isLoading}
              className="h-11 mt-2"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Advanced Options */}
          <Card className="bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors rounded-t-lg"
            >
              <span className="flex items-center gap-2 text-foreground">
                <span>⚙️</span>
                <span>Advanced Options (optional)</span>
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-foreground" />
              )}
            </button>
            {showAdvanced && (
              <CardContent className="space-y-4 border-t pt-6">
                {/* Generation Mode */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="generationMode">
                      Page Description Generation Mode
                    </Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Controls how individual page descriptions are
                            generated. Project summary is always AI-generated.
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <p className="text-xs">
                              <strong>HTML metadata tags:</strong> Fast, uses
                              existing metadata descriptions. Good for sites
                              with quality metadata.
                            </p>
                            <p className="text-xs">
                              <strong>AI-generated:</strong> Slower, analyzes
                              page content to generate context-aware
                              descriptions. Best for sites with poor/missing
                              metadata.
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={generationMode}
                    onValueChange={(value) =>
                      setGenerationMode(value as GenerationMode)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="generationMode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metadata">
                        HTML metadata tags
                      </SelectItem>
                      <SelectItem value="ai">AI-generated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language Preference */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="languageStrategy">
                      Language Preference
                    </Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2">
                          <p className="text-xs">
                            <strong>Prefer English:</strong> Requests English
                            via Accept-Language header. Skips non-English pages,
                            with graceful fallback after 3 consecutive skips
                            (only if zero English found). Safe for English,
                            multilingual, and geo-aware sites.
                          </p>
                          <p className="text-xs">
                            <strong>Site default language:</strong> No
                            filtering, accepts all languages. Use for
                            non-English-only sites.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={languageStrategy}
                    onValueChange={(value) =>
                      setLanguageStrategy(value as LanguageStrategy)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="languageStrategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prefer-english">
                        Prefer English
                      </SelectItem>
                      <SelectItem value="page-language">
                        Site default language
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Pages */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="maxPages">Maximum Pages</Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          Maximum pages to fetch and parse (1-200). All sitemap
                          URLs are scored, then top N are fetched. Default:{" "}
                          {generationMode === "ai" ? "50" : "200"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="maxPages"
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    min="1"
                    max="200"
                    placeholder={generationMode === "ai" ? "50" : "200"}
                    disabled={isLoading}
                  />
                  {generationMode === "ai" &&
                    parseInt(maxPages || "0") > 100 && (
                      <p className="mt-1 text-xs text-amber-600">
                        ⚠️ AI mode with {maxPages} pages will take ~
                        {Math.ceil((parseInt(maxPages) + 2) / 30 + 1.5)}-
                        {Math.ceil((parseInt(maxPages) + 2) / 30 + 2)} minutes
                        due to API rate limits
                      </p>
                    )}
                </div>

                {/* Max Depth */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="maxDepth">Maximum Depth</Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          Maximum URL path depth (1-5). Controls how deep into
                          the site structure to crawl. Depth 0 = homepage, depth
                          1 = /about, depth 2 = /docs/api. Shallower = platform
                          pages, deeper = articles/posts. Default: 2
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="maxDepth"
                    type="number"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(e.target.value)}
                    min="1"
                    max="5"
                    placeholder="2"
                    disabled={isLoading}
                  />
                </div>

                {/* Project Name Override */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="projectName">Project Name (override)</Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          Override auto-detected project name (H1 at top,
                          detected from site name, og:site_name, or page title)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., YouTube"
                    disabled={isLoading}
                  />
                </div>

                {/* Project Description Override */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="projectDescription">
                      Project Description (override)
                    </Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          Override AI-generated summary (blockquote below H1,
                          auto-generated from homepage content and metadata)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="e.g., Share videos globally and explore diverse content."
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isLoading}
                  />
                </div>

                {/* Exclude Patterns */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="excludePatterns">Exclude Patterns</Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2">
                          <p className="text-xs">
                            Skip URLs matching these patterns. Useful for
                            filtering out blogs, legal pages, or marketing
                            content.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Note: Exclude takes precedence over include
                            patterns.
                          </p>
                          <h4 className="font-medium text-xs mt-2">Examples</h4>
                          <ul className="space-y-1 text-xs">
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                **/blog/**
                              </code>
                              <span className="text-muted-foreground">
                                Skip all blog posts
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                **/jobs/**
                              </code>
                              <span className="text-muted-foreground">
                                Skip career pages
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                **.pdf
                              </code>
                              <span className="text-muted-foreground">
                                Skip PDF files
                              </span>
                            </li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <textarea
                    id="excludePatterns"
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    placeholder="**/blog/**, **/privacy/**, **/terms/**"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isLoading}
                  />
                </div>

                {/* Include Patterns */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="includePatterns">Include Patterns</Label>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2">
                          <p className="text-xs">
                            Only crawl URLs matching these patterns. Useful for
                            focusing on specific sections like docs or API
                            reference.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Note: Homepage is always included. Exclude patterns
                            take precedence.
                          </p>
                          <h4 className="font-medium text-xs mt-2">Examples</h4>
                          <ul className="space-y-1 text-xs">
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                **/docs/**
                              </code>
                              <span className="text-muted-foreground">
                                Only documentation pages
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                **/api/**
                              </code>
                              <span className="text-muted-foreground">
                                Only API reference
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] shrink-0">
                                /guides/**
                              </code>
                              <span className="text-muted-foreground">
                                Only guides section
                              </span>
                            </li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <textarea
                    id="includePatterns"
                    value={includePatterns}
                    onChange={(e) => setIncludePatterns(e.target.value)}
                    placeholder="**/docs/**, **/api/**"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Generating..." : "Generate"}
          </Button>
        </form>

        <div className="border-t pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Try these examples:
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <Button
                key={example.url}
                onClick={() => setUrl(example.url)}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {example.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

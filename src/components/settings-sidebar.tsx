"use client";

import { useState } from "react";
import { LanguageStrategy } from "@/lib/types";
import { GenerationMode } from "@/lib/api/dtos/llms-txt";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, ChevronDown, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SettingsSidebarProps {
  languageStrategy: LanguageStrategy;
  setLanguageStrategy: (value: LanguageStrategy) => void;
  generationMode: GenerationMode;
  setGenerationMode: (value: GenerationMode) => void;
  maxPages: string;
  setMaxPages: (value: string) => void;
  maxDepth: string;
  setMaxDepth: (value: string) => void;
  projectName: string;
  setProjectName: (value: string) => void;
  projectDescription: string;
  setProjectDescription: (value: string) => void;
  excludePatterns: string;
  setExcludePatterns: (value: string) => void;
  includePatterns: string;
  setIncludePatterns: (value: string) => void;
  isLoading: boolean;
}

export function SettingsSidebar({
  languageStrategy,
  setLanguageStrategy,
  generationMode,
  setGenerationMode,
  maxPages,
  setMaxPages,
  maxDepth,
  setMaxDepth,
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
  excludePatterns,
  setExcludePatterns,
  includePatterns,
  setIncludePatterns,
  isLoading,
}: SettingsSidebarProps) {
  const [showOverrides, setShowOverrides] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <TooltipProvider>
      <Card className="h-fit sticky top-4 max-h-[calc(100vh-6rem)] flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto flex-1">
          {/* Generation Mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="generationMode" className="text-sm">
                Generation Mode
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
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Controls how individual page descriptions are generated.
                      Project summary is always AI-generated.
                    </p>
                    <div className="space-y-1.5 mt-2">
                      <p className="text-xs">
                        <strong>HTML metadata tags:</strong> Fast, uses existing
                        metadata descriptions. Good for sites with quality
                        metadata.
                      </p>
                      <p className="text-xs">
                        <strong>AI-generated:</strong> Slower, analyzes page
                        content to generate context-aware descriptions. Best for
                        sites with poor/missing metadata.
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
              <SelectTrigger id="generationMode" className="h-9">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metadata">HTML metadata tags</SelectItem>
                <SelectItem value="ai">AI-generated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="languageStrategy" className="text-sm">
                Language
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
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-xs">
                      <strong>Prefer English:</strong> Requests English via
                      Accept-Language header. Skips non-English pages, with
                      graceful fallback after 3 consecutive skips (only if zero
                      English found). Safe for English, multilingual, and
                      geo-aware sites.
                    </p>
                    <p className="text-xs">
                      <strong>Site default language:</strong> No filtering,
                      accepts all languages. Use for non-English-only sites.
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
              <SelectTrigger id="languageStrategy" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prefer-english">Prefer English</SelectItem>
                <SelectItem value="page-language">
                  Site default language
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Pages */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="maxPages" className="text-sm">
                Max Pages
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
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs">
                    Maximum pages to fetch and parse (1-200). All sitemap URLs
                    are scored, then top N are fetched. Default:{" "}
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
              className="h-9"
            />
            {generationMode === "ai" && parseInt(maxPages || "0") > 100 && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠️ AI mode with {maxPages} pages will take ~
                {Math.ceil((parseInt(maxPages) + 2) / 30 + 1.5)}-
                {Math.ceil((parseInt(maxPages) + 2) / 30 + 2)} minutes due to
                API rate limits
              </p>
            )}
          </div>

          {/* Max Depth */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="maxDepth" className="text-sm">
                Max Depth
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
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs">
                    Maximum URL path depth (1-5). Controls how deep into the
                    site structure to crawl. Depth 0 = homepage, depth 1 =
                    /about, depth 2 = /docs/api. Shallower = platform pages,
                    deeper = articles/posts. Default: 2
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
              className="h-9"
            />
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowOverrides(!showOverrides)}
              className="flex items-center justify-between w-full text-sm font-medium hover:opacity-80 transition-opacity mb-3 cursor-pointer"
            >
              <span>Overrides</span>
              {showOverrides ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {showOverrides && (
              <div className="space-y-3">
                {/* Project Name Override */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="projectName" className="text-sm">
                      Project Name
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
                      <TooltipContent side="left" className="max-w-xs">
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
                    className="h-9"
                  />
                </div>

                {/* Project Description Override */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="projectDescription" className="text-sm">
                      Description
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
                      <TooltipContent side="left" className="max-w-xs">
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
                    placeholder="e.g., Share videos globally..."
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full text-sm font-medium hover:opacity-80 transition-opacity mb-3 cursor-pointer"
            >
              <span>Filters</span>
              {showFilters ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {showFilters && (
              <div className="space-y-3">
                {/* Exclude Patterns */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="excludePatterns" className="text-sm">
                      Exclude Patterns
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
                      <TooltipContent side="left" className="max-w-xs">
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
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    id="excludePatterns"
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    placeholder="**/blog/**, **/privacy/**"
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>

                {/* Include Patterns */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="includePatterns" className="text-sm">
                      Include Patterns
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
                      <TooltipContent side="left" className="max-w-xs">
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
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UrlInputSimpleProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInputSimple({ onSubmit, isLoading }: UrlInputSimpleProps) {
  const [url, setUrl] = useState("");
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
      onSubmit(processedUrl);
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
    <div className="w-full space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url" className="text-base">
            Website URL
          </Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={isLoading}
            className="h-12 text-base mt-2"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 text-base"
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
  );
}

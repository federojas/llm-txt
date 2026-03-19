"use client";

import { useState } from "react";

interface ResultPreviewProps {
  content: string;
  stats: {
    pagesFound: number;
    url: string;
  };
  onReset: () => void;
}

export function ResultPreview({ content, stats, onReset }: ResultPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? editedContent : content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? editedContent : content], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "llms.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-900">
              Successfully generated llms.txt
            </p>
            <p className="text-sm text-green-700">
              Found {stats.pagesFound} pages from {new URL(stats.url).hostname}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h3 className="font-medium text-gray-900">Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {isEditing ? "Preview" : "Edit"}
            </button>
            <button
              onClick={handleCopy}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Download
            </button>
          </div>
        </div>

        <div className="p-4">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="h-96 w-full rounded-md border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
          ) : (
            <pre className="h-96 overflow-auto rounded-md bg-gray-50 p-4 font-mono text-sm text-gray-900">
              {isEditing ? editedContent : content}
            </pre>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onReset}
          className="rounded-lg border border-blue-600 bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          Generate another llms.txt
        </button>
      </div>
    </div>
  );
}

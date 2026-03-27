"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Download, Copy, Check, RotateCcw } from "lucide-react";

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
      <Alert variant="success">
        <CheckCircle2 className="h-5 w-5" />
        <AlertTitle>Successfully generated llms.txt</AlertTitle>
        <AlertDescription>
          Found <Badge variant="success">{stats.pagesFound}</Badge> pages from{" "}
          {new URL(stats.url).hostname}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Preview</CardTitle>
          <div className="flex gap-2">
            <Button onClick={onReset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant="outline"
              size="sm"
            >
              {isEditing ? "Preview" : "Edit"}
            </Button>
            <Button onClick={handleCopy} variant="outline" size="sm">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            <Button onClick={handleDownload} size="sm">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="h-96 w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          ) : (
            <pre className="h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">
              {isEditing ? editedContent : content}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

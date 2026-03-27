"use client";

import { HelpCircle } from "lucide-react";

export function HelpButton() {
  return (
    <a
      href="https://llmstxt.org"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer"
      title="Help & Documentation"
    >
      <HelpCircle className="h-4 w-4 text-white" />
    </a>
  );
}

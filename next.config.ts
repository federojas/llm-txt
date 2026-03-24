import { withAxiom } from "next-axiom";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // For Docker deployment
};

// Wrap with both Axiom and Sentry
// Order matters: Sentry outer, Axiom inner
export default withSentryConfig(withAxiom(nextConfig), {
  // Sentry build options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI/production
  silent: !process.env.CI,
});

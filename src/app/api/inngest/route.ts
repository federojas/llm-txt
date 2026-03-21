/**
 * Inngest API Route
 * Webhook endpoint for Inngest to execute functions
 */

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import * as functions from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(functions),
});

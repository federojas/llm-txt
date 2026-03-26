/**
 * Inngest Functions
 * Central export for all background job processors
 */

import { processCrawl } from "./crawl";

// Export individual functions
export { processCrawl };

// Export array for Inngest serve() - required for production builds
export const allFunctions = [processCrawl];

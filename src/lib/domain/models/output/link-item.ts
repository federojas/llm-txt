/**
 * Link Item Model
 * Represents a single link entry in llms.txt output
 */

export interface LinkItem {
  title: string;
  url: string;
  description?: string;
}

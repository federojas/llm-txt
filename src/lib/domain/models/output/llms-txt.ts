/**
 * llms.txt Output Format Models
 */

import { LinkItem } from "./link-item";

export interface LlmsTxtOutput {
  projectName: string;
  summary?: string;
  details?: string;
  sections: LlmsTxtSection[];
  optionalSection?: LlmsTxtSection;
}

export interface LlmsTxtSection {
  title: string;
  links: LinkItem[];
}

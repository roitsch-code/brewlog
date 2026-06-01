/**
 * SCA knowledge module.
 *
 * SCA brewing foundations corpus, distilled from the SCA Introduction
 * to Coffee + SCA Coffee Brewing Foundation course transcripts.
 *
 * Always-injected into the lesson distiller (src/lib/claude/lessons.ts)
 * per the user-confirmed design decision — see PR history. Surfaced
 * alongside the recipes / varieties / techniques / roaster priors
 * already consumed by /recommend.
 */

export type { ScaTopic, ScaFact } from "./types";
export { SCA_FOUNDATIONS } from "./data";
export {
  getScaTopicById,
  getAllScaTopics,
  formatScaFoundationsForPrompt,
} from "./helpers";

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Sonnet rather than Opus: the only caller is submission review, which is
 * rubric scoring against explicit criteria rather than open reasoning, and
 * it runs once per submission on a member's behalf. Bump it here, not at
 * the call site.
 */
export const CLAUDE_MODEL = "claude-sonnet-5";

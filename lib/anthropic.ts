import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleAuth } from "google-auth-library";

/**
 * The Claude client, from whichever provider this deployment is wired to.
 *
 * TWO PROVIDERS, ONE SHAPE. `messages.create` is identical across the direct
 * API and Vertex, so nothing downstream needs to know which is in use. What
 * differs is credentials and, importantly, the MODEL NAME - Vertex uses its
 * own ids with an `@version` suffix rather than the direct API's aliases, so
 * the model is read from the environment and only falls back to a default
 * that is correct for the direct API.
 *
 * Returns null rather than throwing when nothing is configured, following
 * `lib/resend.ts`: a dev machine with no credentials must still boot, and the
 * one caller (submission review) already treats an absent client as "leave it
 * for a person".
 *
 * VERTEX ON SERVERLESS. Vertex normally authenticates through Application
 * Default Credentials, which on Vercel means no metadata server and no
 * credentials file. `GOOGLE_SERVICE_ACCOUNT_JSON` holds the service account
 * key as a single env var instead, which is the only shape that survives a
 * serverless deploy. If it is absent the SDK's own ADC lookup still runs, so
 * a GCP-hosted environment keeps working without it.
 */

export type ClaudeProvider = "anthropic" | "vertex";

/**
 * Explicit beats inferred, but inferred beats a crash: setting the Vertex
 * project alone is a clear enough statement of intent.
 */
export function claudeProvider(): ClaudeProvider | null {
  const explicit = process.env.CLAUDE_PROVIDER?.trim().toLowerCase();
  if (explicit === "vertex" || explicit === "anthropic") return explicit;
  if (process.env.ANTHROPIC_VERTEX_PROJECT_ID) return "vertex";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/**
 * Opus 5, because the only caller is submission review and that is the one
 * place in this app where being slightly wrong is expensive: an approval
 * nobody checks is a gate that did not hold.
 *
 * Verified against Vertex on 23 Aug 2026 - the eval set scored 7 of 8 with no
 * false approvals and no style problems. Opus marks harder than Sonnet, so
 * roughly one good submission in eight is routed to a person unnecessarily.
 * That is the cheap direction to be wrong in and it is a deliberate trade.
 *
 * The id happens to be identical on both providers. That is not guaranteed
 * for future models, which is why CLAUDE_MODEL exists.
 */
const DEFAULT_MODEL = "claude-opus-5";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;

let cached: Anthropic | AnthropicVertex | null | undefined;

export function claudeClient(): Anthropic | AnthropicVertex | null {
  if (cached !== undefined) return cached;

  const provider = claudeProvider();

  if (provider === "vertex") {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    let googleAuth: GoogleAuth | undefined;
    if (raw) {
      try {
        googleAuth = new GoogleAuth({
          credentials: JSON.parse(raw),
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          // Without this, user-flavoured credentials are refused with
          // "the API requires a quota project" rather than anything legible.
          clientOptions: {
            quotaProjectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID,
          },
        });
      } catch {
        // Malformed key: fall through to ADC rather than throwing at import.
        googleAuth = undefined;
      }
    }
    cached = new AnthropicVertex({
      projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID ?? null,
      // "global", not a European region. Checked against Phlo's own Vertex
      // project on 23 Aug 2026: europe-west1 carries only claude-3-opus and
      // claude-sonnet-4-5, and us-central1 lists Opus 5 but answers 429 with
      // zero quota for it. The global endpoint serves it.
      region: process.env.CLOUD_ML_REGION ?? "global",
      ...(googleAuth ? { googleAuth } : {}),
    });
    return cached;
  }

  if (provider === "anthropic") {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return cached;
  }

  cached = null;
  return cached;
}

/**
 * One prompt, one string back, whichever provider is wired up.
 *
 * The two SDKs have the same `messages.create` but different overload sets,
 * so the union is not callable without narrowing. Narrowing here means every
 * caller gets one signature and none of them import a provider type.
 */
export async function askClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const client = claudeClient();
  if (!client) throw new Error("no Claude provider configured");

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user" as const, content: prompt }],
  };
  const response =
    client instanceof AnthropicVertex
      ? await client.messages.create(body)
      : await client.messages.create(body);

  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

/** One line for the admin screen, so a misconfiguration is legible. */
export function claudeStatus(): string {
  const provider = claudeProvider();
  if (!provider) return "not configured";
  if (provider === "vertex") {
    const project = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
    if (!project) return "Vertex, but no project id set";
    return `Vertex (${project}, ${process.env.CLOUD_ML_REGION ?? "global"}) using ${CLAUDE_MODEL}`;
  }
  return `Anthropic API using ${CLAUDE_MODEL}`;
}

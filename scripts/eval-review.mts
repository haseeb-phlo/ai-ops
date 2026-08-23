/**
 * Run the review eval from a terminal.
 *
 * The same eight cases the admin button runs, against whichever provider the
 * environment points at. Two places to run it, and they answer different
 * questions:
 *
 *   * this script - "is the prompt any good against this model", which is
 *     what you want while editing the prompt or comparing models;
 *   * the button on /learn/admin - "is the deployment wired up and
 *     behaving", which is what you want before a cohort starts.
 *
 * Deliberately does not import lib/programme/review-eval-run.ts: that file is
 * `server-only`, which throws outside the Next runtime. It imports the same
 * pure modules and repeats the twelve lines of glue instead, which is the
 * cheaper of the two wrong answers.
 *
 *   CLAUDE_PROVIDER=vertex ANTHROPIC_VERTEX_PROJECT_ID=phlo-ai \
 *   CLOUD_ML_REGION=global CLAUDE_MODEL=claude-opus-5 npm run eval:review
 *
 * On Vertex it uses Application Default Credentials, so `gcloud auth
 * application-default login` is enough locally and no key file is needed.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleAuth } from "google-auth-library";
import {
  buildFeedbackRewritePrompt,
  buildReviewPrompt,
  decideReview,
  parseReviewResponse,
} from "../lib/programme/ai-review.ts";
import {
  applyStyleFixes,
  describeViolations,
  findStyleViolations,
} from "../lib/programme/feedback-style.ts";
import {
  EVAL_CASES,
  evalPasses,
  summariseEval,
  type EvalResult,
} from "../lib/programme/review-evals.ts";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";
const PROVIDER =
  process.env.CLAUDE_PROVIDER ??
  (process.env.ANTHROPIC_VERTEX_PROJECT_ID ? "vertex" : "anthropic");

function makeClient() {
  if (PROVIDER === "vertex") {
    const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
    if (!projectId) throw new Error("ANTHROPIC_VERTEX_PROJECT_ID is not set");
    return new AnthropicVertex({
      projectId,
      region: process.env.CLOUD_ML_REGION ?? "global",
      googleAuth: new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        clientOptions: { quotaProjectId: projectId },
      }),
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const client = makeClient();

async function ask(prompt: string): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 2048,
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

console.log(`provider ${PROVIDER} | model ${MODEL}`);
if (PROVIDER === "vertex") {
  console.log(
    `project ${process.env.ANTHROPIC_VERTEX_PROJECT_ID} | region ${process.env.CLOUD_ML_REGION ?? "global"}`,
  );
}
console.log("");

const results: EvalResult[] = [];

for (const testCase of EVAL_CASES) {
  process.stdout.write(`${testCase.id.padEnd(20)} `);
  try {
    const review = parseReviewResponse(await ask(buildReviewPrompt(testCase.submission)));
    if (!review) throw new Error("unparseable reply");

    let feedback = review.feedback;
    const violations = findStyleViolations(feedback);
    if (violations.length > 0) {
      const retry = (
        await ask(
          buildFeedbackRewritePrompt(
            testCase.submission,
            feedback,
            describeViolations(violations),
          ),
        )
      ).trim();
      if (retry.length > 20 && findStyleViolations(retry).length < violations.length) {
        feedback = retry;
      }
    }
    feedback = applyStyleFixes(feedback);

    const { decision, reasons } = decideReview({ ...review, feedback }, testCase.submission);
    const styleViolations = findStyleViolations(feedback).map((v) => `${v.rule}:${v.found}`);
    const agreed = decision === testCase.expect;

    results.push({
      id: testCase.id,
      expected: testCase.expect,
      actual: decision,
      agreed,
      falseApproval: testCase.expect === "flagged" && decision === "approved",
      reasons,
      styleViolations,
      feedback,
    });

    const mark = agreed ? "ok  " : testCase.expect === "flagged" ? "MISS" : "flag";
    console.log(
      `${mark} wanted ${testCase.expect}, got ${decision}` +
        (violations.length > 0 ? "  (style retried)" : "") +
        (styleViolations.length > 0 ? `  STYLE ${styleViolations.join(",")}` : ""),
    );
    console.log(`${" ".repeat(21)}scores ${JSON.stringify(review.scores)}`);
    if (reasons.length > 0) console.log(`${" ".repeat(21)}${reasons.join(", ")}`);
    console.log(`${" ".repeat(21)}"${feedback}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    results.push({
      id: testCase.id,
      expected: testCase.expect,
      actual: "error",
      agreed: false,
      falseApproval: false,
      reasons: [message],
      styleViolations: [],
      feedback: "",
    });
    console.log(`ERROR ${message}`);
  }
  console.log("");
}

const report = summariseEval(results);
console.log("-".repeat(70));
console.log(
  `${report.agreed}/${report.total} agreed | ${report.falseApprovals} false approvals | ` +
    `${report.falseFlags} false flags | ${report.total - report.styleClean} style problems | ` +
    `${report.errors} errors`,
);
console.log(evalPasses(report) ? "PASS" : "FAIL");
process.exit(evalPasses(report) ? 0 : 1);

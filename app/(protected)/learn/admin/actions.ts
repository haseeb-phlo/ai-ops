"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readXlsx, parseCsv } from "@/lib/programme/xlsx";
import {
  buildImportPreview,
  type ImportPreview,
} from "@/lib/programme/may-import";

/**
 * May 2026 import.
 *
 * Two steps on purpose - preview, then commit - because the dangerous failure
 * here is silent. The importer keys on column order, so a shifted export files
 * every answer under the wrong question and produces plausible-looking wrong
 * scores. The preview shows per-question counts to check against the known
 * distribution before anything is written.
 *
 * Idempotent: the upsert targets (email, wave), so re-running changes nothing.
 */

export type ImportResult =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "preview";
      preview: SerialisablePreview;
      fileName: string;
      payload: string;
    }
  | {
      kind: "done";
      inserted: number;
      withoutAccount: number;
    };

/** The preview, minus the full answer sets - those go in `payload`. */
export type SerialisablePreview = Omit<ImportPreview, "responses"> & {
  sampleEmails: string[];
};

const MAX_BYTES = 10 * 1024 * 1024;

function toPreview(rows: string[][]): {
  preview: SerialisablePreview;
  full: ImportPreview;
} {
  const full = buildImportPreview(rows);
  return {
    full,
    preview: {
      rowCount: full.rowCount,
      duplicatesDropped: full.duplicatesDropped,
      unmatchedCount: full.unmatchedCount,
      headerCheck: full.headerCheck,
      distribution: full.distribution,
      sampleEmails: full.responses.slice(0, 3).map((r) => r.email),
    },
  };
}

export async function previewMayImport(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can import." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "error", message: "Pick a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { kind: "error", message: "That file is over 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows: string[][];
  try {
    rows = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(buffer.toString("utf8"))
      : readXlsx(buffer);
  } catch (error) {
    return {
      kind: "error",
      message: `Could not read that file: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  if (rows.length < 2) {
    return { kind: "error", message: "That file has no data rows." };
  }

  const { preview, full } = toPreview(rows);
  return {
    kind: "preview",
    preview,
    fileName: file.name,
    // Carried through the round-trip so committing doesn't re-upload or
    // re-parse, and so what's written is exactly what was previewed.
    payload: JSON.stringify(full.responses),
  };
}

export async function commitMayImport(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can import." };
  }

  let responses: {
    email: string;
    answers: Record<string, { value: string; score?: number }>;
    completionTime: string;
  }[];
  try {
    responses = JSON.parse(String(formData.get("payload") ?? "[]"));
  } catch {
    return { kind: "error", message: "Preview expired — upload again." };
  }
  if (responses.length === 0) {
    return { kind: "error", message: "Nothing to import." };
  }

  const supabase = await createClient();

  // Resolve user_ids where an account exists. Rows without one are still
  // imported - user_id binds on their first sign-in - because dropping them
  // would shed exactly the sample the before/after comparison depends on.
  const { data: userRows } = await supabase.rpc("user_emails", {
    p_user_ids: [],
  });
  void userRows; // placeholder: the RPC is id-keyed, so match after insert.

  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < responses.length; i += chunkSize) {
    const chunk = responses.slice(i, i + chunkSize).map((r) => ({
      email: r.email.toLowerCase(),
      wave: "may_2026" as const,
      source: "import" as const,
      answers_json: r.answers,
      submitted_at: parseCompletionTime(r.completionTime),
    }));

    const { error, count } = await supabase
      .from("ai_score_responses")
      .upsert(chunk, { onConflict: "email,wave", count: "exact" });

    if (error) {
      return { kind: "error", message: `Import failed: ${error.message}` };
    }
    inserted += count ?? chunk.length;
  }

  // Backfill user_id for anyone who already has an account. The rest bind at
  // their next sign-in, via the hook in /auth/callback.
  const { data: linked } = await supabase.rpc("link_ai_score_responses");
  const withoutAccount = Math.max(
    0,
    responses.length - (typeof linked === "number" ? linked : 0),
  );

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track/score");
  return { kind: "done", inserted, withoutAccount };
}

/**
 * Microsoft Forms exports completion time in a few shapes. Anything we can't
 * confidently read falls back to now() rather than inventing a date.
 */
function parseCompletionTime(raw: string): string {
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed)
    ? new Date().toISOString()
    : new Date(parsed).toISOString();
}

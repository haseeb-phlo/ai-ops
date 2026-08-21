/**
 * Generates supabase/programme_seed.sql from lib/programme/track-spec.ts.
 *
 * Run with `npm run seed:programme`. The generated file is committed; if
 * regenerating produces a diff, the SQL was hand-edited and the spec is the
 * one to fix.
 *
 * The generated seed is idempotent - every insert is guarded by a
 * `where not exists` on (track, day_index, sort_order), matching the style of
 * supabase/seed.sql - so running it twice is a no-op.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Node 24 strips TypeScript types natively, so the spec is imported directly
// rather than transpiled or duplicated - one definition, no drift.
import {
  buildTrackItems,
  TRACK_NAME,
  TRACK_SLUG,
} from "../lib/programme/track-spec.ts";
import { QUIZ_CONTENT_BY_DAY } from "../lib/programme/quiz-content.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const jsonb = (o) =>
  o == null ? `'{}'::jsonb` : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

const items = buildTrackItems();

// Fill each quiz's questions from the content module. Done here rather than in
// track-spec so that module stays dependency-free.
for (const item of items) {
  if (item.type !== "quiz") continue;
  const questions = QUIZ_CONTENT_BY_DAY[item.dayIndex] ?? [];
  if (questions.length === 0) {
    throw new Error(`No quiz content for day ${item.dayIndex}.`);
  }
  if (questions.length !== item.config.question_count) {
    throw new Error(
      `Day ${item.dayIndex}: ${questions.length} questions written but ` +
        `question_count says ${item.config.question_count}.`,
    );
  }
  if (item.config.pass_mark > questions.length) {
    throw new Error(
      `Day ${item.dayIndex}: pass mark ${item.config.pass_mark} exceeds ` +
        `${questions.length} questions - nobody could pass.`,
    );
  }
  item.config.questions = questions;
}

// (day_index, sort_order) is the seed's idempotency key and a unique
// constraint in the schema. Assert it here so a spec change that collides
// fails at generate time with a readable message, rather than at psql time
// with a constraint violation.
const slots = new Set();
for (const it of items) {
  const key = `${it.dayIndex}:${it.sortOrder}`;
  if (slots.has(key)) {
    throw new Error(
      `Duplicate (day_index, sort_order) ${key} for "${it.title}". ` +
        `Give repeated item types on one day distinct sortOrder values in track-spec.ts.`,
    );
  }
  slots.add(key);
}
const lines = [];
lines.push(`-- =========================================================================`);
lines.push(`-- Core Programme track seed`);
lines.push(`--`);
lines.push(`-- GENERATED FILE - do not edit by hand.`);
lines.push(`-- Source: lib/programme/track-spec.ts   Regenerate: npm run seed:programme`);
lines.push(`--`);
lines.push(`-- Idempotent: every insert is guarded, so running this twice is a no-op.`);
lines.push(`-- Run AFTER migrations. Safe to run against an existing track.`);
lines.push(`--`);
lines.push(`-- Learn videos are REFERENCED, never copied: learn_video_id is resolved by`);
lines.push(`-- exact title match against learn_videos and left null when there's no`);
lines.push(`-- match, to be bound later in the admin Track-items screen.`);
lines.push(`-- =========================================================================`);
lines.push("");
lines.push(`insert into public.programme_tracks (name, slug, is_active)`);
lines.push(`select ${q(TRACK_NAME)}, ${q(TRACK_SLUG)}, true`);
lines.push(` where not exists (select 1 from public.programme_tracks where slug = ${q(TRACK_SLUG)});`);
lines.push("");
lines.push(`-- ${items.length} items: day 0 gate, 15 x (video + use_example), 3 sessions,`);
lines.push(`-- 3 quizzes (end of each week), 8 submission slots, 1 post check-in.`);
lines.push(`with track as (`);
lines.push(`  select id from public.programme_tracks where slug = ${q(TRACK_SLUG)}`);
lines.push(`), spec(type, title, description, day_index, sort_order, learn_video_title, config_json) as (`);
lines.push(`  values`);
const rows = items.map(
  (it) =>
    `    (${q(it.type)}, ${q(it.title)}, ${q(it.description ?? null)}, ` +
    `${it.dayIndex}, ${it.sortOrder}, ${q(it.learnVideoTitle ?? null)}, ${jsonb(it.config ?? {})})`,
);
lines.push(rows.join(",\n"));
lines.push(`)`);
lines.push(`insert into public.programme_track_items`);
lines.push(`  (track_id, type, title, description, day_index, sort_order, learn_video_id, config_json)`);
lines.push(`select t.id, s.type, s.title, s.description, s.day_index, s.sort_order,`);
lines.push(`       (select v.id from public.learn_videos v where lower(v.title) = lower(s.learn_video_title) limit 1),`);
lines.push(`       s.config_json`);
lines.push(`  from spec s cross join track t`);
lines.push(` where not exists (`);
lines.push(`   select 1 from public.programme_track_items i`);
lines.push(`    where i.track_id = t.id and i.day_index = s.day_index and i.sort_order = s.sort_order`);
lines.push(` );`);
lines.push("");
lines.push(`-- Sync titles and descriptions from the spec. These are seed-owned: admins`);
lines.push(`-- rename Learn videos, not track days, so overwriting is safe and it means`);
lines.push(`-- re-running the seed actually applies a wording change to an existing track.`);
lines.push(`update public.programme_track_items i`);
lines.push(`   set title = s.title, description = s.description`);
lines.push(`  from (values`);
lines.push(
  items
    .map(
      (it) =>
        `    (${it.dayIndex}, ${it.sortOrder}, ${q(it.title)}, ${q(it.description ?? null)})`,
    )
    .join(",\n"),
);
lines.push(`  ) as s(day_index, sort_order, title, description)`);
lines.push(` where i.day_index = s.day_index and i.sort_order = s.sort_order`);
lines.push(`   and i.track_id = (select id from public.programme_tracks where slug = ${q(TRACK_SLUG)})`);
lines.push(`   and (i.title is distinct from s.title or i.description is distinct from s.description);`);
lines.push("");
lines.push(`-- Re-bind any day whose Learn video has since been added. Only fills nulls,`);
lines.push(`-- so an admin's manual binding is never overwritten.`);
lines.push(`--`);
lines.push(`-- VIDEO ITEMS ONLY. A use_example is the "now go do it" half of the day and`);
lines.push(`-- stays unbound: if it shared the video, one tick on /learn would complete`);
lines.push(`-- both items and G1 would be reachable without doing any exercise.`);
lines.push(`update public.programme_track_items i`);
lines.push(`   set learn_video_id = v.id`);
lines.push(`  from public.learn_videos v`);
lines.push(` where i.learn_video_id is null`);
lines.push(`   and i.type = 'video'`);
lines.push(`   and lower(v.title) = lower(i.title)`);
lines.push(`   and i.track_id = (select id from public.programme_tracks where slug = ${q(TRACK_SLUG)});`);
lines.push("");

writeFileSync(resolve(root, "supabase/programme_seed.sql"), lines.join("\n"));
console.log(`generated supabase/programme_seed.sql (${items.length} items)`);

"use client";

import { useId, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  CheckIcon,
  ClapperboardIcon,
  ClipboardCheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  LockIcon,
  PlayIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { videoEmbedUrl } from "@/lib/video";
import { parseItemCopy } from "@/lib/programme/item-copy";
import { normaliseTaskLink, shortenTaskLink } from "@/lib/programme/task-link";
import { PROGRAMME_OPEN_LABEL } from "@/lib/programme/working-days";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  PROGRAMME_ITEM_STATE,
  PROGRAMME_SIGNOFF,
  type ProgrammeItemState,
  type ProgrammeSignoffStatus,
} from "@/lib/status";
import type { TrackVideo } from "@/lib/programme/track-data";
import { Input } from "@/components/ui/input";
import {
  markTrackItemComplete,
  markTrackItemStarted,
  saveTaskOutputLink,
} from "../actions";
import { SubmissionDialog } from "./submission-dialog";

export type TrackItemView = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  state: ProgrammeItemState;
  unlockDate: string;
  video: TrackVideo | null;
  /** Set for submission_slot items. */
  /** Video day with nothing recorded yet: shown, but not a to-do. */
  awaitingVideo?: boolean;
  /**
   * Whether this item's own day has come round yet.
   *
   * Distinct from `state`: an item that has been started or completed never
   * re-locks, so a future day can be open and on screen. Drives everything
   * the card is willing to say - see below.
   */
  dayArrived?: boolean;
  /**
   * Locked by week one's checkpoint rather than by its date - rule 2b.
   *
   * Needed because the two are indistinguishable from `state` alone, and the
   * date is actively misleading here: a day held by the checkpoint has a
   * release date that has already passed, so "Unlocks 7 Sep" on the 8th reads
   * as a bug rather than as a thing the member can do something about.
   */
  blockedByWeekOne?: boolean;
  /**
   * True when this item's unlock date IS today and the clock is what is still
   * holding it - days open at 7am, not at midnight.
   *
   * Without it the card spends every morning telling somebody a thing
   * "unlocks 2 Sep" on the 2nd of September, which reads as a broken date
   * rather than as an hour to wait for.
   */
  opensToday?: boolean;
  /**
   * The date this item's day opens, for the "Released on ..." line.
   *
   * Carried separately from `unlockDate` because the two answer different
   * questions and only agree while unlock is daily: `unlockDate` is when the
   * item becomes reachable, this is when its DAY comes round. It is computed
   * from the same daily arithmetic as `dayArrived`, so the date shown is
   * always the date the blanking stops.
   */
  releaseDate?: string;
  /**
   * The link this member filed against a Task, if any. Only ever set for
   * use_example items - see lib/programme/task-link.ts.
   */
  outputUrl?: string | null;
  submission?: {
    kind: string;
    signoffStatus: ProgrammeSignoffStatus | null;
    signoffComment: string | null;
    reviewedByAi?: boolean;
  } | null;
};

const TYPE_ICON: Record<string, typeof PlayIcon> = {
  video: PlayIcon,
  use_example: FileTextIcon,
  session: UsersIcon,
  quiz: ClipboardCheckIcon,
  questionnaire_baseline: ClipboardCheckIcon,
  questionnaire_post: ClipboardCheckIcon,
  submission_slot: FileTextIcon,
};

/**
 * The panel a day's video sits behind: a button that plays in place, or an
 * anchor to the host when the video cannot be embedded.
 *
 * One component rather than two branches around the same markup, so a
 * link-out day cannot drift into a different hover state from a playable one.
 */
function PlaySurface(
  props: {
    title: string;
    children: React.ReactNode;
  } & (
    | { kind: "play"; onPlay: () => void }
    | { kind: "open"; href: string; onOpen: () => void }
  ),
) {
  const shell =
    "group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted";
  return props.kind === "play" ? (
    <button
      type="button"
      onClick={props.onPlay}
      className={shell}
      aria-label={`Play ${props.title}`}
    >
      {props.children}
    </button>
  ) : (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={props.onOpen}
      className={shell}
      aria-label={`Open ${props.title} in a new tab`}
    >
      {props.children}
    </a>
  );
}

/**
 * One item on the timeline.
 *
 * Locked items still render - greyed, with their unlock date - because seeing
 * what's coming is most of what makes a 15-day programme feel finite.
 */
export function TrackItemCard({
  cohortId,
  item,
}: {
  /**
   * The cohort this card is being shown for, sent with every write and every
   * link out. An admin with a preview run is in two cohorts on the same track,
   * and without this the server picks one for itself - which is how a sandbox
   * submission gets filed against a real cohort.
   */
  cohortId: string;
  item: TrackItemView;
}) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticComplete, setOptimisticComplete] = useState(
    item.state === "complete",
  );
  const [pending, startTransition] = useTransition();

  const locked = item.state === "locked";
  // Descriptions are plain text that may carry line breaks and "- " bullets;
  // a one-line description parses to a single paragraph, which is what every
  // description was before tasks grew steps. See lib/programme/item-copy.ts.
  const copy = parseItemCopy(item.description);
  const Icon = TYPE_ICON[item.type] ?? FileTextIcon;
  const state: ProgrammeItemState = optimisticComplete ? "complete" : item.state;
  const style = PROGRAMME_ITEM_STATE[state];
  // A video day with nothing linked yet can't be completed: otherwise G1 is
  // satisfiable for content that hasn't been recorded. Use examples have no
  // video by design, so they stay completable.
  const awaitingVideo = item.awaitingVideo ?? (item.type === "video" && !item.video);
  // A day that has not come round yet gives nothing away: no title, no
  // description, no still frame, no player - just the date it opens.
  //
  // `locked` is not the same test and cannot stand in for it. An item that has
  // been started never re-locks, so anyone who ran ahead under the old weekly
  // unlock is carrying unlocked day-4 items around today; those are exactly
  // the ones that would otherwise spoil the rest of the fortnight.
  //
  // Defaults to true so a caller that has not been taught about day pacing
  // shows everything rather than silently blanking the whole track.
  const dayArrived = item.dayArrived ?? true;
  // Everything below the header hangs off this rather than off `locked`, so a
  // day still to come renders as its release line and nothing else - no
  // player, no "coming soon" placeholder, no submit button.
  const revealed = dayArrived && !locked;
  // Read from config_json for every slot, so this is right on day one -
  // before there is a submission row to read a kind off. A work sample is
  // the odd slot out and says so on the card; see below.
  const submissionKind = item.submission?.kind ?? "signed_example";
  const isWorkSample = submissionKind.startsWith("work_sample");
  const canComplete =
    revealed &&
    !optimisticComplete &&
    !awaitingVideo &&
    (item.type === "video" || item.type === "use_example");

  // Null for a host we cannot embed, which turns the panel into a link out.
  // Branch on this, never on the id being truthy - see lib/video.ts.
  const videoEmbed = item.video
    ? videoEmbedUrl(
        { provider: item.video.provider, embedId: item.video.loom_embed_id },
        { autoplay: true },
      )
    : null;

  // Marks the item started whether it plays here or opens on its host: what
  // the day records is that they went to watch it, not which tab it ran in.
  const markStarted = () => {
    startTransition(() => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      fd.set("cohort_id", cohortId);
      void markTrackItemStarted(fd);
    });
  };

  // `playing` is only ever set for a video that plays HERE. A link-out opens
  // on the host, so it records the start and leaves the flag alone: the panel
  // it came from is still the thing on screen. Setting it anyway happens to
  // render the same today, because the embed branch also checks `videoEmbed` -
  // which is exactly the kind of inertness that stops being true the moment
  // anything else reads `playing`.
  const handlePlay = () => {
    setPlaying(true);
    markStarted();
  };

  const handleComplete = () => {
    setError(null);
    setOptimisticComplete(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      fd.set("cohort_id", cohortId);
      const result = await markTrackItemComplete(fd);
      if (result.kind === "error") {
        setOptimisticComplete(false);
        setError(result.message);
      }
    });
  };

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-background p-4",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border",
            state === "complete"
              ? "bg-background"
              : "bg-muted text-muted-foreground",
          )}
        >
          {locked ? (
            <LockIcon className="size-3.5" />
          ) : state === "complete" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {dayArrived ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className="text-sm font-medium text-foreground">
                {item.title}
              </h4>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    awaitingVideo
                      ? "bg-muted-foreground/30"
                      : style.dotClassName,
                  )}
                />
                {locked
                  ? item.blockedByWeekOne
                    ? "Submit week 1 first"
                    : item.opensToday
                      ? `Unlocks ${PROGRAMME_OPEN_LABEL}`
                      : `Unlocks ${format(new Date(`${item.unlockDate}T00:00:00`), "d MMM")}`
                  : awaitingVideo
                    ? "Coming soon"
                    : style.label}
              </span>
            </div>
          ) : (
            // The whole row for a day still to come. One line, and the date is
            // the only thing on it - printing a title beside it would give the
            // day away, which is the thing this is here to prevent.
            <h4 className="text-sm font-medium text-muted-foreground">
              Released on{" "}
              {format(
                new Date(`${item.releaseDate ?? item.unlockDate}T00:00:00`),
                "EEEE d MMMM",
              )}
            </h4>
          )}

          {/* A task can run to eight lines, so this reads as body copy rather
              than as the meta line it used to be: one step up in size and room
              between the blocks.

              NO MEASURE. There used to be a `max-w-prose` here, on the
              typographic argument that a line over ~65 characters is tiring to
              read. It cost more than it bought. Measured at a 1440px window:
              65ch resolves to 647px inside the 988px a card actually gives
              this column, so every sentence broke two thirds of the way
              across and left a 340px band of empty card to its right - which
              reads as a rendering fault rather than as a considered measure.
              Full width is the wanted behaviour; do not reinstate the cap as
              a typography fix. */}
          {dayArrived && copy.length > 0 && (
            <div className="mt-2 space-y-2.5">
              {copy.map((block, i) =>
                block.kind === "list" ? (
                  <ul
                    key={i}
                    className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/50"
                  >
                    {block.items.map((line, j) => (
                      <li key={j} className="pl-0.5">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {block.text}
                  </p>
                ),
              )}
            </div>
          )}

          {revealed && item.video && (
            <div className="mt-3">
              {playing && videoEmbed ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <iframe
                    src={videoEmbed}
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={item.video.title}
                  />
                </div>
              ) : (
                // A real anchor for a host we cannot embed, so the day's video
                // still opens - on the host's own page, in a new tab. Same
                // panel either way: the day's card deliberately shows no still
                // frame, so there is nothing to restyle.
                <PlaySurface
                  title={item.video.title}
                  {...(videoEmbed
                    ? { kind: "play" as const, onPlay: handlePlay }
                    : {
                        kind: "open" as const,
                        href: item.video.loom_share_url,
                        onOpen: markStarted,
                      })}
                >
                  {/* No still frame, for any day. It used to render for a
                      day that had arrived, gated on the same predicate as the
                      title - but a thumbnail is a picture OF the content, and
                      the whole point of the day-by-day drip is that you meet
                      the content on its day. A play button on a plain panel
                      says "there is a video here" without saying what is in
                      it, which is all this card needs to say. The library
                      keeps its thumbnails; that is an admin surface. */}
                  <span className="relative flex size-11 items-center justify-center rounded-full bg-black/70 text-white transition group-hover:bg-black/85">
                    {videoEmbed ? (
                      <PlayIcon className="size-5" aria-hidden />
                    ) : (
                      <ExternalLinkIcon className="size-5" aria-hidden />
                    )}
                  </span>
                </PlaySurface>
              )}
            </div>
          )}

          {/* Placeholder for a day whose video isn't recorded yet. Member-
              facing copy, not the admin instruction it used to show - during
              Cohort 1 several days are still in production, and "coming soon"
              with the topic named reads as planned rather than broken. */}
          {revealed && !item.video && item.type === "video" && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
              >
                <ClapperboardIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Video coming soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Being recorded now. It will not hold up your progress - carry
                  on with the rest of the day.
                </p>
              </div>
            </div>
          )}

          {revealed && item.type === "submission_slot" && (
            <>
              {/* What a work sample IS, said on the card rather than inside
                  the dialog. Every other slot names itself - "Example 1" after
                  a day about prompting is self-explanatory - but "Work sample
                  (before)" on day one is a title and a Submit button with no
                  brief attached, and the brief only appeared once you had
                  already decided to click. The two things people need to know
                  before deciding are that anything counts and that it is not
                  a test of them, so both belong out here. */}
              {isWorkSample && (
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  Submit a piece of work you&apos;ve done using Claude - a
                  Project, a Cowork session, an Artefact, a Scheduled Task or
                  anything at all. Send it exactly as it is; it is not meant to
                  be tidied up. This is private and it measures the programme
                  rather than you.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {item.submission?.signoffStatus && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        PROGRAMME_SIGNOFF[item.submission.signoffStatus]
                          .dotClassName,
                      )}
                    />
                    {PROGRAMME_SIGNOFF[item.submission.signoffStatus].label}
                  </span>
                )}
                {item.submission?.signoffStatus !== "approved" && (
                  <SubmissionDialog
                    cohortId={cohortId}
                    trackItemId={item.id}
                    kind={submissionKind}
                    title={item.title}
                    isResubmission={
                      item.submission?.signoffStatus === "rejected"
                    }
                    rejectionComment={item.submission?.signoffComment ?? null}
                  />
                )}
              </div>
            </>
          )}

          {revealed && item.type === "quiz" && (
            <Link
              href={`/learn/track/quiz/${item.id}?cohort=${cohortId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
            >
              {item.state === "complete" ? "Retake" : "Start"} the check
            </Link>
          )}

          {revealed &&
            (item.type === "questionnaire_baseline" ||
              item.type === "questionnaire_post") && (
              <Link
                href={`/learn/track/score?cohort=${cohortId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
              >
                {item.state === "complete" ? "See your score" : "Open the check-in"}
              </Link>
            )}

          {/* Feedback on an APPROVED submission had nowhere to appear: the
              resubmit dialog only opens when something was sent back, so an
              approving comment was written and never read. */}
          {revealed &&
            item.type === "submission_slot" &&
            item.submission?.signoffStatus === "approved" &&
            item.submission.signoffComment && (
              <div className="mt-2 rounded-md border border-border border-l-2 border-l-success bg-background px-3 py-2">
                <p className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {item.submission.reviewedByAi
                    ? "Feedback - automatic review"
                    : "Feedback"}
                </p>
                <p className="mt-0.5 text-xs text-foreground">
                  {item.submission.signoffComment}
                </p>
              </div>
            )}

          {canComplete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleComplete}
              disabled={pending}
            >
              <CheckIcon aria-hidden />
              Mark complete
            </Button>
          )}

          {revealed && item.type === "use_example" && (
            <TaskOutputLink
              cohortId={cohortId}
              itemId={item.id}
              initialUrl={item.outputUrl ?? null}
              complete={state === "complete"}
              onSaved={() => setOptimisticComplete(true)}
            />
          )}

          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Where a member files the link to what a Task produced.
 *
 * Inline rather than behind a dialog, which is how a submission slot does it.
 * A slot asks for four fields and carries sign-off, so the dialog earns its
 * click; this is one field asked fifteen times, and a box you have to open is
 * a box most people leave shut.
 *
 * Optional on every day: saving a link completes the task, and so does the
 * Mark complete button next to it. Day 2 asks for a link in its copy, most
 * days do not, and a task whose output is a spreadsheet on a shared drive is
 * still done.
 */
function TaskOutputLink({
  cohortId,
  itemId,
  initialUrl,
  complete,
  onSaved,
}: {
  cohortId: string;
  itemId: string;
  initialUrl: string | null;
  /** Only so the button does not offer to finish something already finished. */
  complete: boolean;
  /** Lets the card tick itself over without waiting for the revalidate. */
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(initialUrl);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // useId, not the item id: the page renders the same item twice - once in the
  // focus card and once in the timeline below it - so an id derived from the
  // item would appear twice in the document and the label would point at
  // whichever copy the parser met first.
  const inputId = useId();
  const showForm = editing || !saved;

  const handleSubmit = () => {
    // Validated here as well as in the action, using the same module, so a
    // typo comes back instantly rather than after a round trip.
    const normalised = normaliseTaskLink(value);
    if (!normalised) {
      setError(
        "That does not look like a link. Paste the whole thing, like https://claude.ai/share/...",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("track_item_id", itemId);
      fd.set("cohort_id", cohortId);
      fd.set("output_url", normalised);
      const result = await saveTaskOutputLink(fd);
      if (result.kind === "error") {
        setError(result.message);
        return;
      }
      setSaved(normalised);
      setValue("");
      setEditing(false);
      onSaved();
    });
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      {saved && !editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <LinkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <a
            href={saved}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-sm text-foreground underline underline-offset-2 hover:no-underline"
          >
            <span className="truncate">{shortenTaskLink(saved)}</span>
            <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setValue(saved);
              setEditing(true);
            }}
          >
            Replace
          </Button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          {/* Not labelled optional. It is not enforced - a task whose output
              is a spreadsheet on a shared drive is still done - but the
              programme tracks a link per person per day, and a field that
              calls itself optional is a field most people skip. */}
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            Link to your output
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              id={inputId}
              name="output_url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://claude.ai/share/..."
              className="min-w-0 flex-1"
              disabled={pending}
            />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {saved || complete ? "Save link" : "Save & mark done"}
            </Button>
            {editing && saved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            In Claude, use Share to create a link, then paste it here. Anything
            else that shows your output works too.
          </p>
        </form>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

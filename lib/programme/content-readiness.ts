/**
 * Which track items are actually ready for a member to do.
 *
 * A video day whose Learn video has not been recorded yet is NOT something a
 * member can complete, and it must not be counted as though it were.
 *
 * This is not hypothetical: the programme plan has several videos produced
 * during Cohort 1 rather than before it, so days sit unrecorded for real
 * people. The first version of this treated an unrecorded day as an ordinary
 * outstanding item, which meant:
 *
 *   - G1 ("watched everything") could never pass, so nobody could ever
 *     complete the programme;
 *   - RAG counted the missing videos against the member, so everyone drifted
 *     to red through no fault of their own;
 *   - the member saw a day they could not action and reasonably concluded the
 *     track was broken.
 *
 * The rule that fixes all three: you cannot be required to watch a video that
 * does not exist. An unbound video day is excluded from the gate and from RAG
 * until it has a video, and shows as "coming soon" rather than as a to-do.
 * The moment an admin binds it, it becomes required like any other day.
 *
 * Use examples are deliberately never affected: they are exercises with no
 * video of their own, so they are always actionable.
 */

export type ContentItem = {
  id: string;
  type: string;
  learn_video_id?: string | null;
};

/** True when this is a video day with nothing recorded against it yet. */
export function isAwaitingContent(item: ContentItem): boolean {
  return item.type === "video" && !item.learn_video_id;
}

/** True when the member can actually be asked to complete this item. */
export function isActionable(item: ContentItem): boolean {
  return !isAwaitingContent(item);
}

/**
 * The item ids gate G1 counts: every video and use example EXCEPT videos with
 * nothing recorded yet.
 */
export function gateableContentItemIds(
  items: readonly ContentItem[],
): string[] {
  return items
    .filter((i) => i.type === "video" || i.type === "use_example")
    .filter(isActionable)
    .map((i) => i.id);
}

/** How many days are waiting on a recording, for the admin's benefit. */
export function awaitingContentCount(items: readonly ContentItem[]): number {
  return items.filter(isAwaitingContent).length;
}

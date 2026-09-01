/**
 * Turns a track item's `description` into renderable blocks.
 *
 * Descriptions started life as one sentence and rendered as a single `<p>`,
 * which is why the day 1 video description is written as prose with the
 * comment "newlines collapse, so a bulleted string would run together". That
 * was true of the renderer, not of the copy people want to write: a task that
 * says "pick three jobs" then lists them needs the list to survive.
 *
 * So the storage stays plain text - no markdown, no JSON in `config_json` -
 * and this parser gives the card the two shapes the copy actually uses:
 *
 *   - a line starting "- " (or "* ", or a bullet character) is a list item,
 *     and consecutive ones become one list;
 *   - every other non-blank line is its own paragraph.
 *
 * A single-line description therefore parses to exactly one paragraph, which
 * is what every existing description is and how they already render. Blank
 * lines are separators only - two paragraphs with a gap between them read the
 * same as two without, because the card spaces paragraphs itself.
 */

export type CopyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/** Leading bullet markers a writer might paste in, including from a doc. */
const BULLET_RE = /^\s*(?:[-*•‣◦⁃∙])\s+/;

/** A line that is nothing but a marker. */
const MARKER_ONLY_RE = /^[-*•‣◦⁃∙]$/;

export function parseItemCopy(description: string | null): CopyBlock[] {
  if (!description) return [];

  const blocks: CopyBlock[] = [];
  // Held open so consecutive bullet lines join one list rather than each
  // becoming a list of one, which would double the spacing between them.
  let openList: string[] | null = null;

  const closeList = () => {
    if (openList && openList.length > 0) {
      blocks.push({ kind: "list", items: openList });
    }
    openList = null;
  };

  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      // A blank line ends a list but is not itself a block - the card owns
      // the vertical rhythm, so copy pasted with double spacing renders the
      // same as copy without it.
      closeList();
      continue;
    }

    // A marker with nothing after it is a stray dash from an edit, not an
    // empty bullet. Skipped without closing the list, so "- a", "-", "- b"
    // stays one list of two rather than two lists of one.
    if (MARKER_ONLY_RE.test(line)) continue;

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      (openList ??= []).push(line.slice(bullet[0].length).trim());
      continue;
    }

    closeList();
    blocks.push({ kind: "paragraph", text: line });
  }

  closeList();
  return blocks;
}

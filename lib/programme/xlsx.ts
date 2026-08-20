/**
 * A minimal, read-only .xlsx reader.
 *
 * Why not a library: SheetJS stopped publishing to npm at v0.18.5, and that
 * stale package carries a prototype-pollution advisory (CVE-2023-30533, fixed
 * only in 0.19.3+, which lives on the vendor's own CDN). Pulling a CDN tarball
 * into a regulated pharmacy's internal platform to read one historical
 * spreadsheet is a bad trade, and exceljs is heavy for a read-only path.
 *
 * An .xlsx is a ZIP of XML. We need exactly two entries - the shared string
 * table and the first worksheet - so the whole reader is a central-directory
 * walk, two inflates, and a regex pass. Scope is deliberately narrow: first
 * sheet, cell values only, everything returned as strings. No formulas, no
 * styles, no dates-as-numbers conversion.
 */

import { inflateRawSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;

type ZipEntry = { name: string; offset: number; compression: number; size: number };

/**
 * Reads the ZIP central directory.
 *
 * The end-of-central-directory record sits at the tail, after a comment of
 * unknown length, so it has to be found by scanning backwards for its
 * signature. 64KB is the maximum comment length, hence the bounded search.
 */
function readCentralDirectory(buf: Buffer): Map<string, ZipEntry> {
  let eocd = -1;
  const start = Math.max(0, buf.length - 65_557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("Not a valid .xlsx file (no ZIP directory).");

  const entryCount = buf.readUInt16LE(eocd + 10);
  let pointer = buf.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(pointer) !== CENTRAL_FILE_SIGNATURE) break;
    const compression = buf.readUInt16LE(pointer + 10);
    const compressedSize = buf.readUInt32LE(pointer + 20);
    const nameLength = buf.readUInt16LE(pointer + 28);
    const extraLength = buf.readUInt16LE(pointer + 30);
    const commentLength = buf.readUInt16LE(pointer + 32);
    const localOffset = buf.readUInt32LE(pointer + 42);
    const name = buf.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    entries.set(name, {
      name,
      offset: localOffset,
      compression,
      size: compressedSize,
    });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Extracts one entry. The local file header repeats the name and extra-field
 * lengths, and they can differ from the central directory's, so the data
 * offset must be computed from the LOCAL header - a classic source of
 * off-by-N corruption if you trust the central copy.
 */
function readEntry(buf: Buffer, entry: ZipEntry): string {
  const nameLength = buf.readUInt16LE(entry.offset + 26);
  const extraLength = buf.readUInt16LE(entry.offset + 28);
  const dataStart = entry.offset + 30 + nameLength + extraLength;
  const raw = buf.subarray(dataStart, dataStart + entry.size);
  if (entry.compression === 0) return raw.toString("utf8");
  if (entry.compression === 8) return inflateRawSync(raw).toString("utf8");
  throw new Error(`Unsupported compression method ${entry.compression}.`);
}

/* ------------------------------------------------------------------ */
/* XML                                                                 */
/* ------------------------------------------------------------------ */

// Excel writes elements with an `x:` namespace prefix; other producers don't.
// Every pattern below tolerates both.
const P = "(?:[A-Za-z0-9]+:)?";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    // Ampersand last, so "&amp;lt;" doesn't become "<".
    .replace(/&amp;/g, "&");
}

/**
 * The shared string table. Every text cell in a sheet is an INDEX into this,
 * not a literal - miss it and every answer comes back as a number.
 *
 * An <si> can be split across several <t> runs when part of the string is
 * formatted differently, so the runs are concatenated.
 */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = new RegExp(`<${P}si>([\\s\\S]*?)</${P}si>`, "g");
  const tRe = new RegExp(`<${P}t[^>]*>([\\s\\S]*?)</${P}t>`, "g");
  for (const si of xml.matchAll(siRe)) {
    let text = "";
    for (const t of si[1].matchAll(tRe)) text += t[1];
    out.push(decodeXmlEntities(text));
  }
  return out;
}

/** "BC" -> 55. Spreadsheet columns are base-26 with no zero. */
export function columnToIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * Reads the first worksheet as a dense grid of strings.
 *
 * Cells are addressed (A1, B7) and empty ones are simply absent from the XML,
 * so rows are built by column index rather than by order of appearance -
 * otherwise a blank cell silently shifts every value after it left by one,
 * which is the exact failure that would misfile answers under the wrong
 * question.
 */
export function readXlsx(buffer: Buffer): string[][] {
  const entries = readCentralDirectory(buffer);

  const sharedName = [...entries.keys()].find((n) =>
    n.endsWith("sharedStrings.xml"),
  );
  const shared = sharedName
    ? parseSharedStrings(readEntry(buffer, entries.get(sharedName)!))
    : [];

  const sheetName = [...entries.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) throw new Error("No worksheet found in the .xlsx file.");
  const sheet = readEntry(buffer, entries.get(sheetName)!);

  const rowRe = new RegExp(`<${P}row[^>]*>([\\s\\S]*?)</${P}row>`, "g");

  // Cells are scanned with an explicit walk rather than one regex.
  //
  // The tempting one-liner - `<c ...([^>]*)(?:/>|>(.*?)</c>)` - is WRONG,
  // because `[^>]*` happily consumes the `/` of a self-closing tag and then
  // matches the `>` branch, so an empty cell swallows the next populated one.
  // The value lands under the wrong column AND, if the two cells differ in
  // type, a shared-string index gets read as a literal number. Silent, and
  // exactly the failure that would misfile answers under the wrong question.
  const cellOpenRe = new RegExp(`<${P}c\\s+([^>]*)>`, "g");
  const vRe = new RegExp(`<${P}v>([\\s\\S]*?)</${P}v>`);
  const isRe = new RegExp(`<${P}is>[\\s\\S]*?<${P}t[^>]*>([\\s\\S]*?)</${P}t>`);
  const closeRe = new RegExp(`</${P}c>`);

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(rowRe)) {
    const xml = rowMatch[1];
    const cells: string[] = [];

    cellOpenRe.lastIndex = 0;
    let open: RegExpExecArray | null;
    while ((open = cellOpenRe.exec(xml)) !== null) {
      const attrs = open[1];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!ref) continue;
      const index = columnToIndex(ref) - 1;

      let value = "";
      // A trailing slash in the attribute run means the tag closed itself and
      // the cell is empty - there is no body to look at.
      if (!attrs.trimEnd().endsWith("/")) {
        const rest = xml.slice(cellOpenRe.lastIndex);
        const close = closeRe.exec(rest);
        const body = close ? rest.slice(0, close.index) : rest;
        if (/t="inlineStr"/.test(attrs)) {
          value = decodeXmlEntities(isRe.exec(body)?.[1] ?? "");
        } else {
          const raw = vRe.exec(body)?.[1] ?? "";
          value = /t="s"/.test(attrs)
            ? (shared[Number(raw)] ?? "")
            : decodeXmlEntities(raw);
        }
      }

      // Pad the gaps so column index always equals array index.
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** Convenience for CSV, which the importer also accepts. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

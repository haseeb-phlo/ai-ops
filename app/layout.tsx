import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * ONE type program for the whole product, sans and mono together.
 *
 * The previous pair was Work Sans and JetBrains Mono - two unrelated designs
 * with different x-heights, widths and stroke weights. That is fine on a
 * marketing page and it shows on these screens, because the training
 * dashboards set numbers in mono directly beside sans labels: the cohort
 * heatmap, the reporting tiles and the day strip all put a mono figure under a
 * sans eyebrow, and two families that were never drawn to sit together never
 * quite read as one table.
 *
 * IBM Plex was designed as a family with a mono sibling, for interfaces and
 * technical documentation, so the two agree on all of that by construction.
 * Two other things earn its place here specifically:
 *
 *   - this UI leans hard on small type. There is a named 11px step
 *     (`--text-3xs`) used for eyebrows and dense meta, and Plex was cut for
 *     screen text at those sizes rather than for headlines shrunk down;
 *   - both halves have real tabular figures, which matters because
 *     `tabular-nums` appears on nearly every number in the product and is
 *     load-bearing in the admin tables, where a column of scores has to line
 *     up.
 *
 * WEIGHTS ARE EXPLICIT because Plex is a static family on Google Fonts rather
 * than a variable one, so anything not listed here is synthesised by the
 * browser into a faux weight. 400/500/600 is exactly what the codebase uses -
 * `font-normal`, `font-medium` and `font-semibold`, and nothing bolder. Add
 * the weight here before reaching for `font-bold` in a component.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Phlo AI Ops",
  description: "Phlo's internal register of recurring workflows and AI initiatives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

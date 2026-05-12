/**
 * Returns a deterministic avatar URL for a given seed (user id, name, etc).
 * Uses Dicebear's public SVG endpoint so we don't need to set up Supabase
 * Storage or a CDN before showing real avatars on /map.
 *
 * Override at any point by saving an `avatar_url` on the profiles row.
 */
export function defaultAvatarUrl(seed: string): string {
  const safe = encodeURIComponent(seed || "anon");
  return `https://api.dicebear.com/9.x/personas/svg?seed=${safe}&backgroundType=gradientLinear`;
}

export function resolveAvatar(
  avatarUrl: string | null | undefined,
  seed: string,
): string {
  return avatarUrl && avatarUrl.trim().length > 0
    ? avatarUrl
    : defaultAvatarUrl(seed);
}

/**
 * Picks the best human-readable name for a user across our three sources.
 *
 * - `profile.display_name` is user-editable. It's authoritative when the user
 *   has actually set it.
 * - `people.display_name` is the org directory's canonical name (e.g.
 *   "Neal Archbold"). Used when the profile is missing or still on the
 *   email-local-part default.
 * - `email` is the last-resort fallback (the local part, e.g. "neal.archbold").
 *
 * The "still on the email default" check is what fixes pre-directory users:
 * their `handle_new_user` trigger stored `split_part(email, '@', 1)` as their
 * profile name, and the later backfill only updated rows that still equalled
 * that default. If they typed their email-local-part as their custom name
 * we'll happily overwrite with the directory's version - that's an accepted
 * trade-off; nobody picks "neal.archbold" as their preferred display name.
 */
export function resolveDisplayName(
  profile: string | null | undefined,
  people: string | null | undefined,
  email: string | null | undefined,
): string {
  const emailLocal = (email ?? "").split("@")[0]?.trim() ?? "";
  const profileTrim = profile?.trim() ?? "";
  const peopleTrim = people?.trim() ?? "";

  const profileIsDefault =
    profileTrim.length === 0 ||
    profileTrim.toLowerCase() === emailLocal.toLowerCase();

  if (!profileIsDefault) return profileTrim;
  if (peopleTrim) return peopleTrim;
  if (profileTrim) return profileTrim;
  return emailLocal;
}

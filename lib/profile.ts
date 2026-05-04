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

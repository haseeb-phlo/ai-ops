import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 ring-purple-200",
  editor: "bg-blue-100 text-blue-800 ring-blue-200",
  viewer: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  member: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function Header({ user }: { user: SessionUser }) {
  const roleClass = ROLE_STYLES[user.role] ?? ROLE_STYLES.member;

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight"
        >
          Phlo Workshop
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600">
          <Link href="/workflows" className="hover:text-zinc-900">
            Workflows
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-zinc-600">
          <span>{user.email}</span>
          {user.team && (
            <>
              <span className="text-zinc-300">·</span>
              <span>{user.team}</span>
            </>
          )}
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${roleClass}`}
        >
          {user.role}
        </span>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

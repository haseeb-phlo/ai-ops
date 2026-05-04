import { getSessionUser } from "@/lib/auth";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export default async function Home() {
  const user = await getSessionUser();
  const firstName = user.displayName.split(" ")[0];
  const article = VOWELS.has(user.role.charAt(0).toLowerCase()) ? "an" : "a";

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Hello, {firstName}
        </h1>
        <p className="text-zinc-500">
          You&apos;re signed in as {article}{" "}
          <span className="font-medium text-zinc-900">{user.role}</span>
          {user.team && (
            <>
              {" "}
              on team{" "}
              <span className="font-medium text-zinc-900">{user.team}</span>
            </>
          )}
          .
        </p>
      </div>
    </div>
  );
}

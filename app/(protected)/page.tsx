import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  const firstName = user.email.split("@")[0].split(".")[0];
  const greeting = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Hello, {greeting} 👋
        </h1>
        <p className="text-zinc-500">
          You&apos;re signed in as{" "}
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

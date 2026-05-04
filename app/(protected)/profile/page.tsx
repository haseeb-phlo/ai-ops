import { getSessionUser } from "@/lib/auth";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const user = await getSessionUser();

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Your name and avatar are shown across the app and on the company map.
        </p>
      </div>

      <ProfileForm
        defaultDisplayName={user.displayName}
        defaultAvatarUrl={user.avatarUrl}
        defaultTitle={user.title ?? ""}
        email={user.email}
        team={user.team}
        userId={user.id}
      />
    </div>
  );
}

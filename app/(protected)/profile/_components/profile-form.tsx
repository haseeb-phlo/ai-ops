"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultAvatarUrl } from "@/lib/profile";
import { updateProfile, type UpdateProfileState } from "../actions";

export function ProfileForm({
  defaultDisplayName,
  defaultAvatarUrl: initialAvatarUrl,
  defaultTitle,
  email,
  team,
  userId,
}: {
  defaultDisplayName: string;
  defaultAvatarUrl: string;
  defaultTitle: string;
  email: string;
  team: string | null;
  userId: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    { kind: "idle" },
  );

  function useDefaultAvatar() {
    setAvatarUrl(defaultAvatarUrl(userId));
  }

  return (
    <form action={action} className="space-y-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl || defaultAvatarUrl(userId)}
          alt={defaultDisplayName}
          className="size-20 rounded-full ring-1 ring-zinc-200 object-cover bg-zinc-50"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">
            {team ? `Team: ${team}` : "No team assigned"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={defaultDisplayName}
          required
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          Shown on the map and beside workflows you own.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Job title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultTitle}
          required
          maxLength={100}
          placeholder="e.g. Operations Lead"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
        <Input
          id="avatar_url"
          name="avatar_url"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
        />
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={useDefaultAvatar}
            className="text-zinc-600 underline-offset-2 hover:underline"
          >
            Use generated avatar
          </button>
          <span className="text-muted-foreground">
            Paste any image URL, or use the auto-generated one.
          </span>
        </div>
      </div>

      {state.kind === "error" && (
        <p
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      )}
      {state.kind === "ok" && (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          role="status"
        >
          Saved.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

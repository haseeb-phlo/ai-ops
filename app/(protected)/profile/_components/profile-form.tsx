"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { defaultAvatarUrl } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, type UpdateProfileState } from "../actions";

const CUSTOM_TEAM = "__custom__";

// Native input styled to match components/ui/input.tsx. Bypasses Base UI's
// FieldControl, whose `useControlled` hook locks controlled-vs-uncontrolled
// mode in a useRef on first render - incompatible with React 19's form-action
// reset cycle, which causes a false-positive uncontrolled→controlled warning
// when useActionState re-renders this form.
const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

export function ProfileForm({
  defaultDisplayName,
  defaultAvatarUrl: initialAvatarUrl,
  defaultTitle,
  defaultTeam,
  email,
  userId,
  teams,
}: {
  defaultDisplayName: string;
  defaultAvatarUrl: string;
  defaultTitle: string;
  defaultTeam: string | null;
  email: string;
  userId: string;
  teams: string[];
}) {
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [title, setTitle] = useState(defaultTitle);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialTeamInList = !!defaultTeam && teams.includes(defaultTeam);
  const [teamSelect, setTeamSelect] = useState<string>(() => {
    if (!defaultTeam) return "";
    return initialTeamInList ? defaultTeam : CUSTOM_TEAM;
  });
  const [customTeam, setCustomTeam] = useState<string>(
    !initialTeamInList && defaultTeam ? defaultTeam : "",
  );

  const isCustomTeam = teamSelect === CUSTOM_TEAM;
  const submittedTeam = isCustomTeam ? customTeam.trim() : teamSelect;

  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    { kind: "idle" },
  );

  function useDefaultAvatar() {
    setAvatarUrl(defaultAvatarUrl(userId));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUpload({ kind: "error", message: "Use a PNG, JPEG, or WEBP file." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUpload({ kind: "error", message: "File is over 5 MB." });
      return;
    }

    setUpload({ kind: "uploading" });
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setUpload({ kind: "error", message: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUpload({ kind: "idle" });
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
        <p className="text-sm font-medium text-zinc-700">{email}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={100}
          className={cn(inputClass)}
        />
        <p className="text-xs text-muted-foreground">
          Shown on the map and beside workflows you own.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Job title</Label>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          placeholder="e.g. Operations Lead"
          className={cn(inputClass)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team">Team</Label>
        <input type="hidden" name="team" value={submittedTeam} />
        <Select
          value={teamSelect}
          onValueChange={(v) => setTeamSelect(v ?? "")}
        >
          <SelectTrigger id="team" className="w-full">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_TEAM}>Other...</SelectItem>
          </SelectContent>
        </Select>
        {isCustomTeam && (
          <input
            id="team_custom"
            value={customTeam}
            onChange={(e) => setCustomTeam(e.target.value)}
            maxLength={100}
            placeholder="Enter team name"
            className={cn(inputClass)}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Profile photo</Label>
        <input type="hidden" name="avatar_url" value={avatarUrl} />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.kind === "uploading" || pending}
          >
            {upload.kind === "uploading" ? "Uploading…" : "Upload photo"}
          </Button>
          <button
            type="button"
            onClick={useDefaultAvatar}
            className="text-xs text-zinc-600 underline-offset-2 hover:underline"
          >
            Use generated avatar instead
          </button>
        </div>
        {upload.kind === "error" && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
          >
            {upload.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, or WEBP. Up to 5 MB. Click <em>Save profile</em> to keep
          the new photo.
        </p>
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
        <Button
          type="submit"
          disabled={
            pending ||
            upload.kind === "uploading" ||
            submittedTeam.length === 0
          }
        >
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

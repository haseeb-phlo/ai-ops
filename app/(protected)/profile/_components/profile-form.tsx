"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
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
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

type SavedSnapshot = {
  displayName: string;
  title: string;
  avatarUrl: string;
  team: string;
};

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
  // Normalize free-text teams: trim, and reuse the canonical casing when the
  // typed value case-insensitively matches an existing team - prevents
  // "Tech" vs "technology" drift in the directory.
  const trimmedCustom = customTeam.trim();
  const canonicalCustom =
    teams.find((t) => t.toLowerCase() === trimmedCustom.toLowerCase()) ??
    trimmedCustom;
  const submittedTeam = isCustomTeam ? canonicalCustom : teamSelect;

  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    { kind: "idle" },
  );

  // Dirty tracking against the last-saved snapshot: Save stays disabled
  // until something changed, "Saved." disappears as soon as you edit again,
  // and navigating away with unsaved edits warns first.
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot>({
    displayName: defaultDisplayName,
    title: defaultTitle,
    avatarUrl: initialAvatarUrl,
    team: defaultTeam ?? "",
  });
  const [showSaved, setShowSaved] = useState(false);
  const pendingSnapshot = useRef<SavedSnapshot | null>(null);

  const dirty =
    displayName !== savedSnapshot.displayName ||
    title !== savedSnapshot.title ||
    avatarUrl !== savedSnapshot.avatarUrl ||
    submittedTeam !== savedSnapshot.team;

  const avatarUnsaved = avatarUrl !== savedSnapshot.avatarUrl;

  function handleSubmit(formData: FormData) {
    // Snapshot what's actually being sent so a keystroke during the round
    // trip can't corrupt the dirty baseline.
    pendingSnapshot.current = {
      displayName: String(formData.get("display_name") ?? ""),
      title: String(formData.get("title") ?? ""),
      avatarUrl: String(formData.get("avatar_url") ?? ""),
      team: String(formData.get("team") ?? ""),
    };
    action(formData);
  }

  useEffect(() => {
    if (state.kind !== "ok") return;
    const snapshot = pendingSnapshot.current;
    if (snapshot) setSavedSnapshot(snapshot);
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 5000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar
          src={avatarUrl || defaultAvatarUrl(userId)}
          name={displayName || email}
          alt={displayName}
          className="size-20 text-xl ring-1 ring-border bg-muted/40"
        />
        {avatarUnsaved && (
          <p className="text-xs text-amber-800">
            New photo not saved yet - click <em>Save profile</em> to keep it.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <input
          id="email"
          value={email}
          readOnly
          disabled
          className={cn(inputClass)}
        />
        <p className="text-xs leading-normal text-muted-foreground">
          Email is managed by your Google sign-in and can&apos;t be changed
          here.
        </p>
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
        <p className="text-xs text-muted-foreground">
          Shown in the directory and on champion cards.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team">Team</Label>
        <input type="hidden" name="team" value={submittedTeam} />
        <Select
          value={teamSelect === "" ? null : teamSelect}
          onValueChange={(v) => setTeamSelect(typeof v === "string" ? v : "")}
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
          <div className="space-y-2">
            <Label htmlFor="team_custom">New team name</Label>
            <input
              id="team_custom"
              value={customTeam}
              onChange={(e) => setCustomTeam(e.target.value)}
              maxLength={100}
              placeholder="Enter team name"
              className={cn(inputClass)}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Used for team dashboards and filters.
        </p>
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
            loading={upload.kind === "uploading"}
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.kind === "uploading" || pending}
          >
            {upload.kind === "uploading" ? "Uploading…" : "Upload photo"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={useDefaultAvatar}
            className="text-muted-foreground"
          >
            Use generated avatar instead
          </Button>
        </div>
        {upload.kind === "error" && (
          <Alert variant="destructive" className="text-xs">
            {upload.message}
          </Alert>
        )}
        <p className="text-xs leading-normal text-muted-foreground">
          PNG, JPEG, or WEBP. Up to 5 MB. Click <em>Save profile</em> to keep
          the new photo.
        </p>
      </div>

      {state.kind === "error" && (
        <Alert variant="destructive">{state.message}</Alert>
      )}
      {showSaved && !dirty && state.kind === "ok" && (
        <Alert variant="success">Saved.</Alert>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={pending}
          disabled={
            pending ||
            upload.kind === "uploading" ||
            submittedTeam.length === 0 ||
            !dirty
          }
        >
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

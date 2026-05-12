"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invitePerson, type InviteState } from "../_actions/invite";

const initial: InviteState = { kind: "idle" };

export function InviteButton({ teams }: { teams: string[] }) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<string>("");
  const [state, action, pending] = useActionState(invitePerson, initial);

  function handleOpenChange(next: boolean) {
    if (!next) setTeam("");
    setOpen(next);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Invite person
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a person</DialogTitle>
            <DialogDescription>
              Sends a sign-in invitation email and adds the person to the
              directory. Super admin only.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="firstname.lastname@wearephlo.com"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display_name">Name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" name="title" required maxLength={100} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team">Team</Label>
              <input type="hidden" name="team" value={team} />
              <Select value={team} onValueChange={(v) => setTeam(v ?? "")}>
                <SelectTrigger id="team" className="w-full">
                  <SelectValue placeholder="Pick a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.kind === "error" && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200"
              >
                {state.message}
              </p>
            )}
            {state.kind === "ok" && (
              <p
                role="status"
                className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200"
              >
                Invite sent to {state.email}.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Button type="submit" disabled={pending || team === ""}>
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

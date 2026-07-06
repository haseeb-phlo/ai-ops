"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
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
              directory.
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
              <Alert variant="destructive">{state.message}</Alert>
            )}
            {state.kind === "ok" && (
              <Alert variant="success">Invite sent to {state.email}.</Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={pending || team === ""}
              >
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

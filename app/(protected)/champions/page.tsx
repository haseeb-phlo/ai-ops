import { redirect } from "next/navigation";

export default function ChampionsRedirect() {
  // The standalone champions directory now lives as a toggle inside the
  // People tab. Redirect any lingering /champions links there.
  redirect("/map?view=champions");
}

import { redirect } from "next/navigation";

export default async function PeopleRedirect() {
  redirect("/map?view=directory");
}

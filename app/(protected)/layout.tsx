import { getSessionUser } from "@/lib/auth";
import { Header } from "./_components/header";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <>
      <Header user={user} />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}

import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { isAdminEmail } from "~/server/auth/admin";
import AdminClient from "./AdminClient";


export default async function AdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? undefined;
  if (!email || !isAdminEmail(email)) {
    redirect("/");
  }
  return <AdminClient />;
}

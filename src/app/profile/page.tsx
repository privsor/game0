import Image from "next/image";
import Link from "next/link";
import { auth } from "~/server/auth";
import SignOutButton from "../_components/SignOutButton";

export const dynamic = "force-dynamic"; // ensure fresh session

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Your Profile</h1>
        <Link href="/" className="text-white/70 hover:text-white">← Back home</Link>
      </div>

      {!user ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-white/80">
          You are not signed in.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Image
              src={user.image ?? "/profileicon.svg"}
              alt={user.name ?? "User"}
              width={72}
              height={72}
              className="h-18 w-18 rounded-full object-cover"
            />
            <div>
              <div className="text-xl font-semibold">{user.name ?? "Unnamed"}</div>
              {user.email && (
                <div className="text-white/60">{user.email}</div>
              )}
            </div>
          </div>

          <div>
            <SignOutButton />
          </div>
        </div>
      )}
    </main>
  );
}

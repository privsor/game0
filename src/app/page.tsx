import Link from "next/link";

import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import AuthTrigger from "./_components/AuthTrigger";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
				<div className="container flex flex-col items-center justify-center gap-10 px-4 py-20">
					<h1 className="text-5xl font-extrabold tracking-tight">Daddy Games</h1>
					<p className="text-white/70">Multiplayer games, built with love.</p>
					<div className="pt-2">
						<Link
							className="inline-block rounded-full bg-white px-8 py-3 font-semibold text-black transition hover:bg-white/90"
							href="/tictactoe"
						>
							Play Tic Tac Toe
						</Link>
					</div>
					<div className="flex flex-col items-center justify-center gap-4">
						<p className="text-center text-xl">
							{session && <span>Logged in as {session.user?.name}</span>}
						</p>
						<AuthTrigger signedIn={!!session} callbackUrl="/tictactoe" />
					</div>
				</div>
			</main>
		</HydrateClient>
	);
}

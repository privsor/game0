import { Suspense } from "react";
import GameClient from "~/app/tictactoe/GameClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading game...</div>}>
      <GameClient />
    </Suspense>
  );
}

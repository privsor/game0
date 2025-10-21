import { Suspense } from "react";
import GameClient from "~/app/game/GameClient";

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading game...</div>}>
      <GameClient />
    </Suspense>
  );
}

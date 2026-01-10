"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type MediaItem = { type: "image" | "video"; url: string; alt?: string; sortOrder?: number };

export default function MediaCarousel({
  prizeTitle,
  variantMedia,
  prizeMedia,
  fallbackImage,
  fallbackVideo,
}: {
  prizeTitle: string;
  variantMedia?: MediaItem[] | null;
  prizeMedia?: MediaItem[] | null;
  fallbackImage?: string | null;
  fallbackVideo?: string | null;
}) {
  const media = useMemo(() => {
    const v = (variantMedia ?? []).filter((m) => !!m?.url);
    const p = (prizeMedia ?? []).filter((m) => !!m?.url);
    return [...v, ...p];
  }, [variantMedia, prizeMedia]);

  const [active, setActive] = useState(0);
  const count = Math.max(media.length, 0);

  const prev = () => setActive((i) => (i - 1 + Math.max(count, 1)) % Math.max(count, 1));
  const next = () => setActive((i) => (i + 1) % Math.max(count, 1));

  return (
    <div className="relative h-56 w-full bg-black">
      {(() => {
        const current = count > 0 ? media[active]! : undefined;
        if (current) {
          if (current.type === "video") {
            return <video src={current.url} className="h-full w-full object-cover" autoPlay muted loop playsInline />;
          }
          return <Image src={current.url} alt={current.alt ?? prizeTitle} fill className="object-cover" />;
        }
        return null;
      })() || (fallbackImage ? (
        <Image src={fallbackImage} alt={prizeTitle} fill className="object-cover" />
      ) : fallbackVideo ? (
        <video src={fallbackVideo} className="h-full w-full object-cover" autoPlay muted loop playsInline />
      ) : (
        <div className="flex h-full items-center justify-center text-white/40">No Media</div>
      ))}

      {count > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-black/50 px-2 py-1 text-xs">◀</button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-black/50 px-2 py-1 text-xs">▶</button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {media.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === active ? "bg-white" : "bg-white/40"}`} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

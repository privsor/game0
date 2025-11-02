"use client";

import { useEffect, useRef, useState } from "react";
import { getChannel } from "~/lib/ably";

export function useAblyPresence(channelName: string | null | undefined) {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState(0);
  const chRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    if (!channelName) {
      setConnected(false);
      setPeers(0);
      return;
    }
    (async () => {
      try {
        const ch = await getChannel(channelName, { params: { rewind: 1 } });
        if (cancelled) return;
        chRef.current = ch;
        try { setConnected(ch.client.connection.state === 'connected'); } catch {}
        try {
          ch.presence.enter({ at: Date.now() }).catch(() => {});
          const members: any[] = await ch.presence.get();
          if (!cancelled) setPeers(members.length);
        } catch {}

        const onConnected = () => setConnected(true);
        const onDisconnected = () => setConnected(false);
        const onStateChange = (change: any) => {
          const st = change?.current || ch.client.connection.state;
          setConnected(st === 'connected');
        };

        // presence enter/leave to track peers
        const onPresence = (msg: any) => {
          // Recompute with a fresh presence.get to be robust
          ch.presence.get().then((members: any[]) => {
            if (!cancelled) setPeers(members.length);
          }).catch(() => {});
        };

        ch.client.connection.on("connected", onConnected);
        ch.client.connection.on("disconnected", onDisconnected);
        ch.client.connection.on("connectionstatechange", onStateChange);
        ch.presence.subscribe("enter", onPresence);
        ch.presence.subscribe("leave", onPresence);

        unsub = () => {
          try { ch.presence.unsubscribe("enter", onPresence); } catch {}
          try { ch.presence.unsubscribe("leave", onPresence); } catch {}
          try { ch.client.connection.off("connected", onConnected); } catch {}
          try { ch.client.connection.off("disconnected", onDisconnected); } catch {}
          try { ch.client.connection.off("connectionstatechange", onStateChange); } catch {}
          try { ch.presence.leave(); } catch {}
        };
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (unsub) {
        try { unsub(); } catch {}
      }
    };
  }, [channelName]);

  return { connected, peers };
}

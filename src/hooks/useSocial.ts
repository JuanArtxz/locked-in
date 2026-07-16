import { useCallback, useEffect, useRef, useState } from 'react';
import * as social from '../lib/social';
import type { FriendsState, PresenceRow } from '../lib/social';

export interface SocialHook {
  state: FriendsState | null;
  presence: Map<string, PresenceRow>;
  /** reload friendships + presence from the server */
  refresh: () => void;
  loading: boolean;
}

const EMPTY: Map<string, PresenceRow> = new Map();

/**
 * Friends + live presence, shared by the Friends tab and the sidebar.
 * Polls every 45s (friendships every 90s) and listens to realtime pushes;
 * completely inert while signed out.
 */
export function useSocial(signedIn: boolean, onError: (m: string) => void): SocialHook {
  const [state, setState] = useState<FriendsState | null>(null);
  const [presence, setPresence] = useState<Map<string, PresenceRow>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshPresence = useCallback(async () => {
    const s = stateRef.current;
    if (!s?.me) return;
    const ids = [s.me.user_id, ...s.friends.map((f) => f.userId)];
    try {
      setPresence(await social.fetchPresence(ids));
    } catch {
      // transient network error — next poll wins
    }
  }, []);

  const refresh = useCallback(() => {
    if (!signedIn) return;
    setLoading(true);
    social
      .loadFriendsState()
      .then((s) => {
        setState(s);
        stateRef.current = s;
        return refreshPresence();
      })
      .catch((err) => {
        // social tables not created yet (supabase/social.sql not run) — stay
        // quiet instead of toasting on every poll
        if (!/schema cache|does not exist/i.test(String(err))) onError(String(err));
      })
      .finally(() => setLoading(false));
  }, [signedIn, onError, refreshPresence]);

  useEffect(() => {
    if (!signedIn) {
      setState(null);
      setPresence(EMPTY);
      return;
    }
    refresh();
    const presenceIv = window.setInterval(refreshPresence, 45_000);
    // slow poll only as backstop — realtime pushes handle the fast path
    const friendsIv = window.setInterval(refresh, 120_000);
    const unsubPresence = social.subscribePresence(refreshPresence);
    // coalesce push bursts (request + accept + …) into one reload
    let debounce: number | null = null;
    const unsubFriendships = social.subscribeFriendships(() => {
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(refresh, 300);
    });
    return () => {
      window.clearInterval(presenceIv);
      window.clearInterval(friendsIv);
      if (debounce) window.clearTimeout(debounce);
      unsubPresence();
      unsubFriendships();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  return { state, presence, refresh, loading };
}

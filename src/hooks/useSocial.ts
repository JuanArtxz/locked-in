import { useCallback, useEffect, useRef, useState } from 'react';
import * as social from '../lib/social';
import type { FriendsState, PresenceRow } from '../lib/social';

export interface SocialHook {
  state: FriendsState | null;
  presence: Map<string, PresenceRow>;
  /** userIds currently connected (realtime channel) — instant online/away */
  onlineIds: Set<string>;
  /** realtime-aware status for a user */
  statusOf: (userId: string) => social.FriendStatus;
  /** app open right now (focusing or not) */
  isOnlineNow: (userId: string) => boolean;
  /** reload friendships + presence from the server */
  refresh: () => void;
  /** extra userIds (groupmates) whose presence should be polled too */
  setExtraIds: (ids: string[]) => void;
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
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const extraIdsRef = useRef<string[]>([]);
  const setExtraIds = useCallback((ids: string[]) => {
    extraIdsRef.current = ids;
  }, []);

  const refreshPresence = useCallback(async () => {
    const s = stateRef.current;
    if (!s?.me) return;
    const ids = [
      ...new Set([s.me.user_id, ...s.friends.map((f) => f.userId), ...extraIdsRef.current]),
    ];
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
    // realtime online/away channel (instant, clock-skew-proof)
    let unsubOnline: (() => void) | undefined;
    social
      .subscribeOnline(setOnlineIds)
      .then((u) => {
        unsubOnline = u;
      })
      .catch(() => {});
    return () => {
      window.clearInterval(presenceIv);
      window.clearInterval(friendsIv);
      if (debounce) window.clearTimeout(debounce);
      unsubPresence();
      unsubFriendships();
      unsubOnline?.();
      setOnlineIds(new Set());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const statusOf = useCallback(
    (userId: string) => social.friendStatusRT(presence.get(userId), userId, onlineIds),
    [presence, onlineIds],
  );
  const isOnlineNow = useCallback(
    (userId: string) => onlineIds.has(userId) || social.isOnline(presence.get(userId)),
    [presence, onlineIds],
  );

  return { state, presence, onlineIds, statusOf, isOnlineNow, refresh, setExtraIds, loading };
}

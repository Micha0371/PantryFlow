import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Android does not speak the alert role by itself, so an error that appears in
// place of a screen is announced explicitly (KAN-39). iOS keeps its behavior
// until VoiceOver is checked (PF-IOS-001).
export function announceError(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}
const announce = announceError;

// Speaks a message once when it appears or its text changes; a cleared and
// re-shown message (a failed retry) is spoken again.
function useAnnouncer() {
  const last = useRef<string | null>(null);
  return useMemo(() => Object.assign((message: string | null) => {
    if (message === last.current) return;
    last.current = message;
    if (message) announce(message);
  }, {
    // Treat a message as already spoken without speaking it.
    mark: (message: string) => { last.current = message; },
    // Speak a message that was marked, unless a newer one replaced it.
    force: (message: string) => { if (last.current === message) announce(message); },
  }), []);
}

// For views outside a navigator's focus, such as AuthGate around a layout.
export function useErrorAnnouncement(message: string | null): void {
  const speak = useAnnouncer();
  useEffect(() => { speak(message); }, [message, speak]);
}

// On a tab switch TalkBack speaks the selected tab ("Shopping selected"), which
// cuts off an announcement made at the same moment (KAN-39 phone check).
export const FOCUS_ANNOUNCEMENT_DELAY_MS = 1000;

// For screens: tabs stay mounted, so an error is spoken only while its screen is
// focused, and again whenever the user returns to a screen that shows it. An
// error that appears on the visible screen is spoken at once.
export function useFocusedErrorAnnouncement(message: string | null): void {
  const speak = useAnnouncer();
  const focused = useRef(false);
  const latest = useRef(message);
  latest.current = message;
  useFocusEffect(useCallback(() => {
    focused.current = true;
    // Mark the shown error as handled now; the timer speaks it after the tab.
    const shown = latest.current;
    speak(null);
    if (shown) speak.mark(shown);
    const timer = setTimeout(() => {
      if (shown && latest.current === shown) speak.force(shown);
    }, FOCUS_ANNOUNCEMENT_DELAY_MS);
    return () => { focused.current = false; clearTimeout(timer); };
  }, [speak]));
  useEffect(() => { if (focused.current) speak(message); }, [message, speak]);
}

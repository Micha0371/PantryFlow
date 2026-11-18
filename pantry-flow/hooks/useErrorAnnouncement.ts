import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Android does not speak the alert role by itself, so an error that appears in
// place of a screen is announced explicitly (KAN-39). iOS keeps its behavior
// until VoiceOver is checked (PF-IOS-001).
export function announceError(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}

// Speaks a message once when it appears or its text changes; a cleared and
// re-shown message (a failed retry) is spoken again.
function useAnnouncer() {
  const last = useRef<string | null>(null);
  return useCallback((message: string | null) => {
    if (message === last.current) return;
    last.current = message;
    if (message) announceError(message);
  }, []);
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
// focused, and again whenever the user returns to a screen that shows it. For
// FOCUS_ANNOUNCEMENT_DELAY_MS after focus nothing is spoken; then the error
// shown at that moment is. Later errors on the visible screen are spoken at once.
export function useFocusedErrorAnnouncement(message: string | null): void {
  const speak = useAnnouncer();
  const latest = useRef(message);
  // 'blurred' | 'settling' (within the delay after focus) | 'ready'
  const phase = useRef<'blurred' | 'settling' | 'ready'>('blurred');
  useEffect(() => {
    latest.current = message;
    if (phase.current === 'ready') speak(message);
  }, [message, speak]);
  useFocusEffect(useCallback(() => {
    phase.current = 'settling';
    const timer = setTimeout(() => {
      phase.current = 'ready';
      speak(null);
      speak(latest.current);
    }, FOCUS_ANNOUNCEMENT_DELAY_MS);
    return () => { phase.current = 'blurred'; clearTimeout(timer); };
  }, [speak]));
}

import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Android does not speak the alert role by itself, so an error that appears in
// place of a screen is announced explicitly (KAN-39). iOS keeps its behavior
// until VoiceOver is checked (PF-IOS-001).
function announce(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}

// Speaks a message once when it appears or its text changes; a cleared and
// re-shown message (a failed retry) is spoken again.
function useAnnouncer() {
  const last = useRef<string | null>(null);
  return useCallback((message: string | null) => {
    if (message === last.current) return;
    last.current = message;
    if (message) announce(message);
  }, []);
}

// For views outside a navigator's focus, such as AuthGate around a layout.
export function useErrorAnnouncement(message: string | null): void {
  const speak = useAnnouncer();
  useEffect(() => { speak(message); }, [message, speak]);
}

// For screens: tabs stay mounted, so an error is spoken only while its screen is
// focused, and again whenever the user returns to a screen that shows it.
export function useFocusedErrorAnnouncement(message: string | null): void {
  const speak = useAnnouncer();
  const focused = useRef(false);
  const latest = useRef(message);
  latest.current = message;
  useFocusEffect(useCallback(() => {
    focused.current = true;
    speak(null);
    speak(latest.current);
    return () => { focused.current = false; };
  }, [speak]));
  useEffect(() => { if (focused.current) speak(message); }, [message, speak]);
}

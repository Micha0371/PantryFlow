import { AccessibilityInfo, Platform } from 'react-native';

// Android does not speak the alert role by itself, so errors are announced
// explicitly (KAN-39). iOS keeps its behavior until VoiceOver is checked
// (PF-IOS-001).
export function announceError(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}

// Speaks a non-error result (a changed status) to the screen reader. Android
// only, like announceError; iOS keeps its behavior until VoiceOver is checked.
export function announce(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}

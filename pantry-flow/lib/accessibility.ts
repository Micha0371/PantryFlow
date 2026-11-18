import { AccessibilityInfo, Platform } from 'react-native';

// Android does not speak the alert role by itself, so errors are announced
// explicitly (KAN-39). iOS keeps its behavior until VoiceOver is checked
// (PF-IOS-001).
export function announceError(message: string) {
  if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(message);
}

import React from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';

interface Props {
  message: string | null;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

// Always mounted, so TalkBack announces an error when it appears or changes
// (KAN-34, KAN-39). The alert role only names it ("alert"). iOS has no live
// region and RN maps this role to no VoiceOver trait, so iOS still needs an
// explicit announcement (PF-IOS-001).
export function InlineError({ message, style, testID }: Readonly<Props>) {
  return (
    <View accessibilityLiveRegion="polite" collapsable={false}>
      {message ? <Text style={style} accessibilityRole="alert" testID={testID}>{message}</Text> : null}
    </View>
  );
}

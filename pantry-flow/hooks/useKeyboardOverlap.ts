import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform } from 'react-native';

type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

// How far the keyboard reaches up into the given view, in px (0 while hidden).
// Edge-to-edge Android does not resize the window, so a bottom-anchored control
// would sit behind the keyboard. The overlap is measured against the view's own
// bottom edge, so a tab bar or inset below the view is accounted for.
export function useKeyboardOverlap(ref: RefObject<Measurable | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const { screenY, height } = e.endCoordinates;
      const node = ref.current;
      if (!node) { setOverlap(height); return; }
      node.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - screenY)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => { show.remove(); hide.remove(); };
  }, [ref]);
  return overlap;
}

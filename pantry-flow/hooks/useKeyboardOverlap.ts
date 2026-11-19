import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';

type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

// How far the keyboard reaches up into the given view, in px (0 while hidden).
// Edge-to-edge Android does not resize the window, so a bottom-anchored control
// would sit behind the keyboard. The overlap is measured against the view's own
// bottom edge, so a tab bar or inset below the view is accounted for.
export function useKeyboardOverlap(ref: RefObject<Measurable | null>): number {
  const [overlap, setOverlap] = useState(0);
  // Every show/hide bumps the token; a measurement from an older one is dropped.
  const token = useRef(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const mine = ++token.current;
      const { screenY } = e.endCoordinates;
      const node = ref.current;
      // No view to measure against: lift nothing rather than over-lift by the tab bar.
      if (!node) { setOverlap(0); return; }
      node.measureInWindow((_x, y, _w, h) => {
        if (mine === token.current) setOverlap(Math.max(0, y + h - screenY));
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      token.current += 1;
      setOverlap(0);
    });
    // A hide missed while backgrounded must not leave the layout lifted.
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') { token.current += 1; setOverlap(0); }
    });
    return () => { show.remove(); hide.remove(); app.remove(); };
  }, [ref]);
  return overlap;
}

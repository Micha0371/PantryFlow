export type Frame = { x: number; y: number; width: number; height: number };
export type Placement = 'below' | 'above' | 'center';

/**
 * Positions the status menu next to its anchor: below if it fits above the bottom
 * inset, else above if it fits below the top inset, else centered in the safe area.
 * The menu is right-aligned to the anchor and kept `margin` dp from the side edges.
 */
export function placeMenu(
  anchor: Frame,
  menu: { width: number; height: number },
  screen: { width: number; height: number },
  insets: { top: number; bottom: number },
  margin = 16,
  gap = 4,
): { top: number; left: number; placement: Placement } {
  const maxLeft = Math.max(margin, screen.width - margin - menu.width);
  const left = Math.min(Math.max(anchor.x + anchor.width - menu.width, margin), maxLeft);

  const belowTop = anchor.y + anchor.height + gap;
  if (belowTop + menu.height <= screen.height - insets.bottom) {
    return { top: belowTop, left, placement: 'below' };
  }
  const aboveTop = anchor.y - gap - menu.height;
  if (aboveTop >= insets.top) {
    return { top: aboveTop, left, placement: 'above' };
  }
  const free = screen.height - insets.top - insets.bottom;
  const top = Math.max(insets.top, insets.top + Math.round((free - menu.height) / 2));
  return { top, left, placement: 'center' };
}

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PantryItem } from '../../components/PantryItem';

jest.mock('@/lib/i18n', () => {
  const { en } = jest.requireActual('@/lib/i18n/en');
  return { useTranslation: () => ({ t: (key: string) => en[key] ?? key }) };
});

const item = { id: 'i1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'low' } as any;

async function setup(props: Record<string, unknown> = {}) {
  const onPress = jest.fn();
  const onStatusPress = jest.fn();
  await render(<PantryItem item={item} onPress={onPress} onStatusPress={onStatusPress} {...props} />);
  return { onPress, onStatusPress };
}
const state = (id: string) => {
  const p = screen.getByTestId(id).props;
  return p.accessibilityState ?? {
    disabled: p['aria-disabled'], busy: p['aria-busy'], expanded: p['aria-expanded'],
  };
};

test('content and status are sibling controls, the status control is not inside the content control', async () => {
  await setup();
  const content = screen.getByTestId('pantry-item-i1');
  const status = screen.getByTestId('pantry-item-status-i1');
  expect(content.parent).toBe(status.parent);
  expect(content.parent).not.toBe(content);
  let node = status.parent;
  while (node) { expect(node).not.toBe(content); node = node.parent; }
});

test('pressing status never calls onPress', async () => {
  const { onPress, onStatusPress } = await setup();
  await fireEvent.press(screen.getByTestId('pantry-item-status-i1'));
  expect(onPress).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('pantry-item-i1'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(onStatusPress).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'content');
});

test('pressing status measures itself and reports the frame with its ref', async () => {
  // The Jest host View's measureInWindow never calls back; supply a frame via its prototype.
  const probe = React.createRef<any>();
  await render(<View ref={probe} />);
  const proto = Object.getPrototypeOf(probe.current);
  const spy = jest.spyOn(proto, 'measureInWindow').mockImplementation((cb: any) => cb(10, 20, 90, 56));
  const { onStatusPress } = await setup();
  await fireEvent.press(screen.getByTestId('pantry-item-status-i1'));
  spy.mockRestore();
  expect(onStatusPress).toHaveBeenCalledTimes(1);
  expect(onStatusPress.mock.calls[0][0]).toEqual({ x: 10, y: 20, width: 90, height: 56 });
  expect(onStatusPress.mock.calls[0][1]).toHaveProperty('current');
});

test('labels carry name, details and the current status', async () => {
  await setup();
  const content = screen.getByTestId('pantry-item-i1').props;
  const status = screen.getByTestId('pantry-item-status-i1').props;
  expect(content['aria-label'] ?? content.accessibilityLabel).toBe('Milk, Dairy, Fridge');
  expect(content.accessibilityHint ?? content['aria-hint']).toBe('Edit item');
  expect(status['aria-label'] ?? status.accessibilityLabel).toBe('Milk, Low');
  expect(status.accessibilityHint ?? status['aria-hint']).toBe('Change status');
});

test('the status control is at least 48 by 48 dp', async () => {
  await setup();
  const style = StyleSheet.flatten(screen.getByTestId('pantry-item-status-i1').props.style);
  expect(style.minWidth).toBeGreaterThanOrEqual(48);
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
});

test('busy shows the old status with busy state; disabled props reach accessibilityState', async () => {
  await setup({ statusBusy: true, statusDisabled: true, statusExpanded: true });
  expect(screen.getByText('Low')).toBeTruthy();
  const sp = screen.getByTestId('pantry-item-status-i1').props;
  expect(sp['aria-label'] ?? sp.accessibilityLabel).toContain('Low');
  const s = state('pantry-item-status-i1');
  expect(s.busy).toBe(true);
  expect(s.disabled).toBe(true);
  expect(s.expanded).toBe(true);
});

test('editDisabled disables only the content control', async () => {
  const { onPress } = await setup({ editDisabled: true });
  expect(state('pantry-item-i1').disabled).toBe(true);
  expect(state('pantry-item-status-i1').disabled).toBeFalsy();
  await fireEvent.press(screen.getByTestId('pantry-item-i1'));
  expect(onPress).not.toHaveBeenCalled();
});

test('status badge is vertically centred in the status control, not pinned to its top', async () => {
  await setup();
  const status = screen.getByTestId('pantry-item-status-i1');
  expect(StyleSheet.flatten(status.props.style).alignItems).toBe('center');
  // The badge is the View holding the status label; it must not override the centring.
  let badge = screen.getByText('Low').parent;
  while (badge && StyleSheet.flatten(badge.props.style)?.borderRadius === undefined) badge = badge.parent;
  expect(badge).toBeTruthy();
  expect(StyleSheet.flatten(badge!.props.style).alignSelf).toBeUndefined();
});

import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StatusSelector } from '../../components/StatusSelector';

jest.mock('@/lib/i18n', () => {
  const { en } = jest.requireActual('@/lib/i18n/en');
  return { useTranslation: () => ({ t: (key: string) => en[key] ?? key }) };
});

const anchor = { x: 300, y: 200, width: 90, height: 56 };
async function setup(overrides = {}) {
  const onSelect = jest.fn();
  const onDismiss = jest.fn();
  await render(
    <StatusSelector anchor={anchor} itemName="Milk" current="low"
      onSelect={onSelect} onDismiss={onDismiss} {...overrides} />,
  );
  return { onSelect, onDismiss };
}

test('renders a radio group labelled with the item name', async () => {
  await setup();
  // The group is deliberately not `accessible`, so each radio stays individually focusable.
  const group = screen.getByLabelText('Status, Milk');
  expect(group.props.role ?? group.props.accessibilityRole).toBe('radiogroup');
});

test('marks only the current status as checked', async () => {
  await setup();
  expect(screen.getByTestId('status-option-low').props['aria-checked'] ?? screen.getByTestId('status-option-low').props.accessibilityState?.checked).toBe(true);
  for (const s of ['in_stock', 'out']) {
    const p = screen.getByTestId(`status-option-${s}`).props;
    expect(p['aria-checked'] ?? p.accessibilityState?.checked).toBeFalsy();
  }
});

test('each option has at least 48 dp height', async () => {
  await setup();
  for (const s of ['in_stock', 'low', 'out']) {
    const style = StyleSheet.flatten(screen.getByTestId(`status-option-${s}`).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  }
});

test('choosing another status calls onSelect once', async () => {
  const { onSelect, onDismiss } = await setup();
  await fireEvent.press(screen.getByTestId('status-option-out'));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith('out');
  expect(onDismiss).not.toHaveBeenCalled();
});

test('choosing the current status, the scrim or Android back calls onDismiss and never onSelect', async () => {
  const { onSelect, onDismiss } = await setup();
  await fireEvent.press(screen.getByTestId('status-option-low'));
  await fireEvent.press(screen.getByTestId('status-scrim'));
  await fireEvent(screen.getByTestId('status-modal'), 'requestClose');
  expect(onDismiss).toHaveBeenCalledTimes(3);
  expect(onSelect).not.toHaveBeenCalled();
});

test('renders nothing without an anchor', async () => {
  await setup({ anchor: null });
  expect(screen.queryByTestId('status-option-low')).toBeNull();
  expect(screen.queryByLabelText('Status, Milk')).toBeNull();
});

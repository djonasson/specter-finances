import {
  Drawer,
  Stack,
  SegmentedControl,
  Group,
  ColorSwatch,
  ColorPicker,
  Select,
  Button,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { useThemeSettings } from '../theme/ThemeContext';
import type { BackgroundEffect } from '../theme/ThemeContext';

interface Props {
  opened: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  { key: 'indigo', hex: '#4c6ef5' },
  { key: 'blue', hex: '#228be6' },
  { key: 'cyan', hex: '#15aabf' },
  { key: 'teal', hex: '#12b886' },
  { key: 'green', hex: '#40c057' },
  { key: 'orange', hex: '#fd7e14' },
  { key: 'pink', hex: '#e64980' },
  { key: 'grape', hex: '#be4bdb' },
  { key: 'red', hex: '#fa5252' },
  { key: 'yellow', hex: '#fab005' },
];

export function ThemeSettings({ opened, onClose }: Props) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const {
    primaryColor,
    customColorHex,
    backgroundEffect,
    setPrimaryColor,
    setCustomColor,
    setBackgroundEffect,
    resetTheme,
  } = useThemeSettings();

  return (
    <Drawer opened={opened} onClose={onClose} title="Theme Settings" position="right" size="sm">
      <Stack gap="xl">
        <div>
          <Text fw={500} mb="xs">Color Scheme</Text>
          <SegmentedControl
            fullWidth
            value={colorScheme}
            onChange={(val) => setColorScheme(val as 'light' | 'dark' | 'auto')}
            data={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'Auto', value: 'auto' },
            ]}
          />
        </div>

        <div>
          <Text fw={500} mb="xs">Primary Color</Text>
          <Group gap="xs" mb="md">
            {PRESET_COLORS.map((c) => (
              <ColorSwatch
                key={c.key}
                color={c.hex}
                onClick={() => setPrimaryColor(c.key)}
                style={{
                  cursor: 'pointer',
                  outline: primaryColor === c.key ? '2px solid var(--mantine-color-text)' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </Group>
          <Text size="sm" mb="xs">Or pick a custom color:</Text>
          <ColorPicker
            format="hex"
            value={customColorHex ?? '#4c6ef5'}
            onChange={setCustomColor}
            fullWidth
          />
        </div>

        <div>
          <Text fw={500} mb="xs">Background Effect</Text>
          <Select
            value={backgroundEffect}
            onChange={(val) => setBackgroundEffect((val ?? 'none') as BackgroundEffect)}
            data={[
              { label: 'None', value: 'none' },
              { label: 'Matrix', value: 'matrix' },
              { label: 'Gradient', value: 'gradient' },
            ]}
            allowDeselect={false}
          />
        </div>

        <Button variant="subtle" onClick={() => { resetTheme(); setColorScheme('auto'); }}>
          Reset to Defaults
        </Button>
      </Stack>
    </Drawer>
  );
}

import {
  Drawer,
  Stack,
  SegmentedControl,
  Group,
  ColorSwatch,
  ColorPicker,
  Select,
  Slider,
  Button,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { ColorInput } from '@mantine/core';
import { useThemeSettings } from '../theme/ThemeContext';
import type { BackgroundEffect, GradientSettings } from '../theme/ThemeContext';

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
    matrixSpeed,
    cardOpacity,
    gradient,
    setPrimaryColor,
    setCustomColor,
    setBackgroundEffect,
    setMatrixSpeed,
    setCardOpacity,
    setGradient,
    resetTheme,
  } = useThemeSettings();

  const updateGradientColor = (index: number, hex: string) => {
    const colors = [...gradient.colors] as GradientSettings['colors'];
    colors[index] = hex;
    setGradient({ colors });
  };

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
          {backgroundEffect === 'matrix' && (
            <>
              <Text size="sm" mt="md" mb="xs">Matrix Speed</Text>
              <Slider
                value={matrixSpeed}
                onChange={setMatrixSpeed}
                min={1}
                max={10}
                step={1}
                marks={[
                  { value: 1, label: 'Slow' },
                  { value: 10, label: 'Fast' },
                ]}
              />
            </>
          )}
          {backgroundEffect === 'gradient' && (
            <>
              <Text size="sm" mt="md" mb="xs">Gradient Speed</Text>
              <Slider
                value={gradient.speed}
                onChange={(val) => setGradient({ speed: val })}
                min={1}
                max={10}
                step={1}
                marks={[
                  { value: 1, label: 'Slow' },
                  { value: 10, label: 'Fast' },
                ]}
              />
              <Text size="sm" mt="md" mb="xs">Gradient Colors</Text>
              <Stack gap="xs">
                <ColorInput label="Color 1" value={gradient.colors[0]} onChange={(hex) => updateGradientColor(0, hex)} format="hex" />
                <ColorInput label="Color 2" value={gradient.colors[1]} onChange={(hex) => updateGradientColor(1, hex)} format="hex" />
                <ColorInput label="Color 3" value={gradient.colors[2]} onChange={(hex) => updateGradientColor(2, hex)} format="hex" />
              </Stack>
            </>
          )}
        </div>

        {backgroundEffect !== 'none' && (
          <div>
            <Text fw={500} mb="xs">Card Transparency</Text>
            <Slider
              value={100 - cardOpacity}
              onChange={(val) => setCardOpacity(100 - val)}
              min={0}
              max={80}
              step={5}
              marks={[
                { value: 0, label: 'Solid' },
                { value: 80, label: 'Glass' },
              ]}
            />
          </div>
        )}

        <Button variant="subtle" onClick={() => { resetTheme(); setColorScheme('auto'); }}>
          Reset to Defaults
        </Button>
      </Stack>
    </Drawer>
  );
}

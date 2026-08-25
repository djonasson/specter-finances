import {
  Drawer,
  Stack,
  SegmentedControl,
  Group,
  ColorSwatch,
  ColorPicker,
  Select,
  Slider,
  Checkbox,
  Button,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { ColorInput } from '@mantine/core';
import { useThemeSettings } from '../theme/ThemeContext';
import type { GradientSettings } from '../theme/ThemeContext';
import {
  BACKGROUND_CHOICE_OPTIONS,
  BACKGROUND_OPTIONS,
  backgroundFor,
  PLAIN_BACKGROUND,
  RANDOM_BACKGROUND,
} from '../theme/registry';
import { BackupButton } from './BackupButton';
import type { BackgroundChoice } from '../theme/registry';

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
    randomPool,
    resolvedBackground,
    matrixSpeed,
    cardOpacity,
    gradient,
    setPrimaryColor,
    setCustomColor,
    setBackgroundEffect,
    setRandomPool,
    shuffleBackground,
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
    <Drawer opened={opened} onClose={onClose} title="Settings" position="right" size="sm">
      <Stack gap="xl">
        <div>
          <Text fw={500} mb="xs">
            Color Scheme
          </Text>
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
          <Text fw={500} mb="xs">
            Primary Color
          </Text>
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
          <Text size="sm" mb="xs">
            Or pick a custom color:
          </Text>
          <ColorPicker
            format="hex"
            value={customColorHex ?? '#4c6ef5'}
            onChange={setCustomColor}
            fullWidth
          />
        </div>

        <div>
          <Text fw={500} mb="xs">
            Background Effect
          </Text>
          <Select
            value={backgroundEffect}
            onChange={(val) => setBackgroundEffect((val ?? PLAIN_BACKGROUND) as BackgroundChoice)}
            data={BACKGROUND_CHOICE_OPTIONS}
            allowDeselect={false}
          />
          {backgroundEffect === RANDOM_BACKGROUND && (
            <>
              {/* The name goes on the group itself, not on a heading beside it:
                  a `Text` above is read as unrelated prose, leaving five boxes
                  announced as "None, Matrix, Gradient…" with nothing saying what
                  they configure. */}
              <Checkbox.Group
                label="Shuffle between"
                value={randomPool}
                onChange={setRandomPool}
                mt="md"
              >
                <Stack gap="xs" mt="xs">
                  {BACKGROUND_OPTIONS.map((background) => (
                    <Checkbox
                      key={background.value}
                      // Named explicitly rather than left to Mantine's generated
                      // id, which is derived from a random seed: under a stubbed
                      // `Math.random` every box shares one id and every label
                      // points at the first of them, so the boxes cannot be told
                      // apart by name. Deterministic ids also make the labels
                      // legible in a DOM dump.
                      id={`shuffle-${background.value}`}
                      value={background.value}
                      label={background.label}
                    />
                  ))}
                </Stack>
              </Checkbox.Group>
              <Text size="sm" mt="xs">
                {randomPool.length > 0
                  ? // The picker says "Random", so this is the only place the
                    // background actually on screen is named. Keyed on the pool
                    // rather than on what it resolved to: a pool holding only
                    // the plain background is a blank screen somebody asked for,
                    // and reporting that as "nothing ticked" would be untrue.
                    `This launch: ${backgroundFor(resolvedBackground)?.label}.`
                  : 'Nothing ticked, so no background is showing.'}
              </Text>
              {randomPool.length > 0 && (
                // Mantine's Select fires no change when the option already
                // showing is picked again, so "Random" cannot re-offer itself.
                // Without this the only way to a different scene is a relaunch.
                <Button variant="light" size="xs" mt="xs" onClick={shuffleBackground}>
                  Shuffle again
                </Button>
              )}
            </>
          )}
          {/* The controls below belong to the background on screen, not to the
              setting: with a shuffle, the setting names no background at all. */}
          {resolvedBackground === 'matrix' && (
            <>
              <Text size="sm" mt="md" mb="xs">
                Matrix Speed
              </Text>
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
          {resolvedBackground === 'gradient' && (
            <>
              <Text size="sm" mt="md" mb="xs">
                Gradient Speed
              </Text>
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
              <Text size="sm" mt="md" mb="xs">
                Gradient Colors
              </Text>
              <Stack gap="xs">
                <ColorInput
                  id="gradient-color-1"
                  label="Color 1"
                  value={gradient.colors[0]}
                  onChange={(hex) => updateGradientColor(0, hex)}
                  format="hex"
                />
                <ColorInput
                  id="gradient-color-2"
                  label="Color 2"
                  value={gradient.colors[1]}
                  onChange={(hex) => updateGradientColor(1, hex)}
                  format="hex"
                />
                <ColorInput
                  id="gradient-color-3"
                  label="Color 3"
                  value={gradient.colors[2]}
                  onChange={(hex) => updateGradientColor(2, hex)}
                  format="hex"
                />
              </Stack>
            </>
          )}
        </div>

        {resolvedBackground !== PLAIN_BACKGROUND && (
          <div>
            <Text fw={500} mb="xs">
              Card Transparency
            </Text>
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

        <div>
          <Text fw={500} mb="xs">
            Data
          </Text>
          <BackupButton />
        </div>

        <Button
          variant="subtle"
          onClick={() => {
            resetTheme();
            setColorScheme('auto');
          }}
        >
          Reset to Defaults
        </Button>
      </Stack>
    </Drawer>
  );
}

import { useState } from 'react';
import { Stack, Group, Button, NumberInput, Checkbox, Alert, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import type { RecurringFormData } from '../types/recurring';
import type { PersonNames } from '../types/person';
import { today, dateInputValue, notCountedProblem } from '../services/utils';
import { MAX_EVERY_MONTHS, MIN_EVERY_MONTHS, describeInterval } from '../services/recurring';
import { ExpenseFields } from './ExpenseFields';

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  onSubmit: (data: RecurringFormData) => Promise<void>;
  initial?: RecurringFormData;
  submitLabel?: string;
  onCancel?: () => void;
}

/**
 * A function, not a constant: an installed PWA can sit open across midnight, and
 * a module-level object would then default both the start date *and* the day of
 * the month to whenever the bundle was first evaluated.
 */
function emptyForm(): RecurringFormData {
  const start = today();
  return {
    start,
    amountA: '',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: '',
    category: 'Various',
    notes: '',
    day: Number(start.slice(8, 10)),
    everyMonths: 1,
    amountVaries: false,
  };
}

export function RecurringForm({
  names,
  onSubmit,
  initial,
  submitLabel = 'Add Recurring Payment',
  onCancel,
}: Props) {
  const [form, setForm] = useState<RecurringFormData>(() => initial ?? emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RecurringFormData>(field: K, value: RecurringFormData[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item.trim()) {
      setError('Item is required');
      return;
    }
    // A varying payment stores no amount at all — the figure is not known until
    // the bill arrives, and the confirmation is where it gets typed in.
    if (!form.amountVaries && !form.amountA && !form.amountB) {
      setError('At least one amount is required');
      return;
    }
    if (
      !Number.isInteger(form.everyMonths) ||
      form.everyMonths < MIN_EVERY_MONTHS ||
      form.everyMonths > MAX_EVERY_MONTHS
    ) {
      setError(`How often must be between ${MIN_EVERY_MONTHS} and ${MAX_EVERY_MONTHS} months`);
      return;
    }
    if (!Number.isInteger(form.day) || form.day < 1 || form.day > 31) {
      setError('Day of the month must be between 1 and 31');
      return;
    }
    const problem = notCountedProblem(form, names);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      if (!initial) setForm(emptyForm());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <DateInput
          // The explanation lives in the label rather than Mantine's
          // description prop, which renders dimmed and fails the contrast rule.
          label="Starts on (nothing is created before this date)"
          value={form.start || null}
          onChange={(d) => set('start', dateInputValue(d))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <NumberInput
          label="Day of the month (31 becomes the last day in shorter months)"
          min={1}
          max={31}
          // Clamped as it is typed, not on blur: no month has a 45th, and a
          // rule carrying one would simply never fall due.
          clampBehavior="strict"
          value={form.day}
          onChange={(val) => set('day', typeof val === 'number' ? val : 1)}
        />

        <NumberInput
          label={`How often, in months (${describeInterval(form.everyMonths)})`}
          min={MIN_EVERY_MONTHS}
          max={MAX_EVERY_MONTHS}
          clampBehavior="strict"
          value={form.everyMonths}
          onChange={(val) => set('everyMonths', typeof val === 'number' ? val : 1)}
        />

        <Checkbox
          label="The amount is different every time"
          checked={form.amountVaries}
          onChange={(e) => {
            const amountVaries = e.currentTarget.checked;
            // Clear what can no longer be known. Leaving a stale figure behind
            // would put it on the sheet the next time the box is unticked.
            setForm((f) =>
              amountVaries
                ? { ...f, amountVaries, amountA: '', amountB: '', notCountedA: '', notCountedB: '' }
                : { ...f, amountVaries },
            );
          }}
        />

        {form.amountVaries && (
          <Text size="sm">
            A utility bill, then — nobody knows the figure until it arrives. This app will remind
            you when one is due and ask for the amount, with everything else already filled in.
          </Text>
        )}

        <ExpenseFields
          names={names}
          value={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          itemPlaceholder="e.g. Water bill"
          categoryFallback="Various"
          showAmounts={!form.amountVaries}
        />

        <Group>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="light" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}

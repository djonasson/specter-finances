import { useState } from 'react';
import { Stack, Group, Button, NumberInput, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import type { RecurringFormData } from '../types/recurring';
import type { PersonNames } from '../types/person';
import { today, dateInputValue, notCountedProblem } from '../services/utils';
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
    if (!form.amountA && !form.amountB) {
      setError('At least one amount is required');
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

        <ExpenseFields
          names={names}
          value={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          itemPlaceholder="e.g. Phone bill"
          categoryFallback="Various"
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

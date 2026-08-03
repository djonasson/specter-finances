import { useState } from 'react';
import { Stack, Group, Button, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ExpenseFormData } from '../types/expense';
import type { PersonNames } from '../types/person';
import { today, dateInputValue, notCountedProblem } from '../services/utils';
import { ExpenseFields } from './ExpenseFields';

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  initial?: ExpenseFormData;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyForm: ExpenseFormData = {
  date: today(),
  amountA: '',
  amountB: '',
  notCountedA: '',
  notCountedB: '',
  item: '',
  category: 'Food',
  notes: '',
};

export function ExpenseForm({
  names,
  onSubmit,
  initial,
  submitLabel = 'Add Expense',
  onCancel,
}: Props) {
  const [form, setForm] = useState<ExpenseFormData>(initial ?? emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic in the field so each one keeps its own type — a plain `string`
  // parameter let set('category', 'Bogus') compile.
  const set = <K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]) =>
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
    const problem = notCountedProblem(form, names);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      if (!initial) setForm({ ...emptyForm, date: today() });
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
          label="Date"
          value={form.date || null}
          onChange={(d) => set('date', dateInputValue(d))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <ExpenseFields
          names={names}
          value={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          itemPlaceholder="e.g. Migross"
          categoryFallback="Food"
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

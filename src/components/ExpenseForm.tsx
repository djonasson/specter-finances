import { useState } from 'react';
import { Stack, Group, Button, TextInput, NumberInput, Select, Alert } from '@mantine/core';
import { CategoryIcon } from './CategoryIcon';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { CATEGORIES, toCategory } from '../types/expense';
import type { ExpenseFormData } from '../types/expense';
import type { PersonNames } from '../types/person';
import { today, dateInputValue, toNum, fromNum } from '../services/utils';

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

        <Group grow>
          <NumberInput
            label={`${names.a} (€)`}
            prefix="€ "
            decimalScale={2}
            fixedDecimalScale
            min={0}
            placeholder="0.00"
            value={toNum(form.amountA)}
            onChange={(val) => set('amountA', fromNum(val as number | ''))}
          />
          <NumberInput
            label={`${names.b} (€)`}
            prefix="€ "
            decimalScale={2}
            fixedDecimalScale
            min={0}
            placeholder="0.00"
            value={toNum(form.amountB)}
            onChange={(val) => set('amountB', fromNum(val as number | ''))}
          />
        </Group>

        <TextInput
          label="Item"
          value={form.item}
          onChange={(e) => set('item', e.currentTarget.value)}
          placeholder="e.g. Migross"
          required
        />

        <Select
          label="Category"
          value={form.category}
          onChange={(val) => set('category', toCategory(val ?? '') || 'Food')}
          data={CATEGORIES as unknown as string[]}
          allowDeselect={false}
          leftSection={<CategoryIcon category={form.category} size={16} />}
          renderOption={({ option }) => (
            <Group gap="xs">
              <CategoryIcon category={option.value} size={16} />
              {option.value}
            </Group>
          )}
        />

        <TextInput
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.currentTarget.value)}
          placeholder="Optional"
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

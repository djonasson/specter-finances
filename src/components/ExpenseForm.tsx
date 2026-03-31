import { useState } from 'react';
import { Stack, Group, Button, TextInput, NumberInput, Select, Alert } from '@mantine/core';
import { CategoryIcon } from './CategoryIcon';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { CATEGORIES } from '../types/expense';
import type { ExpenseFormData } from '../types/expense';

interface Props {
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  initial?: ExpenseFormData;
  submitLabel?: string;
  onCancel?: () => void;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function toDate(str: string): Date | null {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function fromDate(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toNum(s: string): number | '' {
  if (!s) return '';
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}

function fromNum(n: number | ''): string {
  if (n === '' || n === undefined) return '';
  return String(n);
}

const emptyForm: ExpenseFormData = {
  date: today(),
  amountDaniel: '',
  amountManuela: '',
  item: '',
  category: 'Food',
  notes: '',
};

export function ExpenseForm({ onSubmit, initial, submitLabel = 'Add Expense', onCancel }: Props) {
  const [form, setForm] = useState<ExpenseFormData>(initial ?? emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ExpenseFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item.trim()) {
      setError('Item is required');
      return;
    }
    if (!form.amountDaniel && !form.amountManuela) {
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
          value={toDate(form.date)}
          onChange={(d) => set('date', fromDate(d as Date | null))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <Group grow>
          <NumberInput
            label="Daniel (€)"
            prefix="€ "
            decimalScale={2}
            fixedDecimalScale
            min={0}
            placeholder="0.00"
            value={toNum(form.amountDaniel)}
            onChange={(val) => set('amountDaniel', fromNum(val as number | ''))}
          />
          <NumberInput
            label="Manuela (€)"
            prefix="€ "
            decimalScale={2}
            fixedDecimalScale
            min={0}
            placeholder="0.00"
            value={toNum(form.amountManuela)}
            onChange={(val) => set('amountManuela', fromNum(val as number | ''))}
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
          onChange={(val) => set('category', val ?? 'Food')}
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

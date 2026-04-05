import { useState } from 'react';
import { Stack, Group, Button, Select, NumberInput, TextInput, Text, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { PEOPLE } from '../types/transfer';
import type { Person } from '../types/transfer';
import type { GiftFormData } from '../types/gift';
import { today, fromDate } from '../services/utils';

interface Props {
  onSubmit: (data: GiftFormData) => Promise<void>;
  initial?: GiftFormData;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyForm: GiftFormData = {
  date: today(),
  from: 'Daniel',
  amount: '',
  notes: '',
};

export function GiftForm({ onSubmit, initial, submitLabel = 'Add Gift', onCancel }: Props) {
  const [form, setForm] = useState<GiftFormData>(initial ?? emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receiver = form.from === 'Daniel' ? 'Manuela' : 'Daniel';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(form.amount);
    if (!form.amount || isNaN(num) || num <= 0) {
      setError('Amount must be greater than 0');
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
          onChange={(d) => setForm((f) => ({ ...f, date: typeof d === 'string' ? d : fromDate(d) }))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <Select
          label="Who is giving the gift?"
          value={form.from}
          onChange={(val) => setForm((f) => ({ ...f, from: (val as Person) ?? 'Daniel' }))}
          data={PEOPLE as unknown as string[]}
          allowDeselect={false}
        />

        <Text size="sm">Receiving: <Text span fw={600}>{receiver}</Text></Text>

        <NumberInput
          label="Amount (€)"
          prefix="€ "
          decimalScale={2}
          fixedDecimalScale
          min={0}
          placeholder="0.00"
          value={form.amount ? parseFloat(form.amount) : ''}
          onChange={(val) =>
            setForm((f) => ({
              ...f,
              amount: val === '' || val === undefined ? '' : String(val),
            }))
          }
        />

        <TextInput
          label="Notes"
          placeholder="Optional"
          value={form.notes}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setForm((f) => ({ ...f, notes: val }));
          }}
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

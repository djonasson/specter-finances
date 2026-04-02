import { useState } from 'react';
import { Stack, Group, Button, Select, NumberInput, Text, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { PEOPLE } from '../types/transfer';
import type { Person, TransferFormData } from '../types/transfer';
import { today, toDate, fromDate } from '../services/utils';

interface Props {
  onSubmit: (data: TransferFormData) => Promise<void>;
  initial?: TransferFormData;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyForm: TransferFormData = {
  date: today(),
  from: 'Daniel',
  amount: '',
};

export function TransferForm({ onSubmit, initial, submitLabel = 'Add Transfer', onCancel }: Props) {
  const [form, setForm] = useState<TransferFormData>(initial ?? emptyForm);
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
          value={toDate(form.date)}
          onChange={(d) => setForm((f) => ({ ...f, date: fromDate(d as Date | null) }))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <Select
          label="Who is transferring?"
          value={form.from}
          onChange={(val) => setForm((f) => ({ ...f, from: (val as Person) ?? 'Daniel' }))}
          data={PEOPLE as unknown as string[]}
          allowDeselect={false}
        />

        <Text size="sm" c="dimmed">Receiving: <Text span fw={600} c="var(--mantine-color-text)">{receiver}</Text></Text>

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

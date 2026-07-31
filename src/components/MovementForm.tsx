import { useState } from 'react';
import {
  Stack,
  Group,
  Button,
  Select,
  NumberInput,
  TextInput,
  Text,
  Alert,
  Radio,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import type { TransferFormData } from '../types/transfer';
import { PEOPLE, otherPerson, nameOf } from '../types/person';
import type { Person, PersonNames } from '../types/person';
import type { GiftFormData, GiftKind } from '../types/gift';
import { GIFT_KINDS } from '../types/gift';
import { today, dateInputValue } from '../services/utils';

type MovementKind = 'transfer' | 'gift';

const COPY: Record<MovementKind, { senderLabel: string; addLabel: string }> = {
  transfer: { senderLabel: 'Who is transferring?', addLabel: 'Add Transfer' },
  gift: { senderLabel: 'Who is giving the gift?', addLabel: 'Add Gift' },
};

// Spelled out in the labels themselves rather than Mantine's `description`
// prop, which renders dimmed text that fails our contrast rule.
const GIFT_KIND_LABELS: Record<GiftKind, string> = {
  present: 'A present — money changed hands',
  forgiven: 'Forgiving debt — no money moved',
};

interface Props<TForm extends TransferFormData | GiftFormData> {
  kind: MovementKind;
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  onSubmit: (data: TForm) => Promise<void>;
  initial?: TForm;
  submitLabel?: string;
  onCancel?: () => void;
}

/**
 * One form for both transfers and gifts — identical fields and validation, and
 * only the two strings in COPY differ. They were separate components whose
 * amount validation had to be kept in sync by hand.
 */
export function MovementForm<TForm extends TransferFormData | GiftFormData>({
  kind,
  names,
  onSubmit,
  initial,
  submitLabel,
  onCancel,
}: Props<TForm>) {
  // A new gift defaults to a present: forgiving debt moves the balance, so it
  // should be a deliberate choice rather than the one you get by not looking.
  const emptyForm = {
    date: today(),
    from: 'A',
    amount: '',
    notes: '',
    ...(kind === 'gift' ? { giftKind: 'present' } : {}),
  } as TForm;
  const [form, setForm] = useState<TForm>(initial ?? emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receiver = nameOf(names, otherPerson(form.from));

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

        {kind === 'gift' && (
          <Radio.Group
            label="What kind of gift?"
            value={form.giftKind ?? 'present'}
            onChange={(val) => setForm((f) => ({ ...f, giftKind: val as GiftKind }))}
          >
            <Stack gap="xs" pt="xs">
              {GIFT_KINDS.map((k) => (
                <Radio key={k} value={k} label={GIFT_KIND_LABELS[k]} />
              ))}
            </Stack>
          </Radio.Group>
        )}

        <DateInput
          label="Date"
          value={form.date || null}
          onChange={(d) => setForm((f) => ({ ...f, date: dateInputValue(d) }))}
          required
          valueFormat="YYYY-MM-DD"
        />

        <Select
          label={COPY[kind].senderLabel}
          value={form.from}
          onChange={(val) => setForm((f) => ({ ...f, from: (val as Person) ?? 'A' }))}
          data={PEOPLE.map((p) => ({ value: p, label: nameOf(names, p) }))}
          allowDeselect={false}
        />

        <Text size="sm">
          Receiving:{' '}
          <Text span fw={600}>
            {receiver}
          </Text>
        </Text>

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
            {submitLabel ?? COPY[kind].addLabel}
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

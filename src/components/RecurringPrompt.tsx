import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Table,
  NumberInput,
  Checkbox,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { PendingExpense } from '../services/recurring';
import type { PersonNames } from '../types/person';
import { toNum, fromNum } from '../services/utils';
import { formatAmount, parseAmount } from '../services/parsing';

interface Props {
  opened: boolean;
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  pending: PendingExpense[];
  onConfirm: (rows: PendingExpense[]) => Promise<void>;
  /** Not now, and stop asking about exactly these months. */
  onDismiss: () => void;
}

/** Editable state per pending row, keyed by marker. */
interface Draft {
  amountA: string;
  amountB: string;
  skip: boolean;
}

/**
 * Confirm the months that are due before anything reaches the sheet.
 *
 * The amounts are editable, and that is the point rather than a convenience. A
 * rule stores one amount and no history, so months missed while the app went
 * unopened would otherwise be created at today's price even if the price
 * changed in between — and on a sheet that is the only record of who owes whom,
 * a plausible wrong figure is worse than a question.
 *
 * Skipping a month writes nothing at all, not even a marker. If it did, "not
 * this month" would quietly become "never", and there would be no way back
 * short of editing the spreadsheet by hand.
 */
export function RecurringPrompt({ opened, names, pending, onConfirm, onDismiss }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        pending.map((p) => [p.marker, { amountA: p.amountA, amountB: p.amountB, skip: false }]),
      ),
    );
    setError(null);
  }, [pending]);

  const draftFor = (p: PendingExpense): Draft =>
    drafts[p.marker] ?? { amountA: p.amountA, amountB: p.amountB, skip: false };

  const setDraft = (marker: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [marker]: { ...d[marker], ...patch } }));

  const chosen = pending.filter((p) => !draftFor(p).skip);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(
        chosen.map((p) => {
          const draft = draftFor(p);
          return { ...p, amountA: draft.amountA, amountB: draft.amountB };
        }),
      );
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the recurring expenses');
    } finally {
      setSubmitting(false);
    }
  };

  // Amounts arrive in display form ("€12.99"); the inputs work in numbers, and
  // formatAmount puts them back the way the sheet stores them.
  const amountValue = (raw: string) => toNum(parseAmount(raw));
  const amountFromInput = (val: number | string) => formatAmount(fromNum(val as number | ''));

  return (
    <Modal opened={opened} onClose={onDismiss} title="Add these recurring payments?" size="lg">
      <Stack gap="md">
        <Text>
          These months are due and are not on the sheet yet. Check the amounts before adding them —
          if a price changed while you were away, correct it here rather than afterwards.
        </Text>

        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Table.ScrollContainer minWidth={520}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>Add</Table.Th>
                <Table.Th w={110}>Date</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th w={120} ta="right">
                  {names.a}
                </Table.Th>
                <Table.Th w={120} ta="right">
                  {names.b}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pending.map((p) => {
                const draft = draftFor(p);
                return (
                  <Table.Tr key={p.marker}>
                    <Table.Td>
                      <Checkbox
                        checked={!draft.skip}
                        aria-label={`Add ${p.item} for ${p.date}`}
                        onChange={(e) => setDraft(p.marker, { skip: !e.currentTarget.checked })}
                      />
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{p.date}</Table.Td>
                    <Table.Td>{p.item}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`${names.a} for ${p.item} on ${p.date}`}
                        prefix="€ "
                        decimalScale={2}
                        fixedDecimalScale
                        min={0}
                        disabled={draft.skip}
                        value={amountValue(draft.amountA)}
                        onChange={(val) => setDraft(p.marker, { amountA: amountFromInput(val) })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`${names.b} for ${p.item} on ${p.date}`}
                        prefix="€ "
                        decimalScale={2}
                        fixedDecimalScale
                        min={0}
                        disabled={draft.skip}
                        value={amountValue(draft.amountB)}
                        onChange={(val) => setDraft(p.marker, { amountB: amountFromInput(val) })}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Text size="sm">
          Anything you leave unticked is not added and not recorded — it will be offered again next
          time.
        </Text>

        <Group>
          <Button loading={submitting} disabled={chosen.length === 0} onClick={handleConfirm}>
            Add {chosen.length} {chosen.length === 1 ? 'expense' : 'expenses'}
          </Button>
          <Button variant="light" onClick={onDismiss}>
            Later
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

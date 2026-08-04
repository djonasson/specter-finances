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
import { toNum, fromNum, notCountedProblem } from '../services/utils';
import { formatAmount, parseAmount } from '../services/parsing';

interface Props {
  opened: boolean;
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  pending: PendingExpense[];
  onConfirm: (rows: PendingExpense[]) => Promise<void>;
  /**
   * Stop asking. Given a signature, that exact set is what stops being asked
   * about — passed explicitly after a write, because by then the pending set has
   * changed and the set this modal was opened with is no longer the right one.
   */
  onDismiss: (signature?: string) => void;
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
 * Unticking a month is a **stopping point, not a hole**: it unticks every later
 * month of the same payment too. That is not a UI nicety — generation resumes
 * from the last month written, so a hole punched in the middle would never be
 * offered again and a month of real spending would vanish silently. A trailing
 * run can be left for next time; an interior month cannot be, so it is not
 * offered as a choice.
 */
export function RecurringPrompt({ opened, names, pending, onConfirm, onDismiss }: Props) {
  const [amounts, setAmounts] = useState<Record<string, { amountA: string; amountB: string }>>({});
  /** Per rule, the earliest month being left for next time. */
  const [stopAt, setStopAt] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmounts({});
    setStopAt({});
    setError(null);
  }, [pending]);

  const amountsFor = (p: PendingExpense) =>
    amounts[p.marker] ?? { amountA: p.amountA, amountB: p.amountB };
  const isChosen = (p: PendingExpense) => !(p.ruleId in stopAt) || p.month < stopAt[p.ruleId];

  /** The months of one payment, in order — the run a stopping point cuts. */
  const monthsOf = (ruleId: string) =>
    pending.filter((p) => p.ruleId === ruleId).map((p) => p.month);

  const setChosen = (p: PendingExpense, chosen: boolean) =>
    setStopAt((s) => {
      const next = { ...s };
      if (!chosen) {
        next[p.ruleId] = p.month; // this month and everything after it
      } else {
        const after = monthsOf(p.ruleId).filter((m) => m > p.month);
        if (after.length === 0) delete next[p.ruleId];
        else next[p.ruleId] = after[0];
      }
      return next;
    });

  // Amounts arrive in display form ("€12.99"); the inputs work in numbers, and
  // formatAmount puts them back the way the sheet stores them.
  const amountValue = (raw: string) => toNum(parseAmount(raw));
  const amountFromInput = (val: number | string) => formatAmount(fromNum(val as number | ''));

  const chosen = pending.filter(isChosen);

  /**
   * Bills whose amount is different every time, still with no figure.
   *
   * The rule deliberately holds none, so this is the only moment the app can
   * learn it. Writing a €0 row would be worse than writing nothing: it settles
   * as though the bill were free, and the balance is the only record either of
   * them has.
   */
  const unpriced = chosen.filter((p) => {
    if (!p.amountVaries) return false;
    const value = amountsFor(p);
    // Zero counts as no figure, not as a figure of zero. A €0 row settles as
    // though the bill had been free, which is the thing this guard exists to
    // prevent — and a bill that genuinely cost nothing is better left unticked.
    return !amountValue(value.amountA) && !amountValue(value.amountB);
  });
  const skipped = pending.filter((p) => !isChosen(p));

  /**
   * A corrected amount can strand the slice a rule sets aside against it.
   *
   * Correct €30 down to €10 and the rule's €12 "not counted" is suddenly more
   * than the whole; move the amount to the other person and it is stranded on
   * an empty column. Either way `calculateBalance` clamps it to nothing, so the
   * month settles as fully shared with nothing on screen to say why — which is
   * exactly what the two forms refuse, and this is the one write path that did
   * not.
   */
  const impossible = chosen
    .map((p) => {
      const value = amountsFor(p);
      // Pending rows carry display amounts ("€12.00"); the validator works in
      // the raw form the forms use, and hands NaN back for anything else.
      return {
        p,
        problem: notCountedProblem(
          {
            amountA: parseAmount(value.amountA),
            amountB: parseAmount(value.amountB),
            notCountedA: parseAmount(p.notCountedA),
            notCountedB: parseAmount(p.notCountedB),
          },
          names,
        ),
      };
    })
    .filter((r) => r.problem !== null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (impossible.length > 0 || unpriced.length > 0) return;
      await onConfirm(chosen.map((p) => ({ ...p, ...amountsFor(p) })));
      // Dismiss exactly what was left behind. Working it out here rather than
      // letting the hook read its own state avoids persisting the set as it was
      // before the write, which would reopen this modal immediately.
      onDismiss(
        skipped
          .map((p) => p.marker)
          .sort()
          .join('|'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the recurring expenses');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => onDismiss()}
      title="Add these recurring payments?"
      size="lg"
    >
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
                const included = isChosen(p);
                const value = amountsFor(p);
                return (
                  <Table.Tr key={p.marker}>
                    <Table.Td>
                      <Checkbox
                        checked={included}
                        aria-label={`Add ${p.item} for ${p.date}`}
                        onChange={(e) => setChosen(p, e.currentTarget.checked)}
                      />
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{p.date}</Table.Td>
                    <Table.Td>
                      {p.item}
                      {/*
                        Shown because a corrected amount can invalidate it, and
                        blocking on a figure the user cannot see is a dead end.
                      */}
                      {p.amountVaries && <Text size="xs">amount differs every time</Text>}
                      {(p.notCountedA || p.notCountedB) && (
                        <Text size="xs">
                          not counted: {p.notCountedA || '—'} / {p.notCountedB || '—'}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`${names.a} for ${p.item} on ${p.date}`}
                        prefix="€ "
                        decimalScale={2}
                        fixedDecimalScale
                        min={0}
                        disabled={!included}
                        value={amountValue(value.amountA)}
                        onChange={(val) =>
                          setAmounts((a) => ({
                            ...a,
                            [p.marker]: { ...value, amountA: amountFromInput(val) },
                          }))
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`${names.b} for ${p.item} on ${p.date}`}
                        prefix="€ "
                        decimalScale={2}
                        fixedDecimalScale
                        min={0}
                        disabled={!included}
                        value={amountValue(value.amountB)}
                        onChange={(val) =>
                          setAmounts((a) => ({
                            ...a,
                            [p.marker]: { ...value, amountB: amountFromInput(val) },
                          }))
                        }
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {unpriced.length > 0 && impossible.length === 0 && (
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            {unpriced[0].item} on {unpriced[0].date} needs its amount — this one is different every
            time, so nobody but you knows what it came to.
          </Alert>
        )}

        {impossible.length > 0 && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {impossible[0].problem} — {impossible[0].p.item} on {impossible[0].p.date} sets aside
            more than the amount now says. Correct the amount, or untick that month and change the
            payment itself.
          </Alert>
        )}

        <Text size="sm">
          Unticking a month leaves it and every later month of that payment for next time. Nothing
          is written for them and nothing is recorded, so they will be offered again.
        </Text>

        <Group>
          <Button
            loading={submitting}
            disabled={chosen.length === 0 || impossible.length > 0 || unpriced.length > 0}
            onClick={handleConfirm}
          >
            Add {chosen.length} {chosen.length === 1 ? 'expense' : 'expenses'}
          </Button>
          <Button variant="light" onClick={() => onDismiss()}>
            Later
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

import { useState } from 'react';
import { Card, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-react';

import type { PersonNames } from '../types/person';

type RecordKind = 'expense' | 'transfer' | 'gift';

interface Explanation {
  question: string;
  body: string[];
}

// The transfer/gift copy below mirrors the 2×X settlement rule implemented by
// calculateBalance in services/utils.ts — keep the two in sync. In particular,
// only transfers and forgiven gifts appear in that formula; presents do not.
// Examples are built from the names in the sheet rather than any name written
// here, and stay in they/them: the sheet says what people are called, never
// which pronouns they use.
function explanationsFor({ a, b }: PersonNames): Record<RecordKind, Explanation> {
  return {
    expense: {
      question: 'What counts as an expense?',
      body: [
        'Something one of you bought. Enter what each of you actually paid, not what either of you owes — the split is worked out for you.',
        `Example: ${a} pays €40 for groceries → €40 in their column, nothing in ${b}’s. If you split the bill at the till, fill in both.`,
        `If part of it was only for one of you, put that part in their “not counted” field. It stays in the totals as money spent, but the other is not asked to share it: €100 with €10 not counted is €90 shared, so the other owes €45 rather than €50.`,
      ],
    },
    transfer: {
      question: 'What counts as a transfer?',
      body: [
        'One of you paying the other back to settle up. The money is meant to reduce what is owed, so it moves the balance toward zero.',
        `Example: ${a} owes ${b} €100 and transfers €50 → ${a} now owes €50.`,
        'If it is meant to square things up, it is a transfer. If it is a present, log it as a gift instead.',
      ],
    },
    gift: {
      question: 'What counts as a gift?',
      body: [
        'One of you giving the other something, deliberately not as a repayment. Pick which of the two it was — they do opposite things to the balance.',
        `A present — money changed hands. It sits outside the shared pot, so the balance stays exactly where it was. Example: ${a} owes ${b} €100 and gifts them €50 → ${a} still owes €100, and ${b} keeps the €50.`,
        `Forgiving debt — no money moved; you let part of what the other owes you slide. Example: ${b} owes ${a} €100 and ${a} forgives €40 → ${b} owes €60, and nothing left either account.`,
        'If the money is meant to pay something back, log it as a transfer instead.',
      ],
    },
  };
}

interface Props {
  kind: RecordKind;
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
}

/** Collapsible explainer shown above each form on the Add page. */
export function RecordTypeHelp({ kind, names }: Props) {
  const [open, setOpen] = useState(false);
  const { question, body } = explanationsFor(names)[kind];
  const contentId = `record-type-help-${kind}`;

  return (
    <Card withBorder p="xs" radius="md" mb="md">
      <UnstyledButton
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        w="100%"
      >
        <Group gap="xs" wrap="nowrap">
          <IconInfoCircle size={18} stroke={1.8} />
          <Text size="sm" fw={600} flex={1}>
            {question}
          </Text>
          <IconChevronDown
            size={18}
            stroke={1.8}
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        </Group>
      </UnstyledButton>

      <Collapse in={open} id={contentId}>
        <Stack gap="xs" pt="sm" px={4} pb={4}>
          {body.map((paragraph, i) => (
            <Text key={i} size="sm">
              {paragraph}
            </Text>
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

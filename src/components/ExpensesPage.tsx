import type { ComponentProps } from 'react';
import { Tabs } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import type { PersonNames } from '../types/person';
import { ExpenseList } from './ExpenseList';
import { RecurringList } from './RecurringList';

/**
 * Each tab's props, exactly as its list declares them.
 *
 * Spelled this way rather than as two flat sets so this component stops being a
 * renaming layer: every recurring prop used to be written three times under two
 * names on its way from the context to the table.
 */
interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  expenses: Omit<ComponentProps<typeof ExpenseList>, 'names'>;
  recurring: Omit<ComponentProps<typeof RecurringList>, 'names'>;
}

/**
 * The expenses screen: what was spent, and what will be spent again.
 *
 * The tab is held in the query string rather than the path so the bottom nav —
 * which marks the current screen by exact pathname — keeps Expenses lit, and so
 * switching tabs does not count as a navigation, which in this app refetches
 * every domain.
 */
export function ExpensesPage({ names, expenses, recurring }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'recurring' ? 'recurring' : 'expenses';

  return (
    <Tabs
      value={tab}
      onChange={(value) =>
        // replace: switching tabs is not a place to come back to.
        setSearchParams(value === 'recurring' ? { tab: 'recurring' } : {}, { replace: true })
      }
    >
      <Tabs.List>
        <Tabs.Tab value="expenses">Expenses</Tabs.Tab>
        <Tabs.Tab value="recurring">
          {recurring.pending.length > 0
            ? `Recurring (${recurring.pending.length} due)`
            : 'Recurring'}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="expenses" pt="md">
        <ExpenseList names={names} {...expenses} />
      </Tabs.Panel>

      <Tabs.Panel value="recurring" pt="md">
        <RecurringList names={names} {...recurring} />
      </Tabs.Panel>
    </Tabs>
  );
}

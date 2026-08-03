import { Tabs } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import type { RecurringRule, RecurringFormData, RecurringRow } from '../types/recurring';
import type { PersonNames } from '../types/person';
import { ExpenseList } from './ExpenseList';
import { RecurringList } from './RecurringList';

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  expenses: Expense[];
  loading: boolean;
  onUpdate: (rowIndex: ExpenseRow, data: ExpenseFormData) => Promise<void>;
  onDelete: (rowIndex: ExpenseRow) => Promise<void>;
  onRefresh: () => void;

  rules: RecurringRule[];
  recurringLoading: boolean;
  recurringTabMissing: boolean;
  dueCount: number;
  onUpdateRule: (rowIndex: RecurringRow, data: RecurringFormData, id: string) => Promise<void>;
  onDeleteRule: (rowIndex: RecurringRow) => Promise<void>;
  onAssignRuleId: (rowIndex: RecurringRow) => Promise<void>;
  onSetUpRecurring: () => Promise<void>;
  onGenerate: () => void;
  onRefreshRules: () => void;
}

/**
 * The expenses screen: what was spent, and what will be spent again.
 *
 * The tab is held in the query string rather than the path so the bottom nav —
 * which marks the current screen by exact pathname — keeps Expenses lit, and so
 * switching tabs does not count as a navigation, which in this app refetches
 * every domain.
 */
export function ExpensesPage({
  names,
  expenses,
  loading,
  onUpdate,
  onDelete,
  onRefresh,
  rules,
  recurringLoading,
  recurringTabMissing,
  dueCount,
  onUpdateRule,
  onDeleteRule,
  onAssignRuleId,
  onSetUpRecurring,
  onGenerate,
  onRefreshRules,
}: Props) {
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
          {dueCount > 0 ? `Recurring (${dueCount} due)` : 'Recurring'}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="expenses" pt="md">
        <ExpenseList
          names={names}
          expenses={expenses}
          loading={loading}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRefresh={onRefresh}
        />
      </Tabs.Panel>

      <Tabs.Panel value="recurring" pt="md">
        <RecurringList
          names={names}
          rules={rules}
          loading={recurringLoading}
          tabMissing={recurringTabMissing}
          dueCount={dueCount}
          onUpdate={onUpdateRule}
          onDelete={onDeleteRule}
          onAssignId={onAssignRuleId}
          onSetUp={onSetUpRecurring}
          onGenerate={onGenerate}
          onRefresh={onRefreshRules}
        />
      </Tabs.Panel>
    </Tabs>
  );
}

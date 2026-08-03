import { useMemo, useState } from 'react';
import {
  useComputedColorScheme,
  Group,
  TextInput,
  Select,
  Checkbox,
  Badge,
  Button,
  Text,
  Table,
  ActionIcon,
  Pagination,
  Modal,
  Stack,
  Box,
  UnstyledButton,
  Alert,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconSearch,
  IconEdit,
  IconTrash,
  IconCopy,
  IconChevronDown,
  IconAlertCircle,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from '@tabler/icons-react';
import type { Expense, ExpenseFormData, ExpenseRow, Category } from '../types/expense';
import { CATEGORIES } from '../types/expense';
import type { PersonNames } from '../types/person';
import type { ExpenseSort, ExpenseSortKey } from '../services/utils';
import {
  expenseToFormData,
  today,
  sortExpenses,
  filterExpenses,
  isRecentlyAdded,
  DEFAULT_EXPENSE_SORT,
} from '../services/utils';
import { ExpenseForm } from './ExpenseForm';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  expenses: Expense[];
  loading: boolean;
  onUpdate: (rowIndex: ExpenseRow, data: ExpenseFormData) => Promise<void>;
  onDelete: (rowIndex: ExpenseRow) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;
const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/**
 * Sort options in the words someone would use, rather than "date desc".
 *
 * "Recently added" is the sheet's own order, which is what the list always
 * showed before there was a choice.
 */
const SORT_OPTIONS: { label: string; sort: ExpenseSort }[] = [
  { label: 'Newest first', sort: { key: 'date', asc: false } },
  { label: 'Oldest first', sort: { key: 'date', asc: true } },
  { label: 'Largest amount', sort: { key: 'amount', asc: false } },
  { label: 'Smallest amount', sort: { key: 'amount', asc: true } },
  { label: 'Recently added', sort: { key: 'inserted', asc: false } },
  { label: 'First added', sort: { key: 'inserted', asc: true } },
];

/** The Select speaks strings; this is the only place that encoding is defined. */
const sortValue = (sort: ExpenseSort) => `${sort.key}-${sort.asc ? 'asc' : 'desc'}`;

const UNCATEGORISED = '__none__';

/**
 * Marks a row this app created from a recurring payment.
 *
 * variant="filled" rather than "light" for the same reason the gift badges are:
 * over a striped row the light variant does not hold contrast in both colour
 * schemes.
 */
function RecurringBadge() {
  return (
    <Badge color="indigo" variant="filled" size="sm">
      Recurring
    </Badge>
  );
}

/**
 * Marks a row added in the last few days.
 *
 * The list is ordered by when the money was spent, so something entered today
 * for a purchase last month sits in the middle of it. Both badges can appear on
 * one row — a caught-up recurring payment is exactly that case.
 */
function NewBadge() {
  return (
    <Badge color="teal" variant="filled" size="sm">
      New
    </Badge>
  );
}

export function ExpenseList({ names, expenses, loading, onUpdate, onDelete, onRefresh }: Props) {
  const navigate = useNavigate();
  const isDark = useComputedColorScheme('light') === 'dark';
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<Category | '' | 'all'>('all');
  const [recentOnly, setRecentOnly] = useState(false);
  const [sort, setSort] = useState<ExpenseSort>(DEFAULT_EXPENSE_SORT);
  const [page, setPage] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Read once per render rather than per row, so every badge on the screen
  // agrees even if the clock crosses midnight mid-render.
  const now = today();

  // Filter then sort then page, so "Showing X of Y" counts what was matched
  // rather than what fits on the screen.
  const filtered = useMemo(
    () =>
      sortExpenses(
        filterExpenses(expenses, { text: filter, category, recentOnly, todayIso: now }),
        sort,
      ),
    [expenses, filter, category, recentOnly, now, sort],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Offered only when such a row exists: toCategory blanks anything it does not
  // recognise, and hiding those rows behind a filter that cannot reach them
  // would make them unfindable.
  const hasUncategorised = useMemo(() => expenses.some((e) => e.category === ''), [expenses]);

  // Which of the rows on screen are new, worked out once. The row renderer runs
  // twice per expense — once per breakpoint, both of which are always rendered
  // and hidden with CSS — so asking per row asked twice as often as needed.
  const recentRows = useMemo(
    () => new Set(paged.filter((e) => isRecentlyAdded(e, now)).map((e) => e.rowIndex)),
    [paged, now],
  );

  const changeSort = (next: ExpenseSort) => {
    setSort(next);
    setPage(0);
  };

  /** Clicking a desktop header sorts by it, and flips direction if already so. */
  const toggleSort = (key: ExpenseSortKey) =>
    changeSort(sort.key === key ? { key, asc: !sort.asc } : { key, asc: false });

  // Screen readers get sort state from aria-sort; the icon conveys it only
  // visually.
  const ariaSort = (key: ExpenseSortKey): 'ascending' | 'descending' | 'none' =>
    sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none';

  const sortIcon = (key: ExpenseSortKey) =>
    sort.key === key ? (
      sort.asc ? (
        <IconArrowUp size={14} />
      ) : (
        <IconArrowDown size={14} />
      )
    ) : (
      <IconArrowsSort size={14} style={{ opacity: 0.5 }} />
    );

  const sortableHeader = (key: ExpenseSortKey, label: string) => (
    <UnstyledButton onClick={() => toggleSort(key)} style={{ font: 'inherit', color: 'inherit' }}>
      <Group gap={4} wrap="nowrap">
        {label}
        {sortIcon(key)}
      </Group>
    </UnstyledButton>
  );

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingRow(confirmDelete.rowIndex);
    setConfirmDelete(null);
    setDeleteError(null);
    try {
      await onDelete(confirmDelete.rowIndex);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setDeletingRow(null);
    }
  };

  const toFormData = expenseToFormData;

  const handleDuplicate = (expense: Expense) => {
    navigate('/add', { state: { duplicate: { ...toFormData(expense), date: today() } } });
  };

  const toggleExpand = (rowIndex: number) => {
    setExpandedRow((prev) => (prev === rowIndex ? null : rowIndex));
  };

  function renderExpenseRows(expense: Expense, isMobile: boolean) {
    const isEditing = editingRow === expense.rowIndex;
    const isExpanded = expandedRow === expense.rowIndex;
    const colSpan = isMobile ? 4 : 7;

    if (isEditing) {
      return (
        <Table.Tr key={expense.rowIndex}>
          <Table.Td colSpan={colSpan} bg="var(--mantine-color-default-hover)">
            <ExpenseForm
              names={names}
              initial={toFormData(expense)}
              submitLabel="Save"
              onSubmit={async (data) => {
                await onUpdate(expense.rowIndex, data);
                setEditingRow(null);
              }}
              onCancel={() => setEditingRow(null)}
            />
          </Table.Td>
        </Table.Tr>
      );
    }

    const rows = [];

    // Main row
    rows.push(
      <Table.Tr
        key={expense.rowIndex}
        onClick={isMobile ? () => toggleExpand(expense.rowIndex) : undefined}
        style={isMobile ? { cursor: 'pointer' } : undefined}
        data-expanded={isMobile && isExpanded ? true : undefined}
      >
        <Table.Td style={NOWRAP}>
          {isMobile ? (
            // Tapping the row also toggles, but a row is not an accessible
            // control: keyboard and screen-reader users need a real button.
            <Group gap={4} wrap="nowrap">
              <UnstyledButton
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(expense.rowIndex);
                }}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${
                  expense.item || expense.date
                }`}
                display="flex"
              >
                <IconChevronDown
                  size={16}
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms ease',
                  }}
                />
              </UnstyledButton>
              {expense.date}
            </Group>
          ) : (
            expense.date
          )}
        </Table.Td>
        <Table.Td ta="right" style={TABULAR}>
          {expense.amountA}
        </Table.Td>
        <Table.Td ta="right" style={TABULAR}>
          {expense.amountB}
        </Table.Td>
        <Table.Td style={ELLIPSIS}>
          {isMobile ? (
            // The badge earns its space in the narrow layout: a row that has to
            // be tapped to reveal that it is the one you just added is no help
            // at all. The recurring badge stays in the detail row.
            <Group gap={4} wrap="nowrap" style={{ overflow: 'hidden' }}>
              <CategoryIcon category={expense.category} size={16} />
              <span style={ELLIPSIS as React.CSSProperties}>{expense.item}</span>
              {recentRows.has(expense.rowIndex) && <NewBadge />}
            </Group>
          ) : (
            <Group gap="xs" wrap="nowrap">
              <span style={ELLIPSIS as React.CSSProperties}>{expense.item}</span>
              {recentRows.has(expense.rowIndex) && <NewBadge />}
              {expense.recurringMarker && <RecurringBadge />}
            </Group>
          )}
        </Table.Td>
        {!isMobile && (
          <>
            <Table.Td>
              <Group gap={4} wrap="nowrap">
                <CategoryIcon category={expense.category} size={16} />
                {expense.category}
              </Group>
            </Table.Td>
            <Table.Td maw={200} style={ELLIPSIS}>
              {expense.notes}
            </Table.Td>
            <Table.Td>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setEditingRow(expense.rowIndex)}
                  title="Edit"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  onClick={() => handleDuplicate(expense)}
                  title="Duplicate"
                >
                  <IconCopy size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => setConfirmDelete(expense)}
                  title="Delete"
                  disabled={deletingRow === expense.rowIndex}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </>
        )}
      </Table.Tr>,
    );

    // Expanded detail row (mobile only)
    if (isMobile && isExpanded) {
      rows.push(
        <Table.Tr key={`${expense.rowIndex}-detail`} data-expanded>
          <Table.Td colSpan={4} py="xs" px="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap="xs" style={{ flex: 1 }}>
                {expense.recurringMarker && (
                  <Group gap="xs">
                    <Text size="sm" c="var(--mantine-color-text)" w={70}>
                      Source
                    </Text>
                    <RecurringBadge />
                  </Group>
                )}
                {expense.category && (
                  <Group gap="xs">
                    <Text size="sm" c="var(--mantine-color-text)" w={70}>
                      Category
                    </Text>
                    <Group gap={4} wrap="nowrap">
                      <CategoryIcon category={expense.category} size={16} />
                      <Text size="sm">{expense.category}</Text>
                    </Group>
                  </Group>
                )}
                {expense.notes && (
                  <Group gap="xs" align="flex-start">
                    <Text size="sm" c="var(--mantine-color-text)" w={70}>
                      Notes
                    </Text>
                    <Text size="sm" style={{ flex: 1 }}>
                      {expense.notes}
                    </Text>
                  </Group>
                )}
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <ActionIcon
                  variant="light"
                  onClick={() => setEditingRow(expense.rowIndex)}
                  title="Edit"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  onClick={() => handleDuplicate(expense)}
                  title="Duplicate"
                >
                  <IconCopy size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => setConfirmDelete(expense)}
                  title="Delete"
                  disabled={deletingRow === expense.rowIndex}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </Table.Td>
        </Table.Tr>,
      );
    }

    return rows;
  }

  return (
    <Stack gap="md">
      <Group grow wrap="wrap" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Search expenses..."
          leftSection={<IconSearch size={16} />}
          value={filter}
          onChange={(e) => {
            setFilter(e.currentTarget.value);
            setPage(0);
          }}
          miw={180}
        />
        <Select
          label="Category"
          value={category === 'all' ? 'all' : category === '' ? UNCATEGORISED : category}
          onChange={(val) => {
            setCategory(
              val === 'all' || !val ? 'all' : val === UNCATEGORISED ? '' : (val as Category),
            );
            setPage(0);
          }}
          allowDeselect={false}
          maw={220}
          data={[
            { value: 'all', label: 'All categories' },
            ...CATEGORIES.map((c) => ({ value: c, label: c })),
            ...(hasUncategorised ? [{ value: UNCATEGORISED, label: 'Uncategorised' }] : []),
          ]}
        />
        <Select
          label="Sort by"
          value={sortValue(sort)}
          onChange={(val) => {
            const option = SORT_OPTIONS.find((o) => sortValue(o.sort) === val);
            if (option) changeSort(option.sort);
          }}
          allowDeselect={false}
          maw={220}
          data={SORT_OPTIONS.map((o) => ({ value: sortValue(o.sort), label: o.label }))}
        />
        <Checkbox
          label="Recently added"
          checked={recentOnly}
          onChange={(e) => {
            setRecentOnly(e.currentTarget.checked);
            setPage(0);
          }}
          maw={180}
          mb={7}
        />
        <Button variant="light" loading={loading} onClick={onRefresh} maw={120}>
          Refresh
        </Button>
      </Group>

      {deleteError && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          withCloseButton
          onClose={() => setDeleteError(null)}
        >
          {deleteError}
        </Alert>
      )}

      <Text size="sm" c="var(--mantine-color-text)">
        Showing {paged.length} of {filtered.length} expenses
      </Text>

      {/* Desktop table */}
      <Box visibleFrom="sm">
        <Table.ScrollContainer minWidth={700}>
          <Table
            striped
            highlightOnHover
            style={
              isDark
                ? ({ '--table-striped-color': 'rgba(255,255,255,0.07)' } as React.CSSProperties)
                : undefined
            }
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={NOWRAP} w={130} aria-sort={ariaSort('date')}>
                  {sortableHeader('date', 'Date')}
                </Table.Th>
                <Table.Th w={110} ta="right">
                  {names.a}
                </Table.Th>
                <Table.Th w={110} ta="right">
                  {names.b}
                </Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th w={100}>Category</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th w={80}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paged.flatMap((expense) => renderExpenseRows(expense, false))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Box>

      {/* Mobile table */}
      <Box hiddenFrom="sm" style={{ overflowX: 'hidden' }}>
        <Table
          striped
          highlightOnHover
          layout="fixed"
          style={
            isDark
              ? ({ '--table-striped-color': 'rgba(255,255,255,0.07)' } as React.CSSProperties)
              : undefined
          }
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={90} style={NOWRAP}>
                Date
              </Table.Th>
              <Table.Th w={70} ta="right">
                {names.a}
              </Table.Th>
              <Table.Th w={70} ta="right">
                {names.b}
              </Table.Th>
              <Table.Th>Item</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{paged.flatMap((expense) => renderExpenseRows(expense, true))}</Table.Tbody>
        </Table>
      </Box>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination total={totalPages} value={page + 1} onChange={(p) => setPage(p - 1)} />
        </Group>
      )}

      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete expense?"
      >
        {confirmDelete && (
          <Stack gap="md">
            <Text>
              <Text span fw={600}>
                {confirmDelete.date}
              </Text>{' '}
              — {confirmDelete.item}
              {confirmDelete.amountA && ` (${names.a}: ${confirmDelete.amountA})`}
              {confirmDelete.amountB && ` (${names.b}: ${confirmDelete.amountB})`}
            </Text>
            <Group>
              <Button color="red" onClick={handleDeleteConfirm}>
                Delete
              </Button>
              <Button variant="light" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

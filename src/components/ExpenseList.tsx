import { useState } from 'react';
import {
  useComputedColorScheme,
  Group,
  TextInput,
  Button,
  Text,
  Table,
  ActionIcon,
  Pagination,
  Modal,
  Stack,
  Box,
} from '@mantine/core';
import { IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { Expense, ExpenseFormData } from '../types/expense';
import { expenseToFormData } from '../services/utils';
import { ExpenseForm } from './ExpenseForm';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  expenses: Expense[];
  loading: boolean;
  onUpdate: (rowIndex: number, data: ExpenseFormData) => Promise<void>;
  onDelete: (rowIndex: number) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;
const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

export function ExpenseList({ expenses, loading, onUpdate, onDelete, onRefresh }: Props) {
  const isDark = useComputedColorScheme('light') === 'dark';
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const sorted = [...expenses].reverse();

  const filtered = filter
    ? sorted.filter(
        (e) =>
          e.item.toLowerCase().includes(filter.toLowerCase()) ||
          e.category.toLowerCase().includes(filter.toLowerCase()) ||
          e.notes.toLowerCase().includes(filter.toLowerCase()) ||
          e.date.includes(filter)
      )
    : sorted;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingRow(confirmDelete.rowIndex);
    setConfirmDelete(null);
    try {
      await onDelete(confirmDelete.rowIndex);
    } finally {
      setDeletingRow(null);
    }
  };

  const toFormData = expenseToFormData;

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
        <Table.Td style={NOWRAP}>{expense.date}</Table.Td>
        <Table.Td ta="right" style={TABULAR}>{expense.amountDaniel}</Table.Td>
        <Table.Td ta="right" style={TABULAR}>{expense.amountManuela}</Table.Td>
        <Table.Td style={ELLIPSIS}>
          {isMobile ? (
            <Group gap={4} wrap="nowrap" style={{ overflow: 'hidden' }}>
              <CategoryIcon category={expense.category} size={16} />
              <span style={ELLIPSIS as React.CSSProperties}>{expense.item}</span>
            </Group>
          ) : expense.item}
        </Table.Td>
        {!isMobile && (
          <>
            <Table.Td>
              <Group gap={4} wrap="nowrap">
                <CategoryIcon category={expense.category} size={16} />
                {expense.category}
              </Group>
            </Table.Td>
            <Table.Td maw={200} style={ELLIPSIS}>{expense.notes}</Table.Td>
            <Table.Td>
              <Group gap={4} wrap="nowrap">
                <ActionIcon variant="subtle" onClick={() => setEditingRow(expense.rowIndex)} title="Edit">
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => setConfirmDelete(expense)} title="Delete" disabled={deletingRow === expense.rowIndex}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </>
        )}
      </Table.Tr>
    );

    // Expanded detail row (mobile only)
    if (isMobile && isExpanded) {
      rows.push(
        <Table.Tr key={`${expense.rowIndex}-detail`} data-expanded>
          <Table.Td colSpan={4} py="xs" px="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap="xs" style={{ flex: 1 }}>
                {expense.category && (
                  <Group gap="xs">
                    <Text size="sm" c="var(--mantine-color-text)" w={70}>Category</Text>
                    <Group gap={4} wrap="nowrap">
                      <CategoryIcon category={expense.category} size={16} />
                      <Text size="sm">{expense.category}</Text>
                    </Group>
                  </Group>
                )}
                {expense.notes && (
                  <Group gap="xs" align="flex-start">
                    <Text size="sm" c="var(--mantine-color-text)" w={70}>Notes</Text>
                    <Text size="sm" style={{ flex: 1 }}>{expense.notes}</Text>
                  </Group>
                )}
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <ActionIcon variant="light" onClick={() => setEditingRow(expense.rowIndex)} title="Edit">
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon variant="light" color="red" onClick={() => setConfirmDelete(expense)} title="Delete" disabled={deletingRow === expense.rowIndex}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    }

    return rows;
  }

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search expenses..."
          leftSection={<IconSearch size={16} />}
          value={filter}
          onChange={(e) => {
            setFilter(e.currentTarget.value);
            setPage(0);
          }}
          style={{ flex: 1 }}
        />
        <Button variant="light" loading={loading} onClick={onRefresh}>
          Refresh
        </Button>
      </Group>

      <Text size="sm" c="var(--mantine-color-text)">
        Showing {paged.length} of {filtered.length} expenses
      </Text>

      {/* Desktop table */}
      <Box visibleFrom="sm">
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover style={isDark ? { '--table-striped-color': 'rgba(255,255,255,0.07)' } as React.CSSProperties : undefined}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={NOWRAP} w={110}>Date</Table.Th>
                <Table.Th w={110} ta="right">Daniel</Table.Th>
                <Table.Th w={110} ta="right">Manuela</Table.Th>
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
        <Table striped highlightOnHover layout="fixed" style={isDark ? { '--table-striped-color': 'rgba(255,255,255,0.07)' } as React.CSSProperties : undefined}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={90} style={NOWRAP}>Date</Table.Th>
              <Table.Th w={70} ta="right">Daniel</Table.Th>
              <Table.Th w={70} ta="right">Manuela</Table.Th>
              <Table.Th>Item</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paged.flatMap((expense) => renderExpenseRows(expense, true))}
          </Table.Tbody>
        </Table>
      </Box>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={page + 1}
            onChange={(p) => setPage(p - 1)}
          />
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
              <Text span fw={600}>{confirmDelete.date}</Text> — {confirmDelete.item}
              {confirmDelete.amountDaniel && ` (Daniel: ${confirmDelete.amountDaniel})`}
              {confirmDelete.amountManuela && ` (Manuela: ${confirmDelete.amountManuela})`}
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

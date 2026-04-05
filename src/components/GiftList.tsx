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
} from '@mantine/core';
import { IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { Gift, GiftFormData } from '../types/gift';
import { giftFrom, giftAmount, giftToFormData } from '../services/utils';
import { GiftForm } from './GiftForm';

interface Props {
  gifts: Gift[];
  loading: boolean;
  onUpdate: (rowIndex: number, data: GiftFormData) => Promise<void>;
  onDelete: (rowIndex: number) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;
const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;

export function GiftList({ gifts, loading, onUpdate, onDelete, onRefresh }: Props) {
  const isDark = useComputedColorScheme('light') === 'dark';
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Gift | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const sorted = [...gifts].reverse();

  const filtered = filter
    ? sorted.filter((g) => {
        const q = filter.toLowerCase();
        const from = giftFrom(g).toLowerCase();
        const to = (from === 'daniel' ? 'manuela' : 'daniel');
        return g.date.includes(filter) || from.includes(q) || to.includes(q) || g.notes.toLowerCase().includes(q);
      })
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

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search gifts..."
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
        Showing {paged.length} of {filtered.length} gifts
      </Text>

      <Table striped highlightOnHover style={isDark ? { '--table-striped-color': 'rgba(255,255,255,0.07)' } as React.CSSProperties : undefined}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={NOWRAP}>Date</Table.Th>
            <Table.Th>Gift</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th>Notes</Table.Th>
            <Table.Th w={80}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paged.map((g) => {
            if (editingRow === g.rowIndex) {
              return (
                <Table.Tr key={g.rowIndex}>
                  <Table.Td colSpan={5} bg="var(--mantine-color-default-hover)">
                    <GiftForm
                      initial={giftToFormData(g)}
                      submitLabel="Save"
                      onSubmit={async (data) => {
                        await onUpdate(g.rowIndex, data);
                        setEditingRow(null);
                      }}
                      onCancel={() => setEditingRow(null)}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            }

            const from = giftFrom(g);
            const to = from === 'Daniel' ? 'Manuela' : 'Daniel';

            return (
              <Table.Tr key={g.rowIndex}>
                <Table.Td style={NOWRAP}>{g.date}</Table.Td>
                <Table.Td>{from} → {to}</Table.Td>
                <Table.Td ta="right" style={TABULAR}>{giftAmount(g)}</Table.Td>
                <Table.Td>{g.notes}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="subtle" onClick={() => setEditingRow(g.rowIndex)} title="Edit">
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setConfirmDelete(g)}
                      title="Delete"
                      disabled={deletingRow === g.rowIndex}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

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
        title="Delete gift?"
      >
        {confirmDelete && (
          <Stack gap="md">
            <Text>
              <Text span fw={600}>{confirmDelete.date}</Text> —{' '}
              {giftFrom(confirmDelete)} → {giftFrom(confirmDelete) === 'Daniel' ? 'Manuela' : 'Daniel'}{' '}
              {giftAmount(confirmDelete)}
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

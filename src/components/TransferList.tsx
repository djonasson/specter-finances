import { useState } from 'react';
import {
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
import type { Transfer, TransferFormData } from '../types/transfer';
import { transferFrom, transferAmount, transferToFormData } from '../services/utils';
import { TransferForm } from './TransferForm';

interface Props {
  transfers: Transfer[];
  loading: boolean;
  onUpdate: (rowIndex: number, data: TransferFormData) => Promise<void>;
  onDelete: (rowIndex: number) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;
const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;

export function TransferList({ transfers, loading, onUpdate, onDelete, onRefresh }: Props) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transfer | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const sorted = [...transfers].reverse();

  const filtered = filter
    ? sorted.filter((t) => {
        const q = filter.toLowerCase();
        const from = transferFrom(t).toLowerCase();
        const to = (from === 'daniel' ? 'manuela' : 'daniel');
        return t.date.includes(filter) || from.includes(q) || to.includes(q);
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
          placeholder="Search transfers..."
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
        Showing {paged.length} of {filtered.length} transfers
      </Text>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={NOWRAP}>Date</Table.Th>
            <Table.Th>Transfer</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th w={80}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paged.map((t) => {
            if (editingRow === t.rowIndex) {
              return (
                <Table.Tr key={t.rowIndex}>
                  <Table.Td colSpan={4} bg="var(--mantine-color-default-hover)">
                    <TransferForm
                      initial={transferToFormData(t)}
                      submitLabel="Save"
                      onSubmit={async (data) => {
                        await onUpdate(t.rowIndex, data);
                        setEditingRow(null);
                      }}
                      onCancel={() => setEditingRow(null)}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            }

            const from = transferFrom(t);
            const to = from === 'Daniel' ? 'Manuela' : 'Daniel';

            return (
              <Table.Tr key={t.rowIndex}>
                <Table.Td style={NOWRAP}>{t.date}</Table.Td>
                <Table.Td>{from} → {to}</Table.Td>
                <Table.Td ta="right" style={TABULAR}>{transferAmount(t)}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="subtle" onClick={() => setEditingRow(t.rowIndex)} title="Edit">
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setConfirmDelete(t)}
                      title="Delete"
                      disabled={deletingRow === t.rowIndex}
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
        title="Delete transfer?"
      >
        {confirmDelete && (
          <Stack gap="md">
            <Text>
              <Text span fw={600}>{confirmDelete.date}</Text> —{' '}
              {transferFrom(confirmDelete)} → {transferFrom(confirmDelete) === 'Daniel' ? 'Manuela' : 'Daniel'}{' '}
              {transferAmount(confirmDelete)}
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

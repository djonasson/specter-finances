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
  Alert,
  Badge,
} from '@mantine/core';
import {
  IconSearch,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconAlertCircle,
} from '@tabler/icons-react';
import type { TransferFormData } from '../types/transfer';
import { otherPerson, nameOf } from '../types/person';
import type { PersonNames } from '../types/person';
import type { GiftFormData, GiftKind } from '../types/gift';
import {
  movementFrom,
  movementAmount,
  movementToFormData,
  hasAmbiguousDirection,
} from '../services/utils';
import { MovementForm } from './MovementForm';

type MovementKind = 'transfer' | 'gift';

const COPY: Record<MovementKind, { one: string; many: string; column: string; search: string }> = {
  transfer: {
    one: 'transfer',
    many: 'transfers',
    column: 'Transfer',
    search: 'Search transfers...',
  },
  gift: { one: 'gift', many: 'gifts', column: 'Gift', search: 'Search gifts...' },
};

/**
 * Whether the row moved money or only moved the balance. Filled variant, not
 * `light`: these two must stay legible against the striped rows in both colour
 * schemes, and the label is the only thing separating a real present from
 * forgiven debt.
 */
const GIFT_KIND_BADGE: Record<GiftKind, { label: string; color: string }> = {
  present: { label: 'Present', color: 'grape' },
  forgiven: { label: 'Forgiven', color: 'teal' },
};

/** The record shape both tabs share; `giftKind` is set on gifts only. */
interface Movement {
  rowIndex: number;
  date: string;
  amountA: string;
  amountB: string;
  notes: string;
  giftKind?: GiftKind;
}

interface Props<TRecord extends Movement, TRow extends number, TForm> {
  kind: MovementKind;
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  items: TRecord[];
  loading: boolean;
  onUpdate: (rowIndex: TRow, data: TForm) => Promise<void>;
  onDelete: (rowIndex: TRow) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;
const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;

/**
 * One list for both transfers and gifts. They were separate components with
 * identical filter, paginate, edit and delete-confirm machinery; the Duplicate
 * button added to expenses never reached either of them, which is exactly the
 * kind of drift two copies invite.
 */
export function MovementList<
  TRecord extends Movement,
  TRow extends number,
  TForm extends TransferFormData | GiftFormData,
>({ kind, names, items, loading, onUpdate, onDelete, onRefresh }: Props<TRecord, TRow, TForm>) {
  const isDark = useComputedColorScheme('light') === 'dark';
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TRecord | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const copy = COPY[kind];
  const sorted = [...items].reverse();

  const filtered = filter
    ? sorted.filter((m) => {
        const q = filter.toLowerCase();
        const from = nameOf(names, movementFrom(m)).toLowerCase();
        const to = nameOf(names, otherPerson(movementFrom(m))).toLowerCase();
        const kindLabel = m.giftKind ? GIFT_KIND_BADGE[m.giftKind].label.toLowerCase() : '';
        return (
          m.date.includes(filter) ||
          from.includes(q) ||
          to.includes(q) ||
          kindLabel.includes(q) ||
          m.notes.toLowerCase().includes(q)
        );
      })
    : sorted;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingRow(confirmDelete.rowIndex);
    const target = confirmDelete.rowIndex as TRow;
    setConfirmDelete(null);
    setDeleteError(null);
    try {
      await onDelete(target);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : `Failed to delete ${copy.one}`);
    } finally {
      setDeletingRow(null);
    }
  };

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder={copy.search}
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
        Showing {paged.length} of {filtered.length} {copy.many}
      </Text>

      <Table.ScrollContainer minWidth={480}>
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
              <Table.Th style={NOWRAP}>Date</Table.Th>
              <Table.Th>{copy.column}</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th w={80}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paged.map((m) => {
              const from = nameOf(names, movementFrom(m));
              const to = nameOf(names, otherPerson(movementFrom(m)));
              const ambiguous = hasAmbiguousDirection(m);

              if (editingRow === m.rowIndex) {
                return (
                  <Table.Tr key={m.rowIndex}>
                    <Table.Td colSpan={5} bg="var(--mantine-color-default-hover)">
                      {ambiguous && (
                        <Alert
                          color="orange"
                          variant="light"
                          icon={<IconAlertTriangle size={16} />}
                          mb="sm"
                        >
                          This row has amounts in both columns ({m.amountA} and {m.amountB}), so its
                          direction is ambiguous. Saving keeps only {from}&apos;s{' '}
                          {movementAmount(m)} and clears the other. Fix the row in the sheet if that
                          is not what you want.
                        </Alert>
                      )}
                      <MovementForm<TForm>
                        kind={kind}
                        names={names}
                        initial={
                          {
                            ...movementToFormData(m),
                            ...(m.giftKind ? { giftKind: m.giftKind } : {}),
                          } as TForm
                        }
                        submitLabel="Save"
                        onSubmit={async (data) => {
                          await onUpdate(m.rowIndex as TRow, data);
                          setEditingRow(null);
                        }}
                        onCancel={() => setEditingRow(null)}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              }

              return (
                <Table.Tr key={m.rowIndex}>
                  <Table.Td style={NOWRAP}>{m.date}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <span>
                        {from} → {to}
                      </span>
                      {m.giftKind && (
                        <Badge color={GIFT_KIND_BADGE[m.giftKind].color} variant="filled" size="sm">
                          {GIFT_KIND_BADGE[m.giftKind].label}
                        </Badge>
                      )}
                      {ambiguous && (
                        <IconAlertTriangle
                          size={16}
                          color="var(--mantine-color-orange-6)"
                          role="img"
                          aria-label="Ambiguous direction — this row has amounts in both columns"
                        />
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" style={TABULAR}>
                    {movementAmount(m)}
                  </Table.Td>
                  <Table.Td>{m.notes}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setEditingRow(m.rowIndex)}
                        title="Edit"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setConfirmDelete(m)}
                        title="Delete"
                        disabled={deletingRow === m.rowIndex}
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
      </Table.ScrollContainer>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination total={totalPages} value={page + 1} onChange={(p) => setPage(p - 1)} />
        </Group>
      )}

      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${copy.one}?`}
      >
        {confirmDelete && (
          <Stack gap="md">
            <Text>
              <Text span fw={600}>
                {confirmDelete.date}
              </Text>{' '}
              — {nameOf(names, movementFrom(confirmDelete))} →{' '}
              {nameOf(names, otherPerson(movementFrom(confirmDelete)))}{' '}
              {movementAmount(confirmDelete)}
              {confirmDelete.giftKind &&
                ` (${GIFT_KIND_BADGE[confirmDelete.giftKind].label.toLowerCase()})`}
            </Text>
            {confirmDelete.giftKind === 'forgiven' && (
              <Text size="sm">
                This one moves the balance: deleting it puts {movementAmount(confirmDelete)} back
                onto what {nameOf(names, otherPerson(movementFrom(confirmDelete)))} owes.
              </Text>
            )}
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

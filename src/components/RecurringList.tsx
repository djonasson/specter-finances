import { useState } from 'react';
import {
  useComputedColorScheme,
  Group,
  Button,
  Text,
  Table,
  ActionIcon,
  Modal,
  Stack,
  Alert,
  Badge,
  Box,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconAlertTriangle,
  IconPlus,
} from '@tabler/icons-react';
import type { RecurringRule, RecurringFormData, RecurringRow } from '../types/recurring';
import type { PersonNames } from '../types/person';
import { RecurringForm } from './RecurringForm';
import { CategoryIcon } from './CategoryIcon';
import { nextDueDate } from '../services/recurring';
import { today, recurringToFormData } from '../services/utils';

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  rules: RecurringRule[];
  loading: boolean;
  /** The tab has not been created yet. */
  tabMissing: boolean;
  /** How many months are waiting to be confirmed. */
  dueCount: number;
  onUpdate: (rowIndex: RecurringRow, data: RecurringFormData, id: string) => Promise<void>;
  onDelete: (rowIndex: RecurringRow) => Promise<void>;
  onAssignId: (rowIndex: RecurringRow) => Promise<void>;
  onSetUp: () => Promise<void>;
  onGenerate: () => void;
  onRefresh: () => void;
}

const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;
const NOWRAP = { whiteSpace: 'nowrap' } as const;

export function RecurringList({
  names,
  rules,
  loading,
  tabMissing,
  dueCount,
  onUpdate,
  onDelete,
  onAssignId,
  onSetUp,
  onGenerate,
  onRefresh,
}: Props) {
  const isDark = useComputedColorScheme('light') === 'dark';
  // Rules someone typed straight into the spreadsheet, so nothing generated from
  // them could be traced back. Worked out once — four places ask.
  const unidentified = rules.filter((r) => !r.id);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RecurringRule | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingRow(confirmDelete.rowIndex);
    setConfirmDelete(null);
    setActionError(null);
    try {
      await onDelete(confirmDelete.rowIndex);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete recurring payment');
    } finally {
      setDeletingRow(null);
    }
  };

  const handleSetUp = async () => {
    setSettingUp(true);
    setActionError(null);
    try {
      await onSetUp();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create the Recurring tab');
    } finally {
      setSettingUp(false);
    }
  };

  if (tabMissing) {
    return (
      <Stack gap="md">
        {actionError && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            withCloseButton
            onClose={() => setActionError(null)}
          >
            {actionError}
          </Alert>
        )}
        <Text>
          Recurring payments — a phone bill, a subscription, a gym — are kept on their own tab in
          the spreadsheet, and this spreadsheet does not have one yet. Creating it adds a{' '}
          <Text span fw={600}>
            Recurring
          </Text>{' '}
          tab and labels column G of the expenses tab, where each created expense records which
          payment it came from. Nothing else on the sheet is touched.
        </Text>
        <Group>
          <Button leftSection={<IconPlus size={16} />} loading={settingUp} onClick={handleSetUp}>
            Create the Recurring tab
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group>
        <Text style={{ flex: 1 }}>
          {dueCount > 0
            ? `${dueCount} ${dueCount === 1 ? 'payment is' : 'payments are'} waiting to be added`
            : 'Every payment up to this month has been added'}
        </Text>
        {dueCount > 0 && <Button onClick={onGenerate}>Add {dueCount} due</Button>}
        <Button variant="light" loading={loading} onClick={onRefresh}>
          Refresh
        </Button>
      </Group>

      {actionError && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          withCloseButton
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      )}

      {rules.length === 0 ? (
        <Text>
          No recurring payments yet. Add one and this app will offer to create its expense each
          month — including any month you were not here for.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={620}>
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
                <Table.Th w={70}>Day</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th w={110} ta="right">
                  {names.a}
                </Table.Th>
                <Table.Th w={110} ta="right">
                  {names.b}
                </Table.Th>
                <Table.Th w={110}>Category</Table.Th>
                <Table.Th w={120} style={NOWRAP}>
                  Next due
                </Table.Th>
                <Table.Th w={80}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((rule) =>
                editingRow === rule.rowIndex ? (
                  <Table.Tr key={rule.rowIndex}>
                    <Table.Td colSpan={7} bg="var(--mantine-color-default-hover)">
                      <RecurringForm
                        names={names}
                        initial={recurringToFormData(rule)}
                        submitLabel="Save"
                        onSubmit={async (data) => {
                          await onUpdate(rule.rowIndex, data, rule.id);
                          setEditingRow(null);
                        }}
                        onCancel={() => setEditingRow(null)}
                      />
                      <Text size="sm" mt="sm">
                        Changing this only affects future months. The expenses it has already
                        created record what was actually paid and stay as they are.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  <Table.Tr key={rule.rowIndex}>
                    <Table.Td style={TABULAR}>{rule.day}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <span>{rule.item}</span>
                        {!rule.id && (
                          <Badge
                            color="orange"
                            variant="filled"
                            size="sm"
                            leftSection={<IconAlertTriangle size={12} />}
                          >
                            No id
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right" style={TABULAR}>
                      {rule.amountA}
                    </Table.Td>
                    <Table.Td ta="right" style={TABULAR}>
                      {rule.amountB}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <CategoryIcon category={rule.category} size={16} />
                        {rule.category}
                      </Group>
                    </Table.Td>
                    <Table.Td style={NOWRAP}>{rule.id ? nextDueDate(rule, today()) : '—'}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => setEditingRow(rule.rowIndex)}
                          title="Edit"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setConfirmDelete(rule)}
                          title="Delete"
                          disabled={deletingRow === rule.rowIndex}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ),
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {unidentified.length > 0 && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
          <Stack gap="xs">
            <Text>
              A payment added by hand in the spreadsheet has no id, so an expense created from it
              could not be traced back — and would be created again every month. Nothing is created
              from it until it has one.
            </Text>
            <Box>
              {unidentified.map((r) => (
                <Button
                  key={r.rowIndex}
                  size="xs"
                  variant="light"
                  mr="xs"
                  onClick={() => onAssignId(r.rowIndex)}
                >
                  Give “{r.item || `row ${r.rowIndex}`}” an id
                </Button>
              ))}
            </Box>
          </Stack>
        </Alert>
      )}

      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete recurring payment?"
      >
        {confirmDelete && (
          <Stack gap="md">
            <Text>
              <Text span fw={600}>
                {confirmDelete.item}
              </Text>
              {confirmDelete.amountA && ` (${names.a}: ${confirmDelete.amountA})`}
              {confirmDelete.amountB && ` (${names.b}: ${confirmDelete.amountB})`}
            </Text>
            <Text>
              No further expenses will be created from it. The expenses it has already created are
              kept — that money was really spent, and deleting them would change what one of them
              owes the other.
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

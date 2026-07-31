import { useState, useMemo } from 'react';
import {
  Group,
  Button,
  Paper,
  Select,
  SimpleGrid,
  Card,
  Title,
  Table,
  Text,
  Stack,
  UnstyledButton,
  VisuallyHidden,
  useComputedColorScheme,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import type { Expense } from '../types/expense';
import type { Transfer } from '../types/transfer';
import type { PersonNames } from '../types/person';
import type { Gift } from '../types/gift';
import { CategoryIcon } from './CategoryIcon';
import {
  getAvailableYears,
  dateInputValue,
  fmt,
  fmtSigned,
  filterByDate,
  aggregateExpenses,
  calculateBalance,
  monthlyBars,
} from '../services/utils';
import type { FilterMode } from '../services/utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTitle, Tooltip, Legend);

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  expenses: Expense[];
  transfers: Transfer[];
  gifts: Gift[];
}

// Pie chart palette — picked for readability on both light and dark backgrounds
const COLORS_LIGHT = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];
const COLORS_DARK = [
  '#6fa0d6',
  '#f5a54b',
  '#f07b7b',
  '#8ed4cc',
  '#72c474',
  '#f5dd6b',
  '#cfa0cc',
  '#ffb8c0',
  '#c4a07a',
  '#d4ccc8',
];

/**
 * A filter button that expands into an inline control when active. The "By
 * Year" and "Custom" chips were two copies of this Paper/Button/border-style
 * block, so a tweak to the active-chip styling had to be made twice.
 */
function FilterChip({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Paper
      withBorder={active}
      radius="md"
      style={
        active
          ? {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              paddingRight: 8,
              borderColor: 'var(--mantine-primary-color-filled)',
            }
          : { display: 'inline-flex' }
      }
    >
      <Button
        size="sm"
        variant={active ? 'filled' : 'default'}
        onClick={onClick}
        radius={active ? 'md 0 0 md' : 'md'}
      >
        {label}
      </Button>
      {active && children}
    </Paper>
  );
}

export function Dashboard({ names, expenses, transfers, gifts }: Props) {
  const colorScheme = useComputedColorScheme('light');
  const isDark = colorScheme === 'dark';
  const chartText = isDark ? '#c1c2c5' : '#495057';
  const chartGrid = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const pieColors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const colorA = isDark ? '#6fa0d6' : '#4e79a7';
  const colorB = isDark ? '#f07b7b' : '#e15759';

  const [mode, setMode] = useState<FilterMode>('all');
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  type SortCol = 'category' | 'a' | 'b' | 'total';
  const [sortCol, setSortCol] = useState<SortCol>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc((a) => !a);
    } else {
      setSortCol(col);
      setSortAsc(col === 'category'); // alphabetical ascending by default, amounts descending
    }
  };

  // Screen readers get sort state from aria-sort; the icon alone conveys it
  // only visually.
  const ariaSort = (col: SortCol): 'ascending' | 'descending' | 'none' =>
    sortCol === col ? (sortAsc ? 'ascending' : 'descending') : 'none';

  const sortIcon = (col: SortCol) =>
    sortCol === col ? (
      sortAsc ? (
        <IconArrowUp size={14} />
      ) : (
        <IconArrowDown size={14} />
      )
    ) : (
      <IconArrowsSort size={14} style={{ opacity: 0.5 }} />
    );

  const availableYears = useMemo(() => getAvailableYears(expenses), [expenses]);

  const filterParams = useMemo(
    () => ({
      mode,
      selectedYear,
      customFrom: customFrom ?? '',
      customTo: customTo ?? '',
    }),
    [mode, selectedYear, customFrom, customTo],
  );

  const filtered = useMemo(() => filterByDate(expenses, filterParams), [expenses, filterParams]);

  const filteredTransfers = useMemo(
    () => filterByDate(transfers, filterParams),
    [transfers, filterParams],
  );

  const filteredGifts = useMemo(() => filterByDate(gifts, filterParams), [gifts, filterParams]);

  const { totalA, totalB, byCategory, byMonth } = aggregateExpenses(filtered);
  const { owedToA, owedToB, transferA, transferB, forgivenA, forgivenB, presentA, presentB } =
    calculateBalance(filtered, filteredTransfers, filteredGifts);

  const categoryLabels = Object.keys(byCategory).sort();
  const categoryTotals = categoryLabels.map((c) => byCategory[c].a + byCategory[c].b);

  const pieData = {
    labels: categoryLabels,
    datasets: [
      { data: categoryTotals, backgroundColor: pieColors.slice(0, categoryLabels.length) },
    ],
  };

  const useAverage = mode === 'all' || mode === 'custom';
  const bars = monthlyBars(byMonth, useAverage);
  const barTitle = useAverage ? 'Monthly Spending (Average)' : 'Monthly Spending';
  const { labels: barLabels, a: barDataA, b: barDataB } = bars;

  const barData = {
    labels: barLabels,
    datasets: [
      { label: names.a, data: barDataA, backgroundColor: colorA },
      { label: names.b, data: barDataB, backgroundColor: colorB },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' as const, labels: { color: chartText } } },
    scales: {
      x: { stacked: true, ticks: { color: chartText }, grid: { color: chartGrid } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: chartText },
        grid: { color: chartGrid },
      },
    },
  };

  return (
    <Stack gap="lg">
      <Group wrap="wrap" gap="xs">
        <Button
          size="sm"
          variant={mode === 'all' ? 'filled' : 'default'}
          onClick={() => setMode('all')}
        >
          All Time
        </Button>
        <Button
          size="sm"
          variant={mode === 'last12' ? 'filled' : 'default'}
          onClick={() => setMode('last12')}
        >
          Last 12 Months
        </Button>
        <FilterChip active={mode === 'year'} label="By Year" onClick={() => setMode('year')}>
          <Select
            size="xs"
            w={90}
            value={selectedYear}
            onChange={(val) => setSelectedYear(val ?? String(new Date().getFullYear()))}
            data={availableYears.map(String)}
            allowDeselect={false}
            variant="unstyled"
            styles={{ input: { fontWeight: 500 } }}
          />
        </FilterChip>
        <FilterChip active={mode === 'custom'} label="Custom" onClick={() => setMode('custom')}>
          <DateInput
            size="xs"
            placeholder="From"
            value={customFrom}
            onChange={(d) => setCustomFrom(dateInputValue(d))}
            clearable
            valueFormat="YYYY-MM-DD"
            variant="unstyled"
            w={120}
          />
          <Text size="xs">—</Text>
          <DateInput
            size="xs"
            placeholder="To"
            value={customTo}
            onChange={(d) => setCustomTo(dateInputValue(d))}
            clearable
            valueFormat="YYYY-MM-DD"
            variant="unstyled"
            w={120}
          />
        </FilterChip>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder>
          <Title order={4} mb="md">
            Spending by Person
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                <Table.Th ta="right">{names.a}</Table.Th>
                <Table.Th ta="right">{names.b}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Expenses</Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  €{fmt(totalA)}
                </Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  €{fmt(totalB)}
                </Table.Td>
              </Table.Tr>
              {(transferA > 0 || transferB > 0) && (
                <Table.Tr>
                  <Table.Td>Transfers</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {transferA > 0 ? `€${fmt(transferA)}` : '—'}
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {transferB > 0 ? `€${fmt(transferB)}` : '—'}
                  </Table.Td>
                </Table.Tr>
              )}
              {/* Two rows, because only one of them is in the Balance below:
                  presents sit outside the shared pot, forgiveness moves it. */}
              {(presentA > 0 || presentB > 0) && (
                <Table.Tr>
                  <Table.Td>Gifts</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {presentA > 0 ? `€${fmt(presentA)}` : '—'}
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {presentB > 0 ? `€${fmt(presentB)}` : '—'}
                  </Table.Td>
                </Table.Tr>
              )}
              {(forgivenA > 0 || forgivenB > 0) && (
                <Table.Tr>
                  <Table.Td>Forgiven</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {forgivenA > 0 ? `€${fmt(forgivenA)}` : '—'}
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {forgivenB > 0 ? `€${fmt(forgivenB)}` : '—'}
                  </Table.Td>
                </Table.Tr>
              )}
              <Table.Tr style={{ borderTop: '2px solid var(--mantine-color-default-border)' }}>
                <Table.Td fw={600}>Balance</Table.Td>
                <Table.Td ta="right" fw={600}>
                  <Text
                    span
                    c={owedToA >= 0 ? 'green' : 'red'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtSigned(owedToA)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  <Text
                    span
                    c={owedToB >= 0 ? 'green' : 'red'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtSigned(owedToB)}
                  </Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Total expenses</Table.Td>
                <Table.Td
                  ta="right"
                  fw={600}
                  colSpan={2}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  €{fmt(totalA + totalB)}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Spending by Category
          </Title>
          <div style={{ maxHeight: 300 }}>
            <Pie
              data={pieData}
              options={{
                plugins: {
                  legend: { position: 'right', labels: { color: chartText } },
                  tooltip: { titleColor: '#fff', bodyColor: '#fff' },
                },
                maintainAspectRatio: false,
              }}
            />
          </div>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder>
          <Title order={4} mb="md">
            {barTitle}
          </Title>
          <div style={{ maxHeight: 300 }}>
            <Bar data={barData} options={{ ...barOptions, maintainAspectRatio: false }} />
          </div>
          {/* A <canvas> is opaque to assistive tech, so the same numbers are
              also available as a table — the category chart has one alongside
              it already. */}
          <VisuallyHidden>
            <table>
              <caption>{barTitle}</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">{names.a}</th>
                  <th scope="col">{names.b}</th>
                </tr>
              </thead>
              <tbody>
                {barLabels.map((label, i) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>€{fmt(barDataA[i] ?? 0)}</td>
                    <td>€{fmt(barDataB[i] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </VisuallyHidden>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">
            Category Breakdown
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th aria-sort={ariaSort('category')}>
                  <UnstyledButton
                    onClick={() => toggleSort('category')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Category {sortIcon('category')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right" aria-sort={ariaSort('a')}>
                  <UnstyledButton
                    onClick={() => toggleSort('a')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                  >
                    {names.a} {sortIcon('a')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right" aria-sort={ariaSort('b')}>
                  <UnstyledButton
                    onClick={() => toggleSort('b')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                  >
                    {names.b} {sortIcon('b')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right" aria-sort={ariaSort('total')}>
                  <UnstyledButton
                    onClick={() => toggleSort('total')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                  >
                    Total {sortIcon('total')}
                  </UnstyledButton>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...categoryLabels]
                .sort((a, b) => {
                  let cmp: number;
                  switch (sortCol) {
                    case 'category':
                      cmp = a.localeCompare(b);
                      break;
                    case 'a':
                      cmp = byCategory[a].a - byCategory[b].a;
                      break;
                    case 'b':
                      cmp = byCategory[a].b - byCategory[b].b;
                      break;
                    case 'total':
                      cmp = byCategory[a].a + byCategory[a].b - (byCategory[b].a + byCategory[b].b);
                      break;
                  }
                  return sortAsc ? cmp : -cmp;
                })
                .map((cat) => (
                  <Table.Tr key={cat}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <CategoryIcon category={cat} size={16} />
                        {cat}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      €{fmt(byCategory[cat].a)}
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      €{fmt(byCategory[cat].b)}
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      €{fmt(byCategory[cat].a + byCategory[cat].b)}
                    </Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

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
import { CategoryIcon } from './CategoryIcon';
import {
  getAvailableYears,
  fromDate,
  fmt,
  filterByDate,
  aggregateExpenses,
  calculateBalance,
} from '../services/utils';
import type { FilterMode } from '../services/utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTitle, Tooltip, Legend);

interface Props {
  expenses: Expense[];
  transfers: Transfer[];
}

// Pie chart palette — picked for readability on both light and dark backgrounds
const COLORS_LIGHT = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];
const COLORS_DARK = [
  '#6fa0d6', '#f5a54b', '#f07b7b', '#8ed4cc', '#72c474',
  '#f5dd6b', '#cfa0cc', '#ffb8c0', '#c4a07a', '#d4ccc8',
];

export function Dashboard({ expenses, transfers }: Props) {
  const colorScheme = useComputedColorScheme('light');
  const isDark = colorScheme === 'dark';
  const chartText = isDark ? '#c1c2c5' : '#495057';
  const chartGrid = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const pieColors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const danielColor = isDark ? '#6fa0d6' : '#4e79a7';
  const manuelaColor = isDark ? '#f07b7b' : '#e15759';

  const [mode, setMode] = useState<FilterMode>('all');
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  type SortCol = 'category' | 'daniel' | 'manuela' | 'total';
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

  const sortIcon = (col: SortCol) =>
    sortCol === col
      ? sortAsc ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />
      : <IconArrowsSort size={14} style={{ opacity: 0.5 }} />;

  const availableYears = useMemo(() => getAvailableYears(expenses), [expenses]);

  const filterParams = useMemo(() => ({
    mode,
    selectedYear,
    customFrom: fromDate(customFrom),
    customTo: fromDate(customTo),
  }), [mode, selectedYear, customFrom, customTo]);

  const filtered = useMemo(
    () => filterByDate(expenses, filterParams),
    [expenses, filterParams],
  );

  const filteredTransfers = useMemo(
    () => filterByDate(transfers, filterParams),
    [transfers, filterParams],
  );

  const { totalDaniel, totalManuela, byCategory, byMonth } = aggregateExpenses(filtered);
  const { adjustedDeltaDaniel, adjustedDeltaManuela, netTransfer } = calculateBalance(filtered, filteredTransfers);

  const categoryLabels = Object.keys(byCategory).sort();
  const categoryTotals = categoryLabels.map(
    (c) => byCategory[c].daniel + byCategory[c].manuela
  );

  const pieData = {
    labels: categoryLabels,
    datasets: [{ data: categoryTotals, backgroundColor: pieColors.slice(0, categoryLabels.length) }],
  };

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let barLabels: string[];
  let barDanielData: number[];
  let barManuelaData: number[];
  let barTitle: string;

  const useAverage = mode === 'all' || mode === 'custom';

  if (useAverage) {
    const monthTotals = Array.from({ length: 12 }, () => ({ daniel: 0, manuela: 0 }));
    const yearCountPerMonth = Array(12).fill(0);
    const seen = new Set<string>();

    for (const [key, val] of Object.entries(byMonth)) {
      const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        monthTotals[monthIdx].daniel += val.daniel;
        monthTotals[monthIdx].manuela += val.manuela;
        seen.add(key);
      }
    }
    for (const key of seen) {
      const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
      yearCountPerMonth[monthIdx]++;
    }

    barLabels = MONTH_NAMES;
    barDanielData = monthTotals.map((t, i) => yearCountPerMonth[i] ? t.daniel / yearCountPerMonth[i] : 0);
    barManuelaData = monthTotals.map((t, i) => yearCountPerMonth[i] ? t.manuela / yearCountPerMonth[i] : 0);
    barTitle = 'Monthly Spending (Average)';
  } else {
    const ml = Object.keys(byMonth).sort();
    barLabels = ml;
    barDanielData = ml.map((m) => byMonth[m]?.daniel ?? 0);
    barManuelaData = ml.map((m) => byMonth[m]?.manuela ?? 0);
    barTitle = 'Monthly Spending';
  }

  const barData = {
    labels: barLabels,
    datasets: [
      { label: 'Daniel', data: barDanielData, backgroundColor: danielColor },
      { label: 'Manuela', data: barManuelaData, backgroundColor: manuelaColor },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' as const, labels: { color: chartText } } },
    scales: {
      x: { stacked: true, ticks: { color: chartText }, grid: { color: chartGrid } },
      y: { stacked: true, beginAtZero: true, ticks: { color: chartText }, grid: { color: chartGrid } },
    },
  };

  return (
    <Stack gap="lg">
      <Group wrap="wrap" gap="xs">
        <Button size="sm" variant={mode === 'all' ? 'filled' : 'default'} onClick={() => setMode('all')}>
          All Time
        </Button>
        <Button size="sm" variant={mode === 'last12' ? 'filled' : 'default'} onClick={() => setMode('last12')}>
          Last 12 Months
        </Button>
        <Paper
          withBorder={mode === 'year'}
          radius="md"
          style={mode === 'year' ? {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            paddingRight: 8,
            borderColor: 'var(--mantine-primary-color-filled)',
          } : { display: 'inline-flex' }}
        >
          <Button size="sm" variant={mode === 'year' ? 'filled' : 'default'} onClick={() => setMode('year')}
            radius={mode === 'year' ? 'md 0 0 md' : 'md'}
          >
            By Year
          </Button>
          {mode === 'year' && (
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
          )}
        </Paper>
        <Paper
          withBorder={mode === 'custom'}
          radius="md"
          style={mode === 'custom' ? {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            paddingRight: 8,
            borderColor: 'var(--mantine-primary-color-filled)',
          } : { display: 'inline-flex' }}
        >
          <Button size="sm" variant={mode === 'custom' ? 'filled' : 'default'} onClick={() => setMode('custom')}
            radius={mode === 'custom' ? 'md 0 0 md' : 'md'}
          >
            Custom
          </Button>
          {mode === 'custom' && (
            <>
              <DateInput
                size="xs"
                placeholder="From"
                value={customFrom}
                onChange={(d) => setCustomFrom(d as Date | null)}
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
                onChange={(d) => setCustomTo(d as Date | null)}
                clearable
                valueFormat="YYYY-MM-DD"
                variant="unstyled"
                w={120}
              />
            </>
          )}
        </Paper>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder>
          <Title order={4} mb="md">Spending by Person</Title>
          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Daniel</Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(totalDaniel)}</Table.Td>
                <Table.Td ta="right">
                  <Text span c={adjustedDeltaDaniel >= 0 ? 'green' : 'red'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {adjustedDeltaDaniel >= 0 ? '+' : ''}€{fmt(adjustedDeltaDaniel)}
                  </Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Manuela</Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(totalManuela)}</Table.Td>
                <Table.Td ta="right">
                  <Text span c={adjustedDeltaManuela >= 0 ? 'green' : 'red'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {adjustedDeltaManuela >= 0 ? '+' : ''}€{fmt(adjustedDeltaManuela)}
                  </Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr style={{ borderTop: '2px solid var(--mantine-color-default-border)' }}>
                <Table.Td fw={600}>Total</Table.Td>
                <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(totalDaniel + totalManuela)}</Table.Td>
                <Table.Td />
              </Table.Tr>
              {netTransfer !== 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text size="sm" ta="center">
                      Transfers: {netTransfer > 0 ? 'Daniel → Manuela' : 'Manuela → Daniel'} €{fmt(Math.abs(netTransfer))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">Spending by Category</Title>
          <div style={{ maxHeight: 300 }}>
            <Pie data={pieData} options={{
              plugins: {
                legend: { position: 'right', labels: { color: chartText } },
                tooltip: { titleColor: '#fff', bodyColor: '#fff' },
              },
              maintainAspectRatio: false,
            }} />
          </div>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder>
          <Title order={4} mb="md">{barTitle}</Title>
          <div style={{ maxHeight: 300 }}>
            <Bar data={barData} options={{ ...barOptions, maintainAspectRatio: false }} />
          </div>
        </Card>

        <Card withBorder>
          <Title order={4} mb="md">Category Breakdown</Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <UnstyledButton onClick={() => toggleSort('category')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Category {sortIcon('category')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right">
                  <UnstyledButton onClick={() => toggleSort('daniel')} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    Daniel {sortIcon('daniel')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right">
                  <UnstyledButton onClick={() => toggleSort('manuela')} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    Manuela {sortIcon('manuela')}
                  </UnstyledButton>
                </Table.Th>
                <Table.Th ta="right">
                  <UnstyledButton onClick={() => toggleSort('total')} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    Total {sortIcon('total')}
                  </UnstyledButton>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...categoryLabels].sort((a, b) => {
                let cmp: number;
                switch (sortCol) {
                  case 'category':
                    cmp = a.localeCompare(b);
                    break;
                  case 'daniel':
                    cmp = byCategory[a].daniel - byCategory[b].daniel;
                    break;
                  case 'manuela':
                    cmp = byCategory[a].manuela - byCategory[b].manuela;
                    break;
                  case 'total':
                    cmp = (byCategory[a].daniel + byCategory[a].manuela) - (byCategory[b].daniel + byCategory[b].manuela);
                    break;
                }
                return sortAsc ? cmp : -cmp;
              }).map((cat) => (
                <Table.Tr key={cat}>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <CategoryIcon category={cat} size={16} />
                      {cat}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(byCategory[cat].daniel)}</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(byCategory[cat].manuela)}</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>€{fmt(byCategory[cat].daniel + byCategory[cat].manuela)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

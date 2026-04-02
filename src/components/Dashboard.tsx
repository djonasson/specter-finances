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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
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
import { parseAmount } from '../services/sheets';
import { CategoryIcon } from './CategoryIcon';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTitle, Tooltip, Legend);

interface Props {
  expenses: Expense[];
  transfers: Transfer[];
}

type FilterMode = 'all' | 'last12' | 'year' | 'custom';

function toNumber(formatted: string): number {
  const raw = parseAmount(formatted);
  return raw ? parseFloat(raw) : 0;
}

function getAvailableYears(expenses: Expense[]): number[] {
  const years = new Set<number>();
  for (const e of expenses) {
    const y = parseInt(e.date.slice(0, 4), 10);
    if (!isNaN(y)) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

function toDateStr(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export function Dashboard({ expenses, transfers }: Props) {
  const [mode, setMode] = useState<FilterMode>('last12');
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  const availableYears = useMemo(() => getAvailableYears(expenses), [expenses]);

  const filtered = useMemo(() => {
    switch (mode) {
      case 'all':
        return expenses;
      case 'last12': {
        const cutoff = monthsAgo(12);
        return expenses.filter((e) => e.date >= cutoff);
      }
      case 'year':
        return expenses.filter((e) => e.date.startsWith(selectedYear));
      case 'custom': {
        const from = toDateStr(customFrom);
        const to = toDateStr(customTo);
        return expenses.filter((e) => {
          if (from && e.date < from) return false;
          if (to && e.date > to) return false;
          return true;
        });
      }
    }
  }, [expenses, mode, selectedYear, customFrom, customTo]);

  const filteredTransfers = useMemo(() => {
    switch (mode) {
      case 'all':
        return transfers;
      case 'last12': {
        const cutoff = monthsAgo(12);
        return transfers.filter((t) => t.date >= cutoff);
      }
      case 'year':
        return transfers.filter((t) => t.date.startsWith(selectedYear));
      case 'custom': {
        const from = toDateStr(customFrom);
        const to = toDateStr(customTo);
        return transfers.filter((t) => {
          if (from && t.date < from) return false;
          if (to && t.date > to) return false;
          return true;
        });
      }
    }
  }, [transfers, mode, selectedYear, customFrom, customTo]);

  let totalDaniel = 0;
  let totalManuela = 0;
  const byCategory: Record<string, { daniel: number; manuela: number }> = {};
  const byMonth: Record<string, { daniel: number; manuela: number }> = {};

  for (const e of filtered) {
    const d = toNumber(e.amountDaniel);
    const m = toNumber(e.amountManuela);
    totalDaniel += d;
    totalManuela += m;

    const cat = e.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = { daniel: 0, manuela: 0 };
    byCategory[cat].daniel += d;
    byCategory[cat].manuela += m;

    const month = e.date.slice(0, 7);
    if (month) {
      if (!byMonth[month]) byMonth[month] = { daniel: 0, manuela: 0 };
      byMonth[month].daniel += d;
      byMonth[month].manuela += m;
    }
  }

  let transferDaniel = 0;
  let transferManuela = 0;
  for (const t of filteredTransfers) {
    transferDaniel += toNumber(t.amountDaniel);
    transferManuela += toNumber(t.amountManuela);
  }
  // Adjusted delta: spending difference minus transfer difference
  // If Daniel spent more but also transferred money, his surplus shrinks
  const adjustedDeltaDaniel = (totalDaniel - totalManuela) - (transferDaniel - transferManuela);
  const adjustedDeltaManuela = -adjustedDeltaDaniel || 0;
  const netTransfer = transferDaniel - transferManuela;

  const categoryLabels = Object.keys(byCategory).sort();
  const categoryTotals = categoryLabels.map(
    (c) => byCategory[c].daniel + byCategory[c].manuela
  );

  const pieData = {
    labels: categoryLabels,
    datasets: [{ data: categoryTotals, backgroundColor: COLORS.slice(0, categoryLabels.length) }],
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
      { label: 'Daniel', data: barDanielData, backgroundColor: '#4e79a7' },
      { label: 'Manuela', data: barManuelaData, backgroundColor: '#e15759' },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' as const } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
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
              <Text size="xs" c="dimmed">—</Text>
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
                    <Text size="sm" c="dimmed" ta="center">
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
            <Pie data={pieData} options={{ plugins: { legend: { position: 'right' } }, maintainAspectRatio: false }} />
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
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Daniel</Table.Th>
                <Table.Th ta="right">Manuela</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categoryLabels.map((cat) => (
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

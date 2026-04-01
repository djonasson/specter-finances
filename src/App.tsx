import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import logoSvg from '/favicon.svg';
import {
  AppShell,
  Group,
  Button,
  Title,
  Image,
  Center,
  Stack,
  Text,
  Alert,
  Loader,
  ActionIcon,
  UnstyledButton,
  Box,
} from '@mantine/core';
import { IconAlertCircle, IconSettings, IconLayoutDashboard, IconPlus, IconList } from '@tabler/icons-react';
import { useAuth } from './hooks/AuthContext';
import { useExpensesContext } from './hooks/ExpensesContext';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { Dashboard } from './components/Dashboard';
import { ThemeToggle } from './components/ThemeToggle';
import { ThemeSettings } from './components/ThemeSettings';
import { BackgroundEffect } from './theme/backgrounds';
import { InstallButton } from './components/InstallButton';

function BottomNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <UnstyledButton
      component={NavLink}
      to={to}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        padding: '8px 0',
        color: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-dimmed)',
      }}
    >
      {icon}
      <Text size="xs" fw={active ? 600 : 400}>{label}</Text>
    </UnstyledButton>
  );
}

function AuthenticatedApp() {
  const { signOut } = useAuth();
  const { expenses, loading, error, load, add, update, remove } = useExpensesContext();
  const [settingsOpened, setSettingsOpened] = useState(false);
  const location = useLocation();

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Image src={logoSvg} w={28} h={28} />
            <Title order={4}>Specter Finances</Title>
          </Group>
          <Group gap="xs">
            <InstallButton />
            <ThemeToggle />
            <ActionIcon variant="subtle" onClick={() => setSettingsOpened(true)} title="Theme settings">
              <IconSettings size={18} />
            </ActionIcon>
            <Button variant="subtle" size="xs" onClick={signOut}>
              Sign Out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">
            {error}
          </Alert>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <>
                <Title order={2} mb="md">Dashboard</Title>
                {loading ? (
                  <Center py="xl"><Loader /></Center>
                ) : (
                  <Dashboard expenses={expenses} />
                )}
              </>
            }
          />
          <Route
            path="/add"
            element={
              <>
                <Title order={2} mb="md">Add Expense</Title>
                <ExpenseForm onSubmit={add} />
              </>
            }
          />
          <Route
            path="/list"
            element={
              <>
                <Title order={2} mb="md">Expenses</Title>
                <ExpenseList
                  expenses={expenses}
                  loading={loading}
                  onUpdate={update}
                  onDelete={remove}
                  onRefresh={load}
                />
              </>
            }
          />
        </Routes>
      </AppShell.Main>

      <Box pb={60} />

      <Box
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
        }}
      >
        <BottomNavItem to="/" icon={<IconLayoutDashboard size={22} />} label="Dashboard" />
        <BottomNavItem to="/add" icon={<IconPlus size={22} />} label="Add" />
        <BottomNavItem to="/list" icon={<IconList size={22} />} label="List" />
      </Box>

      <BackgroundEffect />
      <ThemeSettings opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
    </AppShell>
  );
}

export default function App() {
  const { authenticated, loading, signIn } = useAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!authenticated) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Image src={logoSvg} w={64} h={64} />
          <Title order={1}>Specter Finances</Title>
          <Text c="dimmed">Shared expense tracker</Text>
          <Button variant="outline" size="lg" onClick={signIn}>
            Sign in with Google
          </Button>
        </Stack>
      </Center>
    );
  }

  return <AuthenticatedApp />;
}

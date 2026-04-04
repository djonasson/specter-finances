import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import logoSvg from '/favicon-squirrel.svg';
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
  Notification,
  Transition,
  Tabs,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconSettings, IconLayoutDashboard, IconPlus, IconList, IconArrowsExchange } from '@tabler/icons-react';
import { useAuth } from './hooks/AuthContext';
import { useExpensesContext } from './hooks/ExpensesContext';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { TransferForm } from './components/TransferForm';
import { TransferList } from './components/TransferList';
import { Dashboard } from './components/Dashboard';
import { ThemeToggle } from './components/ThemeToggle';
import { ThemeSettings } from './components/ThemeSettings';
import { BackgroundEffect } from './theme/backgrounds';
import { useThemeSettings } from './theme/ThemeContext';
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
        color: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-text)',
      }}
    >
      {icon}
      <Text size="xs" fw={active ? 600 : 400}>{label}</Text>
    </UnstyledButton>
  );
}

function AuthenticatedApp() {
  const { backgroundEffect } = useThemeSettings();
  const { signOut } = useAuth();
  const {
    expenses, loading, error, load, add, update, remove,
    transfers, transfersLoading, transfersError, loadTransfers,
    addTransfer, updateTransfer, removeTransfer,
  } = useExpensesContext();
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    load();
    loadTransfers();
  }, [load, loadTransfers, location.pathname]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const addAndRedirect = useCallback(
    async (form: Parameters<typeof add>[0]) => {
      await add(form);
      navigate('/list');
      setSuccessMsg('Expense added');
    },
    [add, navigate],
  );

  const removeWithNotify = useCallback(
    async (rowIndex: number) => {
      await remove(rowIndex);
      setSuccessMsg('Expense deleted');
    },
    [remove],
  );

  const addTransferAndRedirect = useCallback(
    async (form: Parameters<typeof addTransfer>[0]) => {
      await addTransfer(form);
      navigate('/transfers');
      setSuccessMsg('Transfer added');
    },
    [addTransfer, navigate],
  );

  const removeTransferWithNotify = useCallback(
    async (rowIndex: number) => {
      await removeTransfer(rowIndex);
      setSuccessMsg('Transfer deleted');
    },
    [removeTransfer],
  );

  return (
    <>
    <AppShell
      header={{ height: 56 }}
      footer={{ height: 60 }}
      padding="md"
    >
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
        {(error || transfersError) && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">
            {error || transfersError}
          </Alert>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <>
                <Title order={2} mb="md">Dashboard</Title>
                {loading || transfersLoading ? (
                  <Center py="xl"><Loader /></Center>
                ) : (
                  <Dashboard expenses={expenses} transfers={transfers} />
                )}
              </>
            }
          />
          <Route
            path="/add"
            element={
              <>
                <Title order={2} mb="md">Add</Title>
                <Tabs defaultValue="expense">
                  <Tabs.List>
                    <Tabs.Tab value="expense">Expense</Tabs.Tab>
                    <Tabs.Tab value="transfer">Transfer</Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="expense" pt="md">
                    <ExpenseForm onSubmit={addAndRedirect} />
                  </Tabs.Panel>
                  <Tabs.Panel value="transfer" pt="md">
                    <TransferForm onSubmit={addTransferAndRedirect} />
                  </Tabs.Panel>
                </Tabs>
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
                  onDelete={removeWithNotify}
                  onRefresh={load}
                />
              </>
            }
          />
          <Route
            path="/transfers"
            element={
              <>
                <Title order={2} mb="md">Transfers</Title>
                <TransferList
                  transfers={transfers}
                  loading={transfersLoading}
                  onUpdate={updateTransfer}
                  onDelete={removeTransferWithNotify}
                  onRefresh={loadTransfers}
                />
              </>
            }
          />
        </Routes>
        {backgroundEffect === 'squirrel' && <div style={{ height: 100 }} />}
      </AppShell.Main>

      <AppShell.Footer style={{ display: 'flex' }}>
        <BottomNavItem to="/" icon={<IconLayoutDashboard size={22} />} label="Dashboard" />
        <BottomNavItem to="/add" icon={<IconPlus size={22} />} label="Add" />
        <BottomNavItem to="/list" icon={<IconList size={22} />} label="Expenses" />
        <BottomNavItem to="/transfers" icon={<IconArrowsExchange size={22} />} label="Transfers" />
      </AppShell.Footer>

      <Transition mounted={!!successMsg} transition="slide-down" duration={200}>
        {(styles) => (
          <Notification
            icon={<IconCheck size={18} />}
            color="teal"
            title={successMsg}
            onClose={() => setSuccessMsg(null)}
            style={{
              ...styles,
              position: 'fixed',
              top: 68,
              left: '50%',
              transform: `${styles.transform ?? ''} translateX(-50%)`,
              zIndex: 200,
              minWidth: 250,
            }}
          />
        )}
      </Transition>

      <ThemeSettings opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
    </AppShell>
    {backgroundEffect === 'squirrel' && (
      <div style={{
        position: 'fixed',
        bottom: 60,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 100,
        pointerEvents: 'none',
        background: 'var(--mantine-color-body)',
      }} />
    )}
    <BackgroundEffect />
    </>
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
          <Image src={logoSvg} w={128} h={128} />
          <Title order={1}>Specter Finances</Title>
          <Text>Shared expense tracker</Text>
          <Button variant="outline" size="lg" onClick={signIn}>
            Sign in with Google
          </Button>
        </Stack>
      </Center>
    );
  }

  return <AuthenticatedApp />;
}

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
import {
  IconAlertCircle,
  IconCheck,
  IconSettings,
  IconLayoutDashboard,
  IconPlus,
  IconList,
  IconArrowsExchange,
  IconGift,
} from '@tabler/icons-react';
import { useAuth } from './hooks/AuthContext';
import { useExpensesContext } from './hooks/ExpensesContext';
import { getGrantedSheetId, setSheetAccessListener } from './services/sheetAccess';
import { ExpenseForm } from './components/ExpenseForm';
import type { ExpenseFormData, ExpenseRow } from './types/expense';
import { ExpenseList } from './components/ExpenseList';
import type { Transfer, TransferRow, TransferFormData } from './types/transfer';
import type { Gift, GiftRow, GiftFormData } from './types/gift';
import { MovementForm } from './components/MovementForm';
import { MovementList } from './components/MovementList';
import { RecordTypeHelp } from './components/RecordTypeHelp';
import { SheetGate } from './components/SheetGate';
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
      <Text size="xs" fw={active ? 600 : 400}>
        {label}
      </Text>
    </UnstyledButton>
  );
}

function AuthenticatedApp() {
  const { backgroundEffect } = useThemeSettings();
  const { signOut } = useAuth();
  const {
    names,
    expenses,
    loading,
    error,
    load,
    add,
    update,
    remove,
    transfers,
    transfersLoading,
    transfersError,
    loadTransfers,
    addTransfer,
    updateTransfer,
    removeTransfer,
    gifts,
    giftsLoading,
    giftsError,
    loadGifts,
    addGift,
    updateGift,
    removeGift,
  } = useExpensesContext();
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const duplicateExpense = (location.state as { duplicate?: ExpenseFormData } | null)?.duplicate;

  // Deliberately keyed on pathname: the sheet is the source of truth and both
  // of us edit it directly in Google Sheets, so every navigation refetches
  // rather than trusting cached state. Three requests per navigation is
  // nothing against the 60/min per-user quota at this scale.
  useEffect(() => {
    load();
    loadTransfers();
    loadGifts();
  }, [load, loadTransfers, loadGifts, location.pathname]);

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
    async (rowIndex: ExpenseRow) => {
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
    async (rowIndex: TransferRow) => {
      await removeTransfer(rowIndex);
      setSuccessMsg('Transfer deleted');
    },
    [removeTransfer],
  );

  const addGiftAndRedirect = useCallback(
    async (form: Parameters<typeof addGift>[0]) => {
      await addGift(form);
      navigate('/gifts');
      setSuccessMsg('Gift added');
    },
    [addGift, navigate],
  );

  const removeGiftWithNotify = useCallback(
    async (rowIndex: GiftRow) => {
      await removeGift(rowIndex);
      setSuccessMsg('Gift deleted');
    },
    [removeGift],
  );

  return (
    <>
      <AppShell header={{ height: 56 }} footer={{ height: 60 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="xs">
              <Image src={logoSvg} w={28} h={28} />
              <Title order={4}>Specter Finances</Title>
            </Group>
            <Group gap="xs">
              <InstallButton />
              <ThemeToggle />
              <ActionIcon
                variant="subtle"
                onClick={() => setSettingsOpened(true)}
                title="Theme settings"
              >
                <IconSettings size={18} />
              </ActionIcon>
              <Button variant="subtle" size="xs" onClick={signOut}>
                Sign Out
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          {(error || transfersError || giftsError) && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">
              {error || transfersError || giftsError}
            </Alert>
          )}

          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Title order={2} mb="md">
                    Dashboard
                  </Title>
                  {loading || transfersLoading || giftsLoading ? (
                    <Center py="xl">
                      <Loader />
                    </Center>
                  ) : (
                    <Dashboard
                      names={names}
                      expenses={expenses}
                      transfers={transfers}
                      gifts={gifts}
                    />
                  )}
                </>
              }
            />
            <Route
              path="/add"
              element={
                <>
                  <Title order={2} mb="md">
                    Add
                  </Title>
                  <Tabs defaultValue="expense">
                    <Tabs.List>
                      <Tabs.Tab value="expense">Expense</Tabs.Tab>
                      <Tabs.Tab value="transfer">Transfer</Tabs.Tab>
                      <Tabs.Tab value="gift">Gift</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="expense" pt="md">
                      <RecordTypeHelp kind="expense" names={names} />
                      <ExpenseForm
                        names={names}
                        onSubmit={addAndRedirect}
                        initial={duplicateExpense}
                      />
                    </Tabs.Panel>
                    <Tabs.Panel value="transfer" pt="md">
                      <RecordTypeHelp kind="transfer" names={names} />
                      <MovementForm<TransferFormData>
                        kind="transfer"
                        names={names}
                        onSubmit={addTransferAndRedirect}
                      />
                    </Tabs.Panel>
                    <Tabs.Panel value="gift" pt="md">
                      <RecordTypeHelp kind="gift" names={names} />
                      <MovementForm<GiftFormData>
                        kind="gift"
                        names={names}
                        onSubmit={addGiftAndRedirect}
                      />
                    </Tabs.Panel>
                  </Tabs>
                </>
              }
            />
            <Route
              path="/list"
              element={
                <>
                  <Title order={2} mb="md">
                    Expenses
                  </Title>
                  <ExpenseList
                    names={names}
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
                  <Title order={2} mb="md">
                    Transfers
                  </Title>
                  <MovementList<Transfer, TransferRow, TransferFormData>
                    kind="transfer"
                    names={names}
                    items={transfers}
                    loading={transfersLoading}
                    onUpdate={updateTransfer}
                    onDelete={removeTransferWithNotify}
                    onRefresh={loadTransfers}
                  />
                </>
              }
            />
            <Route
              path="/gifts"
              element={
                <>
                  <Title order={2} mb="md">
                    Gifts
                  </Title>
                  <MovementList<Gift, GiftRow, GiftFormData>
                    kind="gift"
                    names={names}
                    items={gifts}
                    loading={giftsLoading}
                    onUpdate={updateGift}
                    onDelete={removeGiftWithNotify}
                    onRefresh={loadGifts}
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
          <BottomNavItem
            to="/transfers"
            icon={<IconArrowsExchange size={22} />}
            label="Transfers"
          />
          <BottomNavItem to="/gifts" icon={<IconGift size={22} />} label="Gifts" />
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
        <div
          style={{
            position: 'fixed',
            bottom: 60,
            left: 0,
            right: 0,
            height: 80,
            zIndex: 100,
            pointerEvents: 'none',
            background: 'var(--mantine-color-body)',
          }}
        />
      )}
      <BackgroundEffect />
    </>
  );
}

export default function App() {
  const { authenticated, loading, signIn } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [grantedSheet, setGrantedSheet] = useState<string | null>(getGrantedSheetId);
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);

  // sheets.ts drops the grant when the API says the sheet is unreachable; this
  // brings us back to the picker instead of failing every request.
  useEffect(() => {
    setSheetAccessListener((sheetId, reason) => {
      setGrantedSheet(sheetId);
      setSheetNotice(reason ?? null);
    });
    return () => setSheetAccessListener(null);
  }, []);

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
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              // signIn throws if the Google script never loaded; without this
              // the button is simply dead with no explanation.
              try {
                setSignInError(null);
                signIn();
              } catch {
                setSignInError(
                  "Couldn't reach Google to sign in. Check your connection and reload.",
                );
              }
            }}
          >
            Sign in with Google
          </Button>
          {signInError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} maw={360}>
              {signInError}
            </Alert>
          )}
        </Stack>
      </Center>
    );
  }

  if (!grantedSheet) {
    return (
      <SheetGate
        notice={sheetNotice}
        onPicked={(id) => {
          setSheetNotice(null);
          setGrantedSheet(id);
        }}
      />
    );
  }

  return <AuthenticatedApp />;
}

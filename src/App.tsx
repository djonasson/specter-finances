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
import { ExpensesPage } from './components/ExpensesPage';
import { RecurringForm } from './components/RecurringForm';
import { RecurringPrompt } from './components/RecurringPrompt';
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
import { BackgroundSpacer } from './theme/BackgroundStage';
import { FOOTER_HEIGHT } from './theme/chrome';
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
  const { signOut } = useAuth();
  const { names, expenses, transfers, gifts, recurring, pending } = useExpensesContext();
  // Pulled out as locals because the dependency arrays below have to name these
  // directly. Each is a stable useCallback, whereas the domain object holding
  // them is rebuilt on every provider render — naming the object in the refetch
  // effect would make it refetch forever.
  const { load: loadExpenses, add: addExpense, remove: removeExpense } = expenses;
  const { load: loadTransfers, add: addTransfer, remove: removeTransfer } = transfers;
  const { load: loadGifts, add: addGift, remove: removeGift } = gifts;
  const { load: loadRecurring, add: addRecurringRule } = recurring;
  const { generate: generatePending } = pending;
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const duplicateExpense = (location.state as { duplicate?: ExpenseFormData } | null)?.duplicate;

  // Deliberately keyed on pathname: the sheet is the source of truth and both
  // of us edit it directly in Google Sheets, so every navigation refetches
  // rather than trusting cached state. Four requests per navigation is
  // nothing against the 60/min per-user quota at this scale.
  useEffect(() => {
    loadExpenses();
    loadTransfers();
    loadGifts();
    loadRecurring();
  }, [loadExpenses, loadTransfers, loadGifts, loadRecurring, location.pathname]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const addAndRedirect = useCallback(
    async (form: Parameters<typeof addExpense>[0]) => {
      await addExpense(form);
      navigate('/list');
      setSuccessMsg('Expense added');
    },
    [addExpense, navigate],
  );

  const removeWithNotify = useCallback(
    async (rowIndex: ExpenseRow) => {
      await removeExpense(rowIndex);
      setSuccessMsg('Expense deleted');
    },
    [removeExpense],
  );

  const addRecurringAndRedirect = useCallback(
    async (form: Parameters<typeof addRecurringRule>[0]) => {
      await addRecurringRule(form);
      navigate('/list?tab=recurring');
      setSuccessMsg('Recurring payment added');
    },
    [addRecurringRule, navigate],
  );

  const confirmRecurring = useCallback(
    async (rows: Parameters<typeof generatePending>[0]) => {
      // The count comes back from the write, not from what was offered: a
      // month the other device generated while the modal sat open is dropped.
      const added = await generatePending(rows);
      setSuccessMsg(
        added === 0
          ? 'Those months were already on the sheet'
          : `${added} recurring ${added === 1 ? 'expense' : 'expenses'} added`,
      );
    },
    [generatePending],
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
      <AppShell header={{ height: 56 }} footer={{ height: FOOTER_HEIGHT }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="xs">
              <Image src={logoSvg} w={28} h={28} />
              <Title order={4}>Specter Finances</Title>
            </Group>
            <Group gap="xs">
              <InstallButton />
              <ThemeToggle />
              <ActionIcon variant="subtle" onClick={() => setSettingsOpened(true)} title="Settings">
                <IconSettings size={18} />
              </ActionIcon>
              <Button variant="subtle" size="xs" onClick={signOut}>
                Sign Out
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          {(expenses.error || transfers.error || gifts.error || recurring.error) && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">
              {expenses.error || transfers.error || gifts.error || recurring.error}
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
                  {expenses.loading || transfers.loading || gifts.loading ? (
                    <Center py="xl">
                      <Loader />
                    </Center>
                  ) : (
                    <Dashboard
                      names={names}
                      expenses={expenses.items}
                      transfers={transfers.items}
                      gifts={gifts.items}
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
                      <Tabs.Tab value="recurring">Recurring</Tabs.Tab>
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
                    <Tabs.Panel value="recurring" pt="md">
                      <RecurringForm names={names} onSubmit={addRecurringAndRedirect} />
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
                  <ExpensesPage
                    names={names}
                    expenses={{
                      expenses: expenses.items,
                      loading: expenses.loading,
                      onUpdate: expenses.update,
                      onDelete: removeWithNotify,
                      onRefresh: expenses.load,
                    }}
                    recurring={{
                      rules: recurring.items,
                      loading: recurring.loading,
                      tabMissing: recurring.tabMissing,
                      pending: pending.pending,
                      onUpdate: recurring.update,
                      onDelete: recurring.remove,
                      onAssignId: recurring.assignId,
                      onSetUp: recurring.setUp,
                      onGenerate: pending.request,
                      onRefresh: recurring.load,
                    }}
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
                    items={transfers.items}
                    loading={transfers.loading}
                    onUpdate={transfers.update}
                    onDelete={removeTransferWithNotify}
                    onRefresh={transfers.load}
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
                    items={gifts.items}
                    loading={gifts.loading}
                    onUpdate={gifts.update}
                    onDelete={removeGiftWithNotify}
                    onRefresh={gifts.load}
                  />
                </>
              }
            />
          </Routes>
          {/* Outside the routes: what is due does not depend on which screen
              the user happens to be looking at. */}
          <RecurringPrompt
            opened={pending.prompt}
            names={names}
            pending={pending.pending}
            onConfirm={confirmRecurring}
            onDismiss={pending.dismiss}
          />
          <BackgroundSpacer />
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

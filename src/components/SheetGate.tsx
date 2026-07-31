import { useState } from 'react';
import { Center, Stack, Title, Text, Button, Alert, Image, Code } from '@mantine/core';
import { IconAlertCircle, IconTableShare } from '@tabler/icons-react';
import logoSvg from '/favicon-squirrel.svg';
import { getAccessToken, getProjectNumber } from '../services/auth';
import { pickSpreadsheet } from '../services/picker';
import { setGrantedSheetId } from '../services/sheetAccess';

/**
 * Shown when signed in but no spreadsheet has been granted yet.
 *
 * The token uses the `drive.file` scope, which only authorises files the user
 * has picked — so this step is what grants access. It is a one-off: the grant
 * persists until the sheet is unshared or access is revoked.
 */
export function SheetGate({
  onPicked,
  notice,
}: {
  onPicked: (sheetId: string) => void;
  notice?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Read per render rather than at module load, so config is picked up without
  // depending on import order.
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const hintId = import.meta.env.VITE_SPREADSHEET_ID;
  // Derived from the client id rather than configured separately.
  const appId = getProjectNumber();

  const choose = async () => {
    const token = getAccessToken();
    if (!token) {
      setError('Not signed in — reload and sign in again.');
      return;
    }
    if (!appId) {
      setError('Cannot read the project number from VITE_GOOGLE_CLIENT_ID.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const sheetId = await pickSpreadsheet(token, apiKey, appId);
      if (sheetId) {
        setGrantedSheetId(sheetId);
        onPicked(sheetId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the file picker.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center h="100vh" p="md">
      <Stack align="center" gap="md" maw={460}>
        <Image src={logoSvg} w={96} h={96} />
        <Title order={2} ta="center">
          Choose your spreadsheet
        </Title>
        <Text ta="center">
          This app can only reach spreadsheets you pick, so it never gets access to the rest of your
          Google Drive. You only need to do this once.
        </Text>

        {notice && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />} w="100%">
            {notice}
          </Alert>
        )}

        {!apiKey || !appId ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            <Text size="sm" fw={600} mb={4}>
              {!apiKey ? 'VITE_GOOGLE_API_KEY is not set' : 'Cannot read the project number'}
            </Text>
            <Text size="sm">
              {!apiKey ? (
                <>
                  The picker needs a Google API key. Enable the <b>Google Picker API</b>, create an
                  API key, and add it to <Code>.env</Code>.
                </>
              ) : (
                <>
                  It is taken from the digits before the dash in <Code>VITE_GOOGLE_CLIENT_ID</Code>,
                  which does not look like a Google client id.
                </>
              )}
            </Text>
          </Alert>
        ) : (
          <>
            <Button
              size="lg"
              leftSection={<IconTableShare size={18} />}
              onClick={choose}
              loading={busy}
            >
              Choose spreadsheet
            </Button>
            {hintId && (
              <Text size="sm" ta="center">
                Look for the sheet with id <Code>{hintId}</Code>.
              </Text>
            )}
          </>
        )}

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} w="100%">
            {error}
          </Alert>
        )}
      </Stack>
    </Center>
  );
}

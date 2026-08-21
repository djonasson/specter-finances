import { useState } from 'react';
import { Alert, Button, Text } from '@mantine/core';
import { IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { backupSpreadsheet } from '../services/backup';
import { today } from '../services/utils';

/**
 * Downloads the whole spreadsheet, every tab, as one Excel file.
 *
 * Self-contained on purpose: it keeps its own busy and error state, so the
 * settings drawer around it stays about the theme and this can be tested alone.
 *
 * A failure is reported where the button is, not through the app's floating
 * notification, which renders behind the drawer overlay and would never be read.
 */
export function BackupButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    // Cleared up front: a stale failure sitting under a retry that succeeded
    // reads as though the retry failed too.
    setError(null);
    try {
      await backupSpreadsheet(today());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not download the spreadsheet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="light" leftSection={<IconDownload size={18} />} loading={busy} onClick={run}>
        Back up spreadsheet
      </Button>
      <Text size="sm" mt="xs">
        Downloads every tab as an Excel file you can upload back to Google Drive.
      </Text>
      {error && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mt="xs">
          {error}
        </Alert>
      )}
    </>
  );
}

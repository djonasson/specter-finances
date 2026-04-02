import { useState, useCallback } from 'react';
import type { Transfer, TransferFormData } from '../types/transfer';
import {
  fetchTransfers,
  addTransfer,
  updateTransfer,
  deleteTransfer,
} from '../services/sheets';

export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransfers();
      setTransfers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(
    async (form: TransferFormData) => {
      await addTransfer(form);
      await load();
    },
    [load]
  );

  const update = useCallback(
    async (rowIndex: number, form: TransferFormData) => {
      await updateTransfer(rowIndex, form);
      await load();
    },
    [load]
  );

  const remove = useCallback(
    async (rowIndex: number) => {
      await deleteTransfer(rowIndex);
      await load();
    },
    [load]
  );

  return { transfers, loading, error, load, add, update, remove };
}

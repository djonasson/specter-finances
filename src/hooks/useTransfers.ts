import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import { fetchTransfers, addTransfer, updateTransfer, deleteTransfer } from '../services/sheets';
import { useMovements } from './useMovements';

export function useTransfers() {
  const { items, ...rest } = useMovements<Transfer, TransferRow, TransferFormData>(
    {
      fetchAll: fetchTransfers,
      add: addTransfer,
      update: updateTransfer,
      remove: deleteTransfer,
    },
    'transfers',
  );
  return { transfers: items, ...rest };
}

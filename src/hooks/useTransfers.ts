import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import { fetchTransfers, addTransfer, updateTransfer, deleteTransfer } from '../services/sheets';
import { useMovements } from './useMovements';

export function useTransfers() {
  return useMovements<Transfer, TransferRow, TransferFormData>(
    {
      fetchAll: fetchTransfers,
      add: addTransfer,
      update: updateTransfer,
      remove: deleteTransfer,
    },
    'transfers',
  );
}

import type { Gift, GiftFormData, GiftRow } from '../types/gift';
import { fetchGifts, addGift, updateGift, deleteGift } from '../services/sheets';
import { useMovements } from './useMovements';

export function useGifts() {
  return useMovements<Gift, GiftRow, GiftFormData>(
    {
      fetchAll: fetchGifts,
      add: addGift,
      update: updateGift,
      remove: deleteGift,
    },
    'gifts',
  );
}

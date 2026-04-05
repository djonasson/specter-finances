import { useState, useCallback } from 'react';
import type { Gift, GiftFormData } from '../types/gift';
import {
  fetchGifts,
  addGift,
  updateGift,
  deleteGift,
} from '../services/sheets';

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGifts();
      setGifts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gifts');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(
    async (form: GiftFormData) => {
      await addGift(form);
      await load();
    },
    [load]
  );

  const update = useCallback(
    async (rowIndex: number, form: GiftFormData) => {
      await updateGift(rowIndex, form);
      await load();
    },
    [load]
  );

  const remove = useCallback(
    async (rowIndex: number) => {
      await deleteGift(rowIndex);
      await load();
    },
    [load]
  );

  return { gifts, loading, error, load, add, update, remove };
}

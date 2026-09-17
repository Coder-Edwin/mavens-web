import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { studentsApi, type StudentRecord } from '@/lib/students';

/// Shared by every parent-facing page that needs "which of my children" —
/// Payments, Tournaments, Progress. Store doesn't need it (an order isn't
/// tied to one child).
export function useChildren() {
  const [children, setChildren] = useState<StudentRecord[] | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await studentsApi.list();
      setChildren(data);
      setActiveChildId((prev) => prev ?? data[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your children.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { children, activeChildId, setActiveChildId, error, refresh };
}

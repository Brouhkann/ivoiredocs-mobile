import { useState, useEffect, useCallback } from 'react';
import { getUserRequests, getDelegateRequests } from '../services/requestService';
import type { Request } from '../types';
import { useAuthStore } from '../stores/authStore';

export function useRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { user, profile } = useAuthStore();

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      let data: Request[];

      if (profile?.role === 'delegate') {
        data = await getDelegateRequests(user.id);
      } else {
        data = await getUserRequests(user.id);
      }

      setRequests(data);
    } catch (err: any) {
      console.error('Erreur chargement demandes:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    error,
    refreshing,
    refresh,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { authApi, serversApi, bookingsApi, AppUser } from '@/lib/api';

// ── Auth ──────────────────────────────────────────────────────────
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(user => setCurrentUser(user))
      .catch(() => { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); })
      .finally(() => setLoading(false));
  }, []);

  const loginUser = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data.user;
  };

  const logoutUser = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setCurrentUser(null);
  };

  return { currentUser, loading, loginUser, logoutUser };
}

// ── Servers ───────────────────────────────────────────────────────
export function useServers() {
  const qc = useQueryClient();
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
    staleTime: 30_000,
  });

  const { mutateAsync: addServer } = useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  });

  const { mutateAsync: updateServerMut } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof serversApi.update>[1] }) =>
      serversApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  });

  const { mutateAsync: deleteServer } = useMutation({
    mutationFn: serversApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  });

  const updateServer = (id: string, data: Parameters<typeof serversApi.update>[1]) =>
    updateServerMut({ id, data });

  return { servers, isLoading, addServer, updateServer, deleteServer };
}

// ── Bookings ──────────────────────────────────────────────────────
export function useBookings(userId?: string) {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: userId ? ['bookings', 'user', userId] : ['bookings'],
    queryFn: userId ? () => bookingsApi.byUser(userId) : bookingsApi.all,
    staleTime: 30_000,
  });

  const { mutateAsync: createBooking } = useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const { mutateAsync: extendMut } = useMutation({
    mutationFn: ({ id, newEndDate }: { id: string; newEndDate: string }) =>
      bookingsApi.extend(id, newEndDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const { mutateAsync: cancelBooking } = useMutation({
    mutationFn: bookingsApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const extendBooking = (id: string, newEndDate: string) => extendMut({ id, newEndDate });

  return { bookings, isLoading, createBooking, extendBooking, cancelBooking };
}

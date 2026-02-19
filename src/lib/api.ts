const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data ?? json;
}

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; expiresAt: string; user: AppUser }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string, isAdmin?: boolean) =>
    request<AppUser>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, isAdmin }),
    }),
  logout: () => request<void>('/users/logout', { method: 'POST' }),
  me: () => request<AppUser>('/users/me'),
};

// ── Servers ───────────────────────────────────────────────────────
export const serversApi = {
  list: () => request<ServerData[]>('/servers'),
  get: (id: string) => request<ServerData>(`/servers/${id}`),
  create: (data: CreateServerPayload) =>
    request<ServerData>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateServerPayload> & { status?: string }) =>
    request<ServerData>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
};

// ── Bookings ──────────────────────────────────────────────────────
export const bookingsApi = {
  all: () => request<BookingData[]>('/bookings'),
  byUser: (userId: string) => request<BookingData[]>(`/bookings/user/${userId}`),
  create: (data: CreateBookingPayload) =>
    request<BookingData>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  extend: (id: string, newEndDate: string) =>
    request<BookingData>(`/bookings/${id}/extend`, { method: 'PUT', body: JSON.stringify({ newEndDate }) }),
  cancel: (id: string) =>
    request<BookingData>(`/bookings/${id}/cancel`, { method: 'PUT' }),
};

// ── Types ─────────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface ServerData {
  id: string;
  name: string;
  specifications: { cpu: string; memory: string; storage: string; gpu?: string | null };
  status: 'available' | 'booked' | 'maintenance' | 'offline';
  location: string;
  currentBooking?: BookingData | null;
}

export interface BookingData {
  id: string;
  serverId: string;
  serverName?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending_renewal';
  createdAt: string;
  renewalNotificationSent?: boolean;
  daysBooked: number;
  server?: { name: string };
  user?: { email: string; name: string };
}

export interface CreateServerPayload {
  name: string;
  specifications: { cpu: string; memory: string; storage: string; gpu?: string };
  location: string;
}

export interface CreateBookingPayload {
  serverId: string;
  userId: string;
  startDate: string;
  endDate: string;
  purpose: string;
}

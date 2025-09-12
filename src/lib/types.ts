export interface Server {
  id: string;
  name: string;
  specifications: {
    cpu: string;
    memory: string;
    storage: string;
    gpu?: string;
  };
  status: 'available' | 'booked' | 'maintenance' | 'offline';
  location: string;
  currentBooking?: Booking;
}

export interface Booking {
  id: string;
  serverId: string;
  serverName: string;
  userId: string;
  userEmail: string;
  userName: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending-renewal';
  createdAt: string;
  renewalNotificationSent?: boolean;
  daysBooked: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface NotificationSettings {
  renewalThreshold: number; // days
  reminderDays: number[]; // days before expiration to send reminders
}
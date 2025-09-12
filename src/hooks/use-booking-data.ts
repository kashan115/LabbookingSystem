import { useKV } from '@github/spark/hooks';
import { Server, Booking, User } from '@/lib/types';
import { generateId } from '@/lib/booking-utils';

export function useServers() {
  const [servers, setServers] = useKV<Server[]>('lab-servers', []);
  
  const addServer = (serverData: Omit<Server, 'id'>) => {
    const newServer: Server = {
      ...serverData,
      id: generateId(),
    };
    
    setServers(currentServers => [...(currentServers || []), newServer]);
    return newServer;
  };
  
  const updateServer = (id: string, updates: Partial<Server>) => {
    setServers(currentServers =>
      (currentServers || []).map(server =>
        server.id === id ? { ...server, ...updates } : server
      )
    );
  };
  
  const deleteServer = (id: string) => {
    setServers(currentServers =>
      (currentServers || []).filter(server => server.id !== id)
    );
  };
  
  return {
    servers,
    addServer,
    updateServer,
    deleteServer,
  };
}

export function useBookings() {
  const [bookings, setBookings] = useKV<Booking[]>('lab-bookings', []);
  
  const createBooking = (bookingData: Omit<Booking, 'id' | 'createdAt' | 'daysBooked'>) => {
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);
    const daysBooked = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const newBooking: Booking = {
      ...bookingData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      daysBooked,
    };
    
    setBookings(currentBookings => [...(currentBookings || []), newBooking]);
    return newBooking;
  };
  
  const updateBooking = (id: string, updates: Partial<Booking>) => {
    setBookings(currentBookings =>
      (currentBookings || []).map(booking =>
        booking.id === id ? { ...booking, ...updates } : booking
      )
    );
  };
  
  const cancelBooking = (id: string) => {
    setBookings(currentBookings =>
      (currentBookings || []).map(booking =>
        booking.id === id ? { ...booking, status: 'cancelled' as const } : booking
      )
    );
  };
  
  const extendBooking = (id: string, newEndDate: string) => {
    setBookings(currentBookings =>
      (currentBookings || []).map(booking => {
        if (booking.id === id) {
          const startDate = new Date(booking.startDate);
          const endDate = new Date(newEndDate);
          const daysBooked = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            ...booking,
            endDate: newEndDate,
            daysBooked,
            renewalNotificationSent: false,
          };
        }
        return booking;
      })
    );
  };
  
  return {
    bookings,
    createBooking,
    updateBooking,
    cancelBooking,
    extendBooking,
  };
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useKV<User | null>('current-user', null);
  
  const loginUser = (userData: User) => {
    setCurrentUser(userData);
  };
  
  const logoutUser = () => {
    setCurrentUser(null);
  };
  
  return {
    currentUser,
    loginUser,
    logoutUser,
  };
}
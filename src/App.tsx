import { useState } from 'react';
import { useServers, useBookings, useCurrentUser } from '@/hooks/use-booking-data';
import { LoginForm } from '@/components/LoginForm';
import { Navigation } from '@/components/Navigation';
import { Dashboard } from '@/components/Dashboard';
import { MyBookings } from '@/components/MyBookings';
import { AdminPanel } from '@/components/AdminPanel';
import { ServerList } from '@/components/ServerList';
import { UserManagement } from '@/components/UserManagement';
import { Communications } from '@/components/Communications';
import { Reports } from '@/components/Reports';
import { Toaster } from '@/components/ui/sonner';

function App() {
  // Demo mode: always logged in as admin
  const currentUser = {
    id: 'demo-admin',
    name: 'Demo Admin',
    email: 'admin@lab-booking.com',
    isAdmin: true,
  };

  const { servers, addServer, updateServer, deleteServer } = useServers();
  const { bookings, createBooking, extendBooking, cancelBooking } = useBookings();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            servers={servers || []}
            bookings={bookings || []}
            currentUser={currentUser}
            onBookingCreate={createBooking}
          />
        );
      case 'communications':
        return <Communications />;
      case 'reports':
        return <Reports />;
      case 'servers':
        return (
          <ServerList
            servers={servers || []}
            onServerAdd={addServer}
            onServerUpdate={updateServer}
            onServerDelete={deleteServer}
          />
        );
      case 'bookings':
        return (
          <MyBookings
            bookings={bookings || []}
            currentUserEmail={currentUser.email}
            onExtendBooking={extendBooking}
            onCancelBooking={cancelBooking}
          />
        );
      case 'users':
        if (!currentUser.isAdmin) return null;
        return <UserManagement />;
      case 'admin':
        if (!currentUser.isAdmin) return null;
        return (
          <AdminPanel
            servers={servers || []}
            bookings={bookings || []}
            onServerAdd={addServer}
            onServerUpdate={updateServer}
            onServerDelete={deleteServer}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={logoutUser}
      />
      <main className="container mx-auto px-4 py-8">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}

export default App;

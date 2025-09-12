import { useState } from 'react';
import { User } from '@/lib/types';
import { useServers, useBookings, useCurrentUser } from '@/hooks/use-booking-data';
import { LoginForm } from '@/components/LoginForm';
import { Navigation } from '@/components/Navigation';
import { Dashboard } from '@/components/Dashboard';
import { MyBookings } from '@/components/MyBookings';
import { AdminPanel } from '@/components/AdminPanel';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const { currentUser, loginUser, logoutUser } = useCurrentUser();
  const { servers, addServer, updateServer, deleteServer } = useServers();
  const { bookings, createBooking, extendBooking, cancelBooking } = useBookings();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!currentUser) {
    return <LoginForm onLogin={loginUser} />;
  }

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
      case 'bookings':
        return (
          <MyBookings
            bookings={bookings || []}
            currentUserEmail={currentUser.email}
            onExtendBooking={extendBooking}
            onCancelBooking={cancelBooking}
          />
        );
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
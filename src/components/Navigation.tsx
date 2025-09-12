import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Calendar, Plus, SignOut, UserCircle } from '@phosphor-icons/react';

interface NavigationProps {
  currentUser: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export function Navigation({ currentUser, activeTab, onTabChange, onLogout }: NavigationProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Database },
    { id: 'bookings', label: 'My Bookings', icon: Calendar },
    ...(currentUser.isAdmin ? [{ id: 'admin', label: 'Admin', icon: Plus }] : []),
  ];

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Database size={24} className="text-primary" />
              <h1 className="text-xl font-bold">Lab Booking</h1>
            </div>
            
            <nav className="flex items-center gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onTabChange(tab.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon size={16} />
                    {tab.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <UserCircle size={20} className="text-muted-foreground" />
              <span className="text-sm font-medium">{currentUser.name}</span>
              {currentUser.isAdmin && (
                <Badge variant="secondary" className="text-xs">
                  Admin
                </Badge>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="flex items-center gap-2"
            >
              <SignOut size={16} />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
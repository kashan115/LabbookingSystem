import { useState } from 'react';
import { Server, Booking, User } from '@/lib/types';
import { getServerStatus } from '@/lib/booking-utils';
import { ServerCard } from './ServerCard';
import { BookingDialog } from './BookingDialog';
import { ServerDetailsDialog } from './ServerDetailsDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, MagnifyingGlass, Funnel } from '@phosphor-icons/react';

interface DashboardProps {
  servers: Server[];
  bookings: Booking[];
  currentUser: User;
  onBookingCreate: (booking: Omit<Booking, 'id' | 'createdAt' | 'daysBooked'>) => void;
}

export function Dashboard({ servers, bookings, currentUser, onBookingCreate }: DashboardProps) {
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Calculate statistics
  const totalServers = servers.length;
  const availableServers = servers.filter(server => getServerStatus(server, bookings) === 'available').length;
  const bookedServers = servers.filter(server => getServerStatus(server, bookings) === 'booked').length;
  const maintenanceServers = servers.filter(server => server.status === 'maintenance').length;

  // Filter servers
  const filteredServers = servers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (statusFilter === 'all') return true;
    
    const serverStatus = getServerStatus(server, bookings);
    return serverStatus === statusFilter;
  });

  const handleBookServer = (server: Server) => {
    setSelectedServer(server);
    setBookingDialogOpen(true);
  };

  const handleViewDetails = (server: Server) => {
    setSelectedServer(server);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Server Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage and book laboratory servers for your engineering projects
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Database size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              {availableServers}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{availableServers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {bookedServers}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{bookedServers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
              {maintenanceServers}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{maintenanceServers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search servers by name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Funnel size={16} className="text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredServers.map(server => (
          <ServerCard
            key={server.id}
            server={server}
            bookings={bookings}
            onBook={handleBookServer}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {filteredServers.length === 0 && (
        <div className="text-center py-12">
          <Database size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No servers found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No servers are currently available in the system.'
            }
          </p>
        </div>
      )}

      {/* Dialogs */}
      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        server={selectedServer}
        bookings={bookings}
        currentUserEmail={currentUser.email}
        currentUserName={currentUser.name}
        onBookingCreate={onBookingCreate}
      />

      <ServerDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        server={selectedServer}
        bookings={bookings}
      />
    </div>
  );
}
import { useState } from 'react';
import { Server, Booking, User } from '@/lib/types';
import { getServerStatus } from '@/lib/booking-utils';
import { ServerCard } from './ServerCard';
import { BookingDialog } from './BookingDialog';
import { ServerDetailsDialog } from './ServerDetailsDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, MagnifyingGlass, Funnel, Cpu } from '@phosphor-icons/react';

interface DashboardProps {
  servers: Server[];
  bookings: Booking[];
  currentUser: User;
  onBookingCreate: (booking: Omit<Booking, 'id' | 'createdAt' | 'daysBooked'>) => void;
}

type Architecture = 'all' | 'amd' | 'intel' | 'arm' | 'other';

function detectArch(cpu: string): Architecture {
  const c = cpu.toLowerCase();
  if (c.includes('amd') || c.includes('epyc') || c.includes('ryzen') || c.includes('threadripper')) return 'amd';
  if (c.includes('intel') || c.includes('xeon') || c.includes('core i')) return 'intel';
  if (c.includes('arm') || c.includes('neoverse') || c.includes('graviton') || c.includes('ampere') || c.includes('a64fx') || c.includes('kunpeng')) return 'arm';
  return 'other';
}

const archConfig: Record<Architecture, { label: string; color: string; bg: string }> = {
  all:   { label: 'All',   color: 'text-gray-700',   bg: 'bg-gray-100 hover:bg-gray-200' },
  amd:   { label: 'AMD',   color: 'text-red-700',    bg: 'bg-red-50 hover:bg-red-100 border-red-200' },
  intel: { label: 'Intel', color: 'text-blue-700',   bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200' },
  arm:   { label: 'ARM',   color: 'text-green-700',  bg: 'bg-green-50 hover:bg-green-100 border-green-200' },
  other: { label: 'Other', color: 'text-gray-700',   bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200' },
};

export function Dashboard({ servers, bookings, currentUser, onBookingCreate }: DashboardProps) {
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [archFilter, setArchFilter] = useState<Architecture>('all');

  // Stats
  const totalServers = servers.length;
  const availableServers = servers.filter(s => getServerStatus(s, bookings) === 'available').length;
  const bookedServers = servers.filter(s => getServerStatus(s, bookings) === 'booked').length;
  const maintenanceServers = servers.filter(s => s.status === 'maintenance').length;

  // Arch counts
  const archCounts: Record<Architecture, number> = { all: servers.length, amd: 0, intel: 0, arm: 0, other: 0 };
  servers.forEach(s => { archCounts[detectArch(s.specifications.cpu)]++; });

  // Filter
  const filteredServers = servers.filter(server => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.specifications.cpu.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== 'all') {
      if (getServerStatus(server, bookings) !== statusFilter) return false;
    }
    if (archFilter !== 'all') {
      if (detectArch(server.specifications.cpu) !== archFilter) return false;
    }
    return true;
  });

  const handleBookServer = (server: Server) => { setSelectedServer(server); setBookingDialogOpen(true); };
  const handleViewDetails = (server: Server) => { setSelectedServer(server); setDetailsDialogOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lab Server Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage and book laboratory servers for your engineering projects</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Database size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalServers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Badge className="bg-green-100 text-green-800 border-green-200">{availableServers}</Badge>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{availableServers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">{bookedServers}</Badge>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{bookedServers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{maintenanceServers}</Badge>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{maintenanceServers}</div></CardContent>
        </Card>
      </div>

      {/* Architecture Filter Pills */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Cpu size={16} />
          <span className="font-medium">Architecture</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'amd', 'intel', 'arm', 'other'] as Architecture[]).map(arch => {
            const cfg = archConfig[arch];
            const count = archCounts[arch];
            const isActive = archFilter === arch;
            return (
              <Button
                key={arch}
                variant="outline"
                size="sm"
                onClick={() => setArchFilter(arch)}
                className={`flex items-center gap-2 transition-all ${isActive ? `${cfg.bg} ${cfg.color} border font-semibold ring-1 ring-offset-1` : 'text-muted-foreground'}`}
              >
                {arch === 'amd' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.25 6.75v10.5h19.5V6.75H2.25zm3.04 2.1h1.38l2.16 5.1h-1.5l-.36-.9H4.95l-.36.9H3.13l2.16-5.1zm5.28 0h1.38v3.84h2.4v1.26H10.57V8.85zm4.68 0h3.96v1.2h-2.58v.84h2.28v1.14h-2.28v.84h2.7v1.08h-4.08V8.85zM6.44 10.2l-.66 1.62h1.32L6.44 10.2z"/></svg>
                )}
                {arch === 'intel' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
                )}
                {arch === 'arm' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.18l5.82 3.64v7.36L12 18.82l-5.82-3.64V7.82L12 4.18z"/></svg>
                )}
                {cfg.label}
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Search + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search servers by name, location, or CPU…"
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
              <SelectItem value="all">All Statuses</SelectItem>
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
          <ServerCard key={server.id} server={server} bookings={bookings} onBook={handleBookServer} onViewDetails={handleViewDetails} />
        ))}
      </div>

      {filteredServers.length === 0 && (
        <div className="text-center py-12">
          <Database size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No servers found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all' || archFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No servers are currently available in the system.'}
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

import { useState } from 'react';
import { Server, Booking } from '@/lib/types';
import { getServerStatus, formatDate } from '@/lib/booking-utils';
import { AddServerDialog } from './AddServerDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Database, Gear, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface AdminPanelProps {
  servers: Server[];
  bookings: Booking[];
  onServerAdd: (server: Omit<Server, 'id'>) => void;
  onServerUpdate: (id: string, updates: Partial<Server>) => void;
  onServerDelete: (id: string) => void;
}

export function AdminPanel({ servers, bookings, onServerAdd, onServerUpdate, onServerDelete }: AdminPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleStatusChange = (serverId: string, newStatus: Server['status']) => {
    onServerUpdate(serverId, { status: newStatus });
    toast.success('Server status updated');
  };

  const handleDeleteServer = (server: Server) => {
    const activeBooking = bookings.find(booking => 
      booking.serverId === server.id && booking.status === 'active'
    );

    if (activeBooking) {
      toast.error('Cannot delete server with active booking');
      return;
    }

    if (confirm(`Are you sure you want to delete "${server.name}"? This action cannot be undone.`)) {
      onServerDelete(server.id);
      toast.success('Server deleted successfully');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'booked':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'offline':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate statistics
  const totalServers = servers.length;
  const availableServers = servers.filter(server => getServerStatus(server, bookings) === 'available').length;
  const bookedServers = servers.filter(server => getServerStatus(server, bookings) === 'booked').length;
  const maintenanceServers = servers.filter(server => server.status === 'maintenance').length;

  // Recent bookings
  const recentBookings = bookings
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage servers and monitor system usage
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Add Server
        </Button>
      </div>

      {/* Statistics */}
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
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{availableServers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{bookedServers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{maintenanceServers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Server Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gear size={20} />
            Server Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Specifications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map(server => {
                const currentStatus = getServerStatus(server, bookings);
                return (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell>{server.location}</TableCell>
                    <TableCell className="text-sm">
                      <div>{server.specifications.cpu}</div>
                      <div className="text-muted-foreground">
                        {server.specifications.memory} | {server.specifications.storage}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge className={getStatusColor(currentStatus)}>
                          {currentStatus}
                        </Badge>
                        <Select
                          value={server.status}
                          onValueChange={(value) => handleStatusChange(server.id, value as Server['status'])}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteServer(server)}
                        disabled={currentStatus === 'booked'}
                      >
                        <Trash size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBookings.map(booking => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.serverName}</TableCell>
                  <TableCell>
                    <div>{booking.userName}</div>
                    <div className="text-sm text-muted-foreground">{booking.userEmail}</div>
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(booking.startDate)} - {formatDate(booking.endDate)}</div>
                    <div className="text-sm text-muted-foreground">{booking.daysBooked} days</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={booking.status === 'active' ? 'default' : 'secondary'}>
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(booking.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Server Dialog */}
      <AddServerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onServerAdd={onServerAdd}
      />
    </div>
  );
}
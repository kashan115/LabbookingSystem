import { useState } from 'react';
import { Server } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerAdd: (server: Omit<Server, 'id'>) => void;
}

export function AddServerDialog({ open, onOpenChange, onServerAdd }: AddServerDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    cpu: '',
    memory: '',
    storage: '',
    gpu: '',
    location: '',
    status: 'available' as Server['status'],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      cpu: '',
      memory: '',
      storage: '',
      gpu: '',
      location: '',
      status: 'available',
    });
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Server name is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.cpu.trim() || !formData.memory.trim() || !formData.storage.trim()) {
      setError('CPU, Memory, and Storage specifications are required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.location.trim()) {
      setError('Location is required');
      setIsSubmitting(false);
      return;
    }

    try {
      const serverData: Omit<Server, 'id'> = {
        name: formData.name.trim(),
        specifications: {
          cpu: formData.cpu.trim(),
          memory: formData.memory.trim(),
          storage: formData.storage.trim(),
          gpu: formData.gpu.trim() || undefined,
        },
        status: formData.status,
        location: formData.location.trim(),
      };

      onServerAdd(serverData);
      toast.success(`Server "${formData.name}" added successfully!`);
      handleClose();
    } catch (err) {
      setError('Failed to add server. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus size={20} className="text-primary" />
            Add New Server
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="server-name">Server Name *</Label>
              <Input
                id="server-name"
                placeholder="e.g., Lab-Server-01"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpu">CPU *</Label>
              <Input
                id="cpu"
                placeholder="e.g., Intel Xeon E5-2690"
                value={formData.cpu}
                onChange={(e) => handleInputChange('cpu', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memory">Memory *</Label>
              <Input
                id="memory"
                placeholder="e.g., 64GB DDR4"
                value={formData.memory}
                onChange={(e) => handleInputChange('memory', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage">Storage *</Label>
              <Input
                id="storage"
                placeholder="e.g., 1TB NVMe SSD"
                value={formData.storage}
                onChange={(e) => handleInputChange('storage', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gpu">GPU (Optional)</Label>
              <Input
                id="gpu"
                placeholder="e.g., NVIDIA RTX 4090"
                value={formData.gpu}
                onChange={(e) => handleInputChange('gpu', e.target.value)}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Building A, Room 101"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <Warning size={16} className="text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Server'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
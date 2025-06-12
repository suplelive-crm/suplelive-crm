import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    segment: '',
    message: '',
    scheduled_at: '',
  });
  const [loading, setLoading] = useState(false);
  const { createCampaign } = useCrmStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createCampaign({
        ...formData,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : undefined,
      });
      setOpen(false);
      setFormData({ name: '', segment: '', message: '', scheduled_at: '' });
      toast({
        title: 'Success',
        description: 'Campaign created successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create campaign',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Create a targeted messaging campaign for specific customer segments.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="segment">Target Segment *</Label>
              <Select value={formData.segment} onValueChange={(value) => setFormData({ ...formData, segment: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="champions">Champions</SelectItem>
                  <SelectItem value="loyal_customers">Loyal Customers</SelectItem>
                  <SelectItem value="potential_loyalists">Potential Loyalists</SelectItem>
                  <SelectItem value="new_customers">New Customers</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="hibernating">Hibernating</SelectItem>
                  <SelectItem value="lost">Lost Customers</SelectItem>
                  <SelectItem value="unconverted_leads">Unconverted Leads</SelectItem>
                  <SelectItem value="inactive_clients">Inactive Clients</SelectItem>
                  <SelectItem value="high_value">High Value Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Enter your campaign message..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="scheduled_at">Schedule (Optional)</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
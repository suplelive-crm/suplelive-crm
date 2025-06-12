import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Calendar, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCrmStore } from '@/store/crmStore';

export function CampaignsPage() {
  const { campaigns, fetchCampaigns } = useCrmStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'running': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'champions': return 'bg-green-100 text-green-800';
      case 'loyal_customers': return 'bg-blue-100 text-blue-800';
      case 'at_risk': return 'bg-red-100 text-red-800';
      case 'lost': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-gray-600 mt-2">Manage targeted messaging campaigns</p>
            </div>
            <CreateCampaignDialog />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{campaigns.length}</div>
                    <div className="text-sm text-gray-600">Total Campaigns</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{campaigns.filter(c => c.status === 'scheduled').length}</div>
                    <div className="text-sm text-gray-600">Scheduled</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{campaigns.filter(c => c.status === 'completed').length}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Messages Sent</div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns ({campaigns.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target Count</TableHead>
                    <TableHead>Sent Count</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <Badge className={getSegmentColor(campaign.segment)}>
                          {campaign.segment.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(campaign.status || 'draft')}>
                          {campaign.status || 'draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign.target_count || '-'}</TableCell>
                      <TableCell>{campaign.sent_count || 0}</TableCell>
                      <TableCell>
                        {campaign.scheduled_at 
                          ? new Date(campaign.scheduled_at).toLocaleString()
                          : 'Not scheduled'
                        }
                      </TableCell>
                      <TableCell>
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button size="sm">
                              Launch
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
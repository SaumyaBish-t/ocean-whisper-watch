import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Send, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Alert = Tables<"alerts">;

interface AlertsPanelProps {
  reports: Tables<"hazard_reports">[];
}

export const AlertsPanel = ({ reports }: AlertsPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [sentTo, setSentTo] = useState<string>('all');

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching alerts:', error);
          return;
        }

        setAlerts(data || []);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Set up real-time subscription
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts(prev => [newAlert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendAlert = async () => {
    if (!alertMessage.trim() || !user?.id) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('alerts')
        .insert({
          alert_message: alertMessage.trim(),
          sent_to: sentTo,
          sender_id: user.id,
          report_id: selectedReport || null
        });

      if (error) {
        throw error;
      }

      toast({
        title: 'Alert Sent',
        description: 'Your alert has been sent successfully.',
      });

      setAlertMessage('');
      setSelectedReport('');
      setSentTo('all');
    } catch (error) {
      console.error('Error sending alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to send alert. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInHours > 24) {
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hours ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minutes ago`;
    } else {
      return "Just now";
    }
  };

  return (
    <div className="space-y-6">
      {/* Send Alert Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Alert
          </CardTitle>
          <CardDescription>
            Send alerts to citizens about hazard reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Message</label>
            <Textarea
              placeholder="Enter alert message..."
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Related Report (Optional)</label>
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific report</SelectItem>
                  {reports.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      {report.hazard_type} - {report.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Send To</label>
              <Select value={sentTo} onValueChange={setSentTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Citizens</SelectItem>
                  <SelectItem value="nearby">Nearby Citizens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={sendAlert} 
            disabled={!alertMessage.trim() || sending}
            className="w-full"
          >
            {sending ? 'Sending...' : 'Send Alert'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Active Alerts
          </CardTitle>
          <CardDescription>
            Currently active alerts sent to citizens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No active alerts
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{alert.alert_message}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(alert.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {alert.sent_to === 'all' ? 'All Citizens' : 'Nearby Citizens'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
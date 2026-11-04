import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Download, BarChart3, FileText, Users, Video, ShoppingBag, MessageSquare, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type ReportType = 'users' | 'content' | 'commerce' | 'engagement';

interface ReportResult {
  title: string;
  data: Record<string, any>[];
  chartData?: any[];
  chartType?: 'bar' | 'pie';
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 60%, 55%)',
  'hsl(150, 50%, 45%)',
  'hsl(350, 60%, 55%)',
  'hsl(45, 70%, 55%)',
];

export default function AdminReporting() {
  const [tab, setTab] = useState<ReportType>('users');
  const [dateRange, setDateRange] = useState('30d');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const getDaysAgo = (range: string) => {
    const d = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const date = new Date();
    date.setDate(date.getDate() - d);
    return date.toISOString();
  };

  const generateReport = async (type: ReportType) => {
    setLoading(true);
    const since = getDaysAgo(dateRange);

    try {
      if (type === 'users') {
        const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: newUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: totalFollows } = await supabase.from('follows').select('*', { count: 'exact', head: true });
        const { count: helpers } = await supabase.from('helper_profiles').select('*', { count: 'exact', head: true });

        setReport({
          title: 'User Report',
          data: [
            { metric: 'Total Users', value: totalUsers || 0 },
            { metric: 'New Users (period)', value: newUsers || 0 },
            { metric: 'Total Follows', value: totalFollows || 0 },
            { metric: 'Helper Profiles', value: helpers || 0 },
          ],
          chartData: [
            { name: 'Total', value: totalUsers || 0 },
            { name: 'New', value: newUsers || 0 },
            { name: 'Helpers', value: helpers || 0 },
          ],
          chartType: 'bar',
        });
      } else if (type === 'content') {
        const { count: posts } = await supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: videos } = await supabase.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: comments } = await supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: questions } = await supabase.from('questions').select('*', { count: 'exact', head: true }).gte('created_at', since);

        setReport({
          title: 'Content Report',
          data: [
            { metric: 'Posts', value: posts || 0 },
            { metric: 'Videos', value: videos || 0 },
            { metric: 'Comments', value: comments || 0 },
            { metric: 'Questions', value: questions || 0 },
          ],
          chartData: [
            { name: 'Posts', value: posts || 0 },
            { name: 'Videos', value: videos || 0 },
            { name: 'Comments', value: comments || 0 },
            { name: 'Questions', value: questions || 0 },
          ],
          chartType: 'pie',
        });
      } else if (type === 'commerce') {
        const { count: orders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: items } = await supabase.from('shop_items').select('*', { count: 'exact', head: true });
        const { count: disputes } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: sellers } = await supabase.from('seller_profiles').select('*', { count: 'exact', head: true });

        setReport({
          title: 'Commerce Report',
          data: [
            { metric: 'Orders (period)', value: orders || 0 },
            { metric: 'Listed Items', value: items || 0 },
            { metric: 'Disputes (period)', value: disputes || 0 },
            { metric: 'Sellers', value: sellers || 0 },
          ],
          chartData: [
            { name: 'Orders', value: orders || 0 },
            { name: 'Items', value: items || 0 },
            { name: 'Disputes', value: disputes || 0 },
            { name: 'Sellers', value: sellers || 0 },
          ],
          chartType: 'bar',
        });
      } else if (type === 'engagement') {
        const { count: likes } = await supabase.from('likes').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: saves } = await supabase.from('likes').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: circles } = await supabase.from('circles').select('*', { count: 'exact', head: true });
        const { count: circleMembers } = await supabase.from('circle_members').select('*', { count: 'exact', head: true });

        setReport({
          title: 'Engagement Report',
          data: [
            { metric: 'Likes (period)', value: likes || 0 },
            { metric: 'Saves (period)', value: saves || 0 },
            { metric: 'Total Circles', value: circles || 0 },
            { metric: 'Circle Members', value: circleMembers || 0 },
          ],
          chartData: [
            { name: 'Likes', value: likes || 0 },
            { name: 'Saves', value: saves || 0 },
            { name: 'Circles', value: circles || 0 },
            { name: 'Members', value: circleMembers || 0 },
          ],
          chartType: 'bar',
        });
      }
    } catch (err) {
      console.error('Report error:', err);
      toast({ title: 'Error generating report', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!report) return;
    const header = Object.keys(report.data[0]).join(',');
    const rows = report.data.map(r => Object.values(r).join(',')).join('\n');
    const csv = `${header}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s/g, '_').toLowerCase()}_${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Reports & Exports</h1>
        {report && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />Export CSV
          </Button>
        )}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="365d">Last year</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date range for period metrics</span>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v as ReportType); setReport(null); }}>
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="content"><FileText className="h-4 w-4 mr-1" />Content</TabsTrigger>
          <TabsTrigger value="commerce"><ShoppingBag className="h-4 w-4 mr-1" />Commerce</TabsTrigger>
          <TabsTrigger value="engagement"><TrendingUp className="h-4 w-4 mr-1" />Engagement</TabsTrigger>
        </TabsList>

        {['users', 'content', 'commerce', 'engagement'].map(t => (
          <TabsContent key={t} value={t} className="mt-4">
            <div className="flex justify-center mb-6">
              <Button onClick={() => generateReport(t as ReportType)} disabled={loading} size="lg">
                {loading ? <SerkleLoader size="xs" className="text-current mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Generate {t.charAt(0).toUpperCase() + t.slice(1)} Report
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {report && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">{report.title}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {report.data.map((row, i) => (
                  <div key={i} className="text-center p-4 border border-border rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{typeof row.value === 'number' ? row.value.toLocaleString() : row.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{row.metric}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {report.chartData && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Visualization</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    {report.chartType === 'pie' ? (
                      <PieChart>
                        <Pie data={report.chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label>
                          {report.chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    ) : (
                      <BarChart data={report.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

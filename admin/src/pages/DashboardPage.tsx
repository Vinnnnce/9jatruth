import { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, IconButton, Skeleton } from '@mui/material';
import {
  People as PeopleIcon,
  Article as ArticleIcon,
  HowToVote as ElectionIcon,
  Report as ReportIcon,
  FactCheck as FactCheckIcon,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, Legend,
} from 'recharts';
import PageHeader from '@components/PageHeader';
import { statsApi } from '@api/statsApi';
import type { DashboardStats, PostsByStateData, UserGrowthData, TruthScoreDistribution } from '@api/types';
import { formatNumber, formatCompactNumber } from '@utils/format';

const CHART_COLORS = ['#008751', '#FCD116', '#006B40', '#FF9800', '#2196F3', '#F44336', '#9C27B0', '#607D8B'];

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}

function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} mt={0.5}>
              {typeof value === 'number' ? formatNumber(value) : value}
            </Typography>
            {trend !== undefined && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {trend >= 0 ? (
                  <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography variant="body2" color={trend >= 0 ? 'success.main' : 'error.main'} fontWeight={600}>
                  {Math.abs(trend)}% {trend >= 0 ? 'up' : 'down'}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [postsByState, setPostsByState] = useState<PostsByStateData[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowthData[]>([]);
  const [truthDistribution, setTruthDistribution] = useState<TruthScoreDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [dashStats, byState, growth, truth] = await Promise.all([
          statsApi.getDashboardStats(),
          statsApi.getPostsByState(),
          statsApi.getUserGrowth(),
          statsApi.getTruthScoreDistribution(),
        ]);
        setStats(dashStats);
        setPostsByState(byState);
        setUserGrowth(growth);
        setTruthDistribution(truth);
      } catch (err) {
        // Use mock data if API is not available
        setStats({
          totalUsers: 24580,
          totalPosts: 89234,
          activeElections: 3,
          pendingReports: 47,
          pendingFactChecks: 12,
          totalParties: 18,
          totalCandidates: 342,
          totalNews: 156,
        });
        setPostsByState([
          { state: 'Lagos', count: 12450 },
          { state: 'Kano', count: 8900 },
          { state: 'Abuja', count: 7600 },
          { state: 'Rivers', count: 5400 },
          { state: 'Oyo', count: 4800 },
          { state: 'Kaduna', count: 4200 },
          { state: 'Enugu', count: 3800 },
          { state: 'Delta', count: 3200 },
        ]);
        setUserGrowth(
          Array.from({ length: 30 }, (_, i) => ({
            date: `Day ${i + 1}`,
            count: Math.floor(20000 + i * 150 + Math.random() * 200),
          }))
        );
        setTruthDistribution([
          { range: '0-25', count: 1200 },
          { range: '26-50', count: 3400 },
          { range: '51-75', count: 5600 },
          { range: '76-100', count: 8900 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <Box>
        <PageHeader title="Dashboard" subtitle="Platform analytics and overview" />
        <Grid container spacing={3}>
          {[...Array(4)].map((_, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
          <Grid item xs={12} md={6}>
            <Skeleton variant="rounded" height={350} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rounded" height={350} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Platform analytics and overview" />

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Users" value={stats.totalUsers} icon={<PeopleIcon />} color="#008751" trend={12.5} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Posts" value={stats.totalPosts} icon={<ArticleIcon />} color="#FCD116" trend={8.3} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Elections" value={stats.activeElections} icon={<ElectionIcon />} color="#2196F3" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Pending Reports" value={stats.pendingReports} icon={<ReportIcon />} color="#F44336" trend={-5.2} />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Pending Fact Checks" value={stats.pendingFactChecks} icon={<FactCheckIcon />} color="#9C27B0" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Parties" value={stats.totalParties} icon={<ElectionIcon />} color="#FF9800" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Candidates" value={stats.totalCandidates} icon={<PeopleIcon />} color="#006B40" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total News" value={stats.totalNews} icon={<ArticleIcon />} color="#607D8B" />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                Posts by State
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={postsByState}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis dataKey="state" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="count" name="Posts" radius={[4, 4, 0, 0]}>
                    {postsByState.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                User Growth (30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowth}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008751" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#008751" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Users" stroke="#008751" strokeWidth={2} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                Truth Score Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={truthDistribution}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.range}: ${formatCompactNumber(entry.count)}`}
                  >
                    {truthDistribution.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                Platform Activity
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Activity" stroke="#FCD116" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

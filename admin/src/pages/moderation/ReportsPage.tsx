import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, TextField, MenuItem, IconButton, Typography, Stack, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider } from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon, Visibility as ViewIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { moderationApi } from '@api/moderationApi';
import type { Report } from '@api/types';
import { formatDateTime, formatTimeAgo, truncateText } from '@utils/format';
import { REPORT_STATUSES, REPORT_REASONS } from '@utils/constants';
import { useSnackbar } from 'notistack';

export default function ReportsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await moderationApi.getReports({ page: page + 1, pageSize, search, status: statusFilter || undefined });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load reports', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (id: string, action: 'RESOLVE' | 'DISMISS') => {
    try {
      setResolveLoading(true);
      await moderationApi.resolveReport(id, { resolution: resolutionText || (action === 'RESOLVE' ? 'Resolved' : 'Dismissed'), action });
      enqueueSnackbar(`Report ${action === 'RESOLVE' ? 'resolved' : 'dismissed'}`, { variant: 'success' });
      setViewReport(null);
      setResolutionText('');
      fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to resolve report', { variant: 'error' }); }
    finally { setResolveLoading(false); }
  };

  const columns = [
    { field: 'reporterName', headerName: 'Reporter', width: 130 },
    { field: 'targetType', headerName: 'Target', width: 100 },
    { field: 'reason', headerName: 'Reason', width: 130 },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 200, valueFormatter: (v: any) => truncateText(v || 'N/A', 60) },
    {
      field: 'status', headerName: 'Status', width: 110, renderCell: (params: any) => {
        const status = REPORT_STATUSES[params.row.status as keyof typeof REPORT_STATUSES];
        return <StatusBadge label={status?.label || params.row.status} color={status?.color as any} />;
      },
    },
    { field: 'createdAt', headerName: 'Created', width: 120, valueFormatter: (v: any) => formatTimeAgo(v) },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false, renderCell: (params: any) => (
        <IconButton size="small" onClick={() => { setViewReport(params.row); setResolutionText(''); }}><ViewIcon fontSize="small" /></IconButton>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Reports Queue" subtitle="Review and resolve user reports" />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField placeholder="Search reports..." size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flexGrow: 1 }} />
            <TextField select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(REPORT_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
            </TextField>
          </Stack>
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Reports Found" message="No reports match your current filters." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewReport} onClose={() => setViewReport(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Report Details</DialogTitle>
        <DialogContent>
          {viewReport && (
            <Box>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reporter</Typography>
                  <Typography variant="body2">{viewReport.reporterName}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Target</Typography>
                  <Typography variant="body2">{viewReport.targetType} (ID: {truncateText(viewReport.targetId, 12)})</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reason</Typography>
                  <Chip label={viewReport.reason} size="small" sx={{ mt: 0.5 }} />
                </Box>
                {viewReport.description && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Description</Typography>
                    <Typography variant="body2">{viewReport.description}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                  <Typography variant="body2">{formatDateTime(viewReport.createdAt)}</Typography>
                </Box>
                {viewReport.status !== 'PENDING' && viewReport.resolution && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Resolution</Typography>
                    <Typography variant="body2">{viewReport.resolution}</Typography>
                    <Typography variant="caption" color="text.secondary">by {viewReport.resolvedByName} on {formatDateTime(viewReport.resolvedAt)}</Typography>
                  </Box>
                )}
                <Divider />
                {viewReport.status === 'PENDING' && (
                  <TextField label="Resolution Note" multiline rows={3} fullWidth value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)} placeholder="Add a note about this resolution..." />
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewReport(null)}>Close</Button>
          {viewReport?.status === 'PENDING' && (
            <>
              <Button variant="outlined" color="default" startIcon={<CloseIcon />} disabled={resolveLoading}
                onClick={() => handleResolve(viewReport.id, 'DISMISS')}>Dismiss</Button>
              <Button variant="contained" color="success" startIcon={<CheckIcon />} disabled={resolveLoading}
                onClick={() => handleResolve(viewReport.id, 'RESOLVE')}>Resolve</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

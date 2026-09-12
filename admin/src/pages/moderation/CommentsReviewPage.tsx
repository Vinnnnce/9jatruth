import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, TextField, MenuItem, IconButton, Avatar, Typography, Stack, Chip } from '@mui/material';
import { Delete as DeleteIcon, Visibility as ViewIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { feedApi } from '@api/feedApi';
import type { Comment } from '@api/types';
import { formatDateTime, formatTimeAgo, truncateText, formatCompactNumber } from '@utils/format';
import { COMMENT_STATUSES } from '@utils/constants';
import { useSnackbar } from 'notistack';

export default function CommentsReviewPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedApi.getComments({ page: page + 1, pageSize, search, status: statusFilter || undefined });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load comments', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await feedApi.deleteComment(deleteId);
      enqueueSnackbar('Comment deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete comment', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await feedApi.updateCommentStatus(id, status);
      enqueueSnackbar('Comment status updated', { variant: 'success' });
      fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to update status', { variant: 'error' }); }
  };

  const columns = [
    {
      field: 'authorName', headerName: 'Author', width: 140, renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'secondary.main' }}>
            {params.row.authorName?.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="body2">{params.row.authorName}</Typography>
        </Box>
      ),
    },
    { field: 'content', headerName: 'Comment', flex: 1, minWidth: 250, valueFormatter: (v: any) => truncateText(v, 80) },
    { field: 'postId', headerName: 'Post ID', width: 100, valueFormatter: (v: any) => truncateText(v, 12) },
    { field: 'likeCount', headerName: 'Likes', width: 80, valueFormatter: (v: any) => formatCompactNumber(v) },
    { field: 'reportCount', headerName: 'Reports', width: 80 },
    {
      field: 'status', headerName: 'Status', width: 110, renderCell: (params: any) => {
        const status = COMMENT_STATUSES[params.row.status as keyof typeof COMMENT_STATUSES];
        return <StatusBadge label={status?.label || params.row.status} color={status?.color as any} />;
      },
    },
    { field: 'createdAt', headerName: 'Created', width: 120, valueFormatter: (v: any) => formatTimeAgo(v) },
    {
      field: 'actions', headerName: 'Actions', width: 120, sortable: false, renderCell: (params: any) => (
        <Box display="flex" gap={1}>
          <TextField select size="small" defaultValue={params.row.status} sx={{ minWidth: 100 }}
            onChange={(e) => handleStatusChange(params.row.id, e.target.value)}>
            {Object.entries(COMMENT_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
          </TextField>
          <IconButton size="small" color="error" onClick={() => setDeleteId(params.row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Comments Review" subtitle="Moderate user comments" />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField placeholder="Search comments..." size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flexGrow: 1 }} />
            <TextField select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">All Statuses</MenuItem>
              {Object.entries(COMMENT_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
            </TextField>
          </Stack>
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Comments Found" message="No comments match your current filters." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} rowHeight={56} />
          )}
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} title="Delete Comment" message="Are you sure you want to delete this comment?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

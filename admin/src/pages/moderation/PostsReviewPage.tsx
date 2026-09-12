import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, TextField, MenuItem, IconButton, Chip, Avatar, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack } from '@mui/material';
import { Delete as DeleteIcon, Visibility as ViewIcon, Flag as FlagIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { feedApi } from '@api/feedApi';
import type { Post } from '@api/types';
import { formatDateTime, formatTimeAgo, formatCompactNumber, truncateText, getTruthScoreColor, getTruthScoreLabel } from '@utils/format';
import { POST_STATUSES, POST_CATEGORIES } from '@utils/constants';
import { useSnackbar } from 'notistack';

export default function PostsReviewPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewPost, setViewPost] = useState<Post | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedApi.getPosts({ page: page + 1, pageSize, search, status: statusFilter || undefined });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load posts', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await feedApi.deletePost(deleteId);
      enqueueSnackbar('Post deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete post', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await feedApi.updatePostStatus(id, status);
      enqueueSnackbar('Post status updated', { variant: 'success' });
      fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to update status', { variant: 'error' }); }
  };

  const columns = [
    {
      field: 'authorName', headerName: 'Author', width: 140, renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'primary.main' }}>
            {params.row.authorName?.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="body2">{params.row.authorName}</Typography>
        </Box>
      ),
    },
    { field: 'content', headerName: 'Content', flex: 1, minWidth: 250, valueFormatter: (v: any) => truncateText(v, 80) },
    { field: 'category', headerName: 'Category', width: 120 },
    {
      field: 'truthScore', headerName: 'Truth Score', width: 120, renderCell: (params: any) => {
        const score = params.row.truthScore;
        return <StatusBadge label={getTruthScoreLabel(score)} color={getTruthScoreColor(score) as any} />;
      },
    },
    {
      field: 'status', headerName: 'Status', width: 110, renderCell: (params: any) => {
        const status = POST_STATUSES[params.row.status as keyof typeof POST_STATUSES];
        return <StatusBadge label={status?.label || params.row.status} color={status?.color as any} />;
      },
    },
    { field: 'likeCount', headerName: 'Likes', width: 80, valueFormatter: (v: any) => formatCompactNumber(v) },
    { field: 'reportCount', headerName: 'Reports', width: 80, renderCell: (params: any) => (
      params.row.reportCount > 0 ? <Chip size="small" color="error" label={params.row.reportCount} icon={<FlagIcon />} /> : '0'
    )},
    { field: 'createdAt', headerName: 'Created', width: 120, valueFormatter: (v: any) => formatTimeAgo(v) },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false, renderCell: (params: any) => (
        <Box>
          <IconButton size="small" onClick={() => setViewPost(params.row)}><ViewIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteId(params.row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Posts Review" subtitle="Moderate and manage user posts" />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField placeholder="Search posts..." size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flexGrow: 1 }} />
            <TextField select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">All Statuses</MenuItem>
              {Object.entries(POST_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
            </TextField>
          </Stack>
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Posts Found" message="No posts match your current filters." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewPost} onClose={() => setViewPost(null)} maxWidth="md" fullWidth>
        <DialogTitle>Post Details</DialogTitle>
        <DialogContent>
          {viewPost && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>{viewPost.authorName?.charAt(0).toUpperCase()}</Avatar>
                <Box>
                  <Typography variant="subtitle2">{viewPost.authorName}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDateTime(viewPost.createdAt)}</Typography>
                </Box>
              </Stack>
              <Typography variant="body1" paragraph>{viewPost.content}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
                <Chip label={`Category: ${viewPost.category}`} size="small" />
                <Chip label={`Likes: ${viewPost.likeCount}`} size="small" />
                <Chip label={`Comments: ${viewPost.commentCount}`} size="small" />
                <Chip label={`Reports: ${viewPost.reportCount}`} size="small" color={viewPost.reportCount > 0 ? 'error' : 'default'} />
                {viewPost.truthScore !== undefined && (
                  <Chip label={`Truth Score: ${viewPost.truthScore}`} size="small" color={getTruthScoreColor(viewPost.truthScore) as any} />
                )}
              </Stack>
              <TextField select fullWidth label="Change Status" defaultValue={viewPost.status}
                onChange={(e) => handleStatusChange(viewPost.id, e.target.value)}>
                {Object.entries(POST_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPost(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete Post" message="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

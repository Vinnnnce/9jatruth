import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Avatar, Typography, Stack } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Publish as PublishIcon, Archive as ArchiveIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { newsApi } from '@api/newsApi';
import type { NewsArticle } from '@api/types';
import { formatDate, truncateText } from '@utils/format';
import { NEWS_STATUSES, NEWS_CATEGORIES } from '@utils/constants';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  title: yup.string().required('Title is required'),
  summary: yup.string().required('Summary is required'),
  content: yup.string().required('Content is required'),
  source: yup.string().required('Source is required'),
  sourceUrl: yup.string().url('Must be a valid URL').optional(),
  imageUrl: yup.string().url('Must be a valid URL').optional(),
  category: yup.string().required('Category is required'),
  status: yup.string().required('Status is required'),
});

type FormData = yup.InferType<typeof schema>;

export default function NewsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsArticle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await newsApi.getNews({ page: page + 1, pageSize, search, status: statusFilter || undefined });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load news', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ title: '', summary: '', content: '', source: '', sourceUrl: '', imageUrl: '', category: '', status: 'DRAFT' }); setDialogOpen(true); };
  const handleOpenEdit = (item: NewsArticle) => { setEditingItem(item); reset({ title: item.title, summary: item.summary, content: item.content, source: item.source, sourceUrl: item.sourceUrl || '', imageUrl: item.imageUrl || '', category: item.category, status: item.status }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await newsApi.updateNews(editingItem.id, data); enqueueSnackbar('News updated', { variant: 'success' }); }
      else { await newsApi.createNews(data); enqueueSnackbar('News created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save news', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await newsApi.deleteNews(deleteId);
      enqueueSnackbar('News deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete news', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const handlePublish = async (id: string) => {
    try { await newsApi.publishNews(id); enqueueSnackbar('News published', { variant: 'success' }); fetchData(); }
    catch (err: any) { enqueueSnackbar(err.message || 'Failed to publish', { variant: 'error' }); }
  };

  const handleArchive = async (id: string) => {
    try { await newsApi.archiveNews(id); enqueueSnackbar('News archived', { variant: 'success' }); fetchData(); }
    catch (err: any) { enqueueSnackbar(err.message || 'Failed to archive', { variant: 'error' }); }
  };

  const columns = [
    {
      field: 'title', headerName: 'Title', flex: 1, minWidth: 200, renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1}>
          {params.row.imageUrl && <Avatar variant="square" src={params.row.imageUrl} sx={{ width: 40, height: 40 }} />}
          <Typography variant="body2">{truncateText(params.row.title, 50)}</Typography>
        </Box>
      ),
    },
    { field: 'category', headerName: 'Category', width: 120 },
    { field: 'source', headerName: 'Source', width: 120 },
    {
      field: 'status', headerName: 'Status', width: 110, renderCell: (params: any) => {
        const status = NEWS_STATUSES[params.row.status as keyof typeof NEWS_STATUSES];
        return <StatusBadge label={status?.label || params.row.status} color={status?.color as any} />;
      },
    },
    { field: 'publishedAt', headerName: 'Published', width: 130, valueFormatter: (v: any) => formatDate(v) },
    { field: 'authorName', headerName: 'Author', width: 120, valueFormatter: (v: any) => v || 'N/A' },
    {
      field: 'actions', headerName: 'Actions', width: 160, sortable: false, renderCell: (params: any) => (
        <Box display="flex" gap={0.5}>
          <IconButton size="small" onClick={() => handleOpenEdit(params.row)}><EditIcon fontSize="small" /></IconButton>
          {params.row.status === 'DRAFT' && <IconButton size="small" color="success" onClick={() => handlePublish(params.row.id)}><PublishIcon fontSize="small" /></IconButton>}
          {params.row.status === 'PUBLISHED' && <IconButton size="small" onClick={() => handleArchive(params.row.id)}><ArchiveIcon fontSize="small" /></IconButton>}
          <IconButton size="small" color="error" onClick={() => setDeleteId(params.row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="News Management" subtitle="Manage news articles"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add News</Button>} />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField placeholder="Search news..." size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flexGrow: 1 }} />
            <TextField select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(NEWS_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
            </TextField>
          </Stack>
          {rows.length === 0 && !loading ? (
            <EmptyState title="No News Found" message="Create your first news article to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit News' : 'Add News'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField {...register('title')} label="Title" fullWidth error={!!errors.title} helperText={errors.title?.message} /></Grid>
              <Grid item xs={12}><TextField {...register('summary')} label="Summary" multiline rows={2} fullWidth error={!!errors.summary} helperText={errors.summary?.message} /></Grid>
              <Grid item xs={12}><TextField {...register('content')} label="Content" multiline rows={6} fullWidth error={!!errors.content} helperText={errors.content?.message} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('source')} label="Source" fullWidth error={!!errors.source} helperText={errors.source?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('category')} select label="Category" fullWidth error={!!errors.category} helperText={errors.category?.message} defaultValue="">
                  {NEWS_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}><TextField {...register('sourceUrl')} label="Source URL" fullWidth error={!!errors.sourceUrl} helperText={errors.sourceUrl?.message} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('imageUrl')} label="Image URL" fullWidth error={!!errors.imageUrl} helperText={errors.imageUrl?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('status')} select label="Status" fullWidth error={!!errors.status} helperText={errors.status?.message} defaultValue="DRAFT">
                  {Object.entries(NEWS_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteId} title="Delete News" message="Are you sure you want to delete this news article?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

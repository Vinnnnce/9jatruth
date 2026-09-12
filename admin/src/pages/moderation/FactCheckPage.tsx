import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Typography, Stack, Link } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { moderationApi } from '@api/moderationApi';
import type { FactCheck } from '@api/types';
import { formatDateTime, truncateText } from '@utils/format';
import { FACT_CHECK_VERDICTS } from '@utils/constants';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  postId: yup.string().required('Post ID is required'),
  claim: yup.string().required('Claim is required'),
  verdict: yup.string().required('Verdict is required'),
  explanation: yup.string().required('Explanation is required'),
  sources: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function FactCheckPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<FactCheck[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FactCheck | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await moderationApi.getFactChecks({ page: page + 1, pageSize, search });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load fact checks', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ postId: '', claim: '', verdict: '', explanation: '', sources: '' }); setDialogOpen(true); };
  const handleOpenEdit = (item: FactCheck) => {
    setEditingItem(item);
    reset({ postId: item.postId, claim: item.claim, verdict: item.verdict, explanation: item.explanation, sources: item.sources?.join('\n') || '' });
    setDialogOpen(true);
  };

  const handleSubmitForm = async (data: FormData) => {
    try {
      const payload = { ...data, sources: data.sources ? data.sources.split('\n').filter(Boolean) : [] };
      if (editingItem) { await moderationApi.updateFactCheck(editingItem.id, payload); enqueueSnackbar('Fact check updated', { variant: 'success' }); }
      else { await moderationApi.createFactCheck(payload); enqueueSnackbar('Fact check created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save fact check', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await moderationApi.deleteFactCheck(deleteId);
      enqueueSnackbar('Fact check deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete fact check', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'postTitle', headerName: 'Post', width: 150, valueFormatter: (v: any) => truncateText(v || 'N/A', 40) },
    { field: 'claim', headerName: 'Claim', flex: 1, minWidth: 250, valueFormatter: (v: any) => truncateText(v, 80) },
    {
      field: 'verdict', headerName: 'Verdict', width: 130, renderCell: (params: any) => {
        const verdict = FACT_CHECK_VERDICTS[params.row.verdict as keyof typeof FACT_CHECK_VERDICTS];
        return <StatusBadge label={verdict?.label || params.row.verdict} color={verdict?.color as any} />;
      },
    },
    { field: 'explanation', headerName: 'Explanation', width: 200, valueFormatter: (v: any) => truncateText(v, 60) },
    { field: 'checkedByName', headerName: 'Checked By', width: 130 },
    { field: 'createdAt', headerName: 'Created', width: 130, valueFormatter: (v: any) => formatDateTime(v) },
    {
      field: 'actions', headerName: 'Actions', width: 120, sortable: false, renderCell: (params: any) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenEdit(params.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteId(params.row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Fact Checks" subtitle="Manage fact-checks for posts"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Fact Check</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search fact checks..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Fact Checks Found" message="Create your first fact check to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Fact Check' : 'Add Fact Check'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField {...register('postId')} label="Post ID" fullWidth error={!!errors.postId} helperText={errors.postId?.message} /></Grid>
              <Grid item xs={12}><TextField {...register('claim')} label="Claim" multiline rows={2} fullWidth error={!!errors.claim} helperText={errors.claim?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('verdict')} select label="Verdict" fullWidth error={!!errors.verdict} helperText={errors.verdict?.message} defaultValue="">
                  {Object.entries(FACT_CHECK_VERDICTS).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}><TextField {...register('explanation')} label="Explanation" multiline rows={4} fullWidth error={!!errors.explanation} helperText={errors.explanation?.message} /></Grid>
              <Grid item xs={12}><TextField {...register('sources')} label="Sources (one per line)" multiline rows={3} fullWidth helperText="Enter each source URL on a new line" /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteId} title="Delete Fact Check" message="Are you sure you want to delete this fact check?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

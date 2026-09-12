import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import { geoApi } from '@api/geoApi';
import type { Community, Ward } from '@api/types';
import { formatDate } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  wardId: yup.string().required('Ward is required'),
  type: yup.string().required('Type is required'),
});

type FormData = yup.InferType<typeof schema>;

const COMMUNITY_TYPES = ['Urban', 'Rural', 'Semi-Urban', 'Village', 'Town'];

export default function CommunitiesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Community[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Community | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [commRes, wardsRes] = await Promise.all([
        geoApi.getCommunities({ page: page + 1, pageSize, search }),
        geoApi.getWards({ pageSize: 100 }),
      ]);
      setRows(commRes.data);
      setTotal(commRes.total);
      setWards(wardsRes.data);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load communities', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ name: '', wardId: '', type: '' }); setDialogOpen(true); };
  const handleOpenEdit = (item: Community) => { setEditingItem(item); reset({ name: item.name, wardId: item.wardId, type: item.type }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await geoApi.updateCommunity(editingItem.id, data); enqueueSnackbar('Community updated', { variant: 'success' }); }
      else { await geoApi.createCommunity(data); enqueueSnackbar('Community created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save community', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await geoApi.deleteCommunity(deleteId);
      enqueueSnackbar('Community deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete community', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'type', headerName: 'Type', width: 120 },
    { field: 'wardName', headerName: 'Ward', width: 150 },
    { field: 'createdAt', headerName: 'Created', width: 130, valueFormatter: (v: any) => formatDate(v) },
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
      <PageHeader title="Communities" subtitle="Manage communities within wards"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Community</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search communities..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Communities Found" message="Add your first community to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Community' : 'Add Community'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField {...register('name')} label="Community Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('type')} select label="Type" fullWidth error={!!errors.type} helperText={errors.type?.message} defaultValue="">
                  {COMMUNITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('wardId')} select label="Ward" fullWidth error={!!errors.wardId} helperText={errors.wardId?.message} defaultValue="">
                  {wards.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
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
      <ConfirmDialog open={!!deleteId} title="Delete Community" message="Are you sure you want to delete this community?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

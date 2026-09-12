import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import { geoApi } from '@api/geoApi';
import type { Ward, Lga } from '@api/types';
import { formatDate } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  code: yup.string().required('Code is required'),
  lgaId: yup.string().required('LGA is required'),
});

type FormData = yup.InferType<typeof schema>;

export default function WardsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Ward[]>([]);
  const [lgas, setLgas] = useState<Lga[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [wardsRes, lgasRes] = await Promise.all([
        geoApi.getWards({ page: page + 1, pageSize, search }),
        geoApi.getLgas({ pageSize: 100 }),
      ]);
      setRows(wardsRes.data);
      setTotal(wardsRes.total);
      setLgas(lgasRes.data);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load wards', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ name: '', code: '', lgaId: '' }); setDialogOpen(true); };
  const handleOpenEdit = (item: Ward) => { setEditingItem(item); reset({ name: item.name, code: item.code, lgaId: item.lgaId }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await geoApi.updateWard(editingItem.id, data); enqueueSnackbar('Ward updated', { variant: 'success' }); }
      else { await geoApi.createWard(data); enqueueSnackbar('Ward created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save ward', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await geoApi.deleteWard(deleteId);
      enqueueSnackbar('Ward deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete ward', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'lgaName', headerName: 'LGA', width: 150 },
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
      <PageHeader title="Wards" subtitle="Manage wards within LGAs"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Ward</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search wards..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Wards Found" message="Add your first ward to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Ward' : 'Add Ward'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}><TextField {...register('name')} label="Ward Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('code')} label="Code" fullWidth error={!!errors.code} helperText={errors.code?.message} /></Grid>
              <Grid item xs={12}>
                <TextField {...register('lgaId')} select label="LGA" fullWidth error={!!errors.lgaId} helperText={errors.lgaId?.message} defaultValue="">
                  {lgas.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
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
      <ConfirmDialog open={!!deleteId} title="Delete Ward" message="Are you sure you want to delete this ward?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import { politicsApi } from '@api/politicsApi';
import type { Office } from '@api/types';
import { formatDate } from '@utils/format';
import { OFFICE_LEVELS } from '@utils/constants';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  level: yup.string().required('Level is required'),
  description: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function OfficesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Office[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Office | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await politicsApi.getOffices({ page: page + 1, pageSize, search });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load offices', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ name: '', level: '', description: '' }); setDialogOpen(true); };
  const handleOpenEdit = (item: Office) => { setEditingItem(item); reset({ name: item.name, level: item.level, description: item.description || '' }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await politicsApi.updateOffice(editingItem.id, data); enqueueSnackbar('Office updated', { variant: 'success' }); }
      else { await politicsApi.createOffice(data); enqueueSnackbar('Office created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save office', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await politicsApi.deleteOffice(deleteId);
      enqueueSnackbar('Office deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete office', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'name', headerName: 'Office Name', flex: 1, minWidth: 180 },
    { field: 'level', headerName: 'Level', width: 120, valueFormatter: (v: any) => OFFICE_LEVELS[v as keyof typeof OFFICE_LEVELS] || v },
    { field: 'description', headerName: 'Description', width: 250, valueFormatter: (v: any) => v || 'N/A' },
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
      <PageHeader title="Offices" subtitle="Manage political offices"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Office</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search offices..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Offices Found" message="Add your first office to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Office' : 'Add Office'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}><TextField {...register('name')} label="Office Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('level')} select label="Level" fullWidth error={!!errors.level} helperText={errors.level?.message} defaultValue="">
                  {Object.entries(OFFICE_LEVELS).map(([val, label]) => <MenuItem key={val} value={val}>{label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}><TextField {...register('description')} label="Description" multiline rows={2} fullWidth /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteId} title="Delete Office" message="Are you sure you want to delete this office?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

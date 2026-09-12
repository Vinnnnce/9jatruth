import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Switch, FormControlLabel, Avatar } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { politicsApi } from '@api/politicsApi';
import type { Party } from '@api/types';
import { formatDate } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  acronym: yup.string().required('Acronym is required').max(10, 'Max 10 characters'),
  color: yup.string().optional(),
  foundedYear: yup.number().optional(),
  ideology: yup.string().optional(),
  isActive: yup.boolean().default(true),
});

type FormData = yup.InferType<typeof schema>;

const PARTY_COLORS = ['#008751', '#FCD116', '#D32F2F', '#1976D2', '#7B1FA2', '#E65100', '#00695C', '#424242'];

export default function PartiesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Party | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const isActive = watch('isActive', true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await politicsApi.getParties({ page: page + 1, pageSize, search });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load parties', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ name: '', acronym: '', color: '', foundedYear: undefined, ideology: '', isActive: true }); setDialogOpen(true); };
  const handleOpenEdit = (item: Party) => { setEditingItem(item); reset({ name: item.name, acronym: item.acronym, color: item.color || '', foundedYear: item.foundedYear, ideology: item.ideology || '', isActive: item.isActive }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await politicsApi.updateParty(editingItem.id, data); enqueueSnackbar('Party updated', { variant: 'success' }); }
      else { await politicsApi.createParty(data); enqueueSnackbar('Party created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save party', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await politicsApi.deleteParty(deleteId);
      enqueueSnackbar('Party deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete party', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    {
      field: 'acronym', headerName: 'Logo', width: 70, renderCell: (params: any) => (
        <Avatar sx={{ bgcolor: params.row.color || '#008751', width: 36, height: 36, fontSize: 12, fontWeight: 700 }}>
          {params.row.acronym?.substring(0, 3)}
        </Avatar>
      ),
    },
    { field: 'name', headerName: 'Party Name', flex: 1, minWidth: 180 },
    { field: 'acronym', headerName: 'Acronym', width: 100 },
    { field: 'foundedYear', headerName: 'Founded', width: 100, valueFormatter: (v: any) => v || 'N/A' },
    { field: 'ideology', headerName: 'Ideology', width: 150, valueFormatter: (v: any) => v || 'N/A' },
    {
      field: 'isActive', headerName: 'Status', width: 110, renderCell: (params: any) => (
        <StatusBadge label={params.row.isActive ? 'Active' : 'Inactive'} color={params.row.isActive ? 'success' : 'default'} />
      ),
    },
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
      <PageHeader title="Political Parties" subtitle="Manage registered political parties"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Party</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search parties..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Parties Found" message="Add your first political party to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Party' : 'Add Party'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={7}><TextField {...register('name')} label="Party Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
              <Grid item xs={12} sm={5}><TextField {...register('acronym')} label="Acronym" fullWidth error={!!errors.acronym} helperText={errors.acronym?.message} inputProps={{ maxLength: 10 }} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('color')} select label="Color" fullWidth defaultValue="">
                {PARTY_COLORS.map((c) => <MenuItem key={c} value={c}><Box component="span" sx={{ display: 'inline-block', width: 16, height: 16, borderRadius: 1, bgcolor: c, mr: 1 }} />{c}</MenuItem>)}
              </TextField></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('foundedYear')} type="number" label="Founded Year" fullWidth /></Grid>
              <Grid item xs={12}><TextField {...register('ideology')} label="Ideology" fullWidth /></Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch {...register('isActive')} checked={isActive} onChange={(e) => setValue('isActive', e.target.checked)} />} label="Active Party" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteId} title="Delete Party" message="Are you sure you want to delete this party?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

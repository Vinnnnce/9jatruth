import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import { geoApi } from '@api/geoApi';
import type { Lga, State } from '@api/types';
import { formatDate } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  code: yup.string().required('Code is required'),
  stateId: yup.string().required('State is required'),
});

type FormData = yup.InferType<typeof schema>;

export default function LgasPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Lga[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Lga | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [lgasRes, statesRes] = await Promise.all([
        geoApi.getLgas({ page: page + 1, pageSize, search }),
        geoApi.getStates({ pageSize: 100 }),
      ]);
      setRows(lgasRes.data);
      setTotal(lgasRes.total);
      setStates(statesRes.data);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load LGAs', { variant: 'error' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ name: '', code: '', stateId: '' }); setDialogOpen(true); };
  const handleOpenEdit = (item: Lga) => { setEditingItem(item); reset({ name: item.name, code: item.code, stateId: item.stateId }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) {
        await geoApi.updateLga(editingItem.id, data);
        enqueueSnackbar('LGA updated successfully', { variant: 'success' });
      } else {
        await geoApi.createLga(data);
        enqueueSnackbar('LGA created successfully', { variant: 'success' });
      }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save LGA', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await geoApi.deleteLga(deleteId);
      enqueueSnackbar('LGA deleted successfully', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete LGA', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'stateName', headerName: 'State', width: 150 },
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
      <PageHeader title="Local Government Areas" subtitle="Manage LGAs across states"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add LGA</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search LGAs..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No LGAs Found" message="Add your first LGA to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit LGA' : 'Add LGA'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}><TextField {...register('name')} label="LGA Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('code')} label="Code" fullWidth error={!!errors.code} helperText={errors.code?.message} /></Grid>
              <Grid item xs={12}>
                <TextField {...register('stateId')} select label="State" fullWidth error={!!errors.stateId} helperText={errors.stateId?.message} defaultValue="">
                  {states.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
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
      <ConfirmDialog open={!!deleteId} title="Delete LGA" message="Are you sure you want to delete this LGA?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

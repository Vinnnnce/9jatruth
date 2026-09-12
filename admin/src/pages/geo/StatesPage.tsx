import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, FileUpload as ImportIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import { geoApi } from '@api/geoApi';
import type { State } from '@api/types';
import { formatDate } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { TextField, MenuItem, Grid } from '@mui/material';
import { NIGERIAN_REGIONS } from '@utils/constants';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  code: yup.string().required('Code is required'),
  region: yup.string().required('Region is required'),
  population: yup.number().optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function StatesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<State[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<State | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await geoApi.getStates({ page: page + 1, pageSize, search });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load states', { variant: 'error' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    reset({ name: '', code: '', region: '', population: undefined });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: State) => {
    setEditingItem(item);
    reset({ name: item.name, code: item.code, region: item.region, population: item.population });
    setDialogOpen(true);
  };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) {
        await geoApi.updateState(editingItem.id, data);
        enqueueSnackbar('State updated successfully', { variant: 'success' });
      } else {
        await geoApi.createState(data);
        enqueueSnackbar('State created successfully', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to save state', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await geoApi.deleteState(deleteId);
      enqueueSnackbar('State deleted successfully', { variant: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to delete state', { variant: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'region', headerName: 'Region', width: 150 },
    { field: 'population', headerName: 'Population', width: 130, valueFormatter: (v: any) => v?.toLocaleString() || 'N/A' },
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
      <PageHeader
        title="States"
        subtitle="Manage Nigerian states"
        actions={
          <>
            <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => enqueueSnackbar('Import feature coming soon', { variant: 'info' })}>
              Import
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
              Add State
            </Button>
          </>
        }
      />
      <Card>
        <CardContent>
          <TextField
            placeholder="Search states..."
            size="small"
            sx={{ mb: 2 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No States Found" message="Add your first state to get started." />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              total={total}
              page={page}
              pageSize={pageSize}
              loading={loading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit State' : 'Add State'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField {...register('name')} label="State Name" fullWidth error={!!errors.name} helperText={errors.name?.message} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('code')} label="Code" fullWidth error={!!errors.code} helperText={errors.code?.message} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('region')} select label="Region" fullWidth error={!!errors.region} helperText={errors.region?.message} defaultValue="">
                  {NIGERIAN_REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('population')} type="number" label="Population" fullWidth />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete State"
        message="Are you sure you want to delete this state? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />
    </Box>
  );
}

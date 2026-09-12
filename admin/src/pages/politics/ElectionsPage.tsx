import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, DatePicker } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { politicsApi } from '@api/politicsApi';
import { geoApi } from '@api/geoApi';
import type { Election, State } from '@api/types';
import { formatDate } from '@utils/format';
import { ELECTION_STATUSES, ELECTION_TYPES } from '@utils/constants';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  type: yup.string().required('Type is required'),
  date: yup.string().required('Date is required'),
  status: yup.string().required('Status is required'),
  description: yup.string().optional(),
  stateId: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function ElectionsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Election | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [electionDate, setElectionDate] = useState<dayjs.Dayjs | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [elecRes, statesRes] = await Promise.all([
        politicsApi.getElections({ page: page + 1, pageSize, search }),
        geoApi.getStates({ pageSize: 100 }),
      ]);
      setRows(elecRes.data);
      setTotal(elecRes.total);
      setStates(statesRes.data);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load elections', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    reset({ name: '', type: '', date: '', status: '', description: '', stateId: '' });
    setElectionDate(null);
    setDialogOpen(true);
  };
  const handleOpenEdit = (item: Election) => {
    setEditingItem(item);
    reset({ name: item.name, type: item.type, date: item.date, status: item.status, description: item.description || '', stateId: item.stateId || '' });
    setElectionDate(dayjs(item.date));
    setDialogOpen(true);
  };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await politicsApi.updateElection(editingItem.id, data); enqueueSnackbar('Election updated', { variant: 'success' }); }
      else { await politicsApi.createElection(data); enqueueSnackbar('Election created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save election', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await politicsApi.deleteElection(deleteId);
      enqueueSnackbar('Election deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete election', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    { field: 'name', headerName: 'Election Name', flex: 1, minWidth: 180 },
    { field: 'type', headerName: 'Type', width: 140, valueFormatter: (v: any) => ELECTION_TYPES[v as keyof typeof ELECTION_TYPES] || v },
    { field: 'date', headerName: 'Date', width: 130, valueFormatter: (v: any) => formatDate(v) },
    { field: 'stateName', headerName: 'State', width: 120, valueFormatter: (v: any) => v || 'National' },
    {
      field: 'status', headerName: 'Status', width: 120, renderCell: (params: any) => {
        const status = ELECTION_STATUSES[params.row.status as keyof typeof ELECTION_STATUSES];
        return <StatusBadge label={status?.label || params.row.status} color={status?.color as any} />;
      },
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
      <PageHeader title="Elections" subtitle="Manage elections"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Election</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search elections..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Elections Found" message="Add your first election to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <form onSubmit={handleSubmit(handleSubmitForm)}>
            <DialogTitle>{editingItem ? 'Edit Election' : 'Add Election'}</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}><TextField {...register('name')} label="Election Name" fullWidth error={!!errors.name} helperText={errors.name?.message} /></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField {...register('type')} select label="Type" fullWidth error={!!errors.type} helperText={errors.type?.message} defaultValue="">
                    {Object.entries(ELECTION_TYPES).map(([val, label]) => <MenuItem key={val} value={val}>{label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField {...register('status')} select label="Status" fullWidth error={!!errors.status} helperText={errors.status?.message} defaultValue="">
                    {Object.entries(ELECTION_STATUSES).map(([val, info]) => <MenuItem key={val} value={val}>{info.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Election Date"
                    value={electionDate}
                    onChange={(newValue) => {
                      setElectionDate(newValue);
                      setValue('date', newValue?.toISOString() || '');
                    }}
                    sx={{ width: '100%' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField {...register('stateId')} select label="State (optional)" fullWidth defaultValue="">
                    <MenuItem value="">National</MenuItem>
                    {states.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
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
      </LocalizationProvider>
      <ConfirmDialog open={!!deleteId} title="Delete Election" message="Are you sure you want to delete this election?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

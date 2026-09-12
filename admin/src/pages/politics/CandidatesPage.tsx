import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Switch, FormControlLabel, Avatar } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import { politicsApi } from '@api/politicsApi';
import type { Candidate, Party, Office, State } from '@api/types';
import { formatDate, getInitials } from '@utils/format';
import { useSnackbar } from 'notistack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { geoApi } from '@api/geoApi';

const schema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  partyId: yup.string().required('Party is required'),
  officeId: yup.string().required('Office is required'),
  stateId: yup.string().optional(),
  bio: yup.string().optional(),
  isActive: yup.boolean().default(true),
});

type FormData = yup.InferType<typeof schema>;

export default function CandidatesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Candidate[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Candidate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({ resolver: yupResolver(schema) });
  const isActive = watch('isActive', true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [candRes, partiesRes, officesRes, statesRes] = await Promise.all([
        politicsApi.getCandidates({ page: page + 1, pageSize, search }),
        politicsApi.getParties({ pageSize: 100 }),
        politicsApi.getOffices({ pageSize: 100 }),
        geoApi.getStates({ pageSize: 100 }),
      ]);
      setRows(candRes.data);
      setTotal(candRes.total);
      setParties(partiesRes.data);
      setOffices(officesRes.data);
      setStates(statesRes.data);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load candidates', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAdd = () => { setEditingItem(null); reset({ firstName: '', lastName: '', partyId: '', officeId: '', stateId: '', bio: '', isActive: true }); setDialogOpen(true); };
  const handleOpenEdit = (item: Candidate) => { setEditingItem(item); reset({ firstName: item.firstName, lastName: item.lastName, partyId: item.partyId, officeId: item.officeId, stateId: item.stateId || '', bio: item.bio || '', isActive: item.isActive }); setDialogOpen(true); };

  const handleSubmitForm = async (data: FormData) => {
    try {
      if (editingItem) { await politicsApi.updateCandidate(editingItem.id, data); enqueueSnackbar('Candidate updated', { variant: 'success' }); }
      else { await politicsApi.createCandidate(data); enqueueSnackbar('Candidate created', { variant: 'success' }); }
      setDialogOpen(false); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to save candidate', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await politicsApi.deleteCandidate(deleteId);
      enqueueSnackbar('Candidate deleted', { variant: 'success' });
      setDeleteId(null); fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to delete candidate', { variant: 'error' }); }
    finally { setDeleteLoading(false); }
  };

  const columns = [
    {
      field: 'fullName', headerName: 'Candidate', flex: 1, minWidth: 180, renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: 'primary.main' }}>
            {getInitials(params.row.firstName, params.row.lastName)}
          </Avatar>
          <Box>{params.row.fullName}</Box>
        </Box>
      ),
    },
    { field: 'partyAcronym', headerName: 'Party', width: 100 },
    { field: 'officeName', headerName: 'Office', width: 150 },
    { field: 'stateName', headerName: 'State', width: 120, valueFormatter: (v: any) => v || 'N/A' },
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
      <PageHeader title="Candidates" subtitle="Manage political candidates"
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>Add Candidate</Button>} />
      <Card>
        <CardContent>
          <TextField placeholder="Search candidates..." size="small" sx={{ mb: 2 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Candidates Found" message="Add your first candidate to get started." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <DialogTitle>{editingItem ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}><TextField {...register('firstName')} label="First Name" fullWidth error={!!errors.firstName} helperText={errors.firstName?.message} /></Grid>
              <Grid item xs={12} sm={6}><TextField {...register('lastName')} label="Last Name" fullWidth error={!!errors.lastName} helperText={errors.lastName?.message} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('partyId')} select label="Party" fullWidth error={!!errors.partyId} helperText={errors.partyId?.message} defaultValue="">
                  {parties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} ({p.acronym})</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('officeId')} select label="Office" fullWidth error={!!errors.officeId} helperText={errors.officeId?.message} defaultValue="">
                  {offices.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField {...register('stateId')} select label="State (optional)" fullWidth defaultValue="">
                  <MenuItem value="">None</MenuItem>
                  {states.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}><TextField {...register('bio')} label="Bio" multiline rows={3} fullWidth /></Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch {...register('isActive')} checked={isActive} onChange={(e) => setValue('isActive', e.target.checked)} />} label="Active Candidate" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteId} title="Delete Candidate" message="Are you sure you want to delete this candidate?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </Box>
  );
}

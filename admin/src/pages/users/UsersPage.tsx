import { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, TextField, MenuItem, IconButton, Avatar, Typography, Stack, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid } from '@mui/material';
import { Edit as EditIcon, Block as BlockIcon, PersonOff as DeactivateIcon, PersonAdd as ActivateIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import EmptyState from '@components/EmptyState';
import StatusBadge from '@components/StatusBadge';
import apiClient from '@api/client';
import type { User, PaginatedResponse, UserRole } from '@api/types';
import { formatDate, formatDateTime, getInitials } from '@utils/format';
import { ROLES, ROLE_OPTIONS } from '@utils/constants';
import { useSnackbar } from 'notistack';
import { useAppSelector } from '@store/hooks';

export default function UsersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('EDITOR');
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blockAction, setBlockAction] = useState<'block' | 'unblock'>('block');
  const [blockLoading, setBlockLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page: page + 1, pageSize, search };
      if (roleFilter) params.role = roleFilter;
      const response = await apiClient.get<PaginatedResponse<User>>('/users', { params });
      setRows(response.data);
      setTotal(response.total);
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Failed to load users', { variant: 'error' });
      setRows([]);
    } finally { setLoading(false); }
  }, [page, pageSize, search, roleFilter, enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateRole = async () => {
    if (!editUser) return;
    try {
      await apiClient.put(`/users/${editUser.id}/role`, { role: selectedRole });
      enqueueSnackbar('User role updated', { variant: 'success' });
      setEditUser(null);
      fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to update role', { variant: 'error' }); }
  };

  const handleToggleBlock = async () => {
    if (!blockId) return;
    try {
      setBlockLoading(true);
      await apiClient.put(`/users/${blockId}/status`, { isActive: blockAction === 'unblock' });
      enqueueSnackbar(`User ${blockAction === 'block' ? 'blocked' : 'activated'}`, { variant: 'success' });
      setBlockId(null);
      fetchData();
    } catch (err: any) { enqueueSnackbar(err.message || 'Failed to update user status', { variant: 'error' }); }
    finally { setBlockLoading(false); }
  };

  const columns = [
    {
      field: 'fullName', headerName: 'User', flex: 1, minWidth: 180, renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar src={params.row.avatar} sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
            {getInitials(params.row.firstName, params.row.lastName)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{params.row.fullName}</Typography>
            <Typography variant="caption" color="text.secondary">{params.row.email}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'role', headerName: 'Role', width: 130, renderCell: (params: any) => {
        const role = ROLES[params.row.role as UserRole];
        return <StatusBadge label={role?.label || params.row.role} color={role?.color as any} />;
      },
    },
    { field: 'phone', headerName: 'Phone', width: 130, valueFormatter: (v: any) => v || 'N/A' },
    {
      field: 'isActive', headerName: 'Status', width: 100, renderCell: (params: any) => (
        <StatusBadge label={params.row.isActive ? 'Active' : 'Blocked'} color={params.row.isActive ? 'success' : 'error'} />
      ),
    },
    { field: 'lastLoginAt', headerName: 'Last Login', width: 140, valueFormatter: (v: any) => v ? formatDateTime(v) : 'Never' },
    { field: 'createdAt', headerName: 'Joined', width: 120, valueFormatter: (v: any) => formatDate(v) },
    {
      field: 'actions', headerName: 'Actions', width: 130, sortable: false, renderCell: (params: any) => (
        <Box display="flex" gap={0.5}>
          <IconButton size="small" onClick={() => { setEditUser(params.row); setSelectedRole(params.row.role); }}><EditIcon fontSize="small" /></IconButton>
          {params.row.isActive ? (
            <IconButton size="small" color="error" onClick={() => { setBlockId(params.row.id); setBlockAction('block'); }}><DeactivateIcon fontSize="small" /></IconButton>
          ) : (
            <IconButton size="small" color="success" onClick={() => { setBlockId(params.row.id); setBlockAction('unblock'); }}><ActivateIcon fontSize="small" /></IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="User Management" subtitle="Manage platform users and roles" />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField placeholder="Search users..." size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flexGrow: 1 }} />
            <TextField select size="small" label="Role" value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">All Roles</MenuItem>
              {ROLE_OPTIONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>
          {rows.length === 0 && !loading ? (
            <EmptyState title="No Users Found" message="No users match your current filters." />
          ) : (
            <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} loading={loading}
              onPageChange={setPage} onPageSizeChange={setPageSize} rowHeight={56} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Change User Role</DialogTitle>
        <DialogContent>
          {editUser && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" mb={2}>Change role for <strong>{editUser.fullName}</strong> ({editUser.email})</Typography>
              <TextField select fullWidth label="Role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole)}>
                {ROLE_OPTIONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateRole} disabled={editUser?.id === currentUser?.id}>Update Role</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!blockId}
        title={blockAction === 'block' ? 'Block User' : 'Activate User'}
        message={blockAction === 'block'
          ? 'Are you sure you want to block this user? They will not be able to access the platform.'
          : 'Are you sure you want to activate this user?'}
        confirmText={blockAction === 'block' ? 'Block' : 'Activate'}
        confirmColor={blockAction === 'block' ? 'error' : 'success'}
        onConfirm={handleToggleBlock}
        onCancel={() => setBlockId(null)}
        loading={blockLoading}
      />
    </Box>
  );
}

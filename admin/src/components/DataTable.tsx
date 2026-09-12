import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useState, useEffect, useCallback } from 'react';

interface DataTableProps {
  columns: GridColDef[];
  rows: any[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
  density?: 'compact' | 'standard' | 'comfortable';
  rowHeight?: number;
}

export default function DataTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  loading = false,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onRowClick,
  density = 'standard',
  rowHeight = 52,
}: DataTableProps) {
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  const paginationModel: GridPaginationModel = {
    page,
    pageSize,
  };

  const handlePaginationModelChange = useCallback(
    (newModel: GridPaginationModel) => {
      if (newModel.page !== page) onPageChange(newModel.page);
      if (newModel.pageSize !== pageSize) onPageSizeChange(newModel.pageSize);
    },
    [page, pageSize, onPageChange, onPageSizeChange]
  );

  const handleSortModelChange = useCallback(
    (newSortModel: GridSortModel) => {
      setSortModel(newSortModel);
      if (onSortChange && newSortModel.length > 0) {
        onSortChange(newSortModel[0].field, newSortModel[0].sort || 'asc');
      }
    },
    [onSortChange]
  );

  useEffect(() => {
    setSortModel([]);
  }, []);

  return (
    <Box sx={{ width: '100%', minHeight: 400 }}>
      <DataGrid
        columns={columns}
        rows={rows}
        rowCount={total}
        loading={loading}
        page={page}
        pageSize={pageSize}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="server"
        onRowClick={onRowClick ? (params) => onRowClick(params.row) : undefined}
        density={density}
        rowHeight={rowHeight}
        rowsPerPageOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        sx={{
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'background.default',
            fontWeight: 600,
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid divider',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      />
    </Box>
  );
}

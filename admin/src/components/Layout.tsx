import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const sidebarWidth = 260;

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header />
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${sidebarWidth}px)` },
          marginTop: '64px',
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

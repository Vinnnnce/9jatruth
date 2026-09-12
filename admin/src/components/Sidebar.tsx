import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Divider, Box, Typography, Chip } from '@mui/material';
import { NavLink } from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  Map as GeoIcon,
  AccountBalance as PoliticsIcon,
  Report as ReportsIcon,
  FactCheck as FactCheckIcon,
  Article as NewsIcon,
  People as UsersIcon,
  Settings as SettingsIcon,
  Forum as PostsIcon,
  Comment as CommentsIcon,
} from '@mui/icons-material';
import { useAppSelector } from '@store/hooks';
import type { UserRole } from '@api/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sidebarWidth = 260;

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAppSelector((state) => state.auth);

  const sections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      ],
    },
    {
      title: 'Geography',
      items: [
        { label: 'States', path: '/geo/states', icon: <GeoIcon /> },
        { label: 'LGAs', path: '/geo/lgas', icon: <GeoIcon /> },
        { label: 'Wards', path: '/geo/wards', icon: <GeoIcon /> },
        { label: 'Communities', path: '/geo/communities', icon: <GeoIcon /> },
      ],
    },
    {
      title: 'Politics',
      items: [
        { label: 'Parties', path: '/politics/parties', icon: <PoliticsIcon /> },
        { label: 'Candidates', path: '/politics/candidates', icon: <PoliticsIcon /> },
        { label: 'Offices', path: '/politics/offices', icon: <PoliticsIcon /> },
        { label: 'Elections', path: '/politics/elections', icon: <PoliticsIcon /> },
      ],
    },
    {
      title: 'Moderation',
      items: [
        { label: 'Posts Review', path: '/moderation/posts', icon: <PostsIcon />, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
        { label: 'Comments Review', path: '/moderation/comments', icon: <CommentsIcon />, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
        { label: 'Fact Checks', path: '/moderation/fact-checks', icon: <FactCheckIcon />, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST'] },
        { label: 'Reports', path: '/moderation/reports', icon: <ReportsIcon />, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
      ],
    },
    {
      title: 'Content',
      items: [
        { label: 'News', path: '/news', icon: <NewsIcon />, roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'] },
        { label: 'Users', path: '/users', icon: <UsersIcon />, roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Settings', path: '/settings', icon: <SettingsIcon />, roles: ['SUPER_ADMIN'] },
      ],
    },
  ];

  const filteredSections = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || (user && item.roles.includes(user.role))),
  })).filter((section) => section.items.length > 0);

  const drawer = (
    <Box sx={{ width: sidebarWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #008751, #FCD116)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: 'white',
              fontSize: 14,
            }}
          >
            9T
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
              9jaTruth
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Admin Dashboard
            </Typography>
          </Box>
        </Box>
      </Toolbar>
      <Divider />
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {filteredSections.map((section, index) => (
          <Box key={section.title} mb={index === filteredSections.length - 1 ? 0 : 2}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block', fontSize: 11, fontWeight: 600 }}>
              {section.title}
            </Typography>
            <List dense>
              {section.items.map((item) => (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    onClick={onClose}
                    sx={{
                      borderRadius: 1,
                      mx: 1,
                      '&.active': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {item.badge ? (
                      <Chip size="small" color="error" label={item.badge} />
                    ) : null}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>
      <Divider />
      <Box p={2}>
        <Typography variant="caption" color="text.secondary">
          v1.0.0 © 9jaTruth
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: sidebarWidth } }}
      >
        {drawer}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: sidebarWidth, boxSizing: 'border-box' },
        }}
        open
      >
        {drawer}
      </Drawer>
    </>
  );
}

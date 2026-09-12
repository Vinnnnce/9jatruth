import { AppBar, Toolbar, IconButton, Typography, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Box, Tooltip, Badge, Chip, Stack } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { toggleSidebar, toggleDarkMode } from '@store/slices/uiSlice';
import { logoutAsync } from '@store/slices/authSlice';
import { ROLES } from '@utils/constants';
import { getInitials } from '@utils/format';

export default function Header() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { darkMode } = useAppSelector((state) => state.ui);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotifClose = () => {
    setNotifAnchor(null);
  };

  const handleLogout = () => {
    dispatch(logoutAsync());
    navigate('/login');
  };

  const roleInfo = user ? ROLES[user.role] : null;

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton edge="start" onClick={() => dispatch(toggleSidebar())} sx={{ mr: 2, display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            9jaTruth Admin
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Dark mode toggle */}
          <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton onClick={() => dispatch(toggleDarkMode())} color="inherit">
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              onClick={(e) => setNotifAnchor(e.currentTarget)}
            >
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={notifAnchor}
            open={Boolean(notifAnchor)}
            onClose={handleNotifClose}
            PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
          >
            <MenuItem onClick={handleNotifClose}>
              <ListItemText primary="New report submitted" secondary="2 minutes ago" />
            </MenuItem>
            <MenuItem onClick={handleNotifClose}>
              <ListItemText primary="Post flagged for review" secondary="15 minutes ago" />
            </MenuItem>
            <MenuItem onClick={handleNotifClose}>
              <ListItemText primary="New user registered" secondary="1 hour ago" />
            </MenuItem>
          </Menu>

          {/* User menu */}
          {user && (
            <>
              <Tooltip title={`${user.fullName} (${roleInfo?.label})`}>
                <Chip
                  label={roleInfo?.label}
                  size="small"
                  color={roleInfo?.color as any}
                  variant="outlined"
                  sx={{ mr: 1, display: { xs: 'none', sm: 'flex' } }}
                />
              </Tooltip>
              <IconButton onClick={handleMenu} sx={{ p: 0 }}>
                <Avatar
                  alt={user.fullName}
                  src={user.avatar}
                  sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14 }}
                >
                  {getInitials(user.firstName, user.lastName)}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{ sx: { minWidth: 200, mt: 1.5 } }}
              >
                <Box px={2} py={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {user.fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
                <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>
                  <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Settings" />
                </MenuItem>
                <MenuItem onClick={handleClose}>
                  <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="My Profile" />
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Logout" />
                </MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

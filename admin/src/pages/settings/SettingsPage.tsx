import { useState } from 'react';
import { Box, Card, CardContent, Grid, Switch, FormControlLabel, Typography, TextField, Button, Divider, Stack, Chip, Tabs, Tab } from '@mui/material';
import { Save as SaveIcon, Security as SecurityIcon, Notifications as NotificationsIcon, Language as LanguageIcon, Palette as PaletteIcon } from '@mui/icons-material';
import PageHeader from '@components/PageHeader';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setDarkMode } from '@store/slices/uiSlice';

interface FeatureToggle {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface SettingsTab {
  label: string;
  icon: React.ReactNode;
}

export default function SettingsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const { darkMode } = useAppSelector((state) => state.ui);
  const [activeTab, setActiveTab] = useState(0);

  const [features, setFeatures] = useState<FeatureToggle[]>([
    { key: 'userRegistration', label: 'User Registration', description: 'Allow new users to register on the platform', enabled: true },
    { key: 'postCreation', label: 'Post Creation', description: 'Allow users to create new posts', enabled: true },
    { key: 'comments', label: 'Comments', description: 'Enable commenting on posts', enabled: true },
    { key: 'voting', label: 'Voting System', description: 'Enable upvote/downvote on posts', enabled: true },
    { key: 'factCheckBadge', label: 'Fact Check Badges', description: 'Display fact-check badges on posts', enabled: true },
    { key: 'aiModeration', label: 'AI Moderation', description: 'Enable AI-powered content moderation', enabled: false },
    { key: 'emailNotifications', label: 'Email Notifications', description: 'Send email notifications to users', enabled: true },
    { key: 'smsAlerts', label: 'SMS Alerts', description: 'Send SMS alerts for critical events', enabled: false },
  ]);

  const [settings, setSettings] = useState({
    siteName: '9jaTruth',
    siteDescription: 'Nigerian Civic-Politics Platform',
    contactEmail: 'admin@9jatruth.ng',
    supportPhone: '+234 800 000 0000',
    maxUploadSize: '10',
    sessionTimeout: '30',
    passwordMinLength: '8',
    maxPostsPerDay: '50',
  });

  const tabs: SettingsTab[] = [
    { label: 'General', icon: <LanguageIcon /> },
    { label: 'Features', icon: <SecurityIcon /> },
    { label: 'Appearance', icon: <PaletteIcon /> },
    { label: 'Notifications', icon: <NotificationsIcon /> },
  ];

  const handleToggleFeature = (key: string) => {
    setFeatures((prev) => prev.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const handleSave = () => {
    enqueueSnackbar('Settings saved successfully', { variant: 'success' });
  };

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Configure platform settings and feature toggles"
        actions={<Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>Save Changes</Button>} />

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        {tabs.map((tab, i) => (
          <Tab key={i} icon={tab.icon} iconPosition="start" label={tab.label} />
        ))}
      </Tabs>

      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" mb={3}>General Settings</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}><TextField label="Site Name" fullWidth value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Contact Email" fullWidth value={settings.contactEmail} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} /></Grid>
              <Grid item xs={12}><TextField label="Site Description" fullWidth value={settings.siteDescription} onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Support Phone" fullWidth value={settings.supportPhone} onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Max Upload Size (MB)" type="number" fullWidth value={settings.maxUploadSize} onChange={(e) => setSettings({ ...settings, maxUploadSize: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Session Timeout (min)" type="number" fullWidth value={settings.sessionTimeout} onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Password Min Length" type="number" fullWidth value={settings.passwordMinLength} onChange={(e) => setSettings({ ...settings, passwordMinLength: e.target.value })} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Max Posts Per Day" type="number" fullWidth value={settings.maxPostsPerDay} onChange={(e) => setSettings({ ...settings, maxPostsPerDay: e.target.value })} /></Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" mb={3}>Feature Toggles</Typography>
            <Grid container spacing={2}>
              {features.map((feature) => (
                <Grid item xs={12} sm={6} md={4} key={feature.key}>
                  <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{feature.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{feature.description}</Typography>
                      </Box>
                      <Switch checked={feature.enabled} onChange={() => handleToggleFeature(feature.key)} />
                    </Stack>
                    {feature.enabled && <Chip size="small" color="success" label="Enabled" sx={{ mt: 1 }} />}
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" mb={3}>Appearance</Typography>
            <Stack spacing={3}>
              <Box>
                <FormControlLabel
                  control={<Switch checked={darkMode} onChange={(e) => dispatch(setDarkMode(e.target.checked))} />}
                  label="Dark Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Toggle between light and dark themes for the admin dashboard
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" mb={1}>Theme Colors</Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Primary" sx={{ bgcolor: '#008751', color: 'white' }} />
                  <Chip label="Secondary" sx={{ bgcolor: '#FCD116', color: 'black' }} />
                  <Chip label="Error" sx={{ bgcolor: '#D32F2F', color: 'white' }} />
                  <Chip label="Success" sx={{ bgcolor: '#2E7D32', color: 'white' }} />
                  <Chip label="Warning" sx={{ bgcolor: '#ED6C02', color: 'white' }} />
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Nigerian national colors: Green (#008751) and Yellow (#FCD116)
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" mb={3}>Notification Settings</Typography>
            <Stack spacing={2}>
              <FormControlLabel control={<Switch defaultChecked />} label="New user registration alerts" />
              <FormControlLabel control={<Switch defaultChecked />} label="Report submission alerts" />
              <FormControlLabel control={<Switch defaultChecked />} label="Post flag alerts" />
              <FormControlLabel control={<Switch />} label="Daily summary emails" />
              <FormControlLabel control={<Switch />} label="Weekly analytics reports" />
              <FormControlLabel control={<Switch />} label="System error alerts" />
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Notification Channels</Typography>
              <FormControlLabel control={<Switch defaultChecked />} label="Email notifications" />
              <FormControlLabel control={<Switch />} label="SMS notifications" />
              <FormControlLabel control={<Switch defaultChecked />} label="In-app notifications" />
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppBar, Toolbar, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, IconButton, Avatar, Menu, MenuItem, Badge, Tooltip, Divider,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuthStore } from '../store/useAuthStore';
import client from '../api/client';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { path: '/', label: '工作台', icon: <DashboardIcon /> },
  { path: '/systems', label: '系统看板', icon: <MonitorHeartIcon /> },
  { path: '/tickets', label: '工单管理', icon: <ConfirmationNumberIcon /> },
  { path: '/settings', label: '设置', icon: <SettingsIcon /> },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState(null);
  const [unread, setUnread] = useState(0);

  const loadUnread = async () => {
    try {
      const res = await client.get('/dashboard/overview');
      setUnread(res.data?.unreadCount || 0);
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => {
    loadUnread();
    const timer = setInterval(loadUnread, 60000); // 每 60s 刷新未读数
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const current = NAV_ITEMS.find((n) =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 顶部栏 */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#1a73e8' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            信息化中心管理平台
          </Typography>
          <Tooltip title="通知">
            <IconButton color="inherit" onClick={() => navigate('/')}>
              <Badge badgeContent={unread} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: '#0d47a1' }}>
              {(user?.name || 'U').charAt(0)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.name}（{user?.role === 'admin' ? '管理员' : '成员'}）
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* 侧边导航 */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box', top: 56 },
        }}
      >
        <Toolbar />
        <List sx={{ mt: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={current?.path === item.path}
              sx={{
                '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8', borderRight: '3px solid #1a73e8' },
              }}
            >
              <ListItemIcon sx={{ color: current?.path === item.path ? '#1a73e8' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* 内容区 */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 7, bgcolor: '#f5f7fa', minHeight: '100vh' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
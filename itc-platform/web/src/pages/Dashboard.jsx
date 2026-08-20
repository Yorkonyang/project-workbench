import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box, List, ListItem, ListItemText,
  Chip, Divider, CircularProgress, Alert, Button,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import client from '../api/client';
import { TICKET_STATUS, SYSTEM_HEALTH, HEALTH_COLORS, LEVEL_COLORS, ALERT_LEVEL, CATEGORY_LABELS } from '../constants';

function StatCard({ icon, label, value, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = JSON.parse(localStorage.getItem('itc_user') || '{}')?.role === 'admin';

  const load = async () => {
    try {
      const res = await client.get('/dashboard/overview');
      setData(res.data);
      if (isAdmin) {
        const wl = await client.get('/dashboard/workload');
        setWorkload(wl.data.rows);
      }
      setError('');
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  const s = data.systemsSummary || { ok: 0, warning: 0, down: 0, unknown: 0 };

  return (
    <Box>
      {/* 统计卡片 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<TrendingUpIcon fontSize="large" />} label="系统正常" value={s.ok} color="#34a853" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ErrorOutlineIcon fontSize="large" />} label="系统告警" value={s.warning} color="#f9ab00" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ErrorOutlineIcon fontSize="large" />} label="系统宕机" value={s.down} color="#ea4335" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PendingActionsIcon fontSize="large" />} label="我的待处理工单" value={data.myOpenCount} color="#1a73e8" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* 我的工单 */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">我的工单</Typography>
                <Chip
                  label={`逾期 ${data.overdueCount}`}
                  color={data.overdueCount > 0 ? 'error' : 'default'}
                  size="small"
                  icon={<AssignmentLateIcon />}
                />
              </Box>
              <Divider sx={{ mb: 1 }} />
              {data.myTickets.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  暂无工单
                </Typography>
              ) : (
                <List dense>
                  {data.myTickets.map((t) => (
                    <ListItem key={t.id} component={Link} to={`/tickets/${t.id}`} sx={{ textDecoration: 'none', color: 'inherit', px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={t.ticket_no} size="small" variant="outlined" />
                            <Typography variant="body2" sx={{ fontWeight: t.slaStatus === 'overdue' ? 700 : 400, color: t.slaStatus === 'overdue' ? '#ea4335' : 'inherit' }}>
                              {t.title}
                            </Typography>
                          </Box>
                        }
                        secondary={`${CATEGORY_LABELS[t.category] || t.category} · ${TICKET_STATUS[t.status]}${t.assignee_name ? ' · ' + t.assignee_name : ''} · ${t.created_at}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 告警与通知 */}
        <Grid item xs={12} md={5}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>未解决告警</Typography>
              <Divider sx={{ mb: 1 }} />
              {data.openAlerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  所有系统运行正常
                </Typography>
              ) : (
                <List dense>
                  {data.openAlerts.slice(0, 8).map((a) => (
                    <ListItem key={a.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={ALERT_LEVEL[a.level] || a.level}
                              size="small"
                              sx={{ ...(LEVEL_COLORS[a.level] ? { bgcolor: LEVEL_COLORS[a.level].split(' ')[0], color: LEVEL_COLORS[a.level].split(' ')[1] } : {}) }}
                            />
                            <Typography variant="body2">{a.title}</Typography>
                          </Box>
                        }
                        secondary={`${a.system_name || ''} · ${a.created_at}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>团队工作量</Typography>
                <Divider sx={{ mb: 1 }} />
                {workload && workload.map((w) => (
                  <Box key={w.user_id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2">{w.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      处理中 {w.in_progress} · 待办 {w.open_count} · 逾期 {w.overdue_count}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
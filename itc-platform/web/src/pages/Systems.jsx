import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, InputLabel, FormControl,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { SYSTEM_HEALTH, HEALTH_COLORS } from '../constants';

const HEALTH_TYPES = [
  { value: 'http', label: 'HTTP' },
  { value: 'tcp', label: 'TCP端口' },
  { value: 'db', label: '数据库' },
];

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL/MariaDB' },
  { value: 'postgres', label: 'PostgreSQL' },
];

function SystemCard({ system, onCheck, onRefresh }) {
  const status = system.latest_status || 'unknown';
  const colorClass = HEALTH_COLORS[status] || HEALTH_COLORS.unknown;

  return (
    <Card sx={{ height: '100%', borderTop: status === 'down' ? '3px solid #ea4335' : status === 'warning' ? '3px solid #f9ab00' : '3px solid #34a853' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6">{system.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {system.vendor || '-'} · v{system.version || '-'}
            </Typography>
          </Box>
          <Chip label={SYSTEM_HEALTH[status] || '未知'} size="small" sx={colorClass ? { bgcolor: colorClass.split(' ')[0], color: colorClass.split(' ')[1] } : {}} />
        </Box>

        <Box sx={{ mt: 1.5, fontSize: '0.8125rem', color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>负责人</span><span>{system.owner_name || '未分配'}</span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <span>最近检查</span><span>{system.last_checked_at || '暂无'}</span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <span>响应时间</span>
            <span>{system.last_response_time != null ? `${system.last_response_time}ms` : '-'}</span>
          </Box>
          {status !== 'ok' && (
            <Box sx={{ mt: 0.5, color: status === 'down' ? '#ea4335' : '#f9ab00' }}>
              {system.last_message}
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color={system.open_alert_count > 0 ? '#ea4335' : 'text.secondary'}>
            {system.open_alert_count > 0 ? `${system.open_alert_count} 条未解决告警` : '无告警'}
          </Typography>
          <Box>
            <Tooltip title="立即探活">
              <IconButton size="small" onClick={() => { onCheck(system.id); }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function SystemDialog({ open, onClose, onSave, users, editing }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (open) {
      setForm(editing || {
        name: '', code: '', version: '', base_url: '', health_type: 'http',
        health_path: '/', db_host: '', db_port: '', db_type: 'mysql',
        expected_status: 200, check_interval: 5, owner_id: '', vendor: '', description: '', is_active: 1,
      });
    }
  }, [open, editing]);

  const submit = () => {
    onSave({ ...form, owner_id: form.owner_id || null });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? '编辑系统' : '新增系统'}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField label="系统名称" fullWidth size="small" required value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="系统编码" fullWidth size="small" required value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              helperText="如 erp/plm/qms/mom/bpm" />
          </Grid>
          <Grid item xs={6}>
            <TextField label="版本" fullWidth size="small" value={form.version || ''}
              onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="厂商" fullWidth size="small" value={form.vendor || ''}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="用友/思普/赛意/轻流/自研" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="探活地址 (base_url)" fullWidth size="small" value={form.base_url || ''}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="http://192.168.1.10:8080" />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>探活类型</InputLabel>
              <Select label="探活类型" value={form.health_type || 'http'}
                onChange={(e) => setForm({ ...form, health_type: e.target.value })}>
                {HEALTH_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField label="健康检查路径" fullWidth size="small" value={form.health_path || '/'}
              onChange={(e) => setForm({ ...form, health_path: e.target.value })}
              disabled={form.health_type !== 'http'} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="数据库主机" fullWidth size="small" value={form.db_host || ''}
              onChange={(e) => setForm({ ...form, db_host: e.target.value })}
              disabled={form.health_type !== 'db' && form.health_type !== 'tcp'} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="数据库端口" fullWidth size="small" type="number" value={form.db_port || ''}
              onChange={(e) => setForm({ ...form, db_port: e.target.value })}
              disabled={form.health_type !== 'db' && form.health_type !== 'tcp'} />
          </Grid>
          {form.health_type === 'db' && (
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>数据库类型</InputLabel>
                <Select label="数据库类型" value={form.db_type || 'mysql'}
                  onChange={(e) => setForm({ ...form, db_type: e.target.value })}>
                  {DB_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>负责人</InputLabel>
              <Select label="负责人" value={form.owner_id || ''}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                <MenuItem value=""><em>未分配</em></MenuItem>
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField label="检查间隔(分钟)" fullWidth size="small" type="number" value={form.check_interval || 5}
              onChange={(e) => setForm({ ...form, check_interval: e.target.value })} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="系统说明" fullWidth size="small" multiline rows={2} value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>启用状态</InputLabel>
              <Select label="启用状态" value={form.is_active ? 1 : 0}
                onChange={(e) => setForm({ ...form, is_active: e.target.value })}>
                <MenuItem value={1}>启用（参与探活）</MenuItem>
                <MenuItem value={0}>停用</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit}>{editing ? '保存' : '创建'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Systems() {
  const [systems, setSystems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [checking, setChecking] = useState({});

  const load = async () => {
    try {
      const [sysRes, userRes] = await Promise.all([
        client.get('/systems'),
        client.get('/users'),
      ]);
      setSystems(sysRes.data.systems);
      setUsers(userRes.data.users);
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

  const handleCheck = async (id) => {
    setChecking((p) => ({ ...p, [id]: true }));
    try {
      await client.post(`/systems/${id}/check`);
    } catch (err) {
      setError(err.message || '探活失败');
    } finally {
      setChecking((p) => ({ ...p, [id]: false }));
      load();
    }
  };

  const handleSave = async (form) => {
    try {
      if (editing) {
        await client.put(`/systems/${editing.id}`, form);
      } else {
        await client.post('/systems', form);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.message || '保存失败');
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">系统健康看板</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          新增系统
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        {systems.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">暂无系统档案，请点击"新增系统"添加</Alert>
          </Grid>
        ) : (
          systems.map((sys) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={sys.id}>
              <SystemCard
                system={sys}
                onCheck={handleCheck}
                checking={checking[sys.id]}
                onEdit={() => { setEditing(sys); setDialogOpen(true); }}
              />
            </Grid>
          ))
        )}
      </Grid>
      <SystemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        users={users}
        editing={editing}
      />
    </Box>
  );
}
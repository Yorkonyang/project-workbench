import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Divider,
  CircularProgress, Alert, Snackbar,
} from '@mui/material';
import client from '../api/client';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');

  const load = async () => {
    try {
      const res = await client.get('/settings');
      setSettings(res.data.settings);
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await client.put('/settings', { settings });
      setSettings(res.data.settings);
      setSnack('设置已保存');
      setError('');
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await client.post('/settings/test-qingflow');
      setSnack(res.data.result?.message || '连接成功');
      setError('');
    } catch (err) {
      setError(err.message || '轻流连接失败');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>系统设置</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 0.5 }}>轻流（QingFlow）集成</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            配置后，系统告警将自动推送到轻流 BPM（Q-Source 通道），无需企微集成。
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="轻流服务器地址 (base_url)"
            fullWidth
            size="small"
            margin="normal"
            placeholder="https://gkbpm.grinm.com:56555"
            value={settings.qingflow_base_url || ''}
            onChange={(e) => setSettings({ ...settings, qingflow_base_url: e.target.value })}
            helperText="轻流 BPM 访问地址"
          />
          <TextField
            label="Q-Source ID"
            fullWidth
            size="small"
            margin="normal"
            placeholder="轻流后台「数据源 → Q-Source」中获取 UUID"
            value={settings.qingflow_qsource_id || ''}
            onChange={(e) => setSettings({ ...settings, qingflow_qsource_id: e.target.value })}
          />
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
            <Button variant="outlined" onClick={handleTest} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>使用说明</Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>默认账号：admin / admin123（首次登录后请修改密码）</li>
              <li>系统看板：管理系统档案，配置探活地址与检查间隔</li>
              <li>工单管理：统一处理用户报障与系统告警自动生成的工单</li>
              <li>告警推送：探活异常自动生成工单，并按 30 分钟去重推送轻流</li>
            </ul>
          </Typography>
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
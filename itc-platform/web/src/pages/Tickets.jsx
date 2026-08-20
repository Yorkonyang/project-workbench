import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, InputLabel, FormControl,
  Grid, CircularProgress, Alert, Paper, TableContainer, Table, TableHead, TableRow,
  TableCell, TableBody, TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import {
  TICKET_STATUS, PRIORITY, CATEGORY_LABELS, TICKET_CATEGORIES, STATUS_COLORS,
} from '../constants';

const STATUS_FILTERS = [
  { value: '', label: '全部状态' },
  ...Object.entries(TICKET_STATUS).map(([v, l]) => ({ value: v, label: l })),
];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', assignee: '', category: '', keyword: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);

  const load = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.assignee) params.assignee = filters.assignee;
      if (filters.category) params.category = filters.category;
      if (filters.keyword) params.keyword = filters.keyword;
      const [tickRes, userRes, sysRes] = await Promise.all([
        client.get('/tickets', { params }),
        client.get('/users'),
        client.get('/systems'),
      ]);
      setTickets(tickRes.data.tickets);
      setUsers(userRes.data.users);
      setSystems(sysRes.data.systems);
      setError('');
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.status, filters.assignee, filters.category]);

  const handleCreate = async (form) => {
    try {
      await client.post('/tickets', form);
      setCreateOpen(false);
      load();
    } catch (err) {
      setError(err.message || '创建失败');
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">工单管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          新建工单
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 筛选栏 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>状态</InputLabel>
              <Select label="状态" value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                {STATUS_FILTERS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>分类</InputLabel>
              <Select label="分类" value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                <MenuItem value=""><em>全部分类</em></MenuItem>
                {TICKET_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABELS[c]}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>处理人</InputLabel>
              <Select label="处理人" value={filters.assignee}
                onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}>
                <MenuItem value=""><em>全部人员</em></MenuItem>
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label="关键词" size="small" fullWidth value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }} />
          </Grid>
        </Grid>
      </Paper>

      {/* 工单表格 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell>工单号</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>分类</TableCell>
              <TableCell>优先级</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>处理人</TableCell>
              <TableCell>SLA</TableCell>
              <TableCell>创建时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>暂无工单</TableCell></TableRow>
            )}
            {tickets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t) => (
              <TableRow key={t.id} hover component={Link} to={`/tickets/${t.id}`} sx={{ cursor: 'pointer', textDecoration: 'none' }}>
                <TableCell><Chip label={t.ticket_no} size="small" variant="outlined" /></TableCell>
                <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </TableCell>
                <TableCell>{CATEGORY_LABELS[t.category] || t.category}</TableCell>
                <TableCell>
                  <Chip label={PRIORITY[t.priority] || t.priority} size="small"
                    sx={t.priority === 'urgent' ? { bgcolor: '#fdeaea', color: '#c62828' } : t.priority === 'high' ? { bgcolor: '#fff3e0', color: '#e65100' } : {}} />
                </TableCell>
                <TableCell>
                  <Chip label={TICKET_STATUS[t.status]} size="small"
                    sx={STATUS_COLORS[t.status] ? { bgcolor: STATUS_COLORS[t.status].split(' ')[0], color: STATUS_COLORS[t.status].split(' ')[1] } : {}} />
                </TableCell>
                <TableCell>{t.assignee_name || '-'}</TableCell>
                <TableCell>
                  {t.slaStatus === 'overdue' ? (
                    <Chip label="已逾期" size="small" sx={{ bgcolor: '#fdeaea', color: '#c62828' }} />
                  ) : t.slaStatus === 'warning' ? (
                    <Chip label="将逾期" size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100' }} />
                  ) : (
                    <Chip label="正常" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32' }} />
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={tickets.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[rowsPerPage]}
        />
      </TableContainer>

      <CreateTicketDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        users={users}
        systems={systems}
      />
    </Box>
  );
}

function CreateTicketDialog({ open, onClose, onSave, users, systems }) {
  const [form, setForm] = useState({});
  const submit = () => {
    if (!form.title?.trim()) return;
    onSave({
      title: form.title,
      description: form.description || '',
      category: form.category || 'other',
      priority: form.priority || 'medium',
      system_id: form.system_id || null,
      assignee_id: form.assignee_id || null,
      tags: form.tags || '',
    });
    setForm({});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新建工单</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="标题" fullWidth size="small" required
              value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>分类</InputLabel>
              <Select label="分类" value={form.category || 'other'}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {TICKET_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABELS[c]}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>优先级</InputLabel>
              <Select label="优先级" value={form.priority || 'medium'}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(PRIORITY).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>关联系统</InputLabel>
              <Select label="关联系统" value={form.system_id || ''}
                onChange={(e) => setForm({ ...form, system_id: e.target.value })}>
                <MenuItem value=""><em>无</em></MenuItem>
                {systems.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>处理人</InputLabel>
              <Select label="处理人" value={form.assignee_id || ''}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                <MenuItem value=""><em>待分派</em></MenuItem>
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField label="标签（逗号分隔）" fullWidth size="small" value={form.tags || ''}
              onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="详细描述" fullWidth multiline rows={3} value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit} disabled={!form.title?.trim()}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
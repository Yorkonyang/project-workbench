import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Chip, Button, Grid, TextField,
  MenuItem, Select, InputLabel, FormControl, Divider, CircularProgress, Alert,
  Paper, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import client from '../api/client';
import {
  TICKET_STATUS, PRIORITY, CATEGORY_LABELS, VALID_TRANSITIONS, STATUS_COLORS,
} from '../constants';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [actions, setActions] = useState([]);
  const [alert, setAlert] = useState(null);
  const [system, setSystem] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignDialog, setAssignDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [comment, setComment] = useState('');

  const load = async () => {
    try {
      const res = await client.get(`/tickets/${id}`);
      setTicket(res.data.ticket);
      setActions(res.data.actions);
      setAlert(res.data.alert);
      setSystem(res.data.system);
      const uRes = await client.get('/users');
      setUsers(uRes.data.users);
      setError('');
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleAssign = async (assigneeId) => {
    try {
      await client.post(`/tickets/${id}/assign`, { assigneeId });
      setAssignDialog(false);
      load();
    } catch (err) {
      setError(err.message || '分派失败');
    }
  };

  const handleStatus = async (toStatus) => {
    try {
      await client.post(`/tickets/${id}/status`, { toStatus, comment: comment || `状态变更为${TICKET_STATUS[toStatus]}` });
      setStatusDialog(false);
      setComment('');
      load();
    } catch (err) {
      setError(err.message || '状态更新失败');
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    try {
      await client.post(`/tickets/${id}/comment`, { comment });
      setComment('');
      load();
    } catch (err) {
      setError(err.message || '评论失败');
    }
  };

  if (loading) return <CircularProgress />;
  if (!ticket) return <Alert severity="error">工单不存在</Alert>;

  const nextStatuses = VALID_TRANSITIONS[ticket.status] || [];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/tickets')} sx={{ mb: 2 }}>
        返回工单列表
      </Button>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip label={ticket.ticket_no} size="small" variant="outlined" />
                <Chip label={CATEGORY_LABELS[ticket.category] || ticket.category} size="small"
                  sx={{ bgcolor: '#e8f0fe', color: '#1a73e8' }} />
              </Box>
              <Typography variant="h6">{ticket.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {ticket.description || '（无描述）'}
              </Typography>
              {system && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  关联系统：<Chip label={system.name} size="small" />
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 140 }}>
              <Chip label={`状态：${TICKET_STATUS[ticket.status]}`} size="medium"
                sx={STATUS_COLORS[ticket.status] ? { bgcolor: STATUS_COLORS[ticket.status].split(' ')[0], color: STATUS_COLORS[ticket.status].split(' ')[1] } : {}} />
              <Chip label={`优先级：${PRIORITY[ticket.priority]}`} size="medium" variant="outlined" />
              <Typography variant="body2" color="text.secondary">
                处理人：{ticket.assignee_name || '未分派'}
              </Typography>
              {ticket.slaStatus === 'overdue' && (
                <Chip label="SLA已逾期" size="small" sx={{ bgcolor: '#fdeaea', color: '#c62828' }} />
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={1}>
            <Grid item xs={4}><Typography variant="body2" color="text.secondary">创建时间</Typography><Typography variant="body2">{ticket.created_at}</Typography></Grid>
            <Grid item xs={4}><Typography variant="body2" color="text.secondary">响应时间</Typography><Typography variant="body2">{ticket.response_at || '-'}</Typography></Grid>
            <Grid item xs={4}><Typography variant="body2" color="text.secondary">解决时间</Typography><Typography variant="body2">{ticket.resolved_at || '-'}</Typography></Grid>
            <Grid item xs={6}><Typography variant="body2" color="text.secondary">SLA响应期限</Typography><Typography variant="body2">{ticket.sla_response_due || '-'}</Typography></Grid>
            <Grid item xs={6}><Typography variant="body2" color="text.secondary">SLA解决期限</Typography><Typography variant="body2">{ticket.sla_resolve_due || '-'}</Typography></Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="contained" onClick={() => setAssignDialog(true)}
              disabled={['resolved', 'closed'].includes(ticket.status)}>
              分派处理人
            </Button>
            {nextStatuses.length > 0 && (
              <Button size="small" variant="outlined" onClick={() => setStatusDialog(true)}>
                变更状态
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 评论与操作记录 */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>操作记录与评论</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField label="添加评论" size="small" fullWidth value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }} />
            <Button variant="contained" onClick={handleComment} disabled={!comment.trim()}>发送</Button>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {actions.map((a) => (
              <ListItem key={a.id} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ fontSize: '0.8125rem' }}>
                      <Chip label={a.action} size="small" variant="outlined" sx={{ mr: 1 }} />
                      <span>{a.comment || ''}</span>
                    </Box>
                  }
                  secondary={`${a.operator_name || '系统'} · ${a.created_at}`}
                />
              </ListItem>
            ))}
            {actions.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无记录</Typography>
            )}
          </List>
        </CardContent>
      </Card>

      {/* 分派弹窗 */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>分派处理人</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {users.map((u) => (
            <Button
              key={u.id}
              fullWidth
              variant={ticket.assignee_id === u.id ? 'contained' : 'outlined'}
              sx={{ mb: 1, justifyContent: 'flex-start' }}
              disabled={ticket.assignee_id === u.id}
              onClick={() => handleAssign(u.id)}
            >
              {u.name}（{u.username}）
            </Button>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>取消</Button>
        </DialogActions>
      </Dialog>

      {/* 状态流转弹窗 */}
      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>变更状态（当前：{TICKET_STATUS[ticket.status]}）</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {nextStatuses.map((s) => (
            <Button
              key={s}
              fullWidth
              variant="outlined"
              sx={{ mb: 1, justifyContent: 'flex-start' }}
              onClick={() => handleStatus(s)}
            >
              → {TICKET_STATUS[s]}
            </Button>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>取消</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
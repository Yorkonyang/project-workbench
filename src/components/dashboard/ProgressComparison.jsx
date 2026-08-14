import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '@/components/ui/Card';
import { TASK_STATUS_ORDER, TASK_STATUS_CONFIG } from '@/config/theme';

export default function ProgressComparison({ projects, tasks }) {
  const data = projects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const item = { name: p.code };
    TASK_STATUS_ORDER.forEach((status) => {
      item[TASK_STATUS_CONFIG[status].label] = projTasks.filter((t) => t.status === status).length;
    });
    return item;
  });

  return (
    <Card title="任务对比（按状态）">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="待办" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
          <Bar dataKey="进行中" stackId="a" fill="#3b82f6" />
          <Bar dataKey="评审中" stackId="a" fill="#8b5cf6" />
          <Bar dataKey="已完成" stackId="a" fill="#10b981" />
          <Bar dataKey="已阻塞" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Card from '@/components/ui/Card';
import { TASK_STATUS_CONFIG, TASK_STATUS_ORDER } from '@/config/theme';

const COLORS = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#8b5cf6',
  done: '#10b981',
  blocked: '#ef4444',
};

export default function TaskStatusChart({ tasks }) {
  const data = TASK_STATUS_ORDER.map((status) => ({
    name: TASK_STATUS_CONFIG[status].label,
    value: tasks.filter((t) => t.status === status).length,
    status,
  })).filter((d) => d.value > 0);

  return (
    <Card title="任务状态分布">
      {data.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-8">暂无任务数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={COLORS[entry.status]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

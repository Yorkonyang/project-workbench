import { useState, useMemo } from 'react';
import { Plus, AlertTriangle, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import RiskMatrix from '@/components/risks/RiskMatrix';
import RiskList from '@/components/risks/RiskList';
import RiskForm from '@/components/risks/RiskForm';
import { useRiskStore } from '@/store/useRiskStore';
import { useProjectStore } from '@/store/useProjectStore';

export default function RisksPage() {
  const risks = useRiskStore((s) => s.risks);
  const addRisk = useRiskStore((s) => s.addRisk);
  const updateRisk = useRiskStore((s) => s.updateRisk);
  const deleteRisk = useRiskStore((s) => s.deleteRisk);
  const projects = useProjectStore((s) => s.projects);

  const [showForm, setShowForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState(null);

  // Filter out archived projects
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const activeRisks = risks.filter((r) => activeProjectIds.has(r.projectId) || !r.projectId);

  const stats = useMemo(() => ({
    total: activeRisks.length,
    open: activeRisks.filter((r) => r.status !== 'closed').length,
    high: activeRisks.filter((r) => r.severity === 'high' && r.status !== 'closed').length,
    medium: activeRisks.filter((r) => r.severity === 'medium' && r.status !== 'closed').length,
    low: activeRisks.filter((r) => r.severity === 'low' && r.status !== 'closed').length,
  }), [activeRisks]);

  const handleEdit = (risk) => {
    setEditingRisk(risk);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRisk(null);
  };

  return (
    <PageContainer
      title="风险管理"
      subtitle={`${risks.length} 个风险项`}
      action={
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          添加风险
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">总风险数</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">待处理风险</p>
              <p className="text-2xl font-bold text-red-600">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">高风险</p>
              <p className="text-2xl font-bold text-amber-600">{stats.high}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">已关闭</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.total - stats.open}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Matrix */}
      <div className="mb-6">
        <RiskMatrix risks={activeRisks} />
      </div>

      {/* Risk List */}
      <RiskList
        risks={activeRisks}
        projects={projects}
        onEdit={handleEdit}
        onDelete={(id) => {
          if (confirm('确定要删除此风险吗？')) {
            deleteRisk(id);
          }
        }}
      />

      {/* Form */}
      {showForm && (
        <RiskForm
          risk={editingRisk}
          projects={projects.filter((p) => !p.archived)}
          onClose={handleCloseForm}
        />
      )}
    </PageContainer>
  );
}

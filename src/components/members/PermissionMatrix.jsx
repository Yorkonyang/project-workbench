import Card from '@/components/ui/Card';
import { ROLES, PERMISSION_MODULES } from '@/config/permissions';
import { Check, X } from 'lucide-react';

export default function PermissionMatrix() {
  const roleKeys = Object.keys(ROLES);

  return (
    <Card title="权限矩阵">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-slate-600 font-medium whitespace-nowrap">模块</th>
              <th className="text-left py-2 px-3 text-slate-600 font-medium whitespace-nowrap">权限</th>
              {roleKeys.map((key) => (
                <th
                  key={key}
                  className="text-center py-2 px-3 font-medium whitespace-nowrap"
                  style={{ color: ROLES[key].color }}
                >
                  {ROLES[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) =>
              module.permissions.map((perm, idx) => {
                const permKey = `${module.key}:${perm.key}`;
                return (
                  <tr key={permKey} className={idx === 0 ? 'border-t border-slate-100' : ''}>
                    {idx === 0 && (
                      <td
                        className="py-2 px-3 text-slate-500 font-medium align-top whitespace-nowrap"
                        rowSpan={module.permissions.length}
                      >
                        {module.label}
                      </td>
                    )}
                    <td className="py-2 px-3 text-slate-600">{perm.label}</td>
                    {roleKeys.map((roleKey) => {
                      const has = ROLES[roleKey].permissions.includes(permKey);
                      return (
                        <td key={roleKey} className="text-center py-2 px-3">
                          {has ? (
                            <Check className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 角色说明 */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {roleKeys.map((key) => (
          <div key={key} className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ROLES[key].color }} />
              <span className="text-sm font-medium text-slate-700">{ROLES[key].label}</span>
            </div>
            <p className="text-xs text-slate-500">{ROLES[key].description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

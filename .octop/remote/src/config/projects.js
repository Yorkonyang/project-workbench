// Project preset configuration
export const PROJECTS = {
  proj_mom: {
    id: 'proj_mom',
    code: 'MOM',
    name: 'MOM 系统建设',
    description: '生产制造管理（MOM）系统建设，涵盖生产计划、过程管控、质量管理、设备管理等模块',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    progress: 35,
    status: 'in_progress',
    phase: '二期开发',
    color: '#3b82f6',
    manager: 'mem_1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-08-09T00:00:00Z',
  },
  proj_erp: {
    id: 'proj_erp',
    code: 'ERP',
    name: 'ERP 升级项目',
    description: '用友 BIP 升级，覆盖财务、供应链、生产成本核算、报表平台等核心模块',
    startDate: '2026-03-01',
    endDate: '2026-11-30',
    progress: 25,
    status: 'in_progress',
    phase: '数据迁移',
    color: '#14b8a6',
    manager: 'mem_1',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-08-09T00:00:00Z',
  },
};

export const PROJECT_LIST = Object.values(PROJECTS);

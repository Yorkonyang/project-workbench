/**
 * Risk auto-delete trigger
 * Called when a task or todo transitions to completed state.
 * Finds matching open risks by sourceId and deletes them entirely.
 */
import { useRiskStore } from '@/store/useRiskStore';
import { apiClient } from '@/lib/apiClient';

export async function autoCloseRelatedRisks(sourceId, typeLabel, title) {
  try {
    const apiRisks = await apiClient.getRisks();
    const openRisks = apiRisks.filter((r) => r.sourceId === sourceId && r.status !== 'closed');
    if (openRisks.length === 0) return;

    for (const risk of openRisks) {
      try { await useRiskStore.getState().deleteRisk(risk.id); } catch (_) {}
    }
  } catch (_) {}
}

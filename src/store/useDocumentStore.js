/**
 * Document Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useDocumentStore = create(
  persist(
    (set, get) => ({
      documents: [],
      loading: false,

      fetchDocuments: async () => {
        set({ loading: true });
        try {
          const documents = await apiClient.getDocuments();
          set({ documents, loading: false });
        } catch (err) {
          console.error('Failed to fetch documents:', err);
          set({ loading: false });
        }
      },

      addDocument: async (doc) => {
        try {
          const created = await apiClient.createDocument(doc);
          set((state) => ({
            documents: [
              ...state.documents,
              { ...created, files: created.files || [] },
            ],
          }));
          return created;
        } catch (err) {
          console.error('Failed to add document:', err);
          const localId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newDoc = {
            ...doc,
            id: localId,
            files: doc.files || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            documents: [...state.documents, newDoc],
          }));
          return newDoc;
        }
      },

      updateDocument: async (id, updates) => {
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        }));
        try {
          await apiClient.updateDocument(id, updates);
        } catch (err) {
          console.error('Failed to update document:', err);
        }
      },

      deleteDocument: async (id) => {
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        }));
        try {
          await apiClient.deleteDocument(id);
        } catch (err) {
          console.error('Failed to delete document:', err);
        }
      },

      addFile: (docId, fileObj) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === docId
              ? { ...d, files: [...(d.files || []), { id: `file_${Date.now()}`, ...fileObj }], updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      removeFile: (docId, fileId) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === docId
              ? { ...d, files: (d.files || []).filter((f) => f.id !== fileId), updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      getDocumentsByProject: (projectId) => get().documents.filter((d) => d.projectId === projectId),
    }),
    {
      name: 'pw_documents',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
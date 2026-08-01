import api from '../lib/api';
import type { DocumentRecord } from '../types';

export interface UploadResponse {
  id: string;
  filename: string;
  size: number;
  words: number;
  characters: number;
  tokens: number;
  documentType: string;
  content: string;
}

export const DocumentService = {
  async upload(file: File, onProgress?: (p: number) => void): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return data.data;
  },

  async list(): Promise<DocumentRecord[]> {
    const { data } = await api.get('/documents');
    return data.data;
  },

  async get(id: string): Promise<DocumentRecord> {
    const { data } = await api.get(`/documents/${id}`);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};

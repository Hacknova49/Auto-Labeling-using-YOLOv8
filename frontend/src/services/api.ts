import { API_BASE_URL } from '../constants';
import type { 
  UploadResponse, 
  ProcessResponse, 
  JobStatusResponse, 
  PrioritizationPrompt 
} from '../types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async uploadFiles(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async processImages(imageIds: string[], prioritization: PrioritizationPrompt): Promise<ProcessResponse> {
    const response = await fetch(`${this.baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_ids: imageIds,
        prioritization,
      }),
    });

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return response.json();
  }

  async createDataset(name: string, imageIds: string[], exportFormat: string = 'yolo') {
    const response = await fetch(`${this.baseUrl}/api/datasets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        image_ids: imageIds,
        export_format: exportFormat,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dataset creation failed: ${response.statusText}`);
    }

    return response.json();
  }

  async exportDataset(datasetId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/datasets/${datasetId}/export`);

    if (!response.ok) {
      throw new Error(`Dataset export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async listDatasets() {
    const response = await fetch(`${this.baseUrl}/api/datasets`);

    if (!response.ok) {
      throw new Error(`Failed to list datasets: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiService = new ApiService();
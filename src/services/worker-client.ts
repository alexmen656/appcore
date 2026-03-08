import axios, { AxiosInstance } from "axios";
import { logger } from "../config";

export interface WorkerDeliverParams {
  locales: Record<
    string,
    {
      name: string;
      subtitle: string;
      keywords: string;
      description: string;
      whatsNew: string;
      promotionalText: string;
      supportUrl: string;
      marketingUrl: string;
    }
  >;
  apiKey: {
    key_id: string;
    issuer_id: string;
    key: string;
    in_house: boolean;
  };
  bundleId: string;
  action: "metadata" | "submit_for_review";
  copyright?: string;
}

export interface WorkerDeliverResult {
  ok: boolean;
  logs: string[];
  errors: string[];
}

export interface WorkerSnapshotParams {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  bundleId: string;
}

export interface WorkerSnapshotResult {
  ok: boolean;
  logs: string[];
  errors: string[];
  screenshots: Record<string, Array<{ filename: string; data: string }>>;
  descriptions: Record<string, string>;
  config: Record<string, string>;
}

export interface WorkerFrameitParams {
  images: Array<{ filename: string; data: string }>;
  options: {
    subtitle?: string;
    title?: string;
    bgColor1?: string;
    bgColor2?: string;
    textColor?: string;
  };
}

export interface WorkerFrameitResult {
  ok: boolean;
  framedImages: Array<{ filename: string; data: string }>;
  error?: string;
}

export interface WorkerHealthResult {
  ok: boolean;
  fastlaneVersion?: string;
  hostname?: string;
  error?: string;
}

class FastlaneWorkerClient {
  private client: AxiosInstance | null = null;

  private getClient(): AxiosInstance {
    if (!this.client) {
      const baseURL = process.env.FASTLANE_WORKER_URL;
      const secret = process.env.FASTLANE_WORKER_SECRET;

      if (!baseURL) {
        throw new Error(
          "FASTLANE_WORKER_URL not set. Cannot communicate with Fastlane worker.",
        );
      }
      if (!secret) {
        throw new Error(
          "FASTLANE_WORKER_SECRET not set. Cannot authenticate with Fastlane worker.",
        );
      }

      this.client = axios.create({
        baseURL,
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        maxBodyLength: 500 * 1024 * 1024,
        maxContentLength: 500 * 1024 * 1024,
        timeout: 0,
      });
    }
    return this.client;
  }

  async health(): Promise<WorkerHealthResult> {
    const res = await this.getClient().get("/worker/health");
    return res.data;
  }

  async deliver(params: WorkerDeliverParams): Promise<WorkerDeliverResult> {
    logger.info("[WorkerClient] Sending deliver task to worker...");
    const res = await this.getClient().post("/worker/deliver", params, {
      timeout: 5 * 60 * 1000,
    });
    return res.data;
  }

  async snapshot(params: WorkerSnapshotParams): Promise<WorkerSnapshotResult> {
    logger.info("[WorkerClient] Sending snapshot task to worker...");
    const res = await this.getClient().post("/worker/snapshot", params, {
      timeout: 20 * 60 * 1000,
    });
    return res.data;
  }

  async frameit(params: WorkerFrameitParams): Promise<WorkerFrameitResult> {
    logger.info("[WorkerClient] Sending frameit task to worker...");
    const res = await this.getClient().post("/worker/frameit", params, {
      timeout: 5 * 60 * 1000,
    });
    return res.data;
  }
}

export const workerClient = new FastlaneWorkerClient();

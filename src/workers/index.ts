import os from "os";
import { TsProjectWorker } from "./ts-project-worker";

export const getTsWorkerPool = (tsconfig?: string) =>
  TsProjectWorker.createPool(Math.max(1, os.cpus().length - 1), {
    getTsConfig: () => tsconfig,
  });

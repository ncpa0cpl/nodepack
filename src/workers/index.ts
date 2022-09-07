import os from "os";
import { TsProjectWorker } from "./ts-project-worker";

export const TsWorkerPool = TsProjectWorker.createPool(
  Math.max(1, os.cpus().length - 1)
);

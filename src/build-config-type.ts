import type { GetDataType } from "dilswer";
import type { buildConfigSchema } from "./build-config";

export type BuildConfig = GetDataType<typeof buildConfigSchema>;

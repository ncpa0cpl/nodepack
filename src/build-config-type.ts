import type { Infer } from "dilswer";
import type { buildConfigSchema } from "./build-config";

export type BuildConfig = Infer<typeof buildConfigSchema>;

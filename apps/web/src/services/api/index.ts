import { env } from "@/lib/env";
import type { NurApi } from "./contract";
import { createHttpApi } from "./http-api";
import { createMockApi } from "./mock-api";

export type { NurApi } from "./contract";
export { ApiError, isApiError, userMessage } from "./errors";

/** Instance API tunggal aplikasi. */
export const api: NurApi = env.apiMode === "mock" ? createMockApi() : createHttpApi(env.apiBaseUrl);

import type { WorkIqExecutionMeta } from "../shared/types.js";

type CreateWorkIqExecutionMetaArgs = {
  toolUsed: string;
  unavailable: boolean;
  liveDataConfirmed?: boolean;
  liveDataSource?: "none" | "skill";
};

export function createWorkIqExecutionMeta({
  toolUsed,
  unavailable,
  liveDataConfirmed = !unavailable,
  liveDataSource = liveDataConfirmed ? "skill" : "none",
}: CreateWorkIqExecutionMetaArgs): WorkIqExecutionMeta {
  return {
    toolUsed,
    unavailable,
    liveDataConfirmed,
    liveDataSource,
  };
}

export function withWorkIqExecutionMeta<T extends Record<string, unknown>>(
  payload: T,
  meta: WorkIqExecutionMeta,
): T & WorkIqExecutionMeta & { meta: WorkIqExecutionMeta } {
  return {
    ...payload,
    meta,
    ...meta,
  };
}
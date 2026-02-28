import { z } from "zod";

const AttachmentSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().default(""),
  size: z.number().int().nonnegative().optional(),
  dataUrl: z.string().nullish(),
  textContent: z.string().nullish(),
  isImage: z.boolean().optional(),
});

export const Schemas = {
  switchModel: z.object({
    sessionId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  sessionCreate: z
    .object({
      model: z.string().min(1).optional(),
      streaming: z.boolean().optional(),
      systemMessage: z.string().optional(),
    })
    .default({}),
  sessionIdOnly: z.object({
    sessionId: z.string().min(1),
  }),
  sessionSend: z.object({
    sessionId: z.string().min(1),
    prompt: z.string().optional().default(""),
    attachments: z.array(AttachmentSchema).optional().default([]),
  }),
  toolsList: z
    .object({
      model: z.string().min(1).optional(),
    })
    .default({}),
  skillsExecute: z.object({
    skillName: z.string().min(1),
    command: z.string().optional().default("status"),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  foundryConfig: z
    .object({
      endpoint: z.string().optional(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
    })
    .default({}),
  mcpConfigWrite: z.object({
    config: z
      .object({
        mcpServers: z.record(z.string(), z.unknown()),
      })
      .passthrough(),
  }),
  proactiveConfig: z
    .object({
      workiqPrompt: z.string().optional(),
      model: z.string().optional(),
    })
    .default({}),
} as const;

// Export inferred types for each schema
export type SwitchModelInput = z.infer<typeof Schemas.switchModel>;
export type SessionCreateInput = z.infer<typeof Schemas.sessionCreate>;
export type SessionIdOnlyInput = z.infer<typeof Schemas.sessionIdOnly>;
export type SessionSendInput = z.infer<typeof Schemas.sessionSend>;
export type ToolsListInput = z.infer<typeof Schemas.toolsList>;
export type SkillsExecuteInput = z.infer<typeof Schemas.skillsExecute>;
export type FoundryConfigInput = z.infer<typeof Schemas.foundryConfig>;
export type McpConfigWriteInput = z.infer<typeof Schemas.mcpConfigWrite>;
export type ProactiveConfigInput = z.infer<typeof Schemas.proactiveConfig>;

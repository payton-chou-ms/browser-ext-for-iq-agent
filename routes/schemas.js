import { z } from "zod";

const AttachmentSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().default(""),
  size: z.number().int().nonnegative().optional(),
  dataUrl: z.string().optional(),
  textContent: z.string().optional(),
  isImage: z.boolean().optional(),
});

export const Schemas = {
  switchModel: z.object({
    sessionId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  sessionCreate: z.object({
    model: z.string().min(1).optional(),
    streaming: z.boolean().optional(),
    systemMessage: z.string().optional(),
  }).default({}),
  sessionIdOnly: z.object({
    sessionId: z.string().min(1),
  }),
  sessionSend: z.object({
    sessionId: z.string().min(1),
    prompt: z.string().optional().default(""),
    attachments: z.array(AttachmentSchema).optional().default([]),
  }),
  toolsList: z.object({
    model: z.string().min(1).optional(),
  }).default({}),
  foundryConfig: z.object({
    endpoint: z.string().optional(),
    apiKey: z.string().optional(),
    clearApiKey: z.boolean().optional(),
  }).default({}),
  mcpConfigWrite: z.object({
    config: z.object({
      mcpServers: z.record(z.string(), z.unknown()),
    }).passthrough(),
  }),
  proactiveConfig: z.object({
    workiqPrompt: z.string().optional(),
    model: z.string().optional(),
  }).default({}),
};

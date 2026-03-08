const PROACTIVE_LIVE_DATA_UNAVAILABLE_RE = /(?:workiq-ask_work_iq\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|work\s*iq(?:\s+tool)?\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|workiq\s+skill\s+is\s+no\s+longer\s+available|no\s+["'`]?workiq["'`]?\s+skill\s+is\s+registered|workiq\s+skill\s+is\s+not\s+(?:registered|listed|available)|not\s+listed\s+among\s+available\s+skills|current\s+skill\s+registry|temporarily\s+loaded\s+earlier|i\s+can[’']?t\s+(?:access|complete).*(?:m365|microsoft\s*365|work\s*iq)|won[’']?t\s+fabricate\s+m365\s+search\s+results|please\s+enable\/provide\s+the\s+work\s*iq\s+tool|live\s+(?:m365|microsoft\s*365)\s+data\s+(?:was\s+)?unavailable)/i;

type ProactiveKind = "briefing" | "deadlines" | "ghosts" | "meeting-prep";

function extractJson(text: string): Record<string, unknown> {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    // not valid JSON
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]!);
    } catch {
      // code block content not valid JSON
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // extracted substring not valid JSON
    }
  }

  return { _raw: text, _parseError: true };
}

function tokenizePromptQuery(promptOverride = ""): string[] {
  const stopWords = new Set([
    "give", "me", "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "at", "is", "are",
    "please", "show", "list", "find", "with", "about", "just", "only",
  ]);
  return (promptOverride || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function includesAnyQueryToken(value: unknown, tokens: string[]): boolean {
  if (!Array.isArray(tokens) || tokens.length === 0) return true;
  const text = String(value ?? "").toLowerCase();
  return tokens.some((token) => text.includes(token));
}

function filterBriefingByPrompt(data: Record<string, unknown>, promptOverride = ""): Record<string, unknown> {
  const tokens = tokenizePromptQuery(promptOverride);
  if (tokens.length === 0) return data;

  const filterItems = (items: unknown[]): unknown[] =>
    items.filter((item) => includesAnyQueryToken(JSON.stringify(item), tokens));

  const emails = filterItems(Array.isArray(data.emails) ? data.emails : []);
  const meetings = filterItems(Array.isArray(data.meetings) ? data.meetings : []);
  const tasks = filterItems(Array.isArray(data.tasks) ? data.tasks : []);
  const mentions = filterItems(Array.isArray(data.mentions) ? data.mentions : []);

  if (emails.length || meetings.length || tasks.length || mentions.length) {
    return {
      ...data,
      emails,
      meetings,
      tasks,
      mentions,
    };
  }

  return {
    ...data,
    emails: [],
    meetings: [],
    tasks: [],
    mentions: [],
    text: `No relevant briefing items found for query: ${promptOverride}`,
  };
}

function emptyResult(kind: ProactiveKind, reason: string): Record<string, unknown> {
  switch (kind) {
    case "briefing":
      return { emails: [], meetings: [], tasks: [], mentions: [], text: reason, unavailable: true };
    case "deadlines":
      return { deadlines: [], text: reason, unavailable: true };
    case "ghosts":
      return { ghosts: [], text: reason, unavailable: true };
    case "meeting-prep":
      return {
        meeting: {},
        attendees: [],
        relatedDocs: [],
        recentChats: [],
        actionItems: [],
        text: reason,
        unavailable: true,
      };
  }
}

export function createUnavailableProactiveResult(kind: ProactiveKind, reason: string): Record<string, unknown> {
  return emptyResult(kind, reason);
}

export function isProactiveLiveDataUnavailable(text: string): boolean {
  return PROACTIVE_LIVE_DATA_UNAVAILABLE_RE.test(text || "");
}

export function normalizeProactiveResult(kind: ProactiveKind, content: string, promptOverride = ""): Record<string, unknown> {
  if (isProactiveLiveDataUnavailable(content)) {
    return emptyResult(kind, "Live Work IQ / M365 data is unavailable in this session.");
  }

  const parsed = extractJson(content);

  switch (kind) {
    case "briefing": {
      const normalized = {
        ...parsed,
        emails: Array.isArray(parsed.emails) ? parsed.emails : [],
        meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [],
      };
      return promptOverride ? filterBriefingByPrompt(normalized, promptOverride) : normalized;
    }
    case "deadlines":
      return {
        ...parsed,
        deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
      };
    case "ghosts":
      return {
        ...parsed,
        ghosts: Array.isArray(parsed.ghosts) ? parsed.ghosts : [],
      };
    case "meeting-prep":
      return {
        ...parsed,
        meeting: parsed.meeting && typeof parsed.meeting === "object" ? parsed.meeting : {},
        attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
        relatedDocs: Array.isArray(parsed.relatedDocs) ? parsed.relatedDocs : [],
        recentChats: Array.isArray(parsed.recentChats) ? parsed.recentChats : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      };
  }
}
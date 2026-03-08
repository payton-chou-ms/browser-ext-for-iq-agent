import { WORKIQ_SKILL_COMMAND } from "./workiq-cli.js";

type PromptBuildOptions = {
  customPrompt?: string;
  promptOverride?: string;
};

function withWorkIqPrompt(lines: string[], customPrompt = ""): string[] {
  const prompt = customPrompt.trim();
  if (!prompt) return lines;
  return [...lines, `Additional user guidance for WorkIQ: ${prompt}`];
}

function withPromptOverride(lines: string[], promptOverride = ""): string[] {
  const overridePrompt = promptOverride.trim();
  if (!overridePrompt) return lines;
  return [
    ...lines,
    "",
    "[Schedule Card Focus - MUST FOLLOW]",
    `User query focus: ${overridePrompt}`,
    "Only return items directly related to the query focus above.",
    "If no related items are found, return valid JSON with empty arrays/objects following the required schema.",
    "Do NOT fill unrelated generic items just to satisfy list length.",
  ];
}

function buildProactivePrompt(lines: string[], options: PromptBuildOptions = {}): string {
  const body = withPromptOverride(withWorkIqPrompt(lines, options.customPrompt), options.promptOverride).join("\n");
  return `${WORKIQ_SKILL_COMMAND} ${body}`;
}

export function buildBriefingPrompt(options: PromptBuildOptions = {}): string {
  const hasPromptOverride = (options.promptOverride || "").trim().length > 0;
  return buildProactivePrompt([
    "Generate a daily briefing for today. Return JSON with this exact structure:",
    "{",
    '  "emails": [{ "from": "sender name", "subject": "subject line", "age": "2h ago", "priority": "high|medium|low", "snippet": "preview text..." }],',
    '  "meetings": [{ "time": "09:00", "title": "meeting title", "attendees": ["name1", "name2"], "location": "room/link" }],',
    '  "tasks": [{ "title": "task name", "due": "today|tomorrow|3 days", "status": "pending|overdue", "source": "Planner|To-Do" }],',
    '  "mentions": [{ "from": "person", "channel": "team/channel", "message": "snippet...", "time": "1h ago" }],',
    '  "text": "optional short note"',
    "}",
    hasPromptOverride
      ? "If schedule-card query focus is provided, return only query-relevant items. If none are relevant, return empty arrays and set a short text field explaining no match."
      : "Use WorkIQ tools to fetch real data if available. If unavailable, do not invent results; return empty arrays and set text explaining live M365 data was unavailable.",
  ], options);
}

export function buildDeadlinesPrompt(options: PromptBuildOptions = {}): string {
  return buildProactivePrompt([
    "Scan the user's email and calendar for upcoming deadlines, due dates, expense reports, and submission dates. Return JSON:",
    "{",
    '  "deadlines": [{ "title": "what is due", "date": "YYYY-MM-DD", "daysLeft": number, "source": "email|calendar|task", "sourceDetail": "from: sender / event name", "urgency": "critical|warning|normal", "snippet": "context..." }],',
    '  "text": "optional short note"',
    "}",
    "Include expense reports, approvals, submissions, reviews, and any time-sensitive items.",
    "Sort by daysLeft ascending (most urgent first).",
    "Use WorkIQ tools to fetch real data if available. If unavailable, do not invent deadlines; return an empty deadlines array and set text explaining live M365 data was unavailable.",
  ], options);
}

export function buildGhostsPrompt(options: PromptBuildOptions = {}): string {
  return buildProactivePrompt([
    "Find emails in the user's inbox that they haven't replied to yet and probably should. Return JSON:",
    "{",
    '  "ghosts": [{ "from": "sender name", "subject": "email subject", "receivedAt": "2 days ago", "priority": "critical|high|medium", "reason": "客戶信件|主管要求|內部請求|HR|需要確認", "snippet": "preview of the email..." }],',
    '  "text": "optional short note"',
    "}",
    "Prioritize: customer emails > manager requests > internal requests > HR > FYI.",
    "Only include emails older than 4 hours that likely need a response.",
    "Use WorkIQ tools to fetch real data if available. If unavailable, do not invent unreplied emails; return an empty ghosts array and set text explaining live M365 data was unavailable.",
  ], options);
}

export function buildMeetingPrepPrompt(options: PromptBuildOptions = {}): string {
  return buildProactivePrompt([
    "Find the user's next upcoming meeting (within 2 hours or the next one today) and prepare a briefing. Return JSON:",
    "{",
    '  "meeting": { "title": "meeting name", "time": "HH:MM", "duration": "30 min", "location": "room/link" },',
    '  "attendees": [{ "name": "person name", "role": "title/department", "notes": "relevant context" }],',
    '  "relatedDocs": [{ "name": "doc name", "type": "pptx|docx|xlsx", "url": "sharepoint url", "relevance": "why this doc is relevant" }],',
    '  "recentChats": [{ "channel": "team/channel", "summary": "what was discussed", "time": "yesterday" }],',
    '  "actionItems": [{ "item": "what you promised", "from": "which meeting", "date": "when" }],',
    '  "text": "optional short note"',
    "}",
    "Use WorkIQ tools to fetch real data if available. If unavailable, do not invent meeting prep data; return empty arrays/objects and set text explaining live M365 data was unavailable.",
  ], options);
}
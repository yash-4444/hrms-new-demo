/* Public surface of the AI suite — import from "@/components/ai". */

export {
  AI_TONE,
  AiBadge,
  AiCitation,
  AiConfidence,
  AiConfirmCard,
  AiDraftBanner,
  AiExplainButton,
  AiFeedback,
  AiGuardrailChips,
  AiRichText,
  AiSuggestionCard,
  useReducedMotion,
  useStreamedText,
} from "./ai-ui";
export type { ConfirmField, ExplainDriver } from "./ai-ui";
export { CopilotLauncher, CopilotPanel, CopilotProvider, useCopilot } from "./copilot-panel";
export { CopilotThreadView, useCopilotThread } from "./copilot-chat";
export type { ChatMessage, CopilotThread } from "./copilot-chat";
export { INTENT_CATALOG, respond, scopeOf, scopedEmployees, suggestedPrompts } from "./engine";
export type { CopilotContext, CopilotReply, IntentId, ReplyBlock } from "./engine";

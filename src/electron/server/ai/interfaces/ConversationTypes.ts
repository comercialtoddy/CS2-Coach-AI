/**
 * Role of the message sender
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A single message in a conversation
 */
export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: {
    type?: string;
    context?: Record<string, unknown>;
  };
}

/**
 * A conversation summary
 */
export interface ConversationSummary {
  mainTopics: string[];
  keyDecisions: string[];
  actionItems: string[];
  context: string;
  timestamp: number;
}

/**
 * Conversation history with metadata
 */
export interface ConversationHistory {
  messages: ConversationMessage[];
  metadata: {
    startTime: number;
    endTime: number;
    totalMessages: number;
    participants: MessageRole[];
  };
} 
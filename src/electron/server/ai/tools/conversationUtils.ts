import { ConversationMessage } from '../interfaces/ConversationTypes.js';

/**
 * Maximum number of tokens to allow in a single chunk
 * This is a conservative estimate to ensure we stay within model context limits
 */
const MAX_TOKENS_PER_CHUNK = 2000;

/**
 * Utility class for processing conversation history
 */
export class ConversationProcessor {
  /**
   * Estimate the number of tokens in a text
   * This is a rough estimate based on average English word length
   */
  private static estimateTokenCount(text: string): number {
    // Average English word is about 4 characters
    // Add 1 for spaces between words
    // Multiply by 1.3 for safety margin
    return Math.ceil((text.length / 5) * 1.3);
  }

  /**
   * Format a single message for LLM input
   */
  private static formatMessage(message: ConversationMessage): string {
    const timestamp = new Date(message.timestamp).toISOString();
    const role = message.role.toUpperCase();
    return `[${timestamp}] ${role}: ${message.content}`;
  }

  /**
   * Split conversation history into chunks that fit within token limits
   */
  public static chunkConversationHistory(messages: ConversationMessage[]): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokenCount = 0;

    // Process messages from newest to oldest
    for (const message of messages.reverse()) {
      const formattedMessage = this.formatMessage(message);
      const messageTokens = this.estimateTokenCount(formattedMessage);

      // If adding this message would exceed the token limit, start a new chunk
      if (currentTokenCount + messageTokens > MAX_TOKENS_PER_CHUNK && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentTokenCount = 0;
      }

      // Add message to current chunk
      currentChunk.push(formattedMessage);
      currentTokenCount += messageTokens;
    }

    // Add any remaining messages
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Extract key points from a conversation chunk
   */
  public static extractKeyPoints(conversationText: string): string[] {
    const keyPoints: string[] = [];
    const lines = conversationText.split('\n');

    for (const line of lines) {
      // Look for lines that might contain key information
      if (
        line.includes('suggested') ||
        line.includes('recommended') ||
        line.includes('advised') ||
        line.includes('important') ||
        line.includes('key point') ||
        line.includes('critical') ||
        line.includes('must') ||
        line.includes('should')
      ) {
        keyPoints.push(line.trim());
      }
    }

    return keyPoints;
  }

  /**
   * Generate a prompt for summarizing a conversation chunk
   */
  public static generateSummaryPrompt(conversationChunk: string): string {
    const keyPoints = this.extractKeyPoints(conversationChunk);
    const keyPointsText = keyPoints.length > 0
      ? '\n\nKey points to consider:\n' + keyPoints.map(point => `- ${point}`).join('\n')
      : '';

    return `Please summarize the following conversation, focusing on the main topics discussed, key decisions made, and any actionable items or recommendations provided. The summary should be concise but comprehensive.

Conversation:
${conversationChunk}${keyPointsText}

Please provide a summary that includes:
1. Main topics discussed
2. Key decisions or recommendations
3. Action items or next steps
4. Any important context or background information

Format the summary in clear, concise paragraphs.`;
  }

  /**
   * Process conversation history for summarization
   */
  public static prepareForSummarization(messages: ConversationMessage[]): {
    chunks: string[];
    prompts: string[];
  } {
    // Split conversation into manageable chunks
    const chunks = this.chunkConversationHistory(messages);

    // Generate prompts for each chunk
    const prompts = chunks.map(chunk => this.generateSummaryPrompt(chunk));

    return {
      chunks,
      prompts
    };
  }
} 
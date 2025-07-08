import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata } from '../interfaces/ITool.js';
import { ConversationMessage, ConversationSummary } from '../interfaces/ConversationTypes.js';
import { ConversationProcessor } from './conversationUtils.js';
import { CallLLMTool } from './CallLLMTool.js';
import type { CallLLMToolOutput } from './CallLLMTool.js';
import { DEFAULT_MODELS } from '../../services/openRouterServices.js';

interface SummarizeConversationInput {
  messages: ConversationMessage[];
}

interface SummarizeConversationOutput {
  summary: ConversationSummary;
  chunks: number;
}

/**
 * Tool for generating concise summaries of agent-player conversations
 */
export class Tool_SummarizeConversation implements ITool<SummarizeConversationInput, SummarizeConversationOutput> {
  public name = 'Tool_SummarizeConversation';
  public description = 'Generates concise summaries of the agent\'s interactions and feedback provided to the player during a session.';

  public inputSchema: Record<string, ToolParameterSchema> = {
    messages: {
      type: 'array',
      description: 'Array of conversation messages to summarize',
      required: true,
      items: {
        type: 'object',
        description: 'A single message in the conversation',
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'assistant', 'system'],
            description: 'Role of the message sender'
          },
          content: {
            type: 'string',
            description: 'Content of the message'
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp of when the message was sent'
          }
        }
      }
    }
  };

  public outputExample: SummarizeConversationOutput = {
    summary: {
      mainTopics: ['Task management', 'Code implementation'],
      keyDecisions: ['Decided to use OpenRouter for LLM integration'],
      actionItems: ['Implement error handling', 'Add unit tests'],
      context: 'Discussion focused on implementing the conversation summarization module.',
      timestamp: Date.now()
    },
    chunks: 1
  };

  public metadata: ToolMetadata = {
    version: '1.0.0',
    category: 'conversation',
    tags: ['summarization', 'conversation', 'llm']
  };

  private llmTool: CallLLMTool;

  constructor(llmTool: CallLLMTool) {
    this.llmTool = llmTool;
  }

  public validateInput(input: SummarizeConversationInput): { isValid: boolean; errors?: { parameter: string; message: string; receivedType?: string; expectedType?: string; }[] } {
    const errors = [];

    if (!Array.isArray(input.messages)) {
      errors.push({
        parameter: 'messages',
        message: 'Messages must be an array',
        receivedType: typeof input.messages,
        expectedType: 'array'
      });
    } else if (input.messages.length === 0) {
      errors.push({
        parameter: 'messages',
        message: 'Messages array cannot be empty',
        receivedType: 'empty array',
        expectedType: 'non-empty array'
      });
    } else {
      for (let i = 0; i < input.messages.length; i++) {
        const message = input.messages[i];
        if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
          errors.push({
            parameter: `messages[${i}].role`,
            message: 'Invalid message role',
            receivedType: message.role,
            expectedType: 'user | assistant | system'
          });
        }
        if (typeof message.content !== 'string') {
          errors.push({
            parameter: `messages[${i}].content`,
            message: 'Message content must be a string',
            receivedType: typeof message.content,
            expectedType: 'string'
          });
        }
        if (typeof message.timestamp !== 'number') {
          errors.push({
            parameter: `messages[${i}].timestamp`,
            message: 'Message timestamp must be a number',
            receivedType: typeof message.timestamp,
            expectedType: 'number'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Parse LLM output into a structured summary
   */
  private parseSummaryOutput(output: string): ConversationSummary {
    const sections = output.split('\n\n');
    const summary: ConversationSummary = {
      mainTopics: [],
      keyDecisions: [],
      actionItems: [],
      context: '',
      timestamp: Date.now()
    };

    for (const section of sections) {
      if (section.toLowerCase().includes('main topics')) {
        summary.mainTopics = section
          .split('\n')
          .slice(1) // Skip the header
          .map(line => line.replace(/^[0-9-.\s]*/, '').trim()) // Remove list markers
          .filter(line => line.length > 0);
      } else if (section.toLowerCase().includes('key decisions')) {
        summary.keyDecisions = section
          .split('\n')
          .slice(1)
          .map(line => line.replace(/^[0-9-.\s]*/, '').trim())
          .filter(line => line.length > 0);
      } else if (section.toLowerCase().includes('action items')) {
        summary.actionItems = section
          .split('\n')
          .slice(1)
          .map(line => line.replace(/^[0-9-.\s]*/, '').trim())
          .filter(line => line.length > 0);
      } else if (section.toLowerCase().includes('context')) {
        summary.context = section
          .split('\n')
          .slice(1)
          .join(' ')
          .trim();
      }
    }

    return summary;
  }

  /**
   * Execute the summarization
   */
  public async execute(input: SummarizeConversationInput, context: ToolExecutionContext): Promise<ToolExecutionResult<SummarizeConversationOutput>> {
    try {
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input parameters',
            details: validation.errors
          }
        };
      }

      // Prepare conversation for summarization
      const { chunks, prompts } = ConversationProcessor.prepareForSummarization(input.messages);

      // Generate summaries for each chunk
      const summaries = await Promise.all(
        prompts.map(prompt =>
          this.llmTool.execute({
            prompt,
            model: DEFAULT_MODELS.BALANCED,
            temperature: 0.3,
            maxTokens: 1000
          }, context)
        )
      );

      // Check if any LLM calls failed
      const failedSummaries = summaries.filter((result: ToolExecutionResult<CallLLMToolOutput>): result is ToolExecutionResult<CallLLMToolOutput> & { success: false } => !result.success);
      if (failedSummaries.length > 0) {
        return {
          success: false,
          error: {
            code: 'LLM_ERROR',
            message: 'Failed to generate summaries',
            details: failedSummaries.map(result => result.error)
          }
        };
      }

      // Combine and parse summaries
      const combinedSummary = summaries
        .map((result: ToolExecutionResult<CallLLMToolOutput>) => {
          if (!result.success || !result.data) {
            throw new Error('Failed to generate summary');
          }
          return result.data.content;
        })
        .join('\n\n=== Next Chunk ===\n\n');

      // Parse the combined summary
      const parsedSummary = this.parseSummaryOutput(combinedSummary);

      return {
        success: true,
        data: {
          summary: parsedSummary,
          chunks: chunks.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }
} 
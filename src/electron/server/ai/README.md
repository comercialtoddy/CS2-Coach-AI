# OpenHud AI Tooling Framework

The AI Tooling Framework provides a robust, extensible architecture for implementing AI agent tools within the OpenHud application. This framework enables the AI agent to perform step-by-step processing by encapsulating different functionalities as callable tools.

## 🏗️ Architecture Overview

The framework consists of three main components:

1. **ITool Interface** - Defines the contract for all AI tools
2. **ToolManager** - Manages tool registration, discovery, and execution  
3. **Tool Implementations** - Specific tools that implement the ITool interface

## 📦 Core Components

### ITool Interface (`interfaces/ITool.ts`)

The core interface that all tools must implement:

```typescript
interface ITool<TInput = any, TOutput = any> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, ToolParameterSchema>;
  readonly outputExample: TOutput;
  readonly metadata: ToolMetadata;
  
  validateInput(input: TInput): ValidationResult;
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>>;
  dispose?(): Promise<void>;
  healthCheck?(): Promise<HealthStatus>;
}
```

### ToolManager (`ToolManager.ts`)

Centralized manager for tool operations:

- **Registration**: Register/unregister tools
- **Execution**: Execute tools with validation and error handling
- **Discovery**: Find and list available tools
- **Monitoring**: Track execution statistics and events
- **Health Checks**: Monitor tool health status

### Tool Categories

Tools are organized into categories for better discovery:

- `DATA_RETRIEVAL` - Database queries, API calls
- `ANALYSIS` - Data processing, calculations
- `COMMUNICATION` - External service interactions
- `UTILITY` - Helper functions, utilities
- `EXTERNAL_API` - Third-party integrations
- `DATABASE` - Database operations
- `FILE_SYSTEM` - File operations
- `GAME_STATE` - CS2/CSGO game state processing
- `PLAYER_MANAGEMENT` - Player-related operations

## 🚀 Quick Start

### 1. Create a New Tool

```typescript
import { ITool, ToolExecutionContext, ToolExecutionResult } from '../interfaces/ITool.js';

export class MyCustomTool implements ITool<MyInput, MyOutput> {
  public readonly name = 'my-custom-tool';
  public readonly description = 'Description of what this tool does';
  
  public readonly inputSchema = {
    parameter1: {
      type: 'string',
      description: 'Description of parameter1',
      required: true
    }
  };
  
  public readonly outputExample = {
    result: 'example output'
  };
  
  public readonly metadata = {
    version: '1.0.0',
    category: 'utility',
    tags: ['custom', 'example']
  };

  public validateInput(input: MyInput): ValidationResult {
    // Implement validation logic
  }

  public async execute(input: MyInput, context: ToolExecutionContext): Promise<ToolExecutionResult<MyOutput>> {
    // Implement tool logic
  }
}
```

### 2. Register and Use the Tool

```typescript
import { toolManager } from './ToolManager.js';
import { MyCustomTool } from './tools/MyCustomTool.js';

// Register the tool
const myTool = new MyCustomTool();
toolManager.register(myTool);

// Execute the tool
const result = await toolManager.execute('my-custom-tool', {
  parameter1: 'value'
});

if (result.success) {
  console.log('Tool executed successfully:', result.data);
} else {
  console.error('Tool execution failed:', result.error);
}
```

## 🛠️ Development Guidelines

### Tool Naming Conventions

- Use kebab-case for tool names: `get-player-data`, `analyze-match-stats`
- Names should be descriptive and action-oriented
- Avoid generic names like `tool1` or `helper`

### Input Validation

Always implement robust input validation:

```typescript
public validateInput(input: MyInput): ValidationResult {
  const errors = [];
  
  // Check required parameters
  if (!input.requiredParam) {
    errors.push({
      parameter: 'requiredParam',
      message: 'Required parameter is missing',
      expectedType: 'string'
    });
  }
  
  // Type validation
  if (input.numericParam && typeof input.numericParam !== 'number') {
    errors.push({
      parameter: 'numericParam', 
      message: 'Parameter must be a number',
      receivedType: typeof input.numericParam,
      expectedType: 'number'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

### Error Handling

Use consistent error codes and provide helpful messages:

```typescript
// Good error handling
return {
  success: false,
  error: {
    code: 'PLAYER_NOT_FOUND',
    message: `Player with ID ${playerId} not found in database`,
    details: { playerId, availableIds: [1, 2, 3] }
  }
};
```

### Performance Considerations

- Set appropriate timeouts for tool execution
- Implement caching for expensive operations
- Use the `dispose()` method to clean up resources
- Monitor execution times and optimize slow tools

## 🔧 Advanced Features

### Event Monitoring

Monitor tool activity with event listeners:

```typescript
import { ToolManagerEvent } from './ToolManager.js';

toolManager.addEventListener(ToolManagerEvent.TOOL_EXECUTED, (event) => {
  console.log(`Tool ${event.toolName} executed successfully`);
});

toolManager.addEventListener(ToolManagerEvent.TOOL_FAILED, (event) => {
  console.error(`Tool ${event.toolName} failed:`, event.data);
});
```

### Health Monitoring

Implement health checks for your tools:

```typescript
public async healthCheck(): Promise<HealthStatus> {
  try {
    // Test tool dependencies (database, external APIs, etc.)
    await this.testDependencies();
    
    return {
      healthy: true,
      message: 'All dependencies are healthy',
      details: {
        lastChecked: new Date(),
        dependencies: ['database', 'external-api']
      }
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Health check failed',
      details: { error: error.message }
    };
  }
}
```

### Tool Statistics

Track execution metrics:

```typescript
const stats = toolManager.getToolStats('my-tool');
console.log(`Success rate: ${(stats.successCount / stats.totalExecutions * 100).toFixed(2)}%`);
console.log(`Average execution time: ${stats.averageExecutionTime}ms`);
```

## 🧪 Testing

The framework includes a comprehensive test suite (`AIToolingTest.ts`) that demonstrates:

- Tool registration and discovery
- Input validation
- Error handling
- Event monitoring
- Statistics tracking
- Health checks

Run the test suite:

```typescript
import { AIToolingTest } from './AIToolingTest.js';

const test = new AIToolingTest();
await test.runTests();
test.cleanup();
```

## 📚 Best Practices

### 1. Tool Design

- **Single Responsibility**: Each tool should have one clear purpose
- **Idempotent**: Tools should produce the same result for the same input
- **Stateless**: Avoid maintaining state between executions
- **Descriptive**: Provide clear descriptions and examples

### 2. Error Handling

- **Graceful Degradation**: Handle errors without crashing
- **Detailed Messages**: Provide helpful error messages for debugging
- **Consistent Codes**: Use standardized error codes across tools
- **Logging**: Log important events and errors

### 3. Performance

- **Timeout Management**: Set appropriate execution timeouts
- **Resource Cleanup**: Always clean up resources in `dispose()`
- **Caching**: Cache expensive computations when appropriate
- **Async Operations**: Use proper async/await patterns

### 4. Documentation

- **Clear Examples**: Provide working examples in documentation
- **Input/Output**: Document expected input and output formats
- **Edge Cases**: Document known limitations and edge cases
- **Version History**: Track changes and maintain compatibility

## 🔄 Integration with OpenHud

The AI Tooling Framework is designed to integrate seamlessly with OpenHud's existing architecture:

- **Database Integration**: Tools can use existing database services
- **API Integration**: Tools can interact with external APIs via existing HTTP clients
- **Game State**: Tools can process CS2/CSGO game state data
- **Real-time Updates**: Tools can emit events via Socket.io

## 🎯 Future Extensions

The framework is designed for extensibility. Future enhancements may include:

- **Tool Composition**: Combining multiple tools into workflows
- **Parallel Execution**: Running multiple tools simultaneously
- **Conditional Logic**: Tools that execute based on conditions
- **Tool Versioning**: Supporting multiple versions of the same tool
- **Remote Tools**: Tools that execute on remote services
- **AI Model Integration**: Tools that directly interface with AI models

## 📄 License

This AI Tooling Framework is part of the OpenHud project and follows the same licensing terms. 
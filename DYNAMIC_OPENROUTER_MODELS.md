# Dynamic OpenRouter Models System

## Overview

This document describes the implementation of a dynamic OpenRouter model system that replaces static model definitions with real-time discovery and intelligent categorization of available models.

## Problem Solved

Previously, the system used static `DEFAULT_MODELS` constants:
```typescript
export const DEFAULT_MODELS = {
  FAST: 'openai/gpt-3.5-turbo',
  BALANCED: 'anthropic/claude-2.1',
  SMART: 'anthropic/claude-3-sonnet-20240229',
  CREATIVE: 'meta-llama/llama-2-70b-chat',
  REASONING: 'google/gemini-pro',
  CHEAP: 'mistral/mistral-7b-instruct'
} as const;
```

This approach had several limitations:
- **Static models** could become unavailable or deprecated
- **No price awareness** - couldn't automatically choose cheapest options
- **No capability detection** - couldn't filter by features like structured outputs
- **Manual maintenance** - required code updates for new models
- **No performance optimization** - couldn't adapt to changing model landscape

## Solution Architecture

### 1. Dynamic Model Discovery

The system now automatically fetches models from OpenRouter's `/api/v1/models` endpoint and enhances them with computed properties:

```typescript
export interface EnhancedOpenRouterModel extends OpenRouterModel {
  category: 'fast' | 'balanced' | 'smart' | 'creative' | 'reasoning' | 'cheap' | 'other';
  costPerMToken: {
    input: number;
    output: number;
  };
  supportsStructuredOutputs: boolean;
  supportsToolCalling: boolean;
  supportsImages: boolean;
  quality: 'low' | 'medium' | 'high' | 'premium';
  performance: {
    speed: number; // 1-10 scale
    cost: number; // 1-10 scale (1 = expensive, 10 = cheap)
    intelligence: number; // 1-10 scale
  };
}
```

### 2. Intelligent Categorization

Models are automatically categorized based on their IDs and characteristics:

- **Fast**: `gpt-3.5-turbo`, `llama-3.1-8b`, `mistral-7b` - Quick responses
- **Smart**: `gpt-4`, `claude-3`, `gemini-pro` - High intelligence
- **Creative**: `llama-2-70b`, `mixtral` - Creative tasks
- **Reasoning**: Models with reasoning capabilities
- **Cheap**: Models with lowest cost per token
- **Balanced**: Well-rounded models for general use

### 3. Advanced Filtering System

The system supports sophisticated filtering options:

```typescript
export interface ModelFilters {
  category?: string;
  maxCostPerMToken?: number;
  minContextLength?: number;
  supportsStructuredOutputs?: boolean;
  supportsToolCalling?: boolean;
  supportsImages?: boolean;
  quality?: ('low' | 'medium' | 'high' | 'premium')[];
  providers?: string[];
  sortBy?: 'cost' | 'speed' | 'intelligence' | 'context_length' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
```

### 4. Intelligent Caching

- **30-minute cache** for optimal performance
- **Graceful fallback** to stale cache on API errors
- **Cache management** endpoints for manual control

## API Endpoints

### Core Model Discovery

#### GET `/openrouter/models/enhanced`
Enhanced models with filtering and caching.

**Query Parameters:**
- `category` - Filter by model category
- `maxCostPerMToken` - Maximum cost per million tokens
- `minContextLength` - Minimum context window size
- `supportsStructuredOutputs` - Filter by structured output support
- `supportsToolCalling` - Filter by tool calling capability
- `supportsImages` - Filter by image processing capability
- `quality` - Filter by quality tiers (comma-separated)
- `providers` - Filter by specific providers (comma-separated)
- `sortBy` - Sort by: cost, speed, intelligence, context_length, name
- `sortOrder` - Sort order: asc, desc
- `limit` - Limit number of results

**Example Request:**
```bash
GET /openrouter/models/enhanced?category=smart&supportsStructuredOutputs=true&sortBy=intelligence&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "anthropic/claude-3-sonnet-20240229",
        "name": "Claude 3 Sonnet",
        "category": "smart",
        "costPerMToken": {
          "input": 3.0,
          "output": 15.0
        },
        "supportsStructuredOutputs": true,
        "supportsToolCalling": true,
        "supportsImages": true,
        "quality": "premium",
        "performance": {
          "speed": 7,
          "cost": 6,
          "intelligence": 9
        },
        "context_length": 200000
      }
    ],
    "metadata": {
      "totalModels": 150,
      "categories": {
        "smart": 25,
        "fast": 30,
        "balanced": 40,
        "creative": 20,
        "reasoning": 15,
        "cheap": 20
      },
      "cached": true,
      "lastUpdate": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Use-Case Specific Recommendations

#### GET `/openrouter/recommendations/:useCase`
Get recommended models for specific use cases.

**Supported Use Cases:**
- `coding` - Models optimized for code generation
- `writing` - Models optimized for creative writing
- `analysis` - Models optimized for data analysis
- `chat` - Models optimized for conversational AI
- `reasoning` - Models optimized for logical reasoning
- `cheap` - Most cost-effective models
- `fast` - Fastest response models

**Example Request:**
```bash
GET /openrouter/recommendations/coding
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "useCase": "coding",
    "models": [
      {
        "id": "anthropic/claude-3-sonnet-20240229",
        "name": "Claude 3 Sonnet",
        "category": "smart",
        "supportsStructuredOutputs": true,
        "performance": {
          "intelligence": 9,
          "speed": 7,
          "cost": 6
        }
      }
    ],
    "count": 5
  }
}
```

### Dynamic Default Models

#### GET `/openrouter/models/dynamic-defaults`
Get current dynamic default models that replace static DEFAULT_MODELS.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "dynamicModels": {
      "FAST": "openai/gpt-3.5-turbo",
      "BALANCED": "anthropic/claude-3-sonnet-20240229",
      "SMART": "gpt-4-turbo-preview",
      "CREATIVE": "meta-llama/llama-2-70b-chat",
      "REASONING": "google/gemini-pro",
      "CHEAP": "mistral/mistral-7b-instruct"
    },
    "staticModels": {
      "FAST": "openai/gpt-3.5-turbo",
      "BALANCED": "anthropic/claude-2.1",
      "SMART": "anthropic/claude-3-sonnet-20240229",
      "CREATIVE": "meta-llama/llama-2-70b-chat",
      "REASONING": "google/gemini-pro",
      "CHEAP": "mistral/mistral-7b-instruct"
    },
    "cacheStatus": {
      "isCached": true,
      "lastFetch": "2024-01-15T10:30:00Z",
      "modelsCount": 150,
      "timeUntilRefresh": 1800000
    }
  }
}
```

### Cache Management

#### POST `/openrouter/cache/clear`
Clear the model cache to force fresh data retrieval.

#### GET `/openrouter/cache/status`
Get current cache status information.

## Implementation Details

### Service Layer (`openRouterServices.ts`)

#### Key Functions:

1. **`getEnhancedModels(filters)`**
   - Main function for enhanced model retrieval
   - Supports comprehensive filtering and sorting
   - Implements intelligent caching with fallback

2. **`getRecommendedModels(useCase)`**
   - Returns top 5 models for specific use cases
   - Uses predefined filtering strategies
   - Optimized for different AI tasks

3. **`getDynamicDefaultModels()`**
   - Dynamically selects best models for each category
   - Fallback to static models on failure
   - Updates automatically with new model availability

4. **`enhanceModelData(model)`**
   - Adds computed properties to raw models
   - Categorizes models intelligently
   - Calculates performance metrics

5. **`clearModelCache()` & `getCacheStatus()`**
   - Cache management utilities
   - Monitoring and control functions

### Controller Layer (`openRouterController.ts`)

The controller exposes all enhanced functionality through clean REST endpoints with proper error handling and input validation.

### Route Layer (`openRouterRoutes.ts`)

All enhanced endpoints are now properly exposed:
- `/models/enhanced` - Enhanced models with filtering
- `/recommendations/:useCase` - Use-case specific recommendations
- `/models/dynamic-defaults` - Dynamic default models
- `/cache/clear` - Cache management
- `/cache/status` - Cache status

## Benefits

### For Developers
- **No manual model maintenance** - System adapts automatically
- **Cost optimization** - Always uses most cost-effective models
- **Capability-aware** - Filters by features like structured outputs
- **Performance optimization** - Intelligent model selection

### For Users
- **Better recommendations** - AI-powered model suggestions
- **Faster responses** - Intelligent caching system
- **More reliable** - Fallback mechanisms for API failures
- **Cost-effective** - Automatic selection of optimal models

### For System
- **Scalable** - Handles growing model ecosystem
- **Maintainable** - Self-updating model information
- **Robust** - Graceful handling of API changes
- **Efficient** - Optimized caching and filtering

## Usage Examples

### Get Fast Models for Quick Responses
```bash
curl "localhost:3000/openrouter/models/enhanced?category=fast&sortBy=speed&sortOrder=desc&limit=3"
```

### Get Cheap Models for Cost-Conscious Applications
```bash
curl "localhost:3000/openrouter/recommendations/cheap"
```

### Get Smart Models with Structured Output Support
```bash
curl "localhost:3000/openrouter/models/enhanced?category=smart&supportsStructuredOutputs=true"
```

### Get Current Dynamic Defaults
```bash
curl "localhost:3000/openrouter/models/dynamic-defaults"
```

### Clear Cache and Get Fresh Data
```bash
curl -X POST "localhost:3000/openrouter/cache/clear"
```

## Migration Guide

### From Static to Dynamic

**Before:**
```typescript
const response = await callLLM(prompt, {
  model: DEFAULT_MODELS.SMART
});
```

**After:**
```typescript
const dynamicDefaults = await getDynamicDefaultModels();
const response = await callLLM(prompt, {
  model: dynamicDefaults.SMART
});
```

### Advanced Usage

```typescript
// Get best coding models
const codingModels = await getRecommendedModels('coding');

// Get cheap models under $1 per million tokens
const cheapModels = await getEnhancedModels({
  maxCostPerMToken: 1.0,
  sortBy: 'cost'
});

// Get fast models with image support
const fastImageModels = await getEnhancedModels({
  category: 'fast',
  supportsImages: true,
  sortBy: 'speed',
  sortOrder: 'desc'
});
```

## Monitoring

The system provides comprehensive monitoring capabilities:

- **Cache hit rates** - Monitor caching effectiveness
- **API call frequency** - Track OpenRouter API usage
- **Model availability** - Monitor model status changes
- **Performance metrics** - Track response times and costs

## Future Enhancements

1. **Model Performance Tracking** - Historical performance data
2. **Custom Model Preferences** - User-defined model preferences
3. **Load Balancing** - Distribute load across similar models
4. **Cost Tracking** - Monitor and optimize spending
5. **A/B Testing** - Compare model performance automatically

## Conclusion

The dynamic OpenRouter model system transforms a static, manually-maintained approach into an intelligent, self-updating system that automatically adapts to the evolving AI model landscape. It provides better performance, lower costs, and more capabilities while requiring minimal maintenance. 
---
sidebar_position: 5
---

# Contributing Guide

Thank you for your interest in contributing to OpenHud! This guide will help you get started with contributing to the project.

## Development Setup

### Prerequisites

Before you begin, ensure you have:
- Node.js 18 or higher
- Git
- Visual Studio Code (recommended)
- CS2 installed (for testing)

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/OpenHud.git
   cd OpenHud
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy the GSI configuration:
   ```bash
   # Windows
   copy "src\assets\gamestate_integration_openhud.cfg" "%PROGRAMFILES(x86)%\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\"
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

The project follows a monorepo structure:

```
OpenHud/
├── src/
│   ├── UI/               # React frontend
│   ├── electron/         # Electron main process
│   └── assets/          # Static assets
├── docs/                # Documentation
└── e2e/                # End-to-end tests
```

## Git Workflow

We follow the GitFlow branching model:

### Branch Naming

- `main` - Production releases
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Production hotfixes
- `release/*` - Release preparation

### Creating a Feature

1. Create a branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
3. Commit using conventional commits:
   ```bash
   git commit -m "feat(component): add new feature"
   ```

4. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Document public APIs
- Use interfaces over types when possible

### React

- Use functional components
- Implement proper prop types
- Use hooks for state management
- Follow component composition patterns

### Electron

- Use IPC for main/renderer communication
- Follow security best practices
- Handle window management properly
- Implement proper error handling

### Example Component

```typescript
import React from 'react';
import { useCallback } from 'react';

interface Props {
  title: string;
  onAction: () => void;
}

export const ExampleComponent: React.FC<Props> = ({ title, onAction }) => {
  const handleClick = useCallback(() => {
    onAction();
  }, [onAction]);

  return (
    <div className="example-component">
      <h2>{title}</h2>
      <button onClick={handleClick}>
        Click Me
      </button>
    </div>
  );
};
```

## Testing

### Unit Tests

- Write tests for all new features
- Use Jest and React Testing Library
- Maintain high test coverage
- Run tests before committing:
  ```bash
  npm test
  ```

### E2E Tests

- Write E2E tests for critical paths
- Use Playwright for E2E testing
- Run E2E tests before merging:
  ```bash
  npm run e2e
  ```

### Example Test

```typescript
import { render, fireEvent } from '@testing-library/react';
import { ExampleComponent } from './ExampleComponent';

describe('ExampleComponent', () => {
  it('calls onAction when clicked', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <ExampleComponent title="Test" onAction={onAction} />
    );

    fireEvent.click(getByText('Click Me'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

## Documentation

### Code Documentation

- Document all public APIs
- Use JSDoc comments
- Include examples where helpful
- Keep documentation up to date

### Example Documentation

```typescript
/**
 * Calculates the optimal buy recommendation based on team economy
 * @param {number} playerMoney - Current player's money
 * @param {number} teamAverageMoney - Average team money
 * @returns {BuyRecommendation} Recommended buy actions
 * @example
 * const recommendation = calculateBuyRecommendation(4000, 3500);
 * // Returns: { shouldBuy: true, items: ['ak47', 'armor'] }
 */
export function calculateBuyRecommendation(
  playerMoney: number,
  teamAverageMoney: number
): BuyRecommendation {
  // Implementation
}
```

## Pull Request Process

1. Create a descriptive PR title
2. Fill out the PR template
3. Ensure all tests pass
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested
7. Merge after approval

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] All tests passing
```

## Release Process

1. Create release branch:
   ```bash
   git checkout develop
   git checkout -b release/v1.0.0
   ```

2. Update version:
   ```bash
   npm version 1.0.0
   ```

3. Run tests:
   ```bash
   npm test
   npm run e2e
   ```

4. Create release PR
5. After approval, merge to main
6. Tag release:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

## Getting Help

- Check existing issues
- Join discussions
- Ask in pull requests
- Contact maintainers

## Code of Conduct

Please read our [Code of Conduct](./code-of-conduct.md) before contributing.

## License

By contributing, you agree that your contributions will be licensed under the project's license. 
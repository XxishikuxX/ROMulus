# Contributing to EmuVerse

Thank you for your interest in contributing to EmuVerse! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Testing](#testing)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- No harassment, discrimination, or hate speech
- Constructive criticism only
- Focus on what's best for the community

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Git
- Docker (optional, for testing)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/emuverse.git
   cd emuverse
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/yourusername/emuverse.git
   ```

## Development Setup

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your local settings
nano .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running Both

Use two terminal windows, or use a process manager:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-new-emulator` - New features
- `fix/login-bug` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/api-cleanup` - Code refactoring

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

Examples:
```
feat(auth): add password reset functionality
fix(player): resolve audio sync issues
docs(readme): add installation instructions
```

## Submitting Changes

### Pull Request Process

1. Update your fork:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```

3. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature
   ```

5. Open a Pull Request on GitHub

### PR Requirements

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated if needed
- [ ] No merge conflicts

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have added tests
- [ ] Documentation has been updated
```

## Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Use ES6+ features
- Use `const` over `let` when possible
- Use meaningful variable names
- Add JSDoc comments for public functions

```typescript
/**
 * Fetches user data from the API
 * @param userId - The user's unique identifier
 * @returns Promise containing user data
 */
async function fetchUser(userId: string): Promise<User> {
  // Implementation
}
```

### React Components

- Use functional components with hooks
- Use TypeScript interfaces for props
- Keep components small and focused

```tsx
interface GameCardProps {
  title: string;
  system: string;
  coverUrl?: string;
  onClick: () => void;
}

export function GameCard({ title, system, coverUrl, onClick }: GameCardProps) {
  return (
    // JSX
  );
}
```

### CSS/Tailwind

- Use Tailwind utility classes
- Follow mobile-first approach
- Use CSS variables for theming

### Database

- Use meaningful table and column names
- Add appropriate indexes
- Include migrations for schema changes

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

### Writing Tests

- Write unit tests for utilities and services
- Write integration tests for API endpoints
- Write component tests for React components

```typescript
describe('AuthService', () => {
  it('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hash = await AuthService.hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await AuthService.verifyPassword(password, hash)).toBe(true);
  });
});
```

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase

Thank you for contributing! 🎮

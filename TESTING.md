# TypeScript Language Server MCP Server - Testing Guide

This document outlines the testing strategy and procedures for the TypeScript Language Server MCP Server.

## Test Structure

### Test Categories

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test TypeScript LSP client integration
3. **End-to-End Tests**: Test complete MCP server workflows
4. **Performance Tests**: Test server performance under load
5. **Error Handling Tests**: Test graceful error handling

### Test Files

- `tests/typescript-operations.test.ts` - Core functionality tests
- `test-fixtures/` - Sample TypeScript/JavaScript files for testing

## Testing Prerequisites

### Required Dependencies

```bash
# TypeScript Language Server (required for LSP tests)
npm install -g typescript-language-server typescript

# Development dependencies
bun install
```

### Environment Setup

```bash
# Verify TypeScript Language Server is available
typescript-language-server --help

# Should show help output without errors
```

## Test Execution

### Running All Tests

```bash
# Run complete test suite
bun test

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch
```

### Running Specific Test Categories

```bash
# Run only unit tests
bun test --grep "Unit Tests"

# Run only integration tests  
bun test --grep "Integration Tests"

# Run LSP client tests
bun test --grep "LSP Client"

# Run MCP server tests
bun test --grep "MCP Server"
```

### Running Individual Test Files

```bash
# Run specific test file
bun test tests/typescript-operations.test.ts

# Run specific test by name
bun test --grep "should find TypeScript symbols"
```

## Test Fixtures

### Sample Project Structure

```
test-fixtures/
├── simple-project/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   └── user.ts
│   │   ├── services/
│   │   │   └── user-service.ts
│   │   └── utils/
│   │       └── helpers.ts
│   └── tests/
│       └── user-service.test.ts
├── mixed-project/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.js
│   │   ├── component.tsx
│   │   └── utils.ts
└── error-project/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── errors.ts          # Contains intentional type errors
        └── missing-imports.ts # Contains missing import errors
```

### Test File Contents

#### Simple TypeScript Interface
```typescript
// test-fixtures/simple-project/src/types/user.ts
export interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export type UserRole = 'admin' | 'user' | 'guest';

export interface UserWithRole extends User {
  role: UserRole;
}
```

#### Service Class
```typescript
// test-fixtures/simple-project/src/services/user-service.ts
import { User, UserRole, UserWithRole } from '../types/user.js';

export class UserService {
  private users: UserWithRole[] = [];

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData
    };
    return user;
  }

  async findUserById(id: number): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async updateUserRole(userId: number, role: UserRole): Promise<void> {
    const user = await this.findUserById(userId);
    if (user) {
      (user as UserWithRole).role = role;
    }
  }

  private generateId(): number {
    return Math.floor(Math.random() * 1000000);
  }
}
```

#### Helper Functions
```typescript
// test-fixtures/simple-project/src/utils/helpers.ts
import { User } from '../types/user.js';

export function formatUserName(user: User): string {
  return `${user.name} (${user.email})`;
}

export function isActiveUser(user: User): boolean {
  return user.isActive;
}

export function filterActiveUsers(users: User[]): User[] {
  return users.filter(isActiveUser);
}

// Function with overloads for testing
export function processData(data: string): string;
export function processData(data: number): number;
export function processData(data: string | number): string | number {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
  return data * 2;
}
```

### Error Test Files

#### Type Errors
```typescript
// test-fixtures/error-project/src/errors.ts
interface BadInterface {
  name: string;
  age: number;
}

// Intentional type errors for testing
const user: BadInterface = {
  name: 'John',
  age: 'thirty' // Type error: string not assignable to number
};

function badFunction(x: number): string {
  return x; // Type error: number not assignable to string
}

// Unused variable
const unusedVariable = 'test';

// Missing return type
function noReturnType(x: number) {
  return x.toString();
}
```

## Test Categories

### 1. TypeScript LSP Client Tests

#### Connection and Initialization
```typescript
describe('TypeScript LSP Client', () => {
  test('should initialize successfully', async () => {
    const client = new TypeScriptLSPClient('/path/to/test-project');
    await client.initialize();
    expect(client.initialized).toBe(true);
    await client.shutdown();
  });

  test('should handle initialization timeout', async () => {
    // Test with invalid path to trigger timeout
  });

  test('should handle process errors', async () => {
    // Test error handling when TypeScript LS fails to start
  });
});
```

#### Symbol Operations
```typescript
describe('Symbol Operations', () => {
  test('should find TypeScript symbols', async () => {
    const result = await findSymbol(client, 'UserService', 'class');
    expect(result).toContain('UserService');
    expect(result).toContain('Class');
  });

  test('should go to definition', async () => {
    const result = await gotoDefinition(client, testFile, 10, 15);
    expect(result).toContain('Definition found at:');
  });

  test('should find references', async () => {
    const result = await findReferences(client, testFile, 5, 10);
    expect(result).toContain('Found');
    expect(result).toContain('reference');
  });
});
```

#### Type Analysis
```typescript
describe('Type Analysis', () => {

  test('should check types', async () => {
    const result = await checkTypes(client, [errorFile]);
    expect(result).toContain('Type checking');
  });

  test('should get completion suggestions', async () => {
    const result = await getCompletionInfo(client, testFile, 10, 15);
    expect(result).toContain('Completion suggestions');
  });
});
```

### 2. MCP Server Integration Tests

#### Tool Registration
```typescript
describe('MCP Server Tools', () => {
  test('should register all TypeScript tools', () => {
    const tools = server.getRegisteredTools();
    expect(tools).toContain('find-symbol');
    expect(tools).toContain('goto-definition');
    expect(tools).toContain('check-types');
    // ... check all 22 tools
  });

  test('should handle tool execution', async () => {
    const result = await server.executeTool('find-symbol', {
      query: 'UserService',
      kind: 'class'
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('UserService');
  });
});
```

#### Error Handling
```typescript
describe('Error Handling', () => {
  test('should handle missing files gracefully', async () => {
    const result = await server.executeTool('goto-definition', {
      file: '/nonexistent/file.ts',
      line: 1,
      character: 1
    });
    expect(result.isError).toBe(true);
  });

  test('should handle TypeScript LS unavailable', async () => {
    // Mock TypeScript LS being unavailable
  });
});
```

### 3. Workspace Management Tests

```typescript
describe('Workspace Management', () => {
  test('should detect project type', async () => {
    const tsType = await workspaceManager.detectProjectType(tsProject);
    expect(tsType).toBe('typescript');
    
    const mixedType = await workspaceManager.detectProjectType(mixedProject);
    expect(mixedType).toBe('mixed');
  });

  test('should manage multiple workspaces', async () => {
    const client1 = await workspaceManager.getOrCreateWorkspace(project1);
    const client2 = await workspaceManager.getOrCreateWorkspace(project2);
    
    expect(client1).not.toBe(client2);
    expect(workspaceManager.workspaces.size).toBe(2);
  });

  test('should cleanup workspaces', async () => {
    await workspaceManager.closeAll();
    expect(workspaceManager.workspaces.size).toBe(0);
  });
});
```

### 4. Advanced Feature Tests

#### Call Hierarchy
```typescript
describe('Call Hierarchy', () => {
  test('should get incoming calls', async () => {
    const result = await getCallHierarchy(client, testFile, 10, 15, 'incoming');
    expect(result).toContain('Call hierarchy');
  });

  test('should get outgoing calls', async () => {
    const result = await getCallHierarchy(client, testFile, 10, 15, 'outgoing');
    expect(result).toContain('Call hierarchy');
  });
});
```

#### Type Hierarchy
```typescript
describe('Type Hierarchy', () => {
  test('should get supertypes', async () => {
    const result = await getTypeHierarchy(client, testFile, 10, 15, 'supertypes');
    expect(result).toContain('Type hierarchy');
  });

  test('should get subtypes', async () => {
    const result = await getTypeHierarchy(client, testFile, 10, 15, 'subtypes');
    expect(result).toContain('Type hierarchy');
  });
});
```

#### Refactoring
```typescript
describe('Refactoring', () => {
  test('should organize imports', async () => {
    const result = await organizeImports(client, testFile);
    expect(result).toContain('organized');
  });


  test('should apply code fixes', async () => {
    const result = await applyCodeFixes(client, errorFile, 5, 10);
    expect(result).toContain('code fixes');
  });
});
```

### 5. Performance Tests

```typescript
describe('Performance', () => {
  test('should handle multiple concurrent requests', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 10 }, () => 
      findSymbol(client, 'User', 'interface')
    );
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    expect(results.length).toBe(10);
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  test('should handle large workspaces', async () => {
    // Test with workspace containing many files
  });
});
```

## Mock Setup

### TypeScript Language Server Mock
```typescript
class MockTypeScriptLSPClient extends TypeScriptLSPClient {
  constructor() {
    super('/mock/workspace');
    this.initialized = true;
  }

  async sendRequest<T>(method: string, params: unknown): Promise<T> {
    // Return mock responses based on method
    switch (method) {
      case 'workspace/symbol':
        return mockSymbolResponse as T;
      case 'textDocument/definition':
        return mockDefinitionResponse as T;
      default:
        return {} as T;
    }
  }
}
```

## Test Data

### Mock Responses
```typescript
const mockSymbolResponse: SymbolInformation[] = [
  {
    name: 'UserService',
    kind: 5, // Class
    location: {
      uri: 'file:///test/user-service.ts',
      range: {
        start: { line: 5, character: 0 },
        end: { line: 25, character: 1 }
      }
    }
  }
];

const mockDefinitionResponse: Location = {
  uri: 'file:///test/user.ts',
  range: {
    start: { line: 2, character: 0 },
    end: { line: 2, character: 15 }
  }
};
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test TypeScript MCP Server

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install TypeScript Language Server
      run: npm install -g typescript-language-server typescript
      
    - name: Install dependencies
      run: bun install
      
    - name: Run tests
      run: bun test
      
    - name: Run linting
      run: bun run lint
```

## Debugging Tests

### Enable Debug Logging
```bash
# Run tests with debug output
DEBUG=typescript-mcp bun test

# Run specific test with verbose output
bun test --verbose tests/typescript-operations.test.ts
```

### Manual Testing
```bash
# Start MCP server manually for testing
bun run typescript/index.ts

# Test individual tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find-symbol","arguments":{"query":"User"}}}' | bun run typescript/index.ts
```

## Test Coverage Goals

- **Unit Tests**: > 90% code coverage
- **Integration Tests**: All TypeScript LSP operations
- **End-to-End Tests**: All MCP tools and prompts
- **Error Handling**: All error paths covered
- **Performance**: Response times within acceptable limits

## Common Issues and Solutions

### TypeScript Language Server Not Found
```bash
# Install globally
npm install -g typescript-language-server typescript

# Or locally in project
npm install typescript-language-server typescript
```

### Test Timeouts
- Increase timeout for LSP operations
- Use mock clients for unit tests
- Verify TypeScript Language Server is responsive

### Workspace Initialization Failures
- Check file permissions
- Verify TypeScript configuration files
- Ensure valid project structure

## Contributing to Tests

1. Write tests for new features
2. Ensure good test coverage
3. Use descriptive test names
4. Include both positive and negative test cases
5. Add performance tests for new operations
6. Update test fixtures when needed
# TypeScript Language Server MCP Server

A Model Context Protocol (MCP) server that provides comprehensive TypeScript/JavaScript code analysis capabilities through the TypeScript Language Server. This server enables LLMs to perform semantic code understanding, refactoring, and analysis with professional-grade accuracy.

## Features

### Symbol Navigation
- **find-symbol**: Search for symbols by name across the workspace with type filtering
- **goto-definition**: Find where symbols are defined
- **goto-source-definition**: Find source definitions (TypeScript 4.7+)
- **goto-type-definition**: Find type definitions
- **find-references**: Find all references to symbols
- **find-implementations**: Find interface/abstract method implementations

### Code Analysis
- **get-diagnostics**: Retrieve type errors, warnings, and hints
- **get-signature-help**: Get function signature and parameter information
- **get-completion-info**: Get auto-completion suggestions at any position
- **check-types**: Perform comprehensive TypeScript type checking

### Code Transformation
- **organize-imports**: Organize and clean up import statements
- **apply-code-fixes**: Apply available automated code fixes

### Workspace Understanding
- **list-symbols**: Get document or workspace symbol outlines
- **get-call-hierarchy**: Show function call relationships (incoming/outgoing)
- **get-type-hierarchy**: Show type inheritance relationships
- **analyze-imports**: Understand module dependencies and import issues
- **get-project-info**: Get TypeScript project configuration

### Code Quality

## Installation

### Prerequisites

```bash
# Install TypeScript Language Server globally
npm install -g typescript-language-server typescript

# Verify installation
typescript-language-server --help
```

### Installation from Source

```bash
# Clone and build the project
git clone <repository-url>
cd sgmpc/typescript
bun install
bun run build
```

## Usage

### Basic Usage

```bash
# Start the MCP server
bun run typescript/index.ts

# Or use as a module
node typescript/index.js
```

### Configuration

The server automatically detects TypeScript projects by looking for:
- `tsconfig.json`
- `jsconfig.json` 
- `package.json` with TypeScript dependencies

### Workspace Management

The server supports multiple concurrent workspaces and automatically manages TypeScript Language Server instances for optimal performance.

## Tool Reference

### Symbol Navigation Tools

#### find-symbol
Search for symbols across the workspace:
```json
{
  "name": "find-symbol",
  "arguments": {
    "query": "UserService",
    "kind": "class",
    "workspace": true,
    "workspaceRoot": "/path/to/project"
  }
}
```

#### goto-definition
Find symbol definitions:
```json
{
  "name": "goto-definition",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": 10,
    "character": 15
  }
}
```

#### goto-source-definition
Find source definitions (requires TypeScript 4.7+):
```json
{
  "name": "goto-source-definition",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": 10,
    "character": 15
  }
}
```

### Code Analysis Tools


#### check-types
Perform comprehensive type checking:
```json
{
  "name": "check-types",
  "arguments": {
    "files": ["/path/to/file1.ts", "/path/to/file2.ts"],
    "strict": true
  }
}
```

### Code Transformation Tools

#### organize-imports
Organize import statements:
```json
{
  "name": "organize-imports",
  "arguments": {
    "file": "/path/to/file.ts",
    "skipDestructiveActions": false
  }
}
```


### Advanced Features

#### get-call-hierarchy
Analyze function call relationships:
```json
{
  "name": "get-call-hierarchy",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": 10,
    "character": 15,
    "direction": "both"
  }
}
```

#### get-type-hierarchy
Analyze type inheritance:
```json
{
  "name": "get-type-hierarchy",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": 10,
    "character": 15,
    "direction": "both"
  }
}
```


## Prompts

### code-review
Performs comprehensive code review using multiple analysis tools:
```json
{
  "name": "code-review",
  "arguments": {
    "file": "/path/to/file.ts",
    "workspaceRoot": "/path/to/project"
  }
}
```

### refactor-analysis
Analyzes symbols for refactoring opportunities:
```json
{
  "name": "refactor-analysis",
  "arguments": {
    "symbol": "UserService",
    "workspaceRoot": "/path/to/project"
  }
}
```

### debug-types
Helps debug type issues at specific positions:
```json
{
  "name": "debug-types",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": "10",
    "character": "15",
    "workspaceRoot": "/path/to/project"
  }
}
```

### optimize-imports
Analyzes and optimizes import statements:
```json
{
  "name": "optimize-imports",
  "arguments": {
    "file": "/path/to/file.ts",
    "workspaceRoot": "/path/to/project"
  }
}
```

## Resources

### workspace-config
Access current workspace configuration:
```
typescript://workspace/config
```

### typescript-env
Get TypeScript environment information:
```
typescript://environment/info
```

### refactoring-catalog
Get available refactoring operations:
```
typescript://refactorings/available
```

## Error Handling

The server follows MCP best practices for error handling:
- All errors are returned within tool results with `isError: true`
- Graceful degradation when TypeScript Language Server is unavailable
- Automatic workspace cleanup on process termination

## Performance

- **Incremental Analysis**: Leverages TypeScript's incremental compilation
- **Workspace Caching**: Reuses Language Server instances across multiple operations
- **Connection Pooling**: Manages multiple concurrent workspace connections
- **Memory Optimization**: Automatic cleanup of unused workspace instances

## Comparison to Text-Based Search

### Semantic Precision
- **Type-aware resolution**: Distinguishes between symbols with the same name but different types
- **Scope awareness**: Understands local vs global scope, module boundaries
- **Import resolution**: Follows symbols across files and packages accurately
- **Context sensitivity**: Resolves overloaded functions, generic types, inheritance

### Rich Metadata
- **Complete type information**: Full type signatures, generics, union types, constraints
- **JSDoc integration**: Access to documentation, parameter descriptions, examples
- **Relationship mapping**: Inheritance hierarchies, call graphs, dependencies
- **Real-time accuracy**: Up-to-date analysis as code evolves

### Professional Features
- **IDE-quality results**: Same engine powering VS Code TypeScript support
- **Standard compliance**: Uses LSP protocol for maximum compatibility
- **Advanced refactoring**: Extract functions, convert code patterns, organize imports
- **Comprehensive diagnostics**: Type checking, unused code detection, import analysis

## Development

### Building
```bash
bun install
bun run build
```

### Testing
```bash
bun test
```

### Linting
```bash
bun run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

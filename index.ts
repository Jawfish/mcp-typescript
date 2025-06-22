#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  TypeScriptWorkspaceManager,
  checkTypeScriptLSPAvailable,
  findSymbol,
  gotoDefinition,
  gotoSourceDefinition,
  gotoTypeDefinition,
  findReferences,
  findImplementations,
  getDiagnostics,
  getSignatureHelp,
  checkTypes,
  organizeImports,
  applyCodeFixes,
  listSymbols,
  getCallHierarchy,
  getTypeHierarchy,
  analyzeImports,
  getProjectInfo,
  TypeScriptToolError,
} from "./lib/typescript-operations.js";

// Global workspace manager
const workspaceManager = new TypeScriptWorkspaceManager();

// Create MCP server
const server = new McpServer({
  name: "typescript-lsp",
  version: "1.0.0"
});

// Error handler following the pattern from other servers
function handleError(error: unknown) {
  if (error instanceof Error) {
    const _tsError = error as TypeScriptToolError;
    return {
      content: [{
        type: "text" as const,
        text: error.message
      }],
      isError: true
    };
  }
  return {
    content: [{
      type: "text" as const,
      text: `Unknown error: ${String(error)}`
    }],
    isError: true
  };
}

// Helper to get workspace client with TypeScript-specific workspace isolation
async function getWorkspaceClient(workspaceRoot: string = process.cwd()) {
  // Add TypeScript-specific workspace isolation to prevent LSP conflicts with other language servers
  const isolatedWorkspaceRoot = `${workspaceRoot}#typescript-lsp`;
  return await workspaceManager.getOrCreateWorkspace(isolatedWorkspaceRoot);
}

// Symbol Navigation Tools

server.tool(
  "find-typescript-symbol",
  {
    query: z.string().describe("Symbol name to search for"),
    kind: z.enum(["class", "interface", "function", "variable", "module", "type", "enum", "all"]).optional().describe("Type of symbol to find"),
    workspace: z.boolean().optional().describe("Search entire workspace vs current file only"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ query, kind, workspace = true, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await findSymbol(client, query, kind, workspace);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "goto-typescript-definition",
  {
    file: z.string().describe("File path containing the symbol"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await gotoDefinition(client, file, line, character);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "goto-typescript-source-definition",
  {
    file: z.string().describe("File path containing the symbol"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await gotoSourceDefinition(client, file, line, character);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "goto-typescript-type-definition",
  {
    file: z.string().describe("File path containing the symbol"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await gotoTypeDefinition(client, file, line, character);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "find-typescript-references",
  {
    file: z.string().describe("File path containing the symbol"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    includeDeclaration: z.boolean().optional().describe("Include the declaration in results"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, includeDeclaration = false, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await findReferences(client, file, line, character, includeDeclaration);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "find-typescript-implementations",
  {
    file: z.string().describe("File path containing the symbol"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await findImplementations(client, file, line, character);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// Code Analysis Tools

server.tool(
  "get-typescript-diagnostics",
  {
    file: z.string().optional().describe("Specific file to check, or entire workspace"),
    severity: z.enum(["error", "warning", "info", "hint"]).optional().describe("Minimum severity level"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, severity, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await getDiagnostics(client, file, severity);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);


server.tool(
  "get-typescript-signature-help",
  {
    file: z.string().describe("File path"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await getSignatureHelp(client, file, line, character);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "check-typescript-types",
  {
    files: z.array(z.string()).optional().describe("Specific files to check"),
    strict: z.boolean().optional().describe("Use strict type checking mode"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ files, strict = false, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await checkTypes(client, files, strict);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// Code Transformation Tools

server.tool(
  "organize-typescript-imports",
  {
    file: z.string().describe("File path to organize imports"),
    skipDestructiveActions: z.boolean().optional().describe("Skip potentially destructive changes"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, skipDestructiveActions, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await organizeImports(client, file, skipDestructiveActions);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "apply-typescript-code-fixes",
  {
    file: z.string().describe("File path"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    fixKind: z.enum(["fixAll", "removeUnused", "addMissingImports", "removeUnusedImports", "sortImports"]).optional().describe("Type of fix to apply"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, fixKind, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await applyCodeFixes(client, file, line, character, fixKind);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);


// Workspace Understanding Tools

server.tool(
  "list-typescript-symbols",
  {
    file: z.string().optional().describe("Specific file, or entire workspace"),
    kind: z.enum(["class", "interface", "function", "variable", "module", "type", "enum", "all"]).optional().describe("Filter by symbol type"),
    hierarchical: z.boolean().optional().describe("Return hierarchical structure"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, kind, hierarchical = false, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await listSymbols(client, file, kind, hierarchical);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get-typescript-call-hierarchy",
  {
    file: z.string().describe("File containing the function"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    direction: z.enum(["incoming", "outgoing", "both"]).optional().describe("Call direction to analyze"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, direction = "both", workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await getCallHierarchy(client, file, line, character, direction);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get-typescript-type-hierarchy",
  {
    file: z.string().describe("File containing the type"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Character position (0-based)"),
    direction: z.enum(["supertypes", "subtypes", "both"]).optional().describe("Type hierarchy direction"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, line, character, direction = "both", workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await getTypeHierarchy(client, file, line, character, direction);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "analyze-typescript-imports",
  {
    file: z.string().optional().describe("Specific file or entire workspace"),
    showUnused: z.boolean().optional().describe("Include unused imports"),
    showMissing: z.boolean().optional().describe("Include missing imports"),
    includeNodeModules: z.boolean().optional().describe("Include external dependencies"),
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ file, showUnused = false, showMissing = false, includeNodeModules = false, workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await analyzeImports(client, file, showUnused, showMissing, includeNodeModules);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.tool(
  "get-typescript-project-info",
  {
    workspaceRoot: z.string().optional().describe("Workspace root directory (defaults to current directory)")
  },
  async ({ workspaceRoot = process.cwd() }) => {
    try {
      const client = await getWorkspaceClient(workspaceRoot);
      const result = await getProjectInfo(client, workspaceRoot);
      return {
        content: [{
          type: "text" as const,
          text: result
        }]
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// Code Quality Tools



// Utility Tools

server.tool(
  "tool-info",
  {},
  async () => {
    const isAvailable = await checkTypeScriptLSPAvailable();
    return {
      content: [{
        type: "text" as const,
        text: `TypeScript Language Server MCP Server
        
Available: ${isAvailable ? 'Yes' : 'No'}
Version: 1.0.0

This server provides TypeScript/JavaScript code analysis using the TypeScript Language Server.

Available tools:
Symbol Navigation:
- find-symbol: Search for symbols by name across the workspace
- goto-definition: Find where a symbol is defined
- goto-source-definition: Find the source definition (not just declaration)
- goto-type-definition: Find where the type of a symbol is defined
- find-references: Find all references to a symbol
- find-implementations: Find all implementations of an interface or abstract method

Code Analysis:
- get-diagnostics: Retrieve type errors, warnings, and hints
- get-signature-help: Get function signature information and parameter details
- check-types: Perform comprehensive TypeScript type checking

Code Transformation:
- organize-imports: Organize and clean up import statements
- apply-code-fixes: Apply available code fixes for issues

Workspace Understanding:
- list-symbols: Get document or workspace symbol outline
- get-call-hierarchy: Show function call relationships
- get-type-hierarchy: Show type inheritance relationships
- analyze-imports: Understand module dependencies and import relationships
- get-project-info: Get TypeScript project configuration and compilation info

Code Quality:

Utilities:
- tool-info: Get information about this tool

All tools support workspace management and can work with multiple TypeScript/JavaScript projects simultaneously.`
      }]
    };
  }
);

// Resources

server.resource(
  "workspace-config",
  "typescript://workspace/config",
  async (uri) => {
    try {
      // This would normally read actual workspace configuration
      const config = {
        name: "typescript-mcp-workspace",
        settings: {
          typescript: {
            preferences: {
              includeInlayParameterNameHints: "all",
              includeInlayFunctionParameterTypeHints: true,
              includeInlayVariableTypeHints: true,
              includeInlayPropertyDeclarationTypeHints: true,
              includeInlayFunctionLikeReturnTypeHints: true,
              includeInlayEnumMemberValueHints: true
            },
            tsserver: {
              logVerbosity: "off"
            }
          }
        },
        activeWorkspaces: Array.from(workspaceManager['workspaces'].keys())
      };

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(config, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error loading workspace config: ${error}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

server.resource(
  "typescript-env",
  "typescript://environment/info",
  async (uri) => {
    try {
      // Get TypeScript environment information
      const nodeVersion = process.version;
      const envInfo = `TypeScript Environment Information

Node.js Version: ${nodeVersion}
Working Directory: ${process.cwd()}

Active Workspaces: ${Array.from(workspaceManager['workspaces'].keys()).join(', ') || 'None'}`;

      return {
        contents: [{
          uri: uri.href,
          text: envInfo,
          mimeType: "text/plain"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error loading environment info: ${error}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

server.resource(
  "refactoring-catalog",
  "typescript://refactorings/available",
  async (uri) => {
    try {
      const availableRefactorings = {
        "Extract to function": {
          description: "Extract selected code to a new function",
          kind: "refactor.extract.function"
        },
        "Extract to constant": {
          description: "Extract selected expression to a constant",
          kind: "refactor.extract.constant"
        },
        "Extract to interface": {
          description: "Extract type to an interface",
          kind: "refactor.extract.interface"
        },
        "Move to new file": {
          description: "Move symbol to a new file",
          kind: "refactor.move.newFile"
        },
        "Convert to arrow function": {
          description: "Convert function declaration to arrow function",
          kind: "refactor.rewrite.function.arrow"
        },
        "Add or remove braces": {
          description: "Add or remove braces in arrow function",
          kind: "refactor.rewrite.arrow.braces"
        },
        "Convert parameters to destructured object": {
          description: "Convert function parameters to destructured object",
          kind: "refactor.rewrite.parameters.toDestructured"
        },
        "Convert to template string": {
          description: "Convert string concatenation to template literal",
          kind: "refactor.rewrite.import.named"
        }
      };

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(availableRefactorings, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error loading refactoring catalog: ${error}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

// Prompts

server.prompt(
  "code-review",
  "Perform comprehensive code review of TypeScript/JavaScript files using TypeScript Language Server analysis",
  {
    file: z.string().describe("TypeScript/JavaScript file to review"),
    workspaceRoot: z.string().optional().describe("Workspace root directory")
  },
  ({ file, workspaceRoot }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text" as const,
        text: `Please perform a comprehensive code review of the TypeScript/JavaScript file: ${file}

Use the following TypeScript MCP tools to analyze the code:

1. check-types - Check for type errors and warnings
2. list-symbols - Get an overview of all classes, functions, interfaces, and variables
3. analyze-imports - Check import usage and dependencies
4. get-diagnostics - Get detailed diagnostic information

${workspaceRoot ? `Workspace: ${workspaceRoot}` : ''}

Provide insights on:
- Type safety and correctness
- Code organization and structure
- Import efficiency and best practices
- Interface and type design
- Potential performance issues
- Overall code quality assessment
- Suggestions for refactoring or improvements`
      }
    }]
  })
);

server.prompt(
  "refactor-analysis",
  "Analyze symbols for potential refactoring opportunities in TypeScript/JavaScript code",
  {
    symbol: z.string().describe("Symbol name to analyze for refactoring"),
    workspaceRoot: z.string().optional().describe("Workspace root directory")
  },
  ({ symbol, workspaceRoot }) => ({
    messages: [{
      role: "user", 
      content: {
        type: "text" as const,
        text: `Analyze the symbol "${symbol}" for potential refactoring opportunities.

Use these TypeScript MCP tools:
1. find-symbol - Locate the symbol definition
2. find-references - Find all usages across the codebase
3. find-implementations - Find implementations if it's an interface
4. get-call-hierarchy - Understand call relationships
5. get-type-hierarchy - Understand type inheritance relationships

${workspaceRoot ? `Workspace: ${workspaceRoot}` : ''}

Provide analysis on:
- Current usage patterns
- Type relationships and dependencies
- Potential impact of changes
- Refactoring safety considerations
- Available automated refactorings
- Suggested improvements or alternatives
- Interface design considerations`
      }
    }]
  })
);

server.prompt(
  "debug-types",
  "Debug type issues in TypeScript/JavaScript code at specific positions",
  {
    file: z.string().describe("TypeScript/JavaScript file with type issues"),
    line: z.string().describe("Line number with potential type issue"),
    character: z.string().describe("Character position"),
    workspaceRoot: z.string().optional().describe("Workspace root directory")
  },
  ({ file, line, character, workspaceRoot }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text" as const, 
        text: `Help debug a type issue in TypeScript/JavaScript code at ${file}:${line}:${character}

Use these TypeScript MCP tools to investigate:
1. goto-definition - Find the symbol definition
2. goto-type-definition - Find the type definition
3. get-diagnostics - Check for type errors and warnings
4. find-references - See how the symbol is used elsewhere
5. get-signature-help - Get function signature information
6. apply-code-fixes - Get available code fixes

${workspaceRoot ? `Workspace: ${workspaceRoot}` : ''}

Please provide:
- Current type information
- Identified type issues
- Root cause analysis
- Available automated fixes
- Suggested manual fixes
- Related type conflicts or issues
- Best practices for type safety`
      }
    }]
  })
);

server.prompt(
  "optimize-imports",
  "Analyze and optimize import statements in TypeScript/JavaScript files",
  {
    file: z.string().describe("TypeScript/JavaScript file to optimize imports"),
    workspaceRoot: z.string().optional().describe("Workspace root directory")
  },
  ({ file, workspaceRoot }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text" as const,
        text: `Analyze and provide recommendations for optimizing imports in: ${file}

Use these TypeScript MCP tools:
1. analyze-imports - Understand module dependencies and import relationships
2. organize-imports - See what organization is available
3. apply-code-fixes - Get available import-related fixes
4. get-diagnostics - Check for import-related errors

${workspaceRoot ? `Workspace: ${workspaceRoot}` : ''}

Provide analysis on:
- Unused imports that can be removed
- Missing imports that should be added
- Import organization and grouping
- Potential circular dependencies
- Tree-shaking opportunities
- Performance implications of imports
- Best practices for import patterns`
      }
    }]
  })
);

// Main function
async function main() {
  // Check if TypeScript Language Server is available
  const isAvailable = await checkTypeScriptLSPAvailable();
  if (!isAvailable) {
    process.exit(1);
  }

  // Set up cleanup on exit
  process.on('SIGINT', async () => {
    await workspaceManager.closeAll();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await workspaceManager.closeAll();
    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}
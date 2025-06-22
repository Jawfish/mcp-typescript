import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// LSP Message Types
interface Message {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// LSP Protocol Types
interface Position {
  line: number;
  character: number;
}

interface Range {
  start: Position;
  end: Position;
}

interface Location {
  uri: string;
  range: Range;
}

interface TextDocumentIdentifier {
  uri: string;
}

interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

interface SymbolInformation {
  name: string;
  kind: number;
  location: Location;
  containerName?: string;
}

interface WorkspaceSymbolParams {
  query: string;
}

interface ReferenceParams extends TextDocumentPositionParams {
  context: {
    includeDeclaration: boolean;
  };
}

interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

interface CallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: Range;
  selectionRange: Range;
}

interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: Range[];
}

interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: Range[];
}

interface TypeHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: Range;
  selectionRange: Range;
}


interface CodeAction {
  title: string;
  kind?: string;
  edit?: unknown;
  command?: unknown;
}

// TypeScript-specific types
export interface TypeScriptToolError extends Error {
  exitCode: number;
  stderr: string;
}

export interface TypeScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// LSP Client implementation
export class TypeScriptLSPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<number | string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = new Map();
  private buffer: string = '';
  private initialized: boolean = false;
  private workspaceRoot: string;
  private tempDir?: string;
  private openDocuments: Set<string> = new Set();

  constructor(workspaceRoot: string) {
    super();
    // Extract real workspace root from isolated identifier (removes #typescript-lsp suffix)
    this.workspaceRoot = workspaceRoot.includes('#') ? workspaceRoot.split('#')[0] : workspaceRoot;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create a temporary directory for TypeScript server's internal use
    this.tempDir = join(tmpdir(), `typescript-lsp-${randomUUID()}`);
    await mkdir(this.tempDir, { recursive: true });

    // Start TypeScript Language Server
    this.process = spawn('typescript-language-server', ['--stdio'], {
      cwd: this.workspaceRoot,
      env: {
        ...process.env,
        TYPESCRIPT_LSP_LOG_LEVEL: '2',
      },
    });

    if (!this.process.stdout || !this.process.stderr) {
      throw new Error('Failed to start TypeScript Language Server');
    }

    // Set up error handling for process startup
    let processStarted = false;
    const startupPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!processStarted) {
          reject(new Error('TypeScript Language Server startup timeout'));
        }
      }, 5000);

      this.process?.on('spawn', () => {
        processStarted = true;
        clearTimeout(timeout);
        resolve();
      });

      this.process?.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start TypeScript Language Server: ${error.message}`));
      });
    });

    // Wait for process to start
    await startupPromise;

    // Handle stdout (LSP messages)
    this.process.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (logs)
    this.process.stderr.on('data', (_data: Buffer) => {
      // Currently not logging stderr, but keeping handler for LSP protocol compliance
    });

    // Handle process exit
    this.process.on('exit', (_code) => {
      this.cleanup();
    });

    // Send initialize request with timeout
    const initTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('LSP initialize request timeout')), 10000);
    });

    const initRequest = this.sendRequest('initialize', {
      processId: process.pid,
      clientInfo: {
        name: 'typescript-mcp',
        version: '1.0.0',
      },
      locale: 'en',
      rootPath: this.workspaceRoot,
      rootUri: `file://${this.workspaceRoot}`,
      capabilities: {
        workspace: {
          symbol: {
            dynamicRegistration: false,
          },
          didChangeConfiguration: {
            dynamicRegistration: false,
          },
          executeCommand: {
            dynamicRegistration: false,
          },
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: false,
          },
          definition: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          typeDefinition: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          implementation: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          references: {
            dynamicRegistration: false,
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['markdown', 'plaintext'],
          },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
            },
          },
          signatureHelp: {
            dynamicRegistration: false,
          },
          codeAction: {
            dynamicRegistration: false,
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  'source.organizeImports.ts',
                  'source.removeUnused.ts',
                  'source.addMissingImports.ts',
                  'source.fixAll.ts',
                ],
              },
            },
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
          callHierarchy: {
            dynamicRegistration: false,
          },
          typeHierarchy: {
            dynamicRegistration: false,
          },
          inlayHint: {
            dynamicRegistration: false,
          },
        },
      },
      initializationOptions: {
        preferences: {
          includeInlayParameterNameHints: 'all',
          includeInlayParameterNameHintsWhenArgumentMatchesName: false,
          includeInlayFunctionParameterTypeHints: true,
          includeInlayVariableTypeHints: true,
          includeInlayVariableTypeHintsWhenTypeMatchesName: false,
          includeInlayPropertyDeclarationTypeHints: true,
          includeInlayFunctionLikeReturnTypeHints: true,
          includeInlayEnumMemberValueHints: true,
        },
        tsserver: {
          logVerbosity: 'off',
        },
      },
      workspaceFolders: [
        {
          uri: `file://${this.workspaceRoot}`,
          name: 'workspace',
        },
      ],
    });

    await Promise.race([initRequest, initTimeout]);

    // Send initialized notification
    await this.sendNotification('initialized', {});

    this.initialized = true;
  }

  async openDocument(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('TypeScript Language Server not initialized');
    }

    const uri = `file://${filePath}`;
    if (this.openDocuments.has(uri)) {
      return; // Document already open
    }

    try {
      // Read file content
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(filePath, 'utf-8');
      
      // Determine language ID based on file extension
      let languageId = 'typescript';
      if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        languageId = 'javascript';
      } else if (filePath.endsWith('.tsx')) {
        languageId = 'typescriptreact';
      } else if (filePath.endsWith('.jsx')) {
        languageId = 'javascriptreact';
      }

      // Send textDocument/didOpen notification
      await this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version: 1,
          text: content,
        },
      });

      this.openDocuments.add(uri);
    } catch (error) {
      throw new Error(`Failed to open document ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async closeDocument(filePath: string): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const uri = `file://${filePath}`;
    if (!this.openDocuments.has(uri)) {
      return; // Document not open
    }

    await this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });

    this.openDocuments.delete(uri);
  }

  async ensureDocumentOpen(filePath: string): Promise<void> {
    const uri = `file://${filePath}`;
    if (!this.openDocuments.has(uri)) {
      try {
        await this.openDocument(filePath);
      } catch (error) {
        // For missing or inaccessible files, create a minimal placeholder
        if (error instanceof Error && error.message.includes('ENOENT')) {
          // Send a minimal textDocument/didOpen for non-existent files
          await this.sendNotification('textDocument/didOpen', {
            textDocument: {
              uri,
              languageId: 'typescript',
              version: 1,
              text: '// File not found\n',
            },
          });
          this.openDocuments.add(uri);
        } else {
          throw error;
        }
      }
    }
  }

  private processBuffer(): void {
    while (true) {
      // Look for Content-Length header
      const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) {
        break;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const headerLength = headerMatch[0].length;
      const totalLength = headerLength + contentLength;

      if (this.buffer.length < totalLength) {
        break; // Not enough data yet
      }

      // Extract the message
      const messageStr = this.buffer.slice(headerLength, totalLength);
      this.buffer = this.buffer.slice(totalLength);

      try {
        const message: Message = JSON.parse(messageStr);
        this.handleMessage(message);
      } catch (_error) {
        // Ignore JSON parsing errors for malformed LSP messages
      }
    }
  }

  private handleMessage(message: Message): void {
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification or request from server
      this.emit(message.method, message.params);
    }
  }

  private sendMessage(message: Message): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('TypeScript Language Server not running');
    }

    const messageStr = JSON.stringify(message);
    const fullMessage = `Content-Length: ${Buffer.byteLength(messageStr)}\r\n\r\n${messageStr}`;
    this.process.stdin.write(fullMessage);
  }

  async sendRequest<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = ++this.requestId;
    const message: Message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.sendMessage(message);

      // Timeout after 10 seconds for better test experience
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 10000);
    });
  }

  async sendNotification(method: string, params: unknown): Promise<void> {
    const message: Message = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.sendMessage(message);
  }

  async executeCommand<T = unknown>(command: string, args: unknown[]): Promise<T> {
    return this.sendRequest('workspace/executeCommand', {
      command,
      arguments: args,
    });
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
    this.pendingRequests.clear();
    
    // Close all open documents
    for (const uri of this.openDocuments) {
      try {
        await this.sendNotification('textDocument/didClose', {
          textDocument: { uri },
        });
      } catch (_error) {
        // Ignore errors during document cleanup
      }
    }
    this.openDocuments.clear();
    
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.tempDir) {
      try {
        await rm(this.tempDir, { recursive: true });
      } catch (_error) {
        // Ignore errors during temp directory cleanup
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      try {
        await this.sendRequest('shutdown', null);
        await this.sendNotification('exit', null);
      } catch (_error) {
        // Ignore errors during LSP shutdown
      }
    }
    await this.cleanup();
  }
}

// Workspace Manager
export class TypeScriptWorkspaceManager {
  private workspaces: Map<string, TypeScriptLSPClient> = new Map();

  async getOrCreateWorkspace(path: string): Promise<TypeScriptLSPClient> {
    const existing = this.workspaces.get(path);
    if (existing) {
      return existing;
    }

    const client = new TypeScriptLSPClient(path);
    await client.initialize();
    this.workspaces.set(path, client);
    return client;
  }

  async closeWorkspace(path: string): Promise<void> {
    const client = this.workspaces.get(path);
    if (client) {
      await client.shutdown();
      this.workspaces.delete(path);
    }
  }

  async closeAll(): Promise<void> {
    const promises = Array.from(this.workspaces.values()).map(client => client.shutdown());
    await Promise.all(promises);
    this.workspaces.clear();
  }

  async detectProjectType(path: string): Promise<'typescript' | 'javascript' | 'mixed'> {
    // Simple heuristic to detect project type
    try {
      const hasTs = await new Promise<boolean>((resolve) => {
        const proc = spawn('find', [path, '-name', '*.ts', '-o', '-name', '*.tsx'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        
        let hasFiles = false;
        proc.stdout?.on('data', (data) => {
          if (data.toString().trim()) {
            hasFiles = true;
          }
        });
        
        proc.on('close', () => {
          resolve(hasFiles);
        });
        
        proc.on('error', () => {
          resolve(false);
        });
      });

      const hasJs = await new Promise<boolean>((resolve) => {
        const proc = spawn('find', [path, '-name', '*.js', '-o', '-name', '*.jsx'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        
        let hasFiles = false;
        proc.stdout?.on('data', (data) => {
          if (data.toString().trim()) {
            hasFiles = true;
          }
        });
        
        proc.on('close', () => {
          resolve(hasFiles);
        });
        
        proc.on('error', () => {
          resolve(false);
        });
      });

      if (hasTs && hasJs) return 'mixed';
      if (hasTs) return 'typescript';
      if (hasJs) return 'javascript';
      return 'typescript'; // Default to TypeScript
    } catch (_error) {
      return 'typescript';
    }
  }
}

// Symbol kinds mapping
const SYMBOL_KINDS: { [key: number]: string } = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
};

// Diagnostic severity mapping
const DIAGNOSTIC_SEVERITY: { [key: number]: string } = {
  1: 'Error',
  2: 'Warning',
  3: 'Information',
  4: 'Hint',
};

// Completion item kinds mapping
const COMPLETION_ITEM_KINDS: { [key: number]: string } = {
  1: 'Text',
  2: 'Method',
  3: 'Function',
  4: 'Constructor',
  5: 'Field',
  6: 'Variable',
  7: 'Class',
  8: 'Interface',
  9: 'Module',
  10: 'Property',
  11: 'Unit',
  12: 'Value',
  13: 'Enum',
  14: 'Keyword',
  15: 'Snippet',
  16: 'Color',
  17: 'File',
  18: 'Reference',
  19: 'Folder',
  20: 'EnumMember',
  21: 'Constant',
  22: 'Struct',
  23: 'Event',
  24: 'Operator',
  25: 'TypeParameter',
};

// Helper functions
export function formatSymbolKind(kind: number): string {
  return SYMBOL_KINDS[kind] || `Unknown(${kind})`;
}

export function formatDiagnosticSeverity(severity: number): string {
  return DIAGNOSTIC_SEVERITY[severity] || `Unknown(${severity})`;
}

export function formatCompletionItemKind(kind: number): string {
  return COMPLETION_ITEM_KINDS[kind] || `Unknown(${kind})`;
}

export function formatLocation(location: Location): string {
  if (!location || !location.uri || !location.range) {
    return 'Unknown location';
  }
  const path = location.uri.replace('file://', '');
  return `${path}:${location.range.start.line + 1}:${location.range.start.character + 1}`;
}

export function formatRange(range: Range): string {
  return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

// Check if TypeScript Language Server is available
export async function checkTypeScriptLSPAvailable(): Promise<boolean> {
  try {
    const result = await new Promise<{ stderr: string; exitCode: number }>((resolve) => {
      const proc = spawn('typescript-language-server', ['--help'], {
        shell: true,
      });

      let stderr = '';

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ stderr, exitCode: 1 });
      }, 3000);

      proc.on('close', (exitCode) => {
        clearTimeout(timeout);
        resolve({ stderr, exitCode: exitCode || 0 });
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve({ stderr: 'Process error', exitCode: 1 });
      });
    });

    // typescript-language-server is available if help shows usage or exits cleanly
    return result.exitCode === 0 || result.stderr.includes('Usage:');
  } catch (_error) {
    return false;
  }
}

// Tool operations
export async function findSymbol(
  client: TypeScriptLSPClient,
  query: string,
  kind?: string,
  _workspace: boolean = true
): Promise<string> {
  // For workspace symbol search, we need to ensure TypeScript has indexed the workspace
  // Try to open some common TypeScript files to populate the workspace
  try {
    const workspaceRoot = client['workspaceRoot'];
    const { readdir, stat } = await import('node:fs/promises');
    const path = await import('node:path');
    
    const findTsFiles = async (dir: string, maxFiles: number = 5): Promise<string[]> => {
      if (maxFiles <= 0) return [];
      
      try {
        const files: string[] = [];
        const entries = await readdir(dir);
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
          
          const fullPath = path.join(dir, entry);
          try {
            const stats = await stat(fullPath);
            if (stats.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
              files.push(fullPath);
            } else if (stats.isDirectory() && files.length < maxFiles) {
              const subFiles = await findTsFiles(fullPath, maxFiles - files.length);
              files.push(...subFiles);
            }
          } catch {
            // Ignore individual file/directory errors
          }
        }
        return files;
      } catch {
        return [];
      }
    };
    
    const tsFiles = await findTsFiles(workspaceRoot, 5);
    
    // Open the found files to help with workspace indexing
    for (const file of tsFiles) {
      try {
        await client.ensureDocumentOpen(file);
      } catch {
        // Ignore errors for individual files
      }
    }
    
    // Give TypeScript server a moment to index
    if (tsFiles.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch {
    // If workspace discovery fails, continue with the request anyway
  }

  const symbols: SymbolInformation[] = await client.sendRequest('workspace/symbol', {
    query,
  } as WorkspaceSymbolParams);

  let filtered = symbols;
  if (kind && kind !== 'all') {
    const targetKinds: number[] = [];
    switch (kind) {
      case 'class':
        targetKinds.push(5); // Class
        break;
      case 'interface':
        targetKinds.push(11); // Interface
        break;
      case 'function':
        targetKinds.push(6, 9, 12); // Method, Constructor, Function
        break;
      case 'variable':
        targetKinds.push(13, 14); // Variable, Constant
        break;
      case 'module':
        targetKinds.push(2); // Module
        break;
      case 'type':
        targetKinds.push(26); // TypeParameter
        break;
      case 'enum':
        targetKinds.push(10); // Enum
        break;
    }
    filtered = symbols.filter(s => targetKinds.includes(s.kind));
  }

  if (filtered.length === 0) {
    return `No symbols found matching '${query}'${kind ? ` of type '${kind}'` : ''}`;
  }

  const results = filtered.map(symbol => {
    const location = formatLocation(symbol.location);
    const symbolKind = formatSymbolKind(symbol.kind);
    return `${symbol.name} (${symbolKind}) - ${location}${symbol.containerName ? ` in ${symbol.containerName}` : ''}`;
  });

  return `Found ${results.length} symbol${results.length !== 1 ? 's' : ''}:\n\n${results.join('\n')}`;
}

export async function gotoDefinition(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const result = await client.sendRequest('textDocument/definition', {
      textDocument: { uri: `file://${file}` },
      position: { line: line - 1, character },
    } as TextDocumentPositionParams);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return 'No definition found at this position';
    }

    const locations: Location[] = Array.isArray(result) ? result : [result];
    
    const definitions = locations.map(loc => {
      const path = formatLocation(loc);
      return `Definition found at: ${path}`;
    });

    return definitions.join('\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Debug Failure') || errorMessage.includes('False expression')) {
      return 'Definition not available at this position (position calculation error)';
    }
    return `Definition error: ${errorMessage}`;
  }
}

export async function gotoSourceDefinition(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const result = await client.executeCommand('_typescript.goToSourceDefinition', [
      `file://${file}`,
      { line: line - 1, character },
    ]);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return 'No source definition found at this position';
    }

    const locations: Location[] = Array.isArray(result) ? result : [result];
    
    const definitions = locations.map(loc => {
      const path = formatLocation(loc);
      return `Source definition found at: ${path}`;
    });

    return definitions.join('\n\n');
  } catch (_error) {
    return 'Source definition not available (requires TypeScript 4.7+)';
  }
}

export async function gotoTypeDefinition(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const result = await client.sendRequest('textDocument/typeDefinition', {
      textDocument: { uri: `file://${file}` },
      position: { line: line - 1, character },
    } as TextDocumentPositionParams);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return 'No type definition found at this position';
    }

    const locations: Location[] = Array.isArray(result) ? result : [result];
    
    const definitions = locations.map(loc => {
      const path = formatLocation(loc);
      return `Type definition found at: ${path}`;
    });

    return definitions.join('\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Debug Failure') || errorMessage.includes('False expression')) {
      return 'Type definition not available at this position (position calculation error)';
    }
    return `Type definition error: ${errorMessage}`;
  }
}

export async function findReferences(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number,
  includeDeclaration: boolean = false
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const result: Location[] = await client.sendRequest('textDocument/references', {
      textDocument: { uri: `file://${file}` },
      position: { line: line - 1, character },
      context: { includeDeclaration },
    } as ReferenceParams);

    if (!result || result.length === 0) {
      return 'No references found';
    }

    const references = result.map(loc => formatLocation(loc));
    
    return `Found ${references.length} reference${references.length !== 1 ? 's' : ''}:\n\n${references.join('\n')}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Debug Failure') || errorMessage.includes('False expression')) {
      return 'References not available at this position (position calculation error)';
    }
    return `References error: ${errorMessage}`;
  }
}

export async function findImplementations(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const result = await client.sendRequest('textDocument/implementation', {
      textDocument: { uri: `file://${file}` },
      position: { line: line - 1, character },
    } as TextDocumentPositionParams);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return 'No implementations found at this position';
    }

    const locations: Location[] = Array.isArray(result) ? result : [result];
    
    const implementations = locations.map(loc => {
      const path = formatLocation(loc);
      return `Implementation found at: ${path}`;
    });

    return implementations.join('\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Debug Failure') || errorMessage.includes('False expression')) {
      return 'Implementations not available at this position (position calculation error)';
    }
    return `Implementations error: ${errorMessage}`;
  }
}

export async function getDiagnostics(
  client: TypeScriptLSPClient,
  file?: string,
  _severity?: string
): Promise<string> {
  // Trigger diagnostics refresh
  if (file) {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    await client.sendRequest('textDocument/diagnostic', {
      textDocument: { uri: `file://${file}` },
    });
  }

  // In a real implementation, we would need to collect diagnostics
  // from the textDocument/publishDiagnostics notifications
  // For now, return a placeholder
  return 'Diagnostics collection requires notification handling (not implemented in this example)';
}


export async function getSignatureHelp(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number
): Promise<string> {
  // Ensure document is open before making request
  await client.ensureDocumentOpen(file);
  
  const result = await client.sendRequest('textDocument/signatureHelp', {
    textDocument: { uri: `file://${file}` },
    position: { line: line - 1, character },
  } as TextDocumentPositionParams);

  if (!result || typeof result !== 'object' || !('signatures' in result)) {
    return 'No signature help available at this position';
  }

  const signatureResult = result as { signatures: unknown[] };
  
  if (!Array.isArray(signatureResult.signatures) || signatureResult.signatures.length === 0) {
    return 'No signatures found';
  }

  const signatures = signatureResult.signatures.map((sig: unknown, index: number) => {
    const signature = sig as { label?: string; documentation?: string; parameters?: unknown[] };
    let result = `Signature ${index + 1}: ${signature.label || 'Unknown'}`;
    
    if (signature.documentation) {
      result += `\n  Documentation: ${signature.documentation}`;
    }
    
    if (signature.parameters && Array.isArray(signature.parameters)) {
      result += '\n  Parameters:';
      signature.parameters.forEach((param: unknown, paramIndex: number) => {
        const parameter = param as { label?: string; documentation?: string };
        result += `\n    ${paramIndex + 1}. ${parameter.label || 'Unknown'}`;
        if (parameter.documentation) {
          result += ` - ${parameter.documentation}`;
        }
      });
    }
    
    return result;
  });

  return signatures.join('\n\n');
}


export async function organizeImports(
  client: TypeScriptLSPClient,
  file: string,
  skipDestructiveActions?: boolean
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    const args = skipDestructiveActions !== undefined ? 
      [file, { skipDestructiveCodeActions: skipDestructiveActions }] : 
      [file];

    await client.executeCommand('_typescript.organizeImports', args);
    return 'Imports organized successfully';
  } catch (error) {
    return `Failed to organize imports: ${(error as Error).message}`;
  }
}

export async function applyCodeFixes(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number,
  fixKind?: string
): Promise<string> {
  // Ensure document is open before making request
  await client.ensureDocumentOpen(file);
  
  const codeActions: CodeAction[] = await client.sendRequest('textDocument/codeAction', {
    textDocument: { uri: `file://${file}` },
    range: {
      start: { line: line - 1, character },
      end: { line: line - 1, character },
    },
    context: {
      diagnostics: [],
      only: fixKind ? [fixKind] : undefined,
    },
  });

  if (!codeActions || codeActions.length === 0) {
    return 'No code fixes available at this position';
  }

  const fixes = codeActions.map((action, index) => {
    const kind = action.kind || 'unknown';
    return `${index + 1}. ${action.title} (${kind})`;
  });

  return `Available code fixes:\n\n${fixes.join('\n')}`;
}


export async function listSymbols(
  client: TypeScriptLSPClient,
  file?: string,
  kind?: string,
  hierarchical: boolean = false
): Promise<string> {
  if (!file) {
    // Workspace symbols
    return await findSymbol(client, '', kind, true);
  }

  // Document symbols
  // Ensure document is open before making request
  await client.ensureDocumentOpen(file);
  
  const result = await client.sendRequest('textDocument/documentSymbol', {
    textDocument: { uri: `file://${file}` },
  });

  if (!result || (Array.isArray(result) && result.length === 0)) {
    return 'No symbols found in this document';
  }

  if (!Array.isArray(result)) {
    return 'Invalid symbol data received';
  }

  const formatDocumentSymbol = (symbol: DocumentSymbol, indent: string = ''): string => {
    const symbolKind = formatSymbolKind(symbol.kind);
    const range = formatRange(symbol.range);
    let result = `${indent}${symbol.name} (${symbolKind}) - ${range}`;
    
    if (symbol.detail) {
      result += ` - ${symbol.detail}`;
    }

    if (hierarchical && symbol.children && symbol.children.length > 0) {
      result += `\n${symbol.children
        .map(child => formatDocumentSymbol(child, `${indent}  `))
        .join('\n')}`;
    }

    return result;
  };

  const symbols: DocumentSymbol[] = result;
  const formatted = symbols.map(s => formatDocumentSymbol(s)).join('\n\n');

  return `Document symbols:\n\n${formatted}`;
}

export async function getCallHierarchy(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number,
  direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<string> {
  // Ensure document is open before making request
  await client.ensureDocumentOpen(file);
  
  // Prepare call hierarchy
  const items: CallHierarchyItem[] = await client.sendRequest('textDocument/prepareCallHierarchy', {
    textDocument: { uri: `file://${file}` },
    position: { line: line - 1, character },
  } as TextDocumentPositionParams);

  if (!items || items.length === 0) {
    return 'No call hierarchy available at this position';
  }

  const item = items[0];
  let result = `Call hierarchy for ${item.name} (${formatSymbolKind(item.kind)}):\n`;

  if (direction === 'incoming' || direction === 'both') {
    const incoming: CallHierarchyIncomingCall[] = await client.sendRequest(
      'callHierarchy/incomingCalls',
      { item }
    );

    if (incoming && incoming.length > 0) {
      result += '\n\nIncoming calls:\n';
      result += incoming.map(call => {
        const from = formatLocation({ uri: call.from.uri, range: call.from.range });
        return `  ${call.from.name} - ${from}`;
      }).join('\n');
    } else {
      result += '\n\nNo incoming calls found';
    }
  }

  if (direction === 'outgoing' || direction === 'both') {
    const outgoing: CallHierarchyOutgoingCall[] = await client.sendRequest(
      'callHierarchy/outgoingCalls',
      { item }
    );

    if (outgoing && outgoing.length > 0) {
      result += '\n\nOutgoing calls:\n';
      result += outgoing.map(call => {
        const to = formatLocation({ uri: call.to.uri, range: call.to.range });
        return `  ${call.to.name} - ${to}`;
      }).join('\n');
    } else {
      result += '\n\nNo outgoing calls found';
    }
  }

  return result;
}

export async function getTypeHierarchy(
  client: TypeScriptLSPClient,
  file: string,
  line: number,
  character: number,
  direction: 'supertypes' | 'subtypes' | 'both' = 'both'
): Promise<string> {
  try {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    // Prepare type hierarchy
    const items: TypeHierarchyItem[] = await client.sendRequest('textDocument/prepareTypeHierarchy', {
      textDocument: { uri: `file://${file}` },
      position: { line: line - 1, character },
    } as TextDocumentPositionParams);

    if (!items || items.length === 0) {
      return 'No type hierarchy available at this position';
    }

    const item = items[0];
    let result = `Type hierarchy for ${item.name} (${formatSymbolKind(item.kind)}):\n`;

    if (direction === 'supertypes' || direction === 'both') {
      try {
        const supertypes: TypeHierarchyItem[] = await client.sendRequest(
          'typeHierarchy/supertypes',
          { item }
        );

        if (supertypes && supertypes.length > 0) {
          result += '\n\nSupertypes:\n';
          result += supertypes.map(type => {
            const location = formatLocation({ uri: type.uri, range: type.range });
            return `  ${type.name} (${formatSymbolKind(type.kind)}) - ${location}`;
          }).join('\n');
        } else {
          result += '\n\nNo supertypes found';
        }
      } catch (_error) {
        result += '\n\nSupertypes not available';
      }
    }

    if (direction === 'subtypes' || direction === 'both') {
      try {
        const subtypes: TypeHierarchyItem[] = await client.sendRequest(
          'typeHierarchy/subtypes',
          { item }
        );

        if (subtypes && subtypes.length > 0) {
          result += '\n\nSubtypes:\n';
          result += subtypes.map(type => {
            const location = formatLocation({ uri: type.uri, range: type.range });
            return `  ${type.name} (${formatSymbolKind(type.kind)}) - ${location}`;
          }).join('\n');
        } else {
          result += '\n\nNo subtypes found';
        }
      } catch (_error) {
        result += '\n\nSubtypes not available';
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Unhandled method')) {
      return 'Type hierarchy not supported by this TypeScript Language Server version';
    }
    return `Type hierarchy error: ${errorMessage}`;
  }
}

export async function analyzeImports(
  client: TypeScriptLSPClient,
  file?: string,
  showUnused: boolean = false,
  showMissing: boolean = false,
  _includeNodeModules: boolean = false
): Promise<string> {
  // Use code actions to find import-related issues
  let result = 'Import analysis:\n\n';

  if (file) {
    // Ensure document is open before making request
    await client.ensureDocumentOpen(file);
    
    // Get code actions for the file
    const codeActions: CodeAction[] = await client.sendRequest('textDocument/codeAction', {
      textDocument: { uri: `file://${file}` },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1000, character: 0 }, // Cover most of the file
      },
      context: {
        diagnostics: [],
        only: ['source.organizeImports', 'source.removeUnused', 'source.addMissingImports'],
      },
    });

    if (showUnused) {
      const unusedActions = codeActions.filter(action => 
        action.kind?.includes('removeUnused') || action.title.toLowerCase().includes('unused')
      );
      if (unusedActions.length > 0) {
        result += 'Unused imports detected:\n';
        result += unusedActions.map(action => `- ${action.title}`).join('\n');
        result += '\n\n';
      }
    }

    if (showMissing) {
      const missingActions = codeActions.filter(action => 
        action.kind?.includes('addMissingImports') || action.title.toLowerCase().includes('missing')
      );
      if (missingActions.length > 0) {
        result += 'Missing imports detected:\n';
        result += missingActions.map(action => `- ${action.title}`).join('\n');
        result += '\n\n';
      }
    }

    const organizeActions = codeActions.filter(action => 
      action.kind?.includes('organizeImports')
    );
    if (organizeActions.length > 0) {
      result += 'Import organization available:\n';
      result += organizeActions.map(action => `- ${action.title}`).join('\n');
    }
  }

  return result || 'No import issues detected';
}

export async function getProjectInfo(
  client: TypeScriptLSPClient,
  _workspaceRoot?: string
): Promise<string> {
  // Get TypeScript version and project configuration
  try {
    // This is typically handled through custom notifications
    // For now, return basic workspace information
    return `TypeScript Language Server project information:
- Workspace: ${client['workspaceRoot']}
- Language Server: typescript-language-server
- Project type: ${await (client as unknown as { workspaceManager?: TypeScriptWorkspaceManager })?.workspaceManager?.detectProjectType?.(client['workspaceRoot']) || 'typescript'}

Note: Detailed project configuration requires custom notification handling.`;
  } catch (_error) {
    return 'Project information not available';
  }
}



export async function checkTypes(
  client: TypeScriptLSPClient,
  files?: string[],
  _strict?: boolean
): Promise<string> {
  // Use TypeScript compiler directly for comprehensive type checking
  const args = ['--noEmit', '--pretty'];
  
  if (files && files.length > 0) {
    args.push(...files);
  }

  try {
    const result = await new Promise<TypeScriptResult>((resolve) => {
      const proc = spawn('tsc', args, {
        cwd: client['workspaceRoot'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode: exitCode || 0 });
      });
    });

    if (result.exitCode === 0) {
      return 'Type checking passed - no errors found';
    } else {
      return `Type checking found issues:\n\n${result.stdout || result.stderr}`;
    }
  } catch (error) {
    const tsError = error as TypeScriptToolError;
    throw tsError;
  }
}
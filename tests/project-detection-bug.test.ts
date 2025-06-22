import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { 
  TypeScriptLSPClient,
  TypeScriptWorkspaceManager,
  checkTypeScriptLSPAvailable,
  findSymbol,
  listSymbols,
  getProjectInfo
} from "../lib/typescript-operations.js";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";

/**
 * These tests specifically reproduce the "No Project" error 
 * that occurs when TypeScript Language Server fails to detect a project.
 * 
 * EXPECTED BEHAVIOR: All tests should pass
 * CURRENT BEHAVIOR: Tests fail with "No Project" error from TypeScript Language Server
 */

const TEST_TIMEOUT = 10000;
const testProjectPath = join(process.cwd(), 'typescript', 'regression-test-project');

let workspaceManager: TypeScriptWorkspaceManager;
let testClient: TypeScriptLSPClient;
let lspAvailable: boolean;

const testFile = join(testProjectPath, 'simple.ts');

async function setupMinimalProject(): Promise<void> {
  await mkdir(testProjectPath, { recursive: true });

  // Create minimal tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true
    },
    include: ["*.ts"],
    exclude: ["node_modules"]
  };
  await writeFile(join(testProjectPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // Create simple TypeScript file
  const simpleContent = `// Simple TypeScript file
export interface User {
  id: number;
  name: string;
}

export class UserService {
  getUser(id: number): User {
    return { id, name: 'Test User' };
  }
}

export const userService = new UserService();
`;
  await writeFile(testFile, simpleContent);
}

async function cleanupProject(): Promise<void> {
  try {
    await rm(testProjectPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

beforeAll(async () => {
  lspAvailable = await checkTypeScriptLSPAvailable();
  
  if (lspAvailable) {
    await cleanupProject();
    await setupMinimalProject();
    
    workspaceManager = new TypeScriptWorkspaceManager();
    testClient = new TypeScriptLSPClient(testProjectPath);
    
    try {
      await testClient.initialize();
    } catch (_error) {
      lspAvailable = false;
    }
  }
}, TEST_TIMEOUT);

afterAll(async () => {
  if (workspaceManager) {
    await workspaceManager.closeAll();
  }
  if (testClient) {
    await testClient.shutdown();
  }
  await cleanupProject();
}, TEST_TIMEOUT);

describe('TypeScript Language Server Project Detection Bug', () => {
  test('should confirm TypeScript Language Server is available', async () => {
    const available = await checkTypeScriptLSPAvailable();
    expect(available).toBe(true);
  });

  test('BUG: findSymbol fails with "No Project" error', async () => {
    if (!lspAvailable) {
      return;
    }
      const result = await findSymbol(testClient, 'User');
      
      // This expectation will FAIL due to the bug
      expect(result).not.toContain('No Project');
      expect(result).not.toContain('TypeScript Server Error');
      expect(result).toContain('User');
  }, TEST_TIMEOUT);

  test('BUG: listSymbols fails with "No Project" error', async () => {
    if (!lspAvailable) {
      return;
    }
      const result = await listSymbols(testClient, testFile);
      
      // This expectation will FAIL due to the bug
      expect(result).not.toContain('No Project');
      expect(result).not.toContain('TypeScript Server Error');
      expect(result).toContain('User');
  }, TEST_TIMEOUT);


  test('getProjectInfo should work even when symbol detection fails', async () => {
    if (!lspAvailable) {
      return;
    }
      const result = await getProjectInfo(testClient, testProjectPath);
      
      expect(result).toContain('TypeScript');
      expect(result).not.toContain('No Project');
  }, TEST_TIMEOUT);

  test('should verify test project setup is correct', async () => {
    // Verify the test files exist and are valid
    const fs = await import('node:fs/promises');
    
    const tsconfigExists = await fs.access(join(testProjectPath, 'tsconfig.json')).then(() => true).catch(() => false);
    expect(tsconfigExists).toBe(true);
    
    const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('export interface User');
    expect(content).toContain('export class UserService');
  });

  test('should confirm LSP client initialization state', async () => {
    if (!lspAvailable) {
      return;
    }

    // Verify the client thinks it's initialized
    expect(testClient['initialized']).toBe(true);
    expect(testClient['workspaceRoot']).toBe(testProjectPath);
  });
});
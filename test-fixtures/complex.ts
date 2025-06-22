// Complex TypeScript file for advanced testing

import { SimpleInterface, } from './simple.js';

// Generic interfaces
export interface Repository<T extends { id: number }> {
  findById(id: number): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: number): Promise<void>;
}

// Advanced type manipulations
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Conditional types
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Extract<T, U> = T extends U ? T : never;

// Mapped types
export type ReadonlyAll<T> = {
  readonly [P in keyof T]: T[P];
};

// Complex class with generics
export abstract class BaseService<T extends { id: number }> {
  protected repository: Repository<T>;

  constructor(repository: Repository<T>) {
    this.repository = repository;
  }

  abstract validate(entity: T): boolean;

  async create(data: Omit<T, 'id'>): Promise<T> {
    const entity = { ...data, id: this.generateId() } as T;
    
    if (!this.validate(entity)) {
      throw new Error('Validation failed');
    }

    return await this.repository.save(entity);
  }

  async findById(id: number): Promise<T | null> {
    return await this.repository.findById(id);
  }

  private generateId(): number {
    return Math.floor(Math.random() * 1000000);
  }
}

// Concrete implementation
export interface Product extends SimpleInterface {
  price: number;
  category: string;
  inStock: boolean;
}

export class ProductService extends BaseService<Product> {
  validate(product: Product): boolean {
    return product.price > 0 && product.name.length > 0;
  }

  async getByCategory(_category: string): Promise<Product[]> {
    // Implementation would filter by category
    return [];
  }

  async updatePrice(id: number, newPrice: number): Promise<void> {
    const product = await this.findById(id);
    if (product) {
      product.price = newPrice;
      await this.repository.save(product);
    }
  }
}

// Decorator examples
export function logged(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: unknown[]) {
    const result = originalMethod.apply(this, args);
    return result;
  };
  
  return descriptor;
}

// Class with decorators
export class DecoratedService {
  @logged
  processData(data: string): string {
    return data.toUpperCase();
  }
}

// Utility types and functions
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    result[key] = obj[key];
  });
  return result;
}

// Advanced async patterns
export class AsyncOperations {
  async parallelProcessing<T>(items: T[], processor: (item: T) => Promise<T>): Promise<T[]> {
    return Promise.all(items.map(processor));
  }

  async sequentialProcessing<T>(items: T[], processor: (item: T) => Promise<T>): Promise<T[]> {
    const results: T[] = [];
    for (const item of items) {
      results.push(await processor(item));
    }
    return results;
  }

  async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i === maxRetries) {
          throw lastError;
        }
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
    
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
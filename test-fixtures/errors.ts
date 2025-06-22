// TypeScript file with intentional errors for testing diagnostics

import { SimpleInterface } from './simple.js';

// Type errors
interface BadInterface {
  name: string;
  age: number;
}

const _badUser: BadInterface = {
  name: 'John',
  age: 'thirty' // Error: Type 'string' is not assignable to type 'number'
};

// Function with wrong return type
export function badFunction(x: number): string {
  return x; // Error: Type 'number' is not assignable to type 'string'
}

// Missing property
const _incompleteUser: SimpleInterface = {
  id: 1
  // Missing 'name' property
};

// Unused variables (for testing unused import detection)
const _unusedVariable = 'test';
const _anotherUnusedVar = 42;

// Wrong method call
const numbers = [1, 2, 3];
numbers.invalidMethod(); // Error: Property 'invalidMethod' does not exist

// Null/undefined access
const _possiblyNull: string | null = Math.random() > 0.5 ? 'hello' : null;

// Wrong generic usage
const _wrongMap = new Map<string>();  // Error: Expected 2 type arguments

// Incorrect async/await usage
export function notAsyncFunction(): string {
  // Error: 'await' expressions are only allowed within async functions
  return Promise.resolve('test') as unknown as string; // Simulated incorrect async usage
}

// Type assertion errors
const someValue: unknown = 'hello';
const _wrongAssertion = someValue as number; // No immediate error but semantically wrong

// Interface implementation errors
export class BadImplementation implements SimpleInterface {
  id = 1;
  // Missing 'name' property implementation
  
  extraMethod(): void {
    // This is fine, but missing required properties
  }
}

// Enum misuse
enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue'
}

const _invalidColor: Color = 'yellow'; // Error: Type '"yellow"' is not assignable to type 'Color'

// Function overload errors
function overloadedFunction(x: string): string;
function overloadedFunction(x: number): number;
function overloadedFunction(x: string | number): string | number {
  if (typeof x === 'string') {
    return x.toLowerCase();
  }
  return x * 2;
}

// Wrong usage of overloaded function
const _result = overloadedFunction(true); // Error: No overload matches this call

// Generic constraint violations
interface HasLength {
  length: number;
}

function requiresLength<T extends HasLength>(item: T): T {
  return item;
}

const _badGenericUsage = requiresLength(42); // Error: Argument of type 'number' is not assignable

// Circular type reference (potentially problematic)
interface CircularA {
  b: CircularB;
}

interface CircularB {
  a: CircularA;
}

// Export errors
export { NonExistentExport } from './simple.js'; // Error: Module has no exported member

// Decorator errors (if experimental decorators not enabled)
function invalidDecorator(_target: unknown, _propertyKey: string) {
  // Decorator implementation
}

export class DecoratedClass {
  @invalidDecorator
  someProperty: string = 'test';
}
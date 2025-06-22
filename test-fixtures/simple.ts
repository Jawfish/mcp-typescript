// Simple TypeScript file for basic testing

export interface SimpleInterface {
  id: number;
  name: string;
}

export class SimpleClass implements SimpleInterface {
  constructor(public id: number, public name: string) {}

  getName(): string {
    return this.name;
  }

  setName(name: string): void {
    this.name = name;
  }
}

export function simpleFunction(param: string): string {
  return `Hello, ${param}!`;
}

export const simpleConstant = 42;

export type SimpleUnion = 'option1' | 'option2' | 'option3';

export enum SimpleEnum {
  FIRST = 'first',
  SECOND = 'second',
  THIRD = 'third'
}
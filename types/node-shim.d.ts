/**
 * Minimal Node runtime declarations used because this repository intentionally
 * has zero runtime/development dependencies in its bootstrap phase. Replace
 * this compatibility boundary with @types/node when registry access is
 * available. The explicit `any` values are confined to this declaration file.
 */
declare const process: any;
declare const Buffer: any;
declare const __dirname: string;
declare function require(name: string): any;
declare module "node:http" { const value: any; export = value; }
declare module "node:https" { const value: any; export = value; }
declare module "node:crypto" { const value: any; export = value; }
declare module "node:fs" { const value: any; export = value; }
declare module "node:fs/promises" { const value: any; export = value; }
declare module "node:path" { const value: any; export = value; }
declare module "node:os" { const value: any; export = value; }
declare module "node:events" { const value: any; export = value; }
declare module "node:assert/strict" { const value: any; export = value; }
declare module "node:test" { const value: any; export = value; }
declare module "node:child_process" { const value: any; export = value; }
declare module "node:sqlite" { export const DatabaseSync: any; export const backup: any; }

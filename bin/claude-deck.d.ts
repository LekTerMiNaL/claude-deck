export interface BinOptions {
  port: number;
  open: boolean;
  help: boolean;
  version: boolean;
}
export function parseArgs(argv: string[]): BinOptions;
export function openCommand(platform: string, url: string): string[];

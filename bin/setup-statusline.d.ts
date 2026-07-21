export function bridgePath(): string;
export function ourCommand(bridge?: string): string;
export function claudeDir(): string;
export function mergeStatusLine(settings: Record<string, unknown>, command: string): Record<string, unknown>;
export function statusLineState(
  settings: Record<string, unknown> | null | undefined,
  command: string,
): "absent" | "ours" | "foreign";
export function stripStatusLine(settings: Record<string, unknown>, command: string): Record<string, unknown>;
export function snippet(command?: string): string;
export function run(
  argv: string[],
  opts?: { now?: Date; log?: (m: string) => void; err?: (m: string) => void },
): number;

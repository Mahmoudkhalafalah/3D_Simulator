export interface CompileDiagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}
export interface CompileResult {
  ok: boolean;
  hex?: string;
  diagnostics: CompileDiagnostic[];
  output: string;
  flashBytes?: number;
  ms?: number;
  cached?: boolean;
}
export function compileSketch(code: string, board?: string): Promise<CompileResult>;
export function toolchainReady(): boolean;
export function parseDiagnostics(output: string): CompileDiagnostic[];

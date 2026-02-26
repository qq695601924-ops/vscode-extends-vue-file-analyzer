/**
 * Maps AST node line numbers (relative to script block) to .vue file line numbers.
 */
export function mapToFileLine(scriptStartLine: number, astLine: number): number {
  return scriptStartLine + astLine - 1;
}

/**
 * Babel AST loc.start.column is 0-based. scriptStartColumn from SFC is also 0-based.
 * Returns 0-based line/column for VSCode Position.
 */
export function mapToFileLocation(
  scriptStartLine: number,
  scriptStartColumn: number,
  astLine: number,
  astColumn: number
): { line: number; column: number } {
  const line = mapToFileLine(scriptStartLine, astLine);
  const column = astLine === 1 ? scriptStartColumn + astColumn : astColumn;
  return {
    line,
    column: Math.max(0, column),
  };
}

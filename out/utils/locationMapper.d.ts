/**
 * Maps AST node line numbers (relative to script block) to .vue file line numbers.
 */
export declare function mapToFileLine(scriptStartLine: number, astLine: number): number;
/**
 * Babel AST loc.start.column is 0-based. scriptStartColumn from SFC is also 0-based.
 * Returns 0-based line/column for VSCode Position.
 */
export declare function mapToFileLocation(scriptStartLine: number, scriptStartColumn: number, astLine: number, astColumn: number): {
    line: number;
    column: number;
};
//# sourceMappingURL=locationMapper.d.ts.map
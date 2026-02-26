"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToFileLine = mapToFileLine;
exports.mapToFileLocation = mapToFileLocation;
/**
 * Maps AST node line numbers (relative to script block) to .vue file line numbers.
 */
function mapToFileLine(scriptStartLine, astLine) {
    return scriptStartLine + astLine - 1;
}
/**
 * Babel AST loc.start.column is 0-based. scriptStartColumn from SFC is also 0-based.
 * Returns 0-based line/column for VSCode Position.
 */
function mapToFileLocation(scriptStartLine, scriptStartColumn, astLine, astColumn) {
    const line = mapToFileLine(scriptStartLine, astLine);
    const column = astLine === 1 ? scriptStartColumn + astColumn : astColumn;
    return {
        line,
        column: Math.max(0, column),
    };
}
//# sourceMappingURL=locationMapper.js.map
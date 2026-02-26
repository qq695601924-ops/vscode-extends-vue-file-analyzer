"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVueFile = parseVueFile;
const compiler_sfc_1 = require("@vue/compiler-sfc");
/**
 * Parse a .vue file and return script / script setup blocks with positions.
 */
function parseVueFile(source) {
    const result = {
        script: null,
        scriptSetup: null,
    };
    let parsed;
    try {
        parsed = (0, compiler_sfc_1.parse)(source, { filename: 'component.vue' });
    }
    catch {
        return result;
    }
    const descriptor = parsed.descriptor;
    if (descriptor.script) {
        const loc = descriptor.script.loc;
        result.script = {
            content: descriptor.script.content,
            startLine: loc.start.line,
            startColumn: loc.start.column,
            isSetup: false,
            lang: (descriptor.script.lang?.toLowerCase() === 'ts' || descriptor.script.lang?.toLowerCase() === 'typescript')
                ? 'typescript'
                : 'js',
        };
    }
    if (descriptor.scriptSetup) {
        const loc = descriptor.scriptSetup.loc;
        result.scriptSetup = {
            content: descriptor.scriptSetup.content,
            startLine: loc.start.line,
            startColumn: loc.start.column,
            isSetup: true,
            lang: (descriptor.scriptSetup.lang?.toLowerCase() === 'ts' || descriptor.scriptSetup.lang?.toLowerCase() === 'typescript')
                ? 'typescript'
                : 'js',
        };
    }
    return result;
}
//# sourceMappingURL=vueParser.js.map
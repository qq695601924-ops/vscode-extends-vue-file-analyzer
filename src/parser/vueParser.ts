import { parse } from '@vue/compiler-sfc';
import type { ScriptBlock, VueParseResult } from './types';

/**
 * Parse a .vue file and return script / script setup blocks with positions.
 */
export function parseVueFile(source: string): VueParseResult {
  const result: VueParseResult = {
    script: null,
    scriptSetup: null,
  };

  let parsed;
  try {
    parsed = parse(source, { filename: 'component.vue' });
  } catch {
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

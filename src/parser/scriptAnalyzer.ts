import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';
import type { SymbolNode, SymbolType, ScriptBlock } from './types';
import { mapToFileLocation } from '../utils/locationMapper';

const LIFECYCLE_OPTIONS = new Set([
  'beforeCreate', 'created', 'beforeMount', 'mounted',
  'beforeUpdate', 'updated', 'activated', 'deactivated',
  'beforeUnmount', 'unmounted', 'beforeDestroy', 'destroyed', 'errorCaptured',
]);

const COMPOSITION_LIFECYCLE = new Set([
  'onBeforeMount', 'onMounted', 'onBeforeUpdate', 'onUpdated',
  'onBeforeUnmount', 'onUnmounted', 'onActivated', 'onDeactivated',
  'onErrorCaptured', 'onServerPrefetch',
]);

/** Vuex map helpers that expand to computed. */
const MAP_COMPUTED = new Set(['mapState', 'mapGetters']);
/** Vuex map helpers that expand to methods. */
const MAP_METHODS = new Set(['mapActions', 'mapMutations']);

function getMapHelperCalleeName(callee: { type: string; name?: string; property?: { type: string; name?: string } }): string {
  if (callee.type === 'Identifier') return callee.name ?? '';
  if (callee.type === 'MemberExpression' && callee.property?.type === 'Identifier') return callee.property.name ?? '';
  return '';
}

/** Extract mapped names from mapState/mapGetters/mapActions/mapMutations first argument. */
function extractNamesFromMapHelperArg(arg: unknown): string[] {
  if (!arg || typeof arg !== 'object' || !('type' in arg)) return [];
  const node = arg as { type: string; elements?: unknown[]; properties?: { type: string; key: { type: string; name?: string; value?: string } }[] };
  if (node.type === 'ArrayExpression' && Array.isArray(node.elements)) {
    return node.elements.map(el => {
      if (el == null || typeof el !== 'object' || !('type' in el)) return '';
      const e = el as { type: string; value?: string; name?: string };
      return e.type === 'StringLiteral' ? (e.value ?? '') : e.type === 'Identifier' ? (e.name ?? '') : '';
    }).filter(Boolean);
  }
  if (node.type === 'ObjectExpression' && Array.isArray(node.properties)) {
    return node.properties.map(p => {
      if (p.type !== 'ObjectProperty') return '';
      const k = p.key;
      return k.type === 'Identifier' ? (k.name ?? '') : k.type === 'StringLiteral' ? (k.value ?? '') : '';
    }).filter(Boolean);
  }
  return [];
}

/** 辅助函数来源的展示文案 */
const MAP_SOURCE_LABELS: Record<string, string> = {
  mapState: '全局状态',
  mapGetters: '全局计算属性',
  mapActions: '全局方法',
  mapMutations: '全局变更',
};

interface RawSymbol {
  name: string;
  type: SymbolType;
  line: number;
  column: number;
  blockIndex: number;
  source?: string;
}

function addSymbol(
  list: RawSymbol[],
  name: string,
  type: SymbolType,
  line: number,
  column: number,
  blockIndex: number,
  source?: string
): void {
  if (name && typeof line === 'number' && typeof column === 'number') {
    list.push({ name, type, line, column, blockIndex, source });
  }
}

function toSymbolNodes(blocks: ScriptBlock[], rawList: RawSymbol[]): SymbolNode[] {
  return rawList.map(r => {
    const block = blocks[r.blockIndex] ?? blocks[0];
    const loc = mapToFileLocation(block.startLine, block.startColumn, r.line, r.column);
    return { name: r.name, type: r.type, location: loc, source: r.source };
  });
}

/**
 * Analyze a single script block and collect symbols. Returns raw (script-relative) symbols.
 */
function analyzeScriptContent(
  content: string,
  isSetup: boolean,
  isTypeScript: boolean,
  blockIndex: number,
  out: RawSymbol[]
): void {
  let ast: babelParser.ParseResult;
  try {
    ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: isTypeScript ? ['typescript', 'jsx'] : ['jsx'],
    });
  } catch {
    return;
  }

  const push = (name: string, type: SymbolType, line: number, col: number, source?: string) =>
    addSymbol(out, name, type, line, col, blockIndex, source);

  /** 预扫描：收集本文件中所有 import 的命名（用于标记“外部函数”） */
  const importedNames = new Set<string>();
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      for (const s of node.specifiers) {
        if (s.type === 'ImportDefaultSpecifier') {
          importedNames.add(s.local.name);
        } else if (s.type === 'ImportSpecifier') {
          importedNames.add(s.local.name);
        }
      }
    }
  }

  traverse(ast, {
    // ---------- Imports (both Options and Composition) ----------
    ImportDeclaration(path) {
      const specifiers = path.node.specifiers;
      const line = path.node.loc?.start.line ?? 1;
      const col = path.node.loc?.start.column ?? 0;
      for (const s of specifiers) {
        if (s.type === 'ImportDefaultSpecifier' || s.type === 'ImportSpecifier') {
          const name = s.type === 'ImportDefaultSpecifier'
            ? s.local.name
            : (s.imported.type === 'Identifier' ? s.imported.name : (s as { imported: { value?: string } }).imported?.value ?? s.local.name);
          push( name, 'import', line, col);
        }
      }
    },

    // ---------- Vue 2 Options API: export default { ... } ----------
    ExportDefaultDeclaration(path) {
      if (!path.node.declaration || path.node.declaration.type !== 'ObjectExpression') return;
      const obj = path.node.declaration;
      const getLineCol = (node: { loc?: { start: { line: number; column: number } } | null }) =>
        node.loc ? [node.loc.start.line, node.loc.start.column] as const : [1, 0];

      for (const prop of obj.properties) {
        if (prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') continue;
        const key = prop.type === 'ObjectProperty'
          ? (prop.key.type === 'Identifier' ? prop.key.name : (prop.key as { value?: string }).value)
          : (prop.key.type === 'Identifier' ? prop.key.name : (prop.key as { value?: string }).value);
        if (typeof key !== 'string') continue;

        const [line, col] = getLineCol(prop as { loc?: { start: { line: number; column: number } } | null });

        if (key === 'components' && prop.type === 'ObjectProperty' && prop.value.type === 'ObjectExpression') {
          for (const p of prop.value.properties) {
            if (p.type === 'ObjectProperty' && p.key.type === 'Identifier') {
              push( p.key.name, 'component', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
            }
          }
        } else if (key === 'props') {
          if (prop.type === 'ObjectProperty') {
            const val = prop.value;
            if (val.type === 'ArrayExpression') {
              for (const el of val.elements) {
                if (el && el.type === 'StringLiteral') push( el.value, 'prop', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
                if (el && el.type === 'Identifier') push( el.name, 'prop', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
              }
            } else if (val.type === 'ObjectExpression') {
              for (const p of val.properties) {
                if (p.type === 'ObjectProperty' && p.key.type === 'Identifier') {
                  push( p.key.name, 'prop', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
                }
              }
            }
          }
        } else if (key === 'emits') {
          if (prop.type === 'ObjectProperty' && prop.value.type === 'ArrayExpression') {
            for (const el of prop.value.elements) {
              if (el && el.type === 'StringLiteral') push( el.value, 'emit', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
              if (el && el.type === 'Identifier') push( el.name, 'emit', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
            }
          }
        } else if (key === 'data' && prop.type === 'ObjectMethod') {
          const body = prop.body.body;
          for (const st of body) {
            if (st.type === 'ReturnStatement' && st.argument?.type === 'ObjectExpression') {
              for (const p of st.argument.properties) {
                if (p.type === 'ObjectProperty' && p.key.type === 'Identifier') {
                  const val = p.value;
                  const fromImport = val.type === 'Identifier' && importedNames.has(val.name);
                  push(p.key.name, 'data', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col, fromImport ? '外部函数' : undefined);
                }
              }
              break;
            }
          }
        } else if (key === 'computed' && prop.type === 'ObjectProperty' && prop.value.type === 'ObjectExpression') {
          for (const p of prop.value.properties) {
            if (p.type === 'ObjectProperty') {
              if (p.key.type === 'Identifier') {
                const val = p.value;
                const fromImport = val.type === 'Identifier' && importedNames.has(val.name);
                push(p.key.name, 'computed', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col, fromImport ? '外部函数' : undefined);
              }
            } else if (p.type === 'ObjectMethod' && p.key.type === 'Identifier') {
              push(p.key.name, 'computed', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
            } else if (p.type === 'SpreadElement' && p.argument.type === 'CallExpression') {
              const calleeName = getMapHelperCalleeName(p.argument.callee as { type: string; name?: string; property?: { type: string; name?: string } });
              if (MAP_COMPUTED.has(calleeName)) {
                const sourceLabel = MAP_SOURCE_LABELS[calleeName] ?? calleeName;
                const names = extractNamesFromMapHelperArg(p.argument.arguments[0]);
                const locLine = p.argument.loc?.start.line ?? line;
                const locCol = p.argument.loc?.start.column ?? col;
                for (const name of names) {
                  push(name, 'computed', locLine, locCol, sourceLabel);
                }
              }
            }
          }
        } else if (key === 'methods' && prop.type === 'ObjectProperty' && prop.value.type === 'ObjectExpression') {
          for (const p of prop.value.properties) {
            if (p.type === 'ObjectProperty') {
              if (p.key.type === 'Identifier') {
                const val = p.value;
                const fromImport = val.type === 'Identifier' && importedNames.has(val.name);
                push(p.key.name, 'method', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col, fromImport ? '外部函数' : undefined);
              }
            } else if (p.type === 'ObjectMethod' && p.key.type === 'Identifier') {
              push(p.key.name, 'method', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
            } else if (p.type === 'SpreadElement' && p.argument.type === 'CallExpression') {
              const calleeName = getMapHelperCalleeName(p.argument.callee as { type: string; name?: string; property?: { type: string; name?: string } });
              if (MAP_METHODS.has(calleeName)) {
                const sourceLabel = MAP_SOURCE_LABELS[calleeName] ?? calleeName;
                const names = extractNamesFromMapHelperArg(p.argument.arguments[0]);
                const locLine = p.argument.loc?.start.line ?? line;
                const locCol = p.argument.loc?.start.column ?? col;
                for (const name of names) {
                  push(name, 'method', locLine, locCol, sourceLabel);
                }
              }
            }
          }
        } else if (key === 'watch' && prop.type === 'ObjectProperty' && prop.value.type === 'ObjectExpression') {
          for (const p of prop.value.properties) {
            if (p.type === 'ObjectProperty' && p.key.type === 'Identifier') {
              push( p.key.name, 'watch', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
            }
          }
        } else if (LIFECYCLE_OPTIONS.has(key)) {
          push( key, 'lifecycle', line, col);
        } else if (key === 'setup' && prop.type === 'ObjectMethod') {
          analyzeSetupFunctionBody(prop.body, out, blockIndex);
        }
      }
    },

    // ---------- Vue 3 <script setup> and top-level Composition API ----------
    ...(isSetup ? {
      CallExpression(path: { node: import('@babel/types').CallExpression; parent: import('@babel/types').Node }) {
        const callee = path.node.callee;
        const line = path.node.loc?.start.line ?? 1;
        const col = path.node.loc?.start.column ?? 0;

        const calleeName =
          callee.type === 'Identifier' ? callee.name
            : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
              ? callee.property.name
              : '';

        if (calleeName === 'defineProps') {
          const arg = path.node.arguments[0];
          if (arg?.type === 'ObjectExpression') {
            for (const p of arg.properties) {
              if (p.type === 'ObjectProperty' && p.key.type === 'Identifier') {
                push( p.key.name, 'prop', p.key.loc?.start.line ?? line, p.key.loc?.start.column ?? col);
              }
            }
          }
          return;
        }
        if (calleeName === 'defineEmits') {
          const arg = path.node.arguments[0];
          if (arg?.type === 'ArrayExpression') {
            for (const el of arg.elements) {
              if (el && el.type === 'StringLiteral') push( el.value, 'emit', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
              if (el && el.type === 'Identifier') push( el.name, 'emit', el.loc?.start.line ?? line, el.loc?.start.column ?? col);
            }
          }
          return;
        }
        if (calleeName === 'ref' || calleeName === 'reactive' || calleeName === 'shallowRef' || calleeName === 'shallowReactive') {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            const firstArg = path.node.arguments[0];
            const fromImport = firstArg?.type === 'Identifier' && importedNames.has(firstArg.name);
            push(parent.id.name, 'data', parent.id.loc?.start.line ?? line, parent.id.loc?.start.column ?? col, fromImport ? '外部函数' : undefined);
          }
          return;
        }
        if (calleeName === 'computed') {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            push( parent.id.name, 'computed', parent.id.loc?.start.line ?? line, parent.id.loc?.start.column ?? col);
          }
          return;
        }
        if (calleeName === 'watch' || calleeName === 'watchEffect') {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            push( parent.id.name, 'watch', parent.id.loc?.start.line ?? line, parent.id.loc?.start.column ?? col);
          } else {
            push( calleeName === 'watch' ? 'watch' : 'watchEffect', 'watch', line, col);
          }
          return;
        }
        if (COMPOSITION_LIFECYCLE.has(calleeName)) {
          push( calleeName, 'lifecycle', line, col);
          return;
        }
        if (calleeName === 'provide') {
          const arg = path.node.arguments[0];
          const name = arg?.type === 'StringLiteral' ? arg.value : arg?.type === 'Identifier' ? arg.name : 'provide';
          push( name, 'provide', line, col);
          return;
        }
        if (calleeName === 'inject') {
          const arg = path.node.arguments[0];
          const name = arg?.type === 'StringLiteral' ? arg.value : arg?.type === 'Identifier' ? arg.name : 'inject';
          push( name, 'inject', line, col);
          return;
        }
      },
      VariableDeclarator(path: { node: import('@babel/types').VariableDeclarator }) {
        const id = path.node.id;
        if (id.type !== 'Identifier') return;
        const init = path.node.init;
        const line = id.loc?.start.line ?? 1;
        const col = id.loc?.start.column ?? 0;
        if (init?.type === 'CallExpression') {
          const callee = init.callee;
          const name = callee.type === 'Identifier' ? callee.name : '';
          if (['ref', 'reactive', 'computed', 'watch', 'watchEffect'].includes(name)) return;
        }
        if (init?.type === 'Identifier' && importedNames.has(init.name)) {
          push(id.name, 'method', line, col, '外部函数');
          return;
        }
        if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
          push(id.name, 'method', line, col);
        }
      },
      FunctionDeclaration(path: { node: import('@babel/types').FunctionDeclaration }) {
        if (path.node.id?.type === 'Identifier') {
          const line = path.node.id.loc?.start.line ?? 1;
          const col = path.node.id.loc?.start.column ?? 0;
          push( path.node.id.name, 'method', line, col);
        }
      },
    } : {}),
  });
}

function analyzeSetupFunctionBody(
  body: import('@babel/types').BlockStatement,
  out: RawSymbol[],
  blockIndex: number
): void {
  const add = (name: string, type: SymbolType, line: number, col: number) =>
    addSymbol(out, name, type, line, col, blockIndex);
  for (const st of body.body) {
    if (st.type === 'VariableDeclaration') {
      for (const d of st.declarations) {
        if (d.id.type === 'Identifier' && d.init?.type === 'CallExpression') {
          const callee = d.init.callee;
          const name = callee.type === 'Identifier' ? callee.name : '';
          const line = d.id.loc?.start.line ?? 1;
          const col = d.id.loc?.start.column ?? 0;
          if (['ref', 'reactive', 'shallowRef', 'shallowReactive'].includes(name)) {
            add(d.id.name, 'data', line, col);
          } else if (name === 'computed') {
            add(d.id.name, 'computed', line, col);
          } else if (name === 'watch' || name === 'watchEffect') {
            add(d.id.name, 'watch', line, col);
          }
        }
      }
    }
    if (st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression') {
      const callee = st.expression.callee;
      const name = callee.type === 'Identifier' ? callee.name : '';
      const line = st.loc?.start.line ?? 1;
      const col = st.loc?.start.column ?? 0;
      if (COMPOSITION_LIFECYCLE.has(name)) {
        add(name, 'lifecycle', line, col);
      } else if (name === 'provide') {
        const arg = st.expression.arguments[0];
        const sym = arg?.type === 'StringLiteral' ? arg.value : arg?.type === 'Identifier' ? arg.name : 'provide';
        add(sym, 'provide', line, col);
      } else if (name === 'inject') {
        const arg = st.expression.arguments[0];
        const sym = arg?.type === 'StringLiteral' ? arg.value : arg?.type === 'Identifier' ? arg.name : 'inject';
        add(sym, 'inject', line, col);
      }
    }
  }
}

/**
 * Analyze one or two script blocks and return symbols with file-relative locations.
 */
export function analyzeScript(blocks: ScriptBlock[]): SymbolNode[] {
  const raw: RawSymbol[] = [];
  blocks.forEach((block, index) => {
    const isTS = block.lang === 'typescript' || block.lang === 'ts';
    analyzeScriptContent(block.content, block.isSetup, isTS, index, raw);
  });
  return toSymbolNodes(blocks, raw);
}

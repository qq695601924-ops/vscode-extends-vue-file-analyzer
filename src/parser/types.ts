/**
 * Symbol types for Vue file structure tree.
 */
export type SymbolType =
  | 'import'
  | 'component'
  | 'prop'
  | 'emit'
  | 'data'
  | 'computed'
  | 'method'
  | 'watch'
  | 'lifecycle'
  | 'provide'
  | 'inject';

export interface SymbolLocation {
  line: number;
  column: number;
}

export interface SymbolNode {
  name: string;
  type: SymbolType;
  location: SymbolLocation;
  /** 来源标识，如 map 辅助函数：'全局状态' | '全局计算属性' | '全局方法' | '全局变更'，用于显示为 name（source：name） */
  source?: string;
  children?: SymbolNode[];
}

/**
 * Parsed script block from .vue SFC.
 */
export interface ScriptBlock {
  content: string;
  /** 1-based start line of script block in the .vue file */
  startLine: number;
  /** 1-based start column */
  startColumn: number;
  isSetup: boolean;
  lang: 'js' | 'ts' | 'javascript' | 'typescript';
}

/**
 * Result of parsing a .vue file (may have script, script setup, or both).
 */
export interface VueParseResult {
  script: ScriptBlock | null;
  scriptSetup: ScriptBlock | null;
}

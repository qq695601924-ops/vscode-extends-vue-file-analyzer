import * as vscode from 'vscode';
import type { SymbolNode, SymbolType } from '../parser/types';

const CATEGORY_LABELS: Record<SymbolType, string> = {
  import: 'Imports',
  component: 'Components',
  prop: 'Props',
  emit: 'Emits',
  data: 'Data/State',
  computed: 'Computed',
  method: 'Methods/Functions',
  watch: 'Watch',
  lifecycle: 'Lifecycle Hooks',
  provide: 'Provide/Inject',
  inject: 'Provide/Inject',
};

/** Codicon for each category (folder) and symbol type. */
const CATEGORY_ICONS: Record<SymbolType, string> = {
  import: 'references',
  component: 'symbol-class',
  prop: 'symbol-property',
  emit: 'symbol-event',
  data: 'symbol-variable',
  computed: 'symbol-misc',
  method: 'symbol-method',
  watch: 'eye',
  lifecycle: 'debug-restart',
  provide: 'package',
  inject: 'inbox',
};

/** Tree item that can be a category (folder) or a symbol (leaf with location). */
export class VueSymbolTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: 'category' | 'symbol',
    public readonly location?: { line: number; column: number },
    public readonly children: VueSymbolTreeItem[] = [],
    public readonly documentUri?: vscode.Uri,
    public readonly symbolType?: SymbolType
  ) {
    super(
      label,
      kind === 'category' && children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    if (kind === 'category') {
      this.iconPath = new vscode.ThemeIcon(symbolType ? CATEGORY_ICONS[symbolType] : 'folder');
    } else {
      this.iconPath = new vscode.ThemeIcon(symbolType ? CATEGORY_ICONS[symbolType] : 'symbol-misc');
    }
    if (kind === 'symbol' && location && documentUri) {
      this.command = {
        command: 'vueAnalyzer.goToSymbol',
        title: 'Go to Symbol',
        arguments: [location, documentUri],
      };
    }
  }
}

export class VueFileTreeDataProvider implements vscode.TreeDataProvider<VueSymbolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VueSymbolTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private symbols: SymbolNode[] = [];
  private documentUri: vscode.Uri | undefined;
  private categoryOrder: SymbolType[] = [
    'import', 'component', 'prop', 'emit', 'data', 'computed', 'method', 'watch', 'lifecycle', 'provide', 'inject',
  ];

  refresh(symbols: SymbolNode[], documentUri?: vscode.Uri): void {
    this.symbols = symbols;
    this.documentUri = documentUri;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VueSymbolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: VueSymbolTreeItem): VueSymbolTreeItem[] {
    if (!element) {
      return this.buildCategoryNodes();
    }
    return element.children ?? [];
  }

  private buildCategoryNodes(): VueSymbolTreeItem[] {
    const byType = new Map<SymbolType, SymbolNode[]>();
    for (const s of this.symbols) {
      const list = byType.get(s.type) ?? [];
      list.push(s);
      byType.set(s.type, list);
    }

    const provideInject = [
      ...(byType.get('provide') ?? []),
      ...(byType.get('inject') ?? []),
    ];
    if (provideInject.length > 0) {
      byType.set('provide', provideInject);
      byType.delete('inject');
    }

    const items: VueSymbolTreeItem[] = [];
    for (const type of this.categoryOrder) {
      const list = byType.get(type);
      if (!list || list.length === 0) continue;
      const label = type === 'inject' ? 'Provide/Inject' : CATEGORY_LABELS[type];
      const children = list.map(s => {
        const label = s.source ? `${s.name}（${s.source}：${s.name}）` : s.name;
        return new VueSymbolTreeItem(label, 'symbol', s.location, [], this.documentUri, type);
      });
      items.push(new VueSymbolTreeItem(label, 'category', undefined, children, undefined, type));
    }
    return items;
  }
}

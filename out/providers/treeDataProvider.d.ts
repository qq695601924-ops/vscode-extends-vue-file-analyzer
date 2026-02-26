import * as vscode from 'vscode';
import type { SymbolNode, SymbolType } from '../parser/types';
/** Tree item that can be a category (folder) or a symbol (leaf with location). */
export declare class VueSymbolTreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly kind: 'category' | 'symbol';
    readonly location?: {
        line: number;
        column: number;
    } | undefined;
    readonly children: VueSymbolTreeItem[];
    readonly documentUri?: vscode.Uri | undefined;
    readonly symbolType?: SymbolType | undefined;
    constructor(label: string, kind: 'category' | 'symbol', location?: {
        line: number;
        column: number;
    } | undefined, children?: VueSymbolTreeItem[], documentUri?: vscode.Uri | undefined, symbolType?: SymbolType | undefined);
}
export declare class VueFileTreeDataProvider implements vscode.TreeDataProvider<VueSymbolTreeItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | VueSymbolTreeItem | undefined>;
    private symbols;
    private documentUri;
    private categoryOrder;
    refresh(symbols: SymbolNode[], documentUri?: vscode.Uri): void;
    getTreeItem(element: VueSymbolTreeItem): vscode.TreeItem;
    getChildren(element?: VueSymbolTreeItem): VueSymbolTreeItem[];
    private buildCategoryNodes;
}
//# sourceMappingURL=treeDataProvider.d.ts.map
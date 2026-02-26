"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VueFileTreeDataProvider = exports.VueSymbolTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const CATEGORY_LABELS = {
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
const CATEGORY_ICONS = {
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
class VueSymbolTreeItem extends vscode.TreeItem {
    constructor(label, kind, location, children = [], documentUri, symbolType) {
        super(label, kind === 'category' && children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.kind = kind;
        this.location = location;
        this.children = children;
        this.documentUri = documentUri;
        this.symbolType = symbolType;
        if (kind === 'category') {
            this.iconPath = new vscode.ThemeIcon(symbolType ? CATEGORY_ICONS[symbolType] : 'folder');
        }
        else {
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
exports.VueSymbolTreeItem = VueSymbolTreeItem;
class VueFileTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.symbols = [];
        this.categoryOrder = [
            'import', 'component', 'prop', 'emit', 'data', 'computed', 'method', 'watch', 'lifecycle', 'provide', 'inject',
        ];
    }
    refresh(symbols, documentUri) {
        this.symbols = symbols;
        this.documentUri = documentUri;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return this.buildCategoryNodes();
        }
        return element.children ?? [];
    }
    buildCategoryNodes() {
        const byType = new Map();
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
        const items = [];
        for (const type of this.categoryOrder) {
            const list = byType.get(type);
            if (!list || list.length === 0)
                continue;
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
exports.VueFileTreeDataProvider = VueFileTreeDataProvider;
//# sourceMappingURL=treeDataProvider.js.map
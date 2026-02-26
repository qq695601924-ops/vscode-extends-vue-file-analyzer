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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const vueParser_1 = require("./parser/vueParser");
const scriptAnalyzer_1 = require("./parser/scriptAnalyzer");
const treeDataProvider_1 = require("./providers/treeDataProvider");
const VIEW_ID = 'vueAnalyzerTree';
function isVueDocument(doc) {
    return doc.languageId === 'vue' || doc.fileName.endsWith('.vue');
}
function updateTreeForDocument(provider, doc) {
    if (!doc || !isVueDocument(doc)) {
        provider.refresh([]);
        return;
    }
    const result = (0, vueParser_1.parseVueFile)(doc.getText());
    const blocks = [result.script, result.scriptSetup].filter((b) => b != null);
    if (blocks.length === 0) {
        provider.refresh([]);
        return;
    }
    try {
        const symbols = (0, scriptAnalyzer_1.analyzeScript)(blocks);
        provider.refresh(symbols, doc.uri);
    }
    catch {
        provider.refresh([]);
    }
}
function activate(context) {
    const treeDataProvider = new treeDataProvider_1.VueFileTreeDataProvider();
    // 使用 registerTreeDataProvider 注册 contributed view，避免打包后出现「没有可提供视图数据的已注册数据提供程序」
    const treeDisposable = vscode.window.registerTreeDataProvider(VIEW_ID, treeDataProvider);
    context.subscriptions.push(treeDisposable);
    const updateForActiveEditor = () => {
        const editor = vscode.window.activeTextEditor;
        updateTreeForDocument(treeDataProvider, editor?.document);
    };
    updateForActiveEditor();
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => updateForActiveEditor()), vscode.workspace.onDidSaveTextDocument((doc) => {
        if (vscode.window.activeTextEditor?.document.uri.toString() === doc.uri.toString()) {
            updateTreeForDocument(treeDataProvider, doc);
        }
    }), vscode.commands.registerCommand('vueAnalyzer.goToSymbol', (location, documentUri) => {
        if (!location || typeof location.line !== 'number')
            return;
        const line = Math.max(0, location.line - 1);
        const column = Math.max(0, location.column ?? 0);
        const position = new vscode.Position(line, column);
        const uri = documentUri ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri)
            return;
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(position, position), viewColumn: vscode.ViewColumn.One }).then(editor => {
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        });
    }), vscode.commands.registerCommand('vueAnalyzer.refresh', () => updateForActiveEditor()));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
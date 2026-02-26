import * as vscode from 'vscode';
import { parseVueFile } from './parser/vueParser';
import { analyzeScript } from './parser/scriptAnalyzer';
import { VueFileTreeDataProvider } from './providers/treeDataProvider';

const VIEW_ID = 'vueAnalyzerTree';

function isVueDocument(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'vue' || doc.fileName.endsWith('.vue');
}

function updateTreeForDocument(provider: VueFileTreeDataProvider, doc: vscode.TextDocument | undefined): void {
  if (!doc || !isVueDocument(doc)) {
    provider.refresh([]);
    return;
  }
  const result = parseVueFile(doc.getText());
  const blocks = [result.script, result.scriptSetup].filter((b): b is NonNullable<typeof b> => b != null);
  if (blocks.length === 0) {
    provider.refresh([]);
    return;
  }
  try {
    const symbols = analyzeScript(blocks);
    provider.refresh(symbols, doc.uri);
  } catch {
    provider.refresh([]);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const treeDataProvider = new VueFileTreeDataProvider();

  // 使用 registerTreeDataProvider 注册 contributed view，避免打包后出现「没有可提供视图数据的已注册数据提供程序」
  const treeDisposable = vscode.window.registerTreeDataProvider(VIEW_ID, treeDataProvider);
  context.subscriptions.push(treeDisposable);

  const updateForActiveEditor = () => {
    const editor = vscode.window.activeTextEditor;
    updateTreeForDocument(treeDataProvider, editor?.document);
  };

  updateForActiveEditor();

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateForActiveEditor()),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === doc.uri.toString()) {
        updateTreeForDocument(treeDataProvider, doc);
      }
    }),
    vscode.commands.registerCommand('vueAnalyzer.goToSymbol', (location: { line: number; column: number }, documentUri?: vscode.Uri) => {
      if (!location || typeof location.line !== 'number') return;
      const line = Math.max(0, location.line - 1);
      const column = Math.max(0, location.column ?? 0);
      const position = new vscode.Position(line, column);
      const uri = documentUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) return;
      vscode.window.showTextDocument(uri, { selection: new vscode.Range(position, position), viewColumn: vscode.ViewColumn.One }).then(editor => {
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      });
    }),
    vscode.commands.registerCommand('vueAnalyzer.refresh', () => updateForActiveEditor())
  );
}

export function deactivate(): void {}

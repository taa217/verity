/**
 * Transforms AI-generated component code into a react-live–compatible snippet.
 *
 * The backend returns `function App() { ... }` (no imports / exports).
 * react-live in `noInline` mode needs an explicit `render(<App />)` call.
 *
 * This utility:
 *  1. Strips leftover markdown fences / language labels
 *  2. Strips any import / export lines
 *  3. Converts `export default function App` → `function App`
 *  4. Appends `render(<App />)` if missing
 */
export function toReactLiveSnippet(raw: string): string {
  const input = (raw ?? "").replace(/\r\n/g, "\n").trim();

  // --- Strip markdown fences ---
  const noFences = input
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```/g, "");

  const lines = noFences.split("\n");
  const out: string[] = [];

  let skippingImport = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Drop stray language labels (leaked from a fence)
    if (/^(javascript|typescript|json|jsx|tsx|js|ts)$/.test(trimmed)) continue;

    // Multi-line import handling
    if (skippingImport) {
      if (trimmed.includes(";")) skippingImport = false;
      continue;
    }

    // Single- or multi-line import
    if (/^import\b/.test(trimmed)) {
      if (trimmed.includes(";")) continue;
      skippingImport = true;
      continue;
    }

    // Drop re-exports or trailing `export default App;`
    if (/^\s*export\s+\{[^}]*\}\s*;?\s*$/.test(line)) continue;
    if (/^\s*export\s+default\s+App\s*;?\s*$/.test(line)) continue;

    // Drop destructuring from removed namespaces
    // e.g. `const { Mafs, Plot } = mafs;`
    if (/^\s*(const|let|var)\s*\{\s*[^}]+\s*\}\s*=\s*(mafs|drei|fiber)\s*;?\s*$/.test(line)) continue;

    // Convert `export default function App` → `function App`
    out.push(
      line.replace(
        /^\s*export\s+default\s+function\s+App\b/,
        "function App",
      ),
    );
  }

  let code = out.join("\n").trim();

  // Fallback: keep syntax valid
  if (!code) {
    code = "function App(){ return null }";
  }

  // react-live (noInline) needs render()
  if (!/\brender\s*\(/.test(code)) {
    code += "\n\nrender(<App />)\n";
  }

  return code;
}

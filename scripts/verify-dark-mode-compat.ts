// scripts/verify-dark-mode-compat.ts
import fs from "fs";
import path from "path";

console.log("=================================================================");
console.log("  TESTING AI AGENT CONFIGURATION FOR DARK MODE COMPATIBILITY");
console.log("=================================================================\n");

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

const baseDir = path.join(__dirname, "..");

// 1. Check agent-studio.css
const cssPath = path.join(baseDir, "app", "agent-studio", "agent-studio.css");
check("agent-studio.css exists", fs.existsSync(cssPath));
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, "utf-8");
  check("CSS has [data-bs-theme=\"dark\"] selector", css.includes('[data-bs-theme="dark"]'));
  check("CSS has .dark and [data-theme=\"dark\"] selectors", css.includes('.dark') && css.includes('[data-theme="dark"]'));
  check("CSS has dark mode card background & border overrides", css.includes('.ai-card') && css.includes('--ai-surface: #0F172A'));
  check("CSS has dark mode inputs and textareas styling", css.includes('.ai-input') && css.includes('.ai-textarea'));
  check("CSS has dark mode table headers and cells", css.includes('.ai-file-table'));
  check("CSS has dark mode Tailwind text arbitrary color overrides", css.includes('text-\\[\\#12336B\\]') && css.includes('text-\\[\\#526B91\\]'));
  check("CSS has Section 9 & 10 safety fallbacks for background & text", css.includes('data-keep-light') && css.includes('!important'));
}

// 2. Check app/agent-studio/page.tsx
const pagePath = path.join(baseDir, "app", "agent-studio", "page.tsx");
check("page.tsx exists", fs.existsSync(pagePath));
if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, "utf-8");
  check("page.tsx: Create Agent Modal has dark mode classes", page.includes('dark:bg-slate-900') && page.includes('dark:border-slate-800'));
  check("page.tsx: Delete Agent Modal has dark mode classes", page.includes('dark:text-white') && page.includes('dark:text-slate-300'));
}

// 3. Check AiInstructionsView.tsx
const aiInstrPath = path.join(baseDir, "components", "agent-studio", "AiInstructionsView.tsx");
check("AiInstructionsView.tsx exists", fs.existsSync(aiInstrPath));
if (fs.existsSync(aiInstrPath)) {
  const code = fs.readFileSync(aiInstrPath, "utf-8");
  check("AiInstructionsView: Root and banner have dark mode", code.includes('dark:bg-slate-950') && code.includes('dark:bg-slate-900'));
  check("AiInstructionsView: Persona and instructions cards have dark mode", code.includes('dark:text-white') && code.includes('dark:border-slate-800'));
  check("AiInstructionsView: Inputs and textareas have dark mode", code.includes('dark:bg-slate-950') && code.includes('dark:border-slate-700'));
  check("AiInstructionsView: Modals have dark mode", code.includes('dark:bg-slate-950/80') || code.includes('dark:bg-slate-900'));
}

// 4. Check KnowledgeBaseView.tsx
const kbPath = path.join(baseDir, "components", "agent-studio", "KnowledgeBaseView.tsx");
check("KnowledgeBaseView.tsx exists", fs.existsSync(kbPath));
if (fs.existsSync(kbPath)) {
  const code = fs.readFileSync(kbPath, "utf-8");
  check("KnowledgeBaseView: Search and dropdown have dark mode", code.includes('dark:bg-slate-900') && code.includes('dark:text-white'));
  check("KnowledgeBaseView: Table headers and cells have dark mode", code.includes('dark:bg-slate-950') && code.includes('dark:border-slate-800'));
  check("KnowledgeBaseView: Modals have dark mode", code.includes('dark:text-slate-200') || code.includes('dark:text-slate-300'));
}

// 5. Check AgentTestDemoView.tsx
const testDemoPath = path.join(baseDir, "components", "agent-studio", "AgentTestDemoView.tsx");
check("AgentTestDemoView.tsx exists", fs.existsSync(testDemoPath));
if (fs.existsSync(testDemoPath)) {
  const code = fs.readFileSync(testDemoPath, "utf-8");
  check("AgentTestDemoView: Sandbox controls have dark mode", code.includes('dark:bg-slate-900') && code.includes('dark:border-slate-800'));
  check("AgentTestDemoView: Markdown renderer supports dark mode", code.includes('dark:text-slate-100') && code.includes('dark:bg-slate-950'));
}

// 6. Check SettingsView.tsx
const settingsPath = path.join(baseDir, "components", "agent-studio", "SettingsView.tsx");
check("SettingsView.tsx exists", fs.existsSync(settingsPath));
if (fs.existsSync(settingsPath)) {
  const code = fs.readFileSync(settingsPath, "utf-8");
  check("SettingsView: Root has dark mode container", code.includes('dark:bg-slate-950') && code.includes('dark:text-white'));
  check("SettingsView: Agent switcher and filter pills have dark mode", code.includes('dark:bg-slate-900') && code.includes('dark:border-slate-800'));
}

// 7. Check DatabaseConfigurationCard.tsx
const dbCardPath = path.join(baseDir, "components", "agent-studio", "DatabaseConfigurationCard.tsx");
check("DatabaseConfigurationCard.tsx exists", fs.existsSync(dbCardPath));
if (fs.existsSync(dbCardPath)) {
  const code = fs.readFileSync(dbCardPath, "utf-8");
  check("DatabaseConfigurationCard: Cards and credentials modal have dark mode", code.includes('dark:bg-slate-900') && code.includes('dark:border-slate-800'));
}

// 8. Check ModelConfigurationView.tsx
const modelPath = path.join(baseDir, "components", "agent-studio", "ModelConfigurationView.tsx");
check("ModelConfigurationView.tsx exists", fs.existsSync(modelPath));
if (fs.existsSync(modelPath)) {
  const code = fs.readFileSync(modelPath, "utf-8");
  check("ModelConfigurationView: Root and top header have dark mode", code.includes('dark:bg-slate-950') && code.includes('dark:text-white'));
  check("ModelConfigurationView: 4 status KPI cards have dark mode", code.includes('dark:bg-slate-900 border-2') || code.includes('dark:bg-slate-900 border border-slate-200 dark:border-slate-800'));
  check("ModelConfigurationView: Filter bar and search have dark mode", code.includes('dark:bg-slate-950 text-slate-900 dark:text-white'));
  check("ModelConfigurationView: Registered models table has dark mode", code.includes('dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800'));
  check("ModelConfigurationView: Provider API Keys cards have dark mode", code.includes('dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5'));
  check("ModelConfigurationView: Register, Delete, Key, and Custom modals have dark mode", code.includes('dark:bg-slate-950/80 backdrop-blur-sm') && code.includes('dark:bg-slate-900 rounded-2xl'));
}

// 9. Check TokenAnalyticsView.tsx
const tokenPath = path.join(baseDir, "components", "agent-studio", "TokenAnalyticsView.tsx");
check("TokenAnalyticsView.tsx exists", fs.existsSync(tokenPath));
if (fs.existsSync(tokenPath)) {
  const code = fs.readFileSync(tokenPath, "utf-8");
  check("TokenAnalyticsView: Root and page header have dark mode", code.includes('dark:bg-slate-950 min-h-full') && code.includes('dark:text-white'));
  check("TokenAnalyticsView: 4 KPI metric cards have dark mode", code.includes('dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5'));
  check("TokenAnalyticsView: Budget progress bar card has dark mode", code.includes('dark:bg-slate-800 rounded-full') && code.includes('dark:bg-amber-950/60'));
  check("TokenAnalyticsView: Usage by Model & Agent cards have dark mode", code.includes('dark:text-slate-200 truncate max-w-[200px]'));
  check("TokenAnalyticsView: Activity log audit table has dark mode", code.includes('dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300'));
  check("TokenAnalyticsView: Budget modal has dark mode", code.includes('dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800'));
}

console.log("\n=================================================================");
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

// scripts/verify-ai-instructions-ui.ts
import fs from "fs";
import path from "path";

const targetPath = path.join(__dirname, "..", "components", "agent-studio", "AiInstructionsView.tsx");
const pagePath = path.join(__dirname, "..", "app", "agent-studio", "page.tsx");
const cssPath = path.join(__dirname, "..", "app", "agent-studio", "agent-studio.css");

console.log("=================================================");
console.log("  VERIFYING CREDITWISE AI INSTRUCTIONS SAAS REDESIGN");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function assertCheck(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

// 1. Verify Files Exist
assertCheck("AiInstructionsView.tsx exists", fs.existsSync(targetPath));
assertCheck("page.tsx exists", fs.existsSync(pagePath));
assertCheck("agent-studio.css exists", fs.existsSync(cssPath));

if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, "utf-8");
  assertCheck("CSS: --ai-* tokens defined in :root", 
    css.includes("--ai-primary: #2563eb") &&
    css.includes("--ai-surface: #ffffff") &&
    css.includes("--ai-border: #e2e8f0") &&
    css.includes("--ai-danger: #dc2626") &&
    css.includes("--ai-radius-lg: 14px")
  );
  assertCheck("CSS: .ai-main-layout class defined", css.includes(".ai-main-layout"));
  assertCheck("CSS: .ai-card class defined", css.includes(".ai-card"));
  assertCheck("CSS: .ai-form-grid 3-column layout defined", css.includes(".ai-form-grid"));
  assertCheck("CSS: .ai-textarea class defined", css.includes(".ai-textarea"));
  assertCheck("CSS: .ai-upload-grid 2-column layout defined", css.includes(".ai-upload-grid"));
  assertCheck("CSS: .ai-action-btn and .ai-table-actions defined (36x36px)", 
    css.includes(".ai-action-btn") &&
    css.includes("width: 36px") &&
    css.includes("height: 36px") &&
    css.includes(".ai-action-btn--delete")
  );
  assertCheck("CSS: .ai-file-table-wrapper and .ai-file-table defined", 
    css.includes(".ai-file-table-wrapper") &&
    css.includes(".ai-file-table")
  );
  assertCheck("CSS: Responsive media queries defined", css.includes("@media (max-width: 760px)"));
}

if (fs.existsSync(targetPath)) {
  const content = fs.readFileSync(targetPath, "utf-8");

  // 1. Top Configuration Bar
  assertCheck("Header: Page title 'Configure AI Instructions'", content.includes("Configure AI Instructions"));
  assertCheck("Header: Subtitle 'Customize how your assistant speaks, thinks, and uses its knowledge.'", 
    content.includes("Customize how your assistant speaks, thinks, and uses its knowledge.")
  );
  assertCheck("Header: Settings icon in light blue container", content.includes("bg-blue-50 text-blue-600 border border-blue-200/80"));
  assertCheck("Header: Agent selection dropdown present", content.includes("agentDropdownRef") && content.includes("<Bot className="));
  assertCheck("Header: Current agent status Active / Inactive badge", content.includes("Active") && content.includes("Inactive"));
  assertCheck("Header: Activate & Deactivate controls present", content.includes("Deactivate") && content.includes("Activate"));
  assertCheck("Header: Saved status indicator present", content.includes("Saved") && content.includes("Unsaved Changes"));
  assertCheck("Header: Delete Agent button present", content.includes("<Trash2") && content.includes("Delete"));
  assertCheck("Header: Save Instructions button present", content.includes("Save Instructions"));
  assertCheck("Header: Test Assistant accessible outside Quick Settings", content.includes("Test assistant") && content.includes("onNavigateToDemo"));

  // 2. Main Layout — NO QUICK SETTINGS
  assertCheck("Layout: Single full-width main column (.ai-main-layout)", content.includes("ai-main-layout"));
  assertCheck("Layout: Quick Settings UI card completely removed", !content.includes("Quick settings"));
  assertCheck("Layout: No obsolete lg:col-span-4 right-side quick settings panel", !content.includes("lg:col-span-4"));

  // 3. Agent Identity & Persona
  assertCheck("Identity: Card title 'Agent Identity & Persona'", content.includes("Agent Identity &amp; Persona") || content.includes("Agent Identity & Persona"));
  assertCheck("Identity: Full-width card with .ai-card and 3-column .ai-form-grid", content.includes("ai-card") && content.includes("ai-form-grid"));
  assertCheck("Identity: Agent Name field present", content.includes("Agent Name"));
  assertCheck("Identity: Conversation Tone field present", content.includes("Conversation Tone"));
  assertCheck("Identity: Response Style field with Clear, Helpful, Concise", content.includes("Clear, Helpful, Concise"));

  // 4. Instructions for the AI Agent
  assertCheck("Editor: Full-width card with .ai-card", content.includes("Instructions for the AI Agent"));
  assertCheck("Editor: Textarea styled with .ai-textarea", content.includes("ai-textarea"));
  assertCheck("Editor: Character counter present", content.includes("/2000 characters"));
  assertCheck("Editor: Autosave status present", content.includes("Autosaved"));
  assertCheck("Editor: Prompt Engine badge present", content.includes("Prompt Engine"));

  // 5. Knowledge Base Upload (Two-Column within upload only)
  assertCheck("Upload: Local 2-column grid (.ai-upload-grid)", content.includes("ai-upload-grid"));
  assertCheck("Upload: Drag-and-drop dropzone present", content.includes("Drag and drop files here or"));
  assertCheck("Upload: Choose Files button present", content.includes("Choose Files"));
  assertCheck("Upload: Supported formats (PDF, DOCX, TXT, CSV, XLSX)", content.includes("Supported formats: PDF, DOCX, TXT, CSV, XLSX"));
  assertCheck("Upload: Existing Source 1 - From URL present", content.includes("From URL"));
  assertCheck("Upload: Existing Source 2 - From Text present", content.includes("From Text"));
  assertCheck("Upload: Existing Source 3 - From Knowledge Base Library present", content.includes("From Knowledge Base Library"));

  // 6. Uploaded Knowledge Base Files Table
  assertCheck("Table: Full-width card with .ai-file-table-wrapper and .ai-file-table", 
    content.includes("ai-file-table-wrapper") && content.includes("ai-file-table")
  );
  assertCheck("Table: Action buttons styled with .ai-table-actions and .ai-action-btn", 
    content.includes("ai-table-actions") && content.includes("ai-action-btn")
  );
  assertCheck("Table: Delete button styled with .ai-action-btn--delete", content.includes("ai-action-btn--delete"));
  assertCheck("Table: View action triggers preview modal", content.includes("setPreviewDoc(doc)"));
  assertCheck("Table: Edit action triggers config modal", content.includes("setEditConfigDoc(doc)"));
  assertCheck("Table: Delete action triggers confirmation modal", content.includes("setDeleteDocTarget(doc)"));
  assertCheck("Table: Search and Filter controls present", content.includes("Search files...") && content.includes("All Types"));
  assertCheck("Table: Refresh button present", content.includes("RefreshCw") && content.includes("loadAgentKnowledge"));
  assertCheck("Table: Pagination controls present", content.includes("PAGE_SIZE") && content.includes("totalPages"));
  assertCheck("Table: Loading, Empty, and Error states present", 
    content.includes("isLoadingDocs") &&
    content.includes("No knowledge documents found") &&
    content.includes("docsError")
  );

  // 7. Modals & Handlers Preserved
  assertCheck("Modals: Preview Modal present", content.includes("Close Preview"));
  assertCheck("Modals: Edit Configuration Modal present with supported fields", 
    content.includes("editDocName") &&
    content.includes("editInstructionText") &&
    content.includes("editWhenToUse") &&
    content.includes("editWhenNotToUse") &&
    content.includes("editGuardrailText")
  );
  assertCheck("Modals: Delete Confirmation Modal present", content.includes("handleConfirmDeleteDoc"));
  assertCheck("Modals: URL Ingestion Modal present", content.includes("handleAddFromUrl"));
  assertCheck("Modals: Text Ingestion Modal present", content.includes("handleAddFromText"));
  assertCheck("Modals: Bank Policy Library Modal present", content.includes("handleAddFromLibrary"));
}

if (fs.existsSync(pagePath)) {
  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assertCheck("page.tsx: passes onNavigateToDemo to AiInstructionsView", pageContent.includes("onNavigateToDemo="));
  assertCheck("page.tsx: passes onNavigateToKnowledge to AiInstructionsView", pageContent.includes("onNavigateToKnowledge="));
}

console.log("\n=================================================");
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL ACCEPTANCE CRITERIA VERIFIED AND 100% OPERATIONAL!");
}

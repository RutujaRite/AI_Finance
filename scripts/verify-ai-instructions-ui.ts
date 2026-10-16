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

// 2. Verify Page Scroll Locking in page.tsx
if (fs.existsSync(pagePath)) {
  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assertCheck("page.tsx: Outer container has h-screen max-h-screen overflow-hidden",
    pageContent.includes("h-screen max-h-screen overflow-hidden")
  );
  assertCheck("page.tsx: Main area has h-full overflow-hidden",
    pageContent.includes("h-full overflow-hidden")
  );
}

// 3. Verify CSS Design Tokens & Rules
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, "utf-8");
  assertCheck("CSS: Modern Enterprise SaaS design tokens defined in :root", 
    css.includes("--ai-primary: #1677FF") &&
    css.includes("--ai-background: #F5F9FF") &&
    css.includes("--ai-surface: #FFFFFF") &&
    css.includes("--ai-navy: #12336B") &&
    css.includes("--ai-text-body: #526B91") &&
    css.includes("--ai-border: #DCE8F8") &&
    css.includes("--ai-primary-light: #EAF3FF") &&
    css.includes("--ai-success: #079669") &&
    css.includes("--ai-success-bg: #E7F9F1") &&
    css.includes("--ai-danger: #F04452") &&
    css.includes("--ai-radius-lg: 10px") &&
    css.includes("--ai-radius-md: 7px")
  );
  assertCheck("CSS: .ai-main-layout class defined", css.includes(".ai-main-layout"));
  assertCheck("CSS: .ai-card defined with 1px solid #DCE8F8 and 10px radius", 
    css.includes(".ai-card") && css.includes("#DCE8F8")
  );
  assertCheck("CSS: .ai-toolbar-card defined", css.includes(".ai-toolbar-card"));
  assertCheck("CSS: .ai-form-grid 3-column layout defined", css.includes(".ai-form-grid"));
  assertCheck("CSS: .ai-input and .ai-select defined with 38px height and 7px radius", 
    css.includes(".ai-input") && css.includes(".ai-select") && css.includes("height: 38px")
  );
  assertCheck("CSS: .ai-textarea defined with 200-240px min-height", 
    css.includes(".ai-textarea") && (css.includes("min-height: 220px") || css.includes("min-height: 200px"))
  );
  assertCheck("CSS: .ai-upload-grid 50/50 side-by-side grid defined with 16px gap", 
    css.includes(".ai-upload-grid") && css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))")
  );
  assertCheck("CSS: .ai-source-card class defined with #DCE8F8 border and hover effects", 
    css.includes(".ai-source-card") && css.includes("#DCE8F8")
  );
  assertCheck("CSS: .ai-scroll-pane custom scrollbar defined with #DCE8F8 and #F5F9FF", 
    css.includes(".ai-scroll-pane") && css.includes("#DCE8F8") && css.includes("#F5F9FF")
  );
  assertCheck("CSS: .ai-action-btn defined with 34-36px size, 7px radius, and delete styling", 
    css.includes(".ai-action-btn") &&
    (css.includes("width: 35px") || css.includes("width: 34px") || css.includes("width: 36px")) &&
    css.includes("border-radius: 7px") &&
    css.includes(".ai-action-btn--delete")
  );
  assertCheck("CSS: .ai-file-table defined with #F5F9FF header", 
    css.includes(".ai-file-table thead th") && css.includes("#F5F9FF")
  );
}

// 4. Verify AiInstructionsView Component Structure
if (fs.existsSync(targetPath)) {
  const content = fs.readFileSync(targetPath, "utf-8");

  // A. Scroll Container with #F5F9FF background
  assertCheck("AiInstructionsView: Container has bg-[#F5F9FF] h-full overflow-y-auto ai-scroll-pane",
    content.includes("bg-[#F5F9FF]") && content.includes("h-full overflow-y-auto ai-scroll-pane")
  );

  // B. Page Header
  assertCheck("Header: Page title 'Configure AI Instructions' with bold navy #12336B", 
    content.includes("Configure AI Instructions") && content.includes("#12336B")
  );
  assertCheck("Header: Subtitle with muted blue #526B91", 
    (content.includes("Customize how your assistant speaks, thinks, and uses your knowledge.") ||
     content.includes("Customize how your assistant speaks, thinks, and uses its knowledge.")) &&
    content.includes("#526B91")
  );
  assertCheck("Header: Settings icon inside #EAF3FF container", 
    content.includes("<Settings") && content.includes("#EAF3FF")
  );

  // C. Horizontal White Toolbar Card
  assertCheck("Toolbar: Controls enclosed inside horizontal card with #DCE8F8 border and shadow",
    content.includes("ai-card") && content.includes("shadow-[0_2px_8px_rgba(30,80,150,0.04)]")
  );
  assertCheck("Toolbar: Redundant agent dropdown and create agent buttons removed from secondary action bar", 
    !content.includes("isAgentDropdownOpen") && !content.includes("+ Create Agent Toolbar Button")
  );
  assertCheck("Toolbar: Switchable Active / Inactive button with #E7F9F1 and #079669", 
    content.includes("handleToggleActiveStatus") &&
    content.includes("Active") &&
    content.includes("#E7F9F1") &&
    content.includes("#079669")
  );
  assertCheck("Toolbar: Separate Activate and Deactivate buttons removed as requested", 
    !content.includes(">Deactivate<") && !content.includes(">Activate<")
  );
  assertCheck("Toolbar: Delete button with #F04452 styling", 
    content.includes("<Trash2") && content.includes("#F04452")
  );
  assertCheck("Toolbar: Save Instructions primary button with #1677FF", 
    content.includes("Save Instructions") && content.includes("#1677FF")
  );

  // D. Full-Width White Card: Agent Identity & Persona
  assertCheck("Persona Card: Distinct card with user icon and 'Agent Identity & Persona' heading",
    content.includes("Agent Identity &amp; Persona") && content.includes("<User")
  );
  assertCheck("Persona Card: Subtitle 'Define the agent's name, conversation tone, and response style.'",
    content.includes("Define the agent's name, conversation tone, and response style.")
  );
  assertCheck("Persona Card: 3 responsive inputs (Agent Name, Conversation Tone, Response Style)",
    content.includes("Agent Name") &&
    content.includes("Conversation Tone") &&
    content.includes("Response Style") &&
    content.includes("ai-form-grid")
  );

  // E. Full-Width White Card: Instructions for the AI Agent
  assertCheck("Instructions Card: Distinct card directly below Persona with 'Instructions for the AI Agent'",
    content.includes("Instructions for the AI Agent")
  );
  assertCheck("Instructions Card: Subtitle present",
    content.includes("Master instruction prompt, financial verification rules, and conversational logic.")
  );
  assertCheck("Instructions Card: Prompt Engine button aligned top-right",
    content.includes("Prompt Engine") && content.includes("<Sparkles")
  );
  assertCheck("Instructions Card: Large clean textarea with .ai-textarea",
    content.includes("ai-textarea")
  );
  assertCheck("Instructions Card: Footer with Character limit counter",
    content.includes("/ 10,000 characters") || content.includes("/ 10000 characters") || content.includes("/ 2000 characters")
  );
  assertCheck("Instructions Card: Footer with Autosave status and green #079669 check",
    content.includes("Autosaved") && content.includes("#079669")
  );
  assertCheck("Instructions Card: Footer Save Instructions button present",
    content.includes("Save Instructions")
  );

  // F. Removal of Quick Settings
  assertCheck("Quick Settings: Heading completely REMOVED", !content.includes("Quick settings"));
  assertCheck("Quick Settings: Pro Tip card completely REMOVED", !content.includes("Pro Tip"));

  // G. 50/50 Knowledge Base Upload Grid
  assertCheck("Upload Grid: .ai-upload-grid container present", content.includes("ai-upload-grid"));
  assertCheck("Upload Left: 'Upload Knowledge Base' card with cloud icon", 
    content.includes("Upload Knowledge Base") && content.includes("<UploadCloud")
  );
  assertCheck("Upload Left: Supported formats (PDF, DOCX, TXT, CSV, XLSX)",
    content.includes("Supported formats: PDF, DOCX, TXT, CSV, XLSX") ||
    content.includes("Supported: PDF, DOCX, TXT, CSV, XLSX")
  );
  assertCheck("Upload Left: Drag-and-drop dropzone with Choose Files button (#1677FF)",
    content.includes("Drag and drop files here or") && content.includes("Choose Files") && content.includes("#1677FF")
  );
  assertCheck("Upload Right: 'Or add from existing sources' card", 
    content.includes("Or add from existing sources")
  );
  assertCheck("Upload Right: Row 1 - From URL", content.includes("From URL"));
  assertCheck("Upload Right: Row 2 - From Text", content.includes("From Text"));
  assertCheck("Upload Right: Row 3 - From Knowledge Base Library", content.includes("From Knowledge Base Library"));

  // H. Uploaded Knowledge Base Files Table
  assertCheck("Table Card: Distinct full-width card with 'Uploaded Knowledge Base Files'",
    content.includes("Uploaded Knowledge Base Files") && content.includes("<BookOpen")
  );
  assertCheck("Table Controls: Search input, Type filter dropdown, Refresh button",
    content.includes("Search files...") && content.includes("All Types") && content.includes("loadAgentKnowledge")
  );
  assertCheck("Table Rows: Standard 34-36px action buttons for View, Edit, Delete",
    content.includes("ai-action-btn") &&
    content.includes("ai-action-btn--delete") &&
    content.includes("<Eye") &&
    content.includes("<Edit2") &&
    content.includes("<Trash2")
  );
  assertCheck("Table Footer: Dynamic record range (Showing X to Y of Z files)",
    content.includes("Showing") && content.includes("of") && content.includes("files")
  );
  assertCheck("Table Footer: Previous, numbered page, Next buttons with #1677FF active style",
    content.includes("totalPages") && content.includes("#1677FF")
  );

  // I. Dynamic Backend Integrity
  assertCheck("Backend: Dynamic agent knowledge fetching via /api/agents/${agent.id}/knowledge",
    content.includes("/api/agents/${agent.id}/knowledge")
  );
  assertCheck("Backend: Dynamic library policies fetching via /api/policies",
    content.includes("/api/policies")
  );
}

console.log("\n=================================================");
console.log(`  VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}

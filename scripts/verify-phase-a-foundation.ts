/**
 * Verification Script for Phase A Design System Foundation
 *
 * Verifies:
 * 1. 6-level typography hierarchy tokens and utility classes
 * 2. 8pt spacing grid and card padding foundations (20px standard / 16px compact)
 * 3. Semantic color tokens (surfaces, verified, review, original, customized, danger, info) in light & dark modes
 * 4. Card geometry, border radius (8px / rounded-lg), structural borders, and spacing tokens
 * 5. Button hierarchy variants (subtle, neutral, verified)
 * 6. StatusBadge foundation supporting verified, review, original, customized, etc.
 * 7. EmptyState foundation supporting icon, title, description, primaryAction, secondaryAction
 * 8. Dialog foundation with DialogBody, standard typography, and clean geometry
 */

import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${testName}`);
    if (detail) console.error(`    \x1b[33m${detail}\x1b[0m`);
    failed++;
  }
}

console.log('\n=== CareerQuest Phase A Design System Foundation Verification ===\n');

// 1. Check design-tokens.css existence & imports
console.log('--- 1. Design Tokens & Global CSS Integration ---');
const tokensPath = path.resolve(process.cwd(), 'src/styles/design-tokens.css');
const globalsPath = path.resolve(process.cwd(), 'src/styles/globals.css');

assert(fs.existsSync(tokensPath), 'design-tokens.css exists');
assert(fs.existsSync(globalsPath), 'globals.css exists');

const tokensContent = fs.readFileSync(tokensPath, 'utf8');
const globalsContent = fs.readFileSync(globalsPath, 'utf8');

assert(
  globalsContent.includes("@import './design-tokens.css';"),
  'globals.css imports ./design-tokens.css'
);

// 2. Typography Hierarchy Verification
console.log('\n--- 2. Typography Hierarchy (6 Levels) ---');
assert(tokensContent.includes('@utility type-display'), 'type-display utility defined (24px bold)');
assert(tokensContent.includes('font-size: 1.5rem'), 'type-display is 1.5rem (24px)');
assert(tokensContent.includes('@utility type-heading'), 'type-heading utility defined (18px semibold)');
assert(tokensContent.includes('font-size: 1.125rem'), 'type-heading is 1.125rem (18px)');
assert(tokensContent.includes('@utility type-subheading'), 'type-subheading utility defined (14px medium)');
assert(tokensContent.includes('@utility type-body'), 'type-body utility defined (14px regular)');
assert(tokensContent.includes('@utility type-body-sm'), 'type-body-sm utility defined (12px regular)');
assert(tokensContent.includes('font-size: 0.75rem'), 'type-body-sm is 0.75rem (12px)');
assert(tokensContent.includes('@utility type-caption'), 'type-caption utility defined (11px medium)');
assert(tokensContent.includes('font-size: 0.6875rem'), 'type-caption is 0.6875rem (11px)');

// 3. Spacing Foundation (8pt grid & standardized card padding)
console.log('\n--- 3. 8pt Spacing Foundation & Card Padding ---');
assert(tokensContent.includes('@utility card-pad-standard'), 'card-pad-standard utility defined (20px / 1.25rem)');
assert(tokensContent.includes('1.25rem; /* 20px */'), 'card-pad-standard is 1.25rem (20px)');
assert(tokensContent.includes('@utility card-pad-compact'), 'card-pad-compact utility defined (16px / 1.0rem)');
assert(tokensContent.includes('1rem; /* 16px */'), 'card-pad-compact is 1.0rem (16px)');

// 4. Semantic Color Tokens
console.log('\n--- 4. Semantic Color Tokens ---');
assert(tokensContent.includes('--cq-canvas'), '--cq-canvas surface defined');
assert(tokensContent.includes('--cq-surface:'), '--cq-surface defined');
assert(tokensContent.includes('--cq-surface-subtle:'), '--cq-surface-subtle defined');
assert(tokensContent.includes('--cq-border:'), '--cq-border defined');
assert(tokensContent.includes('--cq-verified:'), '--cq-verified (emerald) defined');
assert(tokensContent.includes('--cq-review:'), '--cq-review (amber) defined');
assert(tokensContent.includes('--cq-original:'), '--cq-original (slate/neutral) defined');
assert(tokensContent.includes('--cq-customized:'), '--cq-customized (blue/indigo) defined');
assert(tokensContent.includes('--cq-danger:'), '--cq-danger (destructive) defined');
assert(tokensContent.includes('--cq-info:'), '--cq-info (sky) defined');
assert(tokensContent.includes('.dark {'), '.dark mode color tokens defined');
assert(tokensContent.includes('@theme inline {'), '@theme inline token utility mappings defined');

// 5. Card Component Standardization
console.log('\n--- 5. Card Component Standardization ---');
const cardPath = path.resolve(process.cwd(), 'src/components/ui/card.tsx');
assert(fs.existsSync(cardPath), 'card.tsx exists');
const cardContent = fs.readFileSync(cardPath, 'utf8');

assert(cardContent.includes("size?: 'default' | 'sm' | 'compact'"), 'Card supports compact size');
assert(cardContent.includes('rounded-lg'), 'Card uses rounded-lg (8px) geometry');
assert(cardContent.includes('border border-border/80'), 'Card uses crisp 1px structural border');
assert(cardContent.includes('[--card-spacing:1.25rem]'), 'Card default spacing is 1.25rem (20px standard)');
assert(cardContent.includes('data-[size=compact]:[--card-spacing:1rem]'), 'Card compact spacing is 1rem (16px)');
assert(cardContent.includes('type-heading'), 'CardTitle adopts type-heading (18px)');
assert(cardContent.includes('type-body-sm'), 'CardDescription adopts type-body-sm (12px)');

// 6. Button Hierarchy Standardization
console.log('\n--- 6. Button Hierarchy Variants ---');
const buttonPath = path.resolve(process.cwd(), 'src/components/ui/button.tsx');
assert(fs.existsSync(buttonPath), 'button.tsx exists');
const buttonContent = fs.readFileSync(buttonPath, 'utf8');

assert(buttonContent.includes('subtle:'), 'Button supports subtle variant');
assert(buttonContent.includes('neutral:'), 'Button supports neutral variant (safe decisions)');
assert(buttonContent.includes('verified:'), 'Button supports verified variant');
assert(buttonContent.includes('destructive:'), 'Button reserves destructive for genuinely destructive actions');

// 7. StatusBadge Component Foundation
console.log('\n--- 7. StatusBadge Foundation ---');
const statusBadgePath = path.resolve(process.cwd(), 'src/components/ui/status-badge.tsx');
assert(fs.existsSync(statusBadgePath), 'status-badge.tsx exists');
const statusBadgeContent = fs.readFileSync(statusBadgePath, 'utf8');

assert(statusBadgeContent.includes('verified:'), 'StatusBadge supports verified state (emerald)');
assert(statusBadgeContent.includes('review:'), 'StatusBadge supports review state (amber)');
assert(statusBadgeContent.includes('original:'), 'StatusBadge supports original state (neutral slate, not destructive)');
assert(statusBadgeContent.includes('customized:'), 'StatusBadge supports customized state (blue)');
assert(statusBadgeContent.includes('success:'), 'StatusBadge supports success state');
assert(statusBadgeContent.includes('warning:'), 'StatusBadge supports warning state');
assert(statusBadgeContent.includes('error:'), 'StatusBadge supports error state');
assert(statusBadgeContent.includes('info:'), 'StatusBadge supports info state');
assert(statusBadgeContent.includes('neutral:'), 'StatusBadge supports neutral state');
assert(statusBadgeContent.includes('size: {'), 'StatusBadge supports multiple standardized sizes (sm, default, lg)');

// 8. EmptyState Component Foundation
console.log('\n--- 8. EmptyState Foundation ---');
const emptyStatePath = path.resolve(process.cwd(), 'src/components/ui/empty-state.tsx');
assert(fs.existsSync(emptyStatePath), 'empty-state.tsx exists');
const emptyStateContent = fs.readFileSync(emptyStatePath, 'utf8');

assert(emptyStateContent.includes('EmptyStateProps'), 'EmptyStateProps interface defined');
assert(emptyStateContent.includes('icon?:'), 'EmptyState supports icon');
assert(emptyStateContent.includes('title: React.ReactNode'), 'EmptyState supports title');
assert(emptyStateContent.includes('description?: React.ReactNode'), 'EmptyState supports description');
assert(emptyStateContent.includes('primaryAction?: EmptyStateAction'), 'EmptyState supports primaryAction');
assert(emptyStateContent.includes('secondaryAction?: EmptyStateAction'), 'EmptyState supports secondaryAction');
assert(emptyStateContent.includes('type-subheading'), 'EmptyState title uses type-subheading');
assert(emptyStateContent.includes('type-body-sm'), 'EmptyState description uses type-body-sm');

// 9. Dialog Component Foundation
console.log('\n--- 9. Dialog Foundation ---');
const dialogPath = path.resolve(process.cwd(), 'src/components/ui/dialog.tsx');
assert(fs.existsSync(dialogPath), 'dialog.tsx exists');
const dialogContent = fs.readFileSync(dialogPath, 'utf8');

assert(dialogContent.includes('function DialogBody('), 'Dialog exports DialogBody slot');
assert(dialogContent.includes('type-heading text-foreground font-semibold'), 'DialogTitle uses type-heading');
assert(dialogContent.includes('type-body-sm text-muted-foreground'), 'DialogDescription uses type-body-sm');
assert(dialogContent.includes('rounded-lg bg-popover'), 'DialogContent uses rounded-lg geometry');
assert(dialogContent.includes('border border-border/80 shadow-md'), 'DialogContent uses 1px crisp structural border and shadow');

console.log('\n================================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Phase A Design System Foundation verified successfully!\n');
}

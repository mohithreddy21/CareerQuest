/**
 * Verification Script for Phase B Shared Component Primitives
 *
 * Verifies:
 * 1. DiffViewer component & computeWordDiff LCS token algorithm
 * 2. StatusBadge component & semantic status variant coverage
 * 3. MetricCard component & empathetic insufficient data states
 * 4. EmptyState component & action triggers
 * 5. FilterBar component & responsive filter configurations
 * 6. Integration across core features (ResumeChangeCard, OverviewPage, JobOpportunityCard, DiscoverPage, ApplicationsPage)
 */

import fs from 'node:fs';
import path from 'node:path';
import { computeWordDiff } from '../src/components/ui/diff-viewer';

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

console.log('\n=== CareerQuest Phase B Shared Component Primitives Verification ===\n');

// 1. DiffViewer & LCS Word Diff Engine
console.log('--- 1. DiffViewer Component & LCS Engine ---');
const diffViewerPath = path.resolve(process.cwd(), 'src/components/ui/diff-viewer.tsx');
assert(fs.existsSync(diffViewerPath), 'diff-viewer.tsx exists');

const diffContent = fs.readFileSync(diffViewerPath, 'utf8');
assert(diffContent.includes('export function DiffViewer('), 'DiffViewer component exported');
assert(diffContent.includes('export function computeWordDiff('), 'computeWordDiff algorithm exported');

// Test LCS diffing logic with real sentences
const original = 'Architected distributed systems on AWS handling 50k RPS.';
const modified = 'Architected distributed event-driven systems on AWS handling 50k RPS with Kafka.';
const tokens = computeWordDiff(original, modified);

assert(tokens.length > 0, 'Tokens produced by computeWordDiff');
assert(tokens.some((t) => t.type === 'added' && t.value.includes('event-driven')), 'Detects added phrase "event-driven"');
assert(tokens.some((t) => t.type === 'added' && t.value.includes('Kafka')), 'Detects added phrase "Kafka"');
assert(tokens.some((t) => t.type === 'equal' && t.value.includes('Architected')), 'Detects preserved prefix "Architected"');

// Test deletion
const delOriginal = 'Managed legacy PHP application.';
const delModified = 'Managed modern web application.';
const delTokens = computeWordDiff(delOriginal, delModified);
assert(delTokens.some((t) => t.type === 'removed' && t.value.includes('legacy')), 'Detects removed token "legacy"');
assert(delTokens.some((t) => t.type === 'added' && t.value.includes('modern')), 'Detects added token "modern"');

// 2. StatusBadge Component
console.log('\n--- 2. StatusBadge Component ---');
const statusBadgePath = path.resolve(process.cwd(), 'src/components/ui/status-badge.tsx');
assert(fs.existsSync(statusBadgePath), 'status-badge.tsx exists');

const badgeContent = fs.readFileSync(statusBadgePath, 'utf8');
assert(badgeContent.includes('statusBadgeVariants'), 'statusBadgeVariants defined');
assert(badgeContent.includes('verified:'), 'StatusBadge includes verified variant');
assert(badgeContent.includes('review:'), 'StatusBadge includes review variant');
assert(badgeContent.includes('original:'), 'StatusBadge includes original variant (safe/neutral)');
assert(badgeContent.includes('customized:'), 'StatusBadge includes customized variant');
assert(badgeContent.includes('error:'), 'StatusBadge reserves error for genuine errors');

// 3. MetricCard Component
console.log('\n--- 3. MetricCard Component ---');
const metricCardPath = path.resolve(process.cwd(), 'src/components/ui/metric-card.tsx');
assert(fs.existsSync(metricCardPath), 'metric-card.tsx exists');

const metricContent = fs.readFileSync(metricCardPath, 'utf8');
assert(metricContent.includes('export function MetricCard('), 'MetricCard component exported');
assert(metricContent.includes('isInsufficient'), 'MetricCard handles insufficient-data / empty states');
assert(metricContent.includes('Not enough data yet'), 'MetricCard default empathetic empty message');
assert(metricContent.includes('trend'), 'MetricCard supports trends and deltas');

// 4. EmptyState Component
console.log('\n--- 4. EmptyState Component ---');
const emptyStatePath = path.resolve(process.cwd(), 'src/components/ui/empty-state.tsx');
assert(fs.existsSync(emptyStatePath), 'empty-state.tsx exists');

const emptyContent = fs.readFileSync(emptyStatePath, 'utf8');
assert(emptyContent.includes('export function EmptyState('), 'EmptyState component exported');
assert(emptyContent.includes('primaryAction'), 'EmptyState supports primaryAction');
assert(emptyContent.includes('secondaryAction'), 'EmptyState supports secondaryAction');
assert(emptyContent.includes('type-subheading'), 'EmptyState uses type-subheading');
assert(emptyContent.includes('type-body-sm'), 'EmptyState uses type-body-sm');

// 5. FilterBar Component
console.log('\n--- 5. FilterBar Component ---');
const filterBarPath = path.resolve(process.cwd(), 'src/components/ui/filter-bar.tsx');
assert(fs.existsSync(filterBarPath), 'filter-bar.tsx exists');

const filterContent = fs.readFileSync(filterBarPath, 'utf8');
assert(filterContent.includes('export function FilterBar('), 'FilterBar component exported');
assert(filterContent.includes('onResetAll'), 'FilterBar supports onResetAll');
assert(filterContent.includes('activeFilterCount'), 'FilterBar displays active count badge');
assert(filterContent.includes('isCollapsible'), 'FilterBar supports mobile responsive disclosure');

// 6. Feature Integration Checks
console.log('\n--- 6. Feature Integration Checks ---');
const resumeCardPath = path.resolve(process.cwd(), 'src/features/tailoring/components/resume-change-card.tsx');
const resumeCardContent = fs.readFileSync(resumeCardPath, 'utf8');
assert(resumeCardContent.includes('<DiffViewer'), 'ResumeChangeCard integrates DiffViewer');
assert(resumeCardContent.includes('<StatusBadge'), 'ResumeChangeCard integrates StatusBadge');
assert(resumeCardContent.includes('Keep Original'), 'ResumeChangeCard uses safe non-destructive wording for Keep Original');

const overviewPath = path.resolve(process.cwd(), 'src/features/overview/components/overview-page.tsx');
const overviewContent = fs.readFileSync(overviewPath, 'utf8');
assert(overviewContent.includes('<EmptyState'), 'OverviewPage integrates EmptyState');
assert(overviewContent.includes('<StatusBadge'), 'OverviewPage integrates StatusBadge');
assert(!overviewContent.includes('bg-gradient-to-r from-card via-card/90 to-accent/20'), 'OverviewPage replaced ad-hoc gradient banner with calm surface');

const jobCardPath = path.resolve(process.cwd(), 'src/features/jobs/components/job-opportunity-card.tsx');
const jobCardContent = fs.readFileSync(jobCardPath, 'utf8');
assert(jobCardContent.includes('<StatusBadge'), 'JobOpportunityCard integrates StatusBadge');
assert(jobCardContent.includes('Profile Alignment'), 'JobOpportunityCard shows balanced decision-support alignment');

const discoverPath = path.resolve(process.cwd(), 'src/features/jobs/components/discover-page.tsx');
const discoverContent = fs.readFileSync(discoverPath, 'utf8');
assert(discoverContent.includes('<EmptyState'), 'DiscoverPage integrates EmptyState');

const applicationsPath = path.resolve(process.cwd(), 'src/features/applications/components/applications-page.tsx');
const applicationsContent = fs.readFileSync(applicationsPath, 'utf8');
assert(applicationsContent.includes('<EmptyState'), 'ApplicationsPage integrates EmptyState');

const notificationsPath = path.resolve(process.cwd(), 'src/features/notifications/components/notifications-page.tsx');
const notificationsContent = fs.readFileSync(notificationsPath, 'utf8');
assert(notificationsContent.includes('<EmptyState'), 'NotificationsPage integrates EmptyState');

console.log('\n================================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Phase B Shared Component Primitives verified successfully!\n');
}

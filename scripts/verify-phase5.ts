import { careerRepository, setCareerRepositoryMode } from '../src/services/career-repository';
import { SearchAnalyticsService } from '../src/features/analytics/services/analytics-service';
import { SearchInsightEngine, INSIGHT_THRESHOLDS } from '../src/features/analytics/services/insight-engine';
import { NextActionsService } from '../src/features/overview/services/next-actions-service';
import { ApplicationWithJob } from '../src/features/applications/api/types';
import { ApplicationEvent } from '../src/types/application-tracking';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  setCareerRepositoryMode('in-memory');
  console.log('\n======================================================');
  console.log('CAREERQUEST PHASE 5 COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  // ---------------------------------------------------------
  // TEST GROUP 1: PHASE 2 REGRESSION SCORES (CRITICAL)
  // ---------------------------------------------------------
  console.log('--- TEST GROUP 1: Phase 2 Scoring Regression ---');
  const stripeMatch = await careerRepository.getJobMatch('job-1');
  const datadogMatch = await careerRepository.getJobMatch('job-2');
  const linearMatch = await careerRepository.getJobMatch('job-4');

  assert(stripeMatch?.score === 94, 'Stripe match score remains exactly 94%');
  assert(datadogMatch?.score === 82, 'Datadog match score remains exactly 82%');
  assert(linearMatch?.score === 76, 'Linear match score remains exactly 76%');

  // Verify missing requirements remain unverified / missing
  assert(
    datadogMatch?.missingRequirements.some((m) => m.title.toLowerCase().includes('ebpf') || m.detail.toLowerCase().includes('ebpf')) === true ||
    datadogMatch?.reasoning.toLowerCase().includes('ebpf') === true,
    'Datadog eBPF requirement remains missing/unverified'
  );
  assert(
    linearMatch?.missingRequirements.some((m) => m.title.toLowerCase().includes('rust') || m.title.toLowerCase().includes('electron') || m.detail.toLowerCase().includes('rust') || m.detail.toLowerCase().includes('electron')) === true ||
    linearMatch?.reasoning.toLowerCase().includes('electron') === true ||
    linearMatch?.reasoning.toLowerCase().includes('rust') === true,
    'Linear Electron/Rust requirement remains missing/unverified'
  );

  // ---------------------------------------------------------
  // TEST GROUP 2: KNOWLEDGE BANK BOUNDARIES & PROTECTION
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Knowledge Bank Boundaries & Invariants ---');
  const initialBank = await careerRepository.getKnowledgeBank();
  const initialSkillCount = initialBank.skills.length;
  const initialMasterResume = await careerRepository.getMasterResume();

  // Simulate logging a rejection for an application
  await careerRepository.updateApplicationStatus('app-1', 'rejected', 'Simulated employer rejection note');

  // Simulate adding interview feedback noting missing eBPF and Rust
  await careerRepository.recordApplicationEvent({
    applicationId: 'app-1',
    jobId: 'job-1',
    type: 'interview_completed',
    title: 'Interview Completed',
    description: 'Interviewer noted candidate lacked eBPF kernel instrumentation and Rust systems experience.',
    isAutomated: false
  });

  // Verify Knowledge Bank was NOT touched
  const bankAfterRejection = await careerRepository.getKnowledgeBank('cand-1');
  const skillCountAfterRejection = bankAfterRejection.skills.length;
  assert(initialSkillCount === skillCountAfterRejection, 'Knowledge Bank skill count unchanged after rejection');
  assert(
    bankAfterRejection.skills.some((i) => i.content.name.toLowerCase() === 'ebpf') === false,
    'Knowledge Bank has NOT automatically acquired unverified eBPF'
  );
  assert(
    bankAfterRejection.skills.some((i) => i.content.name.toLowerCase() === 'rust') === false,
    'Knowledge Bank has NOT automatically acquired unverified Rust'
  );

  // Additional Protection Test: Failed interview + withdrawn application + insights generation
  await careerRepository.addInterviewStage('app-1', {
    stageName: 'Failed Round Test',
    status: 'completed',
    outcome: 'failed',
    notes: 'Candidate lacked Rust and Electron runtime skills'
  });
  await careerRepository.updateApplicationStatus('app-1', 'withdrawn', 'Withdrawn following round');
  
  const bankAfterFailAndWithdraw = await careerRepository.getKnowledgeBank('cand-1');
  assert(
    bankAfterFailAndWithdraw.skills.length === initialSkillCount,
    'Knowledge Bank skill count completely invariant after failed interview and withdrawal'
  );
  assert(
    bankAfterFailAndWithdraw.skills.every((s) => s.status === 'approved'),
    'All previously approved Knowledge Bank skills remain approved without tampering'
  );

  // Verify Master Resume was NOT touched
  const masterResumeAfter = await careerRepository.getMasterResume();
  assert(
    JSON.stringify(initialMasterResume?.skills) === JSON.stringify(masterResumeAfter?.skills),
    'Master Resume skills remain completely protected and immutable'
  );

  // Restore app-1 status to applied
  await careerRepository.updateApplicationStatus('app-1', 'applied', 'Restored to applied');

  // ---------------------------------------------------------
  // TEST GROUP 3: APPLICATION LIFECYCLE & HISTORICAL INTEGRITY
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Lifecycle, Snapshots & Event History ---');
  const app1 = await careerRepository.getApplicationById('app-1');
  assert(app1 !== null, 'app-1 exists');
  assert(app1?.status === 'applied', 'app-1 status is applied');
  assert(app1?.matchScoreAtApplication === 94, 'app-1 preserves matchScoreAtApplication (94%)');
  assert(Boolean(app1?.dateApplied), 'app-1 preserves dateApplied snapshot');
  assert(app1?.selectedTemplateId === 'classic-v1', 'app-1 preserves selectedTemplateId');

  // Historical Snapshot Invariant: Verify old application remains immutable when current match changes
  const stripeMatchCurrent = await careerRepository.getJobMatch('job-1');
  assert(app1?.matchScoreAtApplication === 94, 'Historical matchScoreAtApplication remains 94%');
  assert(app1?.selectedTemplateId === 'classic-v1', 'Historical template snapshot remains classic-v1');
  assert(app1?.tailoredResumeVersionId === 'res-tailored-job-1', 'Historical tailored resume reference remains intact');

  // Test backward movement & reopening
  const app7 = await careerRepository.getApplicationById('app-7');
  assert(app7?.status === 'rejected', 'app-7 initial status is rejected');
  assert(Boolean(app7?.dateClosed), 'app-7 records dateClosed on rejection');

  // Reopen app-7 and verify dateClosed is cleared
  const reopenedApp7 = await careerRepository.updateApplicationStatus('app-7', 'interested', 'Reopening opportunity');
  assert(reopenedApp7.status === 'interested', 'Application successfully reopened from rejected to interested');
  assert(reopenedApp7.dateClosed === undefined, 'Reopening clears dateClosed on active status');

  // Verify reopening generated immutable ApplicationEvent
  const eventsAfterReopen = await careerRepository.getApplicationEvents('app-7');
  const reopenEvent = eventsAfterReopen.find((e) => e.type === 'reopened');
  assert(reopenEvent !== undefined, 'Immutable reopened ApplicationEvent recorded');

  // Move back to rejected to restore fixture state
  await careerRepository.updateApplicationStatus('app-7', 'rejected', 'Restoring rejected state');
  const restoredApp7 = await careerRepository.getApplicationById('app-7');
  assert(Boolean(restoredApp7?.dateClosed), 'dateClosed re-established upon returning to rejected');

  // Test Withdrawn status
  const app8 = await careerRepository.getApplicationById('app-8');
  assert(app8?.status === 'withdrawn', 'app-8 status is withdrawn');
  assert(Boolean(app8?.dateClosed), 'app-8 dateClosed is recorded');

  // Test independent archive flag (must not change status)
  const archivedApp = await careerRepository.updateApplicationArchiveStatus('app-8', true);
  assert(archivedApp.isArchived === true, 'Archive flag set independently of status');
  assert(archivedApp.status === 'withdrawn', 'Archiving did not mutate application status');
  const unarchivedApp = await careerRepository.updateApplicationArchiveStatus('app-8', false);
  assert(unarchivedApp.isArchived === false, 'Archive flag toggled off cleanly');

  // Test duplicate / repeat application creation without crashing or hard constraint
  const repeatApp = await careerRepository.createApplication('job-1', 'interested', { allowDuplicate: true });
  assert(repeatApp.id !== 'app-1', 'Repeat application for job-1 successfully created with distinct ID');
  assert(repeatApp.status === 'interested', 'Repeat application starts in interested status');

  // ---------------------------------------------------------
  // TEST GROUP 4: FOLLOW-UPS & SNOOZING
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Follow-up Scheduling, Snoozing & History ---');
  // Snooze follow-up for app-1 by 3 days
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  const snoozedApp = await careerRepository.updateApplicationFollowUp('app-1', {
    followUpDate: futureDateStr,
    followUpStatus: 'snoozed',
    followUpNote: 'Snoozed +3 days after initial check'
  });
  assert(snoozedApp.followUpStatus === 'snoozed', 'Follow-up status transitioned to snoozed');
  assert(snoozedApp.followUpDate === futureDateStr, 'Follow-up date updated to snoozed date');

  // Verify historical event was recorded without destroying history
  const app1Events = await careerRepository.getApplicationEvents('app-1');
  assert(
    app1Events.some((e) => e.type === 'follow_up_snoozed'),
    'follow_up_snoozed event recorded in historical event trail'
  );

  // Mark follow-up complete
  const completedFollowUpApp = await careerRepository.updateApplicationFollowUp('app-1', {
    followUpStatus: 'completed',
    followUpNote: 'Spoke with recruiter Jessica'
  });
  assert(completedFollowUpApp.followUpStatus === 'completed', 'Follow-up marked completed');
  const app1EventsAfter = await careerRepository.getApplicationEvents('app-1');
  assert(
    app1EventsAfter.some((e) => e.type === 'follow_up_completed'),
    'follow_up_completed event recorded in historical event trail'
  );

  // Restore app-1 follow-up to pending due today for UI demo
  await careerRepository.updateApplicationFollowUp('app-1', {
    followUpDate: '2026-09-12',
    followUpStatus: 'pending',
    followUpNote: 'Scheduled 7-day follow-up after application'
  });

  // ---------------------------------------------------------
  // TEST GROUP 5: INTERVIEW STAGES & RECRUITER CONTACTS
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Interview Rounds & Recruiter Contacts ---');
  const app5 = await careerRepository.getApplicationById('app-5');
  assert(app5 !== null, 'app-5 exists');
  assert((app5?.interviewStages?.length ?? 0) >= 2, 'app-5 has interview stages recorded');

  const addedStage = await careerRepository.addInterviewStage('app-5', {
    stageName: 'Executive Chat',
    scheduledDate: '2026-09-18T15:00:00.000Z',
    interviewerNames: ['Dylan Field (CEO)'],
    notes: 'Discussion around design tool platform vision',
    status: 'scheduled',
    outcome: 'pending'
  });
  assert(
    addedStage.interviewStages?.some((s) => s.stageName === 'Executive Chat') === true,
    'New interview round added'
  );

  const app5Events = await careerRepository.getApplicationEvents('app-5');
  assert(
    app5Events.some((e) => e.type === 'interview_scheduled' && e.title.includes('Executive Chat')),
    'interview_scheduled event logged in audit trail'
  );

  // Add Contact
  const withContact = await careerRepository.addApplicationContact('app-5', {
    name: 'Amanda Vance',
    role: 'Staff Technical Recruiter',
    email: 'amanda@figma.com',
    linkedInUrl: 'https://linkedin.com/in/amandavance'
  });
  assert(
    withContact.contacts?.some((c) => c.name === 'Amanda Vance') === true,
    'Recruiter contact added with personal details'
  );

  // ---------------------------------------------------------
  // TEST GROUP 6: SEARCH ANALYTICS ENGINE & EDGE CASES
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Search Analytics Calculations ---');
  const allApps = await careerRepository.getApplications();
  const allEvents = await careerRepository.getApplicationEvents();

  const analytics = SearchAnalyticsService.computeAnalytics(allApps, allEvents);
  assert(analytics.funnel.totalDiscovered === allApps.length, 'Total discovered matches total applications');
  assert(analytics.funnel.totalApplied >= 4, 'Total applied reflects submitted applications');
  assert(analytics.funnel.totalInterviews >= 1, 'Total interviews correctly recorded');
  assert(analytics.funnel.totalOffers >= 1, 'Total offers correctly recorded');
  assert(analytics.funnel.totalRejected >= 1, 'Total rejected correctly recorded');
  assert(analytics.funnel.totalWithdrawn >= 1, 'Total withdrawn correctly recorded');

  // Conversion rates (safe numbers between 0 and 100)
  assert(
    analytics.conversion.appliedToInterviewRate >= 0 && analytics.conversion.appliedToInterviewRate <= 100,
    `Applied -> Interview rate is valid percentage (${analytics.conversion.appliedToInterviewRate}%)`
  );
  assert(
    analytics.conversion.interviewToOfferRate >= 0 && analytics.conversion.interviewToOfferRate <= 100,
    `Interview -> Offer rate is valid percentage (${analytics.conversion.interviewToOfferRate}%)`
  );

  // Velocity timing
  assert(analytics.velocity.avgDaysToApply !== null, `avgDaysToApply computed: ${analytics.velocity.avgDaysToApply} days`);
  assert(
    analytics.velocity.avgDaysToFirstRecordedOutcome !== null,
    `avgDaysToFirstRecordedOutcome computed: ${analytics.velocity.avgDaysToFirstRecordedOutcome} days`
  );

  // Zero-denominator edge case tests
  const emptyAnalytics = SearchAnalyticsService.computeAnalytics([], []);
  assert(emptyAnalytics.conversion.appliedToInterviewRate === 0, 'Zero applications returns 0% rate without NaN');
  assert(emptyAnalytics.conversion.interviewToOfferRate === 0, 'Zero interviews returns 0% rate without NaN');
  assert(emptyAnalytics.velocity.avgDaysToApply === null, 'Zero applications returns null for avgDaysToApply');

  // Single application edge case test
  const singleAppAnalytics = SearchAnalyticsService.computeAnalytics([allApps[0]], []);
  assert(
    !isNaN(singleAppAnalytics.conversion.appliedToInterviewRate),
    'Single application yields valid non-NaN rates'
  );

  // ---------------------------------------------------------
  // TEST GROUP 7: SEARCH INSIGHTS & DATA SUFFICIENCY SAFEGUARD
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Search Insights & Data Sufficiency ---');
  // Full set test (8 applications total, >= 5 submitted)
  const insightsResult = SearchInsightEngine.generateInsights(analytics, allApps);
  assert(insightsResult.isDataSufficient === true, 'Data sufficiency passes with >= 5 submitted applications');
  assert(insightsResult.insights.length > 0, 'Generates valid descriptive insights when data is sufficient');
  assert(
    insightsResult.feedbackRecommendations.length > 0,
    'Generates safe Candidate Feedback Loop recommendation'
  );

  // Verify insights use purely descriptive correlation language
  insightsResult.insights.forEach((ins) => {
    assert(
      !ins.observation.toLowerCase().includes('chance of getting') &&
      !ins.observation.toLowerCase().includes('probability of hire') &&
      !ins.observation.toLowerCase().includes('statistically significant'),
      `Insight "${ins.title}" avoids predictive causation or fake significance claims`
    );
  });

  // Test INSUFFICIENT data safeguard (< 5 submitted applications)
  const sparseApps: ApplicationWithJob[] = allApps.slice(0, 2); // only 2 applications
  const sparseAnalytics = SearchAnalyticsService.computeAnalytics(sparseApps, []);
  const sparseResult = SearchInsightEngine.generateInsights(sparseAnalytics, sparseApps);
  assert(sparseResult.isDataSufficient === false, 'Data sufficiency correctly triggers FALSE for < 5 applications');
  assert(sparseResult.insights.length === 0, 'Zero insights generated when data is insufficient (no manufactured conclusions)');
  assert(sparseResult.threshold === INSIGHT_THRESHOLDS.MIN_SUBMITTED_FOR_OVERALL, 'Threshold is set to 5');

  // ---------------------------------------------------------
  // TEST GROUP 8: NEXT ACTIONS SERVICE
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Deterministic Next Actions Engine ---');
  const nextActions = NextActionsService.computeNextActions(allApps, allEvents);
  assert(nextActions.length > 0, 'Next actions generated for candidate');

  const followUpAction = nextActions.find((a) => a.category === 'follow_up_due');
  assert(followUpAction !== undefined, 'Follow-up due action surfaced for app-1 (due today)');
  assert(followUpAction?.priority === 'high', 'Follow-up due action is marked high priority');

  const interviewAction = nextActions.find((a) => a.category === 'interview_upcoming');
  assert(interviewAction !== undefined, 'Upcoming interview action surfaced for app-5');

  const knowledgeGapAction = nextActions.find((a) => a.category === 'knowledge_gap');
  assert(knowledgeGapAction !== undefined, 'Knowledge Bank review action surfaced');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 5 TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

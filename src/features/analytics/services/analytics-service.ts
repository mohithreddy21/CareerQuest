import { ApplicationWithJob } from '@/features/applications/api/types';
import {
  ApplicationEvent,
  ConversionRates,
  FunnelMetrics,
  SearchAnalytics,
  SegmentedBreakdownItem,
  VelocityMetrics
} from '@/types/application-tracking';
import { ResumeTemplateId } from '@/types/templates';

export const SearchAnalyticsService = {
  computeAnalytics(
    applications: ApplicationWithJob[],
    events: ApplicationEvent[] = []
  ): SearchAnalytics {
    // 1. Funnel Metrics (Unique application counts)
    const submittedApps = applications.filter(
      (a) =>
        Boolean(a.dateApplied) || ['applied', 'interview', 'offer', 'rejected'].includes(a.status)
    );

    const interviewedApps = applications.filter(
      (a) =>
        a.status === 'interview' ||
        a.status === 'offer' ||
        (a.interviewStages && a.interviewStages.length > 0) ||
        a.statusHistory.some((h) => h.status === 'interview')
    );

    const offeredApps = applications.filter(
      (a) => a.status === 'offer' || a.statusHistory.some((h) => h.status === 'offer')
    );

    const rejectedApps = applications.filter((a) => a.status === 'rejected');
    const withdrawnApps = applications.filter((a) => a.status === 'withdrawn');

    const funnel: FunnelMetrics = {
      totalDiscovered: applications.length,
      totalSaved: applications.filter((a) => a.status === 'interested' || a.status === 'preparing')
        .length,
      totalApplied: submittedApps.length,
      totalInterviews: interviewedApps.length,
      totalOffers: offeredApps.length,
      totalRejected: rejectedApps.length,
      totalWithdrawn: withdrawnApps.length
    };

    // 2. Conversion Rates (Safe Zero-Denominator Handling)
    const appliedToInterviewRate =
      funnel.totalApplied > 0
        ? Math.round((funnel.totalInterviews / funnel.totalApplied) * 100)
        : 0;

    const interviewToOfferRate =
      funnel.totalInterviews > 0
        ? Math.round((funnel.totalOffers / funnel.totalInterviews) * 100)
        : 0;

    const appliedToOfferRate =
      funnel.totalApplied > 0 ? Math.round((funnel.totalOffers / funnel.totalApplied) * 100) : 0;

    const conversion: ConversionRates = {
      appliedToInterviewRate,
      interviewToOfferRate,
      appliedToOfferRate
    };

    // 3. Velocity Metrics (Using Events and Status History)
    let totalApplyDays = 0;
    let applyDaysCount = 0;

    for (const app of submittedApps) {
      if (app.dateDiscovered && app.dateApplied) {
        const discDate = new Date(app.dateDiscovered).getTime();
        const appDate = new Date(app.dateApplied).getTime();
        const diff = (appDate - discDate) / (1000 * 60 * 60 * 24);
        if (diff >= 0 && diff < 365) {
          totalApplyDays += diff;
          applyDaysCount++;
        }
      }
    }

    const avgDaysToApply =
      applyDaysCount > 0 ? Number((totalApplyDays / applyDaysCount).toFixed(1)) : null;

    let totalOutcomeDays = 0;
    let outcomeDaysCount = 0;

    for (const app of submittedApps) {
      if (!app.dateApplied) continue;
      const appAppliedTime = new Date(app.dateApplied).getTime();

      // Look for first outcome event (interview, rejection, or offer)
      const appEvents = events.filter((e) => e.applicationId === app.id);
      const outcomeEvents = appEvents.filter((e) =>
        ['interview_scheduled', 'rejection_logged', 'offer_received'].includes(e.type)
      );

      if (outcomeEvents.length > 0) {
        // Find earliest outcome event
        const earliestEvent = outcomeEvents.reduce((earliest, cur) =>
          new Date(cur.timestamp).getTime() < new Date(earliest.timestamp).getTime()
            ? cur
            : earliest
        );
        const outcomeTime = new Date(earliestEvent.timestamp).getTime();
        const diff = (outcomeTime - appAppliedTime) / (1000 * 60 * 60 * 24);
        if (diff >= 0 && diff < 365) {
          totalOutcomeDays += diff;
          outcomeDaysCount++;
        }
      } else if (app.dateClosed) {
        const closedTime = new Date(app.dateClosed).getTime();
        const diff = (closedTime - appAppliedTime) / (1000 * 60 * 60 * 24);
        if (diff >= 0 && diff < 365) {
          totalOutcomeDays += diff;
          outcomeDaysCount++;
        }
      }
    }

    const avgDaysToFirstRecordedOutcome =
      outcomeDaysCount > 0 ? Number((totalOutcomeDays / outcomeDaysCount).toFixed(1)) : null;

    const velocity: VelocityMetrics = {
      avgDaysToApply,
      avgDaysToFirstRecordedOutcome
    };

    // 4. Breakdown by Role Category
    const roleMap = new Map<string, { total: number; interviews: number; offers: number }>();
    applications.forEach((app) => {
      let role = 'Software Engineering';
      const titleLower = app.job.title.toLowerCase();
      if (titleLower.includes('frontend')) role = 'Frontend Engineering';
      else if (titleLower.includes('full-stack') || titleLower.includes('full stack'))
        role = 'Full-Stack Engineering';
      else if (titleLower.includes('platform') || titleLower.includes('infra'))
        role = 'Platform & Infrastructure';
      else if (titleLower.includes('product') || titleLower.includes('designer'))
        role = 'Product & Design';

      const cur = roleMap.get(role) || { total: 0, interviews: 0, offers: 0 };
      cur.total++;
      if (
        app.status === 'interview' ||
        app.status === 'offer' ||
        (app.interviewStages && app.interviewStages.length > 0)
      ) {
        cur.interviews++;
      }
      if (app.status === 'offer') {
        cur.offers++;
      }
      roleMap.set(role, cur);
    });

    const byRole: SegmentedBreakdownItem[] = Array.from(roleMap.entries()).map(([name, data]) => ({
      name,
      totalApplications: data.total,
      interviews: data.interviews,
      offers: data.offers,
      responseRate: data.total > 0 ? Math.round((data.interviews / data.total) * 100) : 0
    }));

    // 5. Breakdown by Source
    const sourceMap = new Map<string, { total: number; interviews: number; offers: number }>();
    applications.forEach((app) => {
      const src = (app.job.source || 'other').toLowerCase();
      const cur = sourceMap.get(src) || { total: 0, interviews: 0, offers: 0 };
      cur.total++;
      if (
        app.status === 'interview' ||
        app.status === 'offer' ||
        (app.interviewStages && app.interviewStages.length > 0)
      ) {
        cur.interviews++;
      }
      if (app.status === 'offer') cur.offers++;
      sourceMap.set(src, cur);
    });

    const bySource: SegmentedBreakdownItem[] = Array.from(sourceMap.entries()).map(
      ([name, data]) => ({
        name: name.toUpperCase(),
        totalApplications: data.total,
        interviews: data.interviews,
        offers: data.offers,
        responseRate: data.total > 0 ? Math.round((data.interviews / data.total) * 100) : 0
      })
    );

    // 6. Breakdown by Match Score Range
    const scoreBuckets = [
      { name: '90%+ Match', min: 90, max: 100, total: 0, interviews: 0, offers: 0 },
      { name: '80% - 89% Match', min: 80, max: 89, total: 0, interviews: 0, offers: 0 },
      { name: '70% - 79% Match', min: 70, max: 79, total: 0, interviews: 0, offers: 0 },
      { name: 'Below 70% Match', min: 0, max: 69, total: 0, interviews: 0, offers: 0 }
    ];

    applications.forEach((app) => {
      // Use matchScoreAtApplication if present, otherwise default to 80
      const score = app.matchScoreAtApplication ?? 80;
      const bucket = scoreBuckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) {
        bucket.total++;
        if (
          app.status === 'interview' ||
          app.status === 'offer' ||
          (app.interviewStages && app.interviewStages.length > 0)
        ) {
          bucket.interviews++;
        }
        if (app.status === 'offer') bucket.offers++;
      }
    });

    const byMatchScoreRange: SegmentedBreakdownItem[] = scoreBuckets.map((b) => ({
      name: b.name,
      totalApplications: b.total,
      interviews: b.interviews,
      offers: b.offers,
      responseRate: b.total > 0 ? Math.round((b.interviews / b.total) * 100) : 0
    }));

    // 7. Breakdown by Template Usage
    const templateNames: Record<ResumeTemplateId | string, string> = {
      'classic-v1': 'Classic Serif',
      'modern-v1': 'Modern Executive',
      'compact-v1': 'Compact Technical'
    };

    const templateMap = new Map<string, { total: number; interviews: number }>();
    applications.forEach((app) => {
      const tmpl = app.selectedTemplateId || 'classic-v1';
      const cur = templateMap.get(tmpl) || { total: 0, interviews: 0 };
      cur.total++;
      if (
        app.status === 'interview' ||
        app.status === 'offer' ||
        (app.interviewStages && app.interviewStages.length > 0)
      ) {
        cur.interviews++;
      }
      templateMap.set(tmpl, cur);
    });

    const byTemplate = Array.from(templateMap.entries()).map(([tmplId, data]) => ({
      templateId: tmplId,
      templateName: templateNames[tmplId] || tmplId,
      totalApplications: data.total,
      interviews: data.interviews
    }));

    return {
      funnel,
      conversion,
      velocity,
      byRole,
      bySource,
      byMatchScoreRange,
      byTemplate
    };
  }
};

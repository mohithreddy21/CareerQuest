import { ApplicationWithJob } from '@/features/applications/api/types';
import { SearchAnalytics, SearchInsight } from '@/types/application-tracking';

export const INSIGHT_THRESHOLDS = {
  MIN_SUBMITTED_FOR_OVERALL: 5,
  MIN_SEGMENT_APPLICATIONS: 3
};

export interface InsightEngineResult {
  isDataSufficient: boolean;
  submittedCount: number;
  threshold: number;
  insights: SearchInsight[];
  feedbackRecommendations: Array<{
    id: string;
    title: string;
    observation: string;
    recommendation: string;
    actionUrl: string;
    actionLabel: string;
  }>;
}

export const SearchInsightEngine = {
  generateInsights(
    analytics: SearchAnalytics,
    applications: ApplicationWithJob[]
  ): InsightEngineResult {
    const submittedCount = analytics.funnel.totalApplied;
    const isDataSufficient = submittedCount >= INSIGHT_THRESHOLDS.MIN_SUBMITTED_FOR_OVERALL;

    const insights: SearchInsight[] = [];
    const feedbackRecommendations: InsightEngineResult['feedbackRecommendations'] = [];

    // Feedback Loop Recommendation (Always explainable and safe; never mutates Knowledge Bank)
    feedbackRecommendations.push({
      id: 'fb-systems-observability',
      title: 'Target Requirement Alignment: Systems & Observability',
      observation:
        'Target engineering opportunities at Datadog and Linear list systems requirements (such as eBPF or Rust) where your Knowledge Bank currently contains no approved evidence.',
      recommendation:
        'If you have verified experience in these technologies, add evidence to your Candidate Knowledge Bank. CareerQuest never automatically adds, assumes, or approves skills.',
      actionUrl: '/dashboard/resume',
      actionLabel: 'Review Knowledge Bank'
    });

    if (!isDataSufficient) {
      return {
        isDataSufficient: false,
        submittedCount,
        threshold: INSIGHT_THRESHOLDS.MIN_SUBMITTED_FOR_OVERALL,
        insights: [],
        feedbackRecommendations
      };
    }

    // 1. Match Score Observation (Descriptive correlation only — never predictive odds)
    const highMatchSegment = analytics.byMatchScoreRange.find(
      (s) => s.name.includes('90%') || s.name.includes('80%')
    );
    if (
      highMatchSegment &&
      highMatchSegment.totalApplications >= INSIGHT_THRESHOLDS.MIN_SEGMENT_APPLICATIONS
    ) {
      insights.push({
        id: 'ins-match-score',
        category: 'match_score',
        title: 'High-Alignment Application Progress',
        observation: `Historical observation: ${highMatchSegment.interviews} of ${highMatchSegment.totalApplications} applications with match scores above 80% reached an interview.`,
        recommendation:
          'Focusing application effort on roles with >= 80% verified qualification alignment historically correlates with higher interview progress.',
        dataBasis: `Based on ${highMatchSegment.totalApplications} applications with match score >= 80% (Product benchmark, not statistical proof).`,
        confidence: 'moderate',
        actionUrl: '/dashboard/discover',
        actionLabel: 'Discover Matched Roles'
      });
    }

    // 2. Pipeline Velocity & Balance
    const activeInFlight =
      analytics.funnel.totalSaved +
      applications.filter((a) => a.status === 'applied' || a.status === 'interview').length;

    insights.push({
      id: 'ins-pipeline-balance',
      category: 'pipeline_balance',
      title: 'Pipeline Capacity & Focus',
      observation: `You currently maintain ${activeInFlight} active opportunities across saved, preparing, applied, and interview stages.`,
      recommendation:
        'Maintaining 3 to 6 active, highly-tailored applications delivers better conversion than broad untargeted volume.',
      dataBasis: `Derived from your ${analytics.funnel.totalDiscovered} total tracked opportunities.`,
      confidence: 'strong',
      actionUrl: '/dashboard/applications',
      actionLabel: 'View Active Pipeline'
    });

    // 3. Source Performance Observation
    const topSource = analytics.bySource.find(
      (s) => s.totalApplications >= INSIGHT_THRESHOLDS.MIN_SEGMENT_APPLICATIONS
    );
    if (topSource) {
      insights.push({
        id: 'ins-source',
        category: 'source',
        title: `Channel Activity: ${topSource.name}`,
        observation: `Historical observation: ${topSource.interviews} of ${topSource.totalApplications} applications submitted via ${topSource.name} progressed to an interview.`,
        recommendation:
          'Track which channels yield active hiring manager responses and prioritize those sources for new discovery.',
        dataBasis: `Based on ${topSource.totalApplications} opportunities sourced through ${topSource.name}.`,
        confidence: 'moderate'
      });
    }

    // 4. Resume Template Usage
    if (analytics.byTemplate.length > 0) {
      const topTemplate = analytics.byTemplate[0];
      insights.push({
        id: 'ins-template',
        category: 'template',
        title: `Presentation Template: ${topTemplate.templateName}`,
        observation: `${topTemplate.totalApplications} applications utilized the ${topTemplate.templateName} layout (${topTemplate.interviews} reached interview).`,
        recommendation:
          'Standard single-column formats ensure ATS compatibility while preserving clean typographical hierarchy.',
        dataBasis: `Descriptive historical count across ${topTemplate.totalApplications} prepared applications.`,
        confidence: 'preliminary'
      });
    }

    return {
      isDataSufficient: true,
      submittedCount,
      threshold: INSIGHT_THRESHOLDS.MIN_SUBMITTED_FOR_OVERALL,
      insights,
      feedbackRecommendations
    };
  }
};

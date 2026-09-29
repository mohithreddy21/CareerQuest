import { careerRepository } from '@/services/career-repository';
import {
  Job,
  JobAnalysis,
  JobMatch,
  SavedSearch,
  SavedSearchExecutionResult
} from '@/types/domain';
import { isSourceUsable } from '../lib/dedup/source-intelligence';
import { RankedOpportunity } from '../lib/ranking';
import { opportunityPriorityService } from './opportunity-priority-service';

export interface JobFilterEvaluationOptions {
  evaluatedAt: Date;
  postedWithinDays?: number | null;
}

export function matchesSavedSearchFilters(
  job: Job,
  savedSearch: SavedSearch,
  options: {
    match?: JobMatch | null;
    analysis?: JobAnalysis | null;
    evaluatedAt: Date;
    postedWithinDays?: number | null;
  }
): boolean {
  const { match, analysis, evaluatedAt, postedWithinDays } = options;

  // 1. Query / Keyword matching
  if (savedSearch.query && savedSearch.query.trim()) {
    const rawTerms = savedSearch.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchableText = [
      job.title,
      job.company,
      job.location,
      job.description,
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || [])
    ]
      .join(' ')
      .toLowerCase();

    const matchesAllTerms = rawTerms.every((term) => searchableText.includes(term));
    if (!matchesAllTerms) return false;
  }

  // 2. Locations filter
  if (savedSearch.locations && savedSearch.locations.length > 0) {
    const jobLoc = (job.location || '').toLowerCase();
    const matchesLocation = savedSearch.locations.some((loc) => {
      const l = loc.toLowerCase().trim();
      return jobLoc.includes(l) || l.includes(jobLoc);
    });
    if (!matchesLocation) return false;
  }

  // 3. Work arrangements filter
  if (savedSearch.workArrangements && savedSearch.workArrangements.length > 0) {
    const jobArr = (job.workArrangement || '').toLowerCase();
    const matchesArrangement = savedSearch.workArrangements.some(
      (arr) => arr.toLowerCase() === jobArr
    );
    if (!matchesArrangement) return false;
  }

  // 4. Role categories filter
  if (savedSearch.roleCategories && savedSearch.roleCategories.length > 0) {
    const roleCat = (analysis?.roleCategory || job.title || '').toLowerCase();
    const matchesRole = savedSearch.roleCategories.some((cat) => {
      const c = cat.toLowerCase().trim();
      return roleCat.includes(c) || c.includes(roleCat);
    });
    if (!matchesRole) return false;
  }

  // 5. Seniority levels filter
  if (savedSearch.seniorityLevels && savedSearch.seniorityLevels.length > 0) {
    const seniority = (analysis?.seniority || '').toLowerCase();
    const matchesSeniority = savedSearch.seniorityLevels.some(
      (lvl) => lvl.toLowerCase() === seniority
    );
    if (!matchesSeniority) return false;
  }

  // 6. Minimum Salary filter
  if (savedSearch.minSalary && savedSearch.minSalary > 0) {
    const maxSalary = job.salary?.max ?? job.salary?.min ?? 0;
    if (maxSalary < savedSearch.minSalary) return false;
  }

  // 7. Minimum Match Score filter
  if (
    savedSearch.minMatchScore !== undefined &&
    savedSearch.minMatchScore !== null &&
    savedSearch.minMatchScore > 0
  ) {
    const score = match?.score ?? 0;
    if (score < savedSearch.minMatchScore) return false;
  }

  // 8. Freshness / Posted Within Days filter
  if (postedWithinDays && postedWithinDays > 0) {
    if (job.postedDate) {
      const postedTime = new Date(job.postedDate).getTime();
      if (!Number.isNaN(postedTime)) {
        const ageMs = Math.max(0, evaluatedAt.getTime() - postedTime);
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > postedWithinDays) return false;
      }
    }
  }

  return true;
}

export class SavedSearchService {
  /**
   * Executes a SavedSearch against CareerQuest's normalized job catalog.
   *
   * Features:
   * - Strict candidate isolation (public jobs + candidate's private jobs only).
   * - Stable evaluatedAt snapshot across all candidate opportunity calculations.
   * - Opportunity Priority (50% match, 35% fit, 15% freshness) preserved.
   * - Deduplication check against durable SavedSearchAlert records.
   * - Updates lastExecutedAt and lastMatchCount on the SavedSearch definition.
   */
  async executeSavedSearch(
    savedSearchId: string,
    candidateId: string,
    options?: {
      evaluatedAt?: Date;
      isManual?: boolean;
      postedWithinDays?: number | null;
    }
  ): Promise<SavedSearchExecutionResult> {
    if (!candidateId) {
      throw new Error('candidateId is required to execute saved search');
    }

    const savedSearch = await careerRepository.getSavedSearchById(savedSearchId, candidateId);
    if (!savedSearch) {
      throw new Error(`Saved search ${savedSearchId} not found or access denied`);
    }

    // 1. Establish single evaluation timestamp snapshot
    const evaluatedAt = options?.evaluatedAt || new Date();

    // 2. Load candidate preferences and catalog
    const [preferences, allJobs, existingAlerts] = await Promise.all([
      careerRepository.getCandidatePreferences(candidateId),
      careerRepository.getJobs({}, candidateId),
      careerRepository.getSavedSearchAlerts(candidateId, savedSearchId)
    ]);

    const alertedJobIds = new Set(existingAlerts.map((a) => a.jobId));
    const matchingOpportunities: RankedOpportunity[] = [];

    // 3. Process candidate-scoped jobs
    for (const jobWithMatch of allJobs) {
      const job: Job = jobWithMatch;
      const match: JobMatch | null = jobWithMatch.match || null;

      // Source intelligence & Usability gate:
      // A job must be active and have at least one usable source if sources exist
      if (job.jobStatus && job.jobStatus !== 'active') {
        continue;
      }

      const sources = await careerRepository.getJobSourceReferences(job.id);
      if (sources.length > 0) {
        const hasUsableSource = sources.some((s) => isSourceUsable(s, evaluatedAt));
        if (!hasUsableSource) {
          continue;
        }
      }

      // Analysis for role & seniority matching
      const analysis = await careerRepository.getJobAnalysis(job.id);

      // Check SavedSearch filter criteria
      const isMatch = matchesSavedSearchFilters(job, savedSearch, {
        match,
        analysis,
        evaluatedAt,
        postedWithinDays: options?.postedWithinDays
      });

      if (!isMatch) {
        continue;
      }

      // Calculate deterministic Opportunity Priority with evaluatedAt snapshot
      const priorityResult = opportunityPriorityService.calculatePriority(job, candidateId, {
        match,
        preferences,
        sources,
        evaluatedAt
      });

      matchingOpportunities.push({
        job,
        priority: priorityResult,
        match,
        candidateState: null,
        applicationStatus: jobWithMatch.applicationStatus || null
      });
    }

    // 4. Deterministic sorting: Priority DESC -> postedDate DESC -> job.id ASC
    matchingOpportunities.sort((a, b) => {
      const pDiff = b.priority.priorityScore - a.priority.priorityScore;
      if (Math.abs(pDiff) > 1e-6) return pDiff;

      const dateA = a.job.postedDate ? new Date(a.job.postedDate).getTime() : 0;
      const dateB = b.job.postedDate ? new Date(b.job.postedDate).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      return a.job.id.localeCompare(b.job.id);
    });

    // 5. New Match Detection (Jobs not previously alerted for this candidate + savedSearch)
    const newOpportunities = matchingOpportunities.filter((o) => !alertedJobIds.has(o.job.id));

    // 6. Update SavedSearch execution metadata
    const updatedSearch = await careerRepository.saveSavedSearch(
      {
        ...savedSearch,
        lastExecutedAt: evaluatedAt,
        lastMatchCount: matchingOpportunities.length
      },
      candidateId
    );

    return {
      savedSearchId,
      candidateId,
      executedAt: evaluatedAt.toISOString(),
      totalMatching: matchingOpportunities.length,
      newAlertCount: newOpportunities.length,
      matchingJobs: matchingOpportunities.map((o) => o.job),
      savedSearch: updatedSearch,
      evaluatedAt: evaluatedAt.toISOString(),
      totalMatchCount: matchingOpportunities.length,
      newMatchCount: newOpportunities.length,
      opportunities: matchingOpportunities,
      newOpportunities
    };
  }

  /**
   * Evaluates all enabled SavedSearches matching the given frequency (e.g. daily, weekly).
   * For each newly matching job, atomically creates a durable SavedSearchAlert and CandidateNotification.
   *
   * Note: This does NOT run a scheduler or cron. It is the callable domain service that
   * future infrastructure can invoke.
   */
  async generateSavedSearchAlerts(options?: {
    frequency?: 'daily' | 'weekly' | 'instant';
    candidateId?: string;
    evaluatedAt?: Date;
  }): Promise<{
    processedSearches: number;
    generatedAlerts: number;
    generatedNotifications: number;
  }> {
    const frequency = options?.frequency;
    const candidateId = options?.candidateId;
    const evaluatedAt = options?.evaluatedAt || new Date();

    const enabledSearches = await careerRepository.getEnabledSavedSearches(frequency, candidateId);

    let processedSearches = 0;
    let generatedAlerts = 0;
    let generatedNotifications = 0;

    for (const search of enabledSearches) {
      if (search.alertFrequency === 'never' || search.isEnabled === false) {
        continue;
      }

      processedSearches++;

      const execution = await this.executeSavedSearch(search.id, search.candidateId, {
        evaluatedAt
      });

      for (const newOpp of execution.newOpportunities || []) {
        const title = `New match: ${newOpp.job.title} at ${newOpp.job.company}`;
        const message = `A new opportunity matching your saved search "${search.name}" was found. Profile match score: ${newOpp.match?.score ?? 50}%.`;

        const result = await careerRepository.createSavedSearchAlertAndNotification({
          candidateId: search.candidateId,
          savedSearchId: search.id,
          jobId: newOpp.job.id,
          savedSearchVersion: search.filterVersion,
          notificationTitle: title,
          notificationMessage: message,
          generatedAt: evaluatedAt
        });

        if (result.isNew) {
          generatedAlerts++;
          if (result.notification) {
            generatedNotifications++;
          }
        }
      }
    }

    return {
      processedSearches,
      generatedAlerts,
      generatedNotifications
    };
  }

  /**
   * Ingestion Hook: Evaluates enabled INSTANT SavedSearches for a single newly created or updated Job.
   * Generates alerts and in-app notifications atomically for any matching searches.
   */
  async evaluateInstantAlertsForJob(
    jobId: string,
    options?: {
      candidateId?: string;
      evaluatedAt?: Date;
    }
  ): Promise<{
    evaluatedSearches: number;
    generatedAlerts: number;
  }> {
    const evaluatedAt = options?.evaluatedAt || new Date();
    const job = await careerRepository.getJobById(jobId, options?.candidateId);
    if (!job || (job.jobStatus && job.jobStatus !== 'active')) {
      return { evaluatedSearches: 0, generatedAlerts: 0 };
    }

    const sources = await careerRepository.getJobSourceReferences(job.id);
    if (sources.length > 0) {
      const hasUsableSource = sources.some((s) => isSourceUsable(s, evaluatedAt));
      if (!hasUsableSource) {
        return { evaluatedSearches: 0, generatedAlerts: 0 };
      }
    }

    // Retrieve all enabled searches with instant alert frequency
    const instantSearches = await careerRepository.getEnabledSavedSearches(
      'instant',
      options?.candidateId
    );

    let evaluatedSearches = 0;
    let generatedAlerts = 0;

    for (const search of instantSearches) {
      // Candidate visibility check:
      // If the job is private, it only matches searches created by the owner candidate
      if (!job.isPublic && job.importedByCandidateId !== search.candidateId) {
        continue;
      }

      evaluatedSearches++;

      const match = await careerRepository.getJobMatch(job.id, search.candidateId);
      const analysis = await careerRepository.getJobAnalysis(job.id);

      const isMatch = matchesSavedSearchFilters(job, search, {
        match,
        analysis,
        evaluatedAt
      });

      if (isMatch) {
        const title = `Instant alert: ${job.title} at ${job.company}`;
        const message = `A new opportunity matching your instant search "${search.name}" is now available. Match score: ${match?.score ?? 50}%.`;

        const result = await careerRepository.createSavedSearchAlertAndNotification({
          candidateId: search.candidateId,
          savedSearchId: search.id,
          jobId: job.id,
          savedSearchVersion: search.filterVersion,
          notificationTitle: title,
          notificationMessage: message,
          generatedAt: evaluatedAt
        });

        if (result.isNew) {
          generatedAlerts++;
        }
      }
    }

    return {
      evaluatedSearches,
      generatedAlerts
    };
  }
}

export const savedSearchService = new SavedSearchService();

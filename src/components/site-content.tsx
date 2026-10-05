import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ExternalLink, FileSpreadsheet, Info } from 'lucide-react';

import {
  ResponsiveCardDialog,
  ResponsiveCardDialogContent,
  ResponsiveCardDialogTrigger,
} from '@/components/ui/responsive-card-dialog';
import type { Locale } from '@/lib/i18n';
import { withBasePath } from '@/lib/site-paths';
import {
  formatChangelogDate,
  formatContributorDate,
  getContributorTargetSummaries,
  getChangelogEntries,
  getPublicContributorGroups,
  getRecommendations,
  type ContributorGroups,
  type ContributorProfile,
  type ContributorRecordView,
  type ContributorSummary,
  type ContributorTargetSummary,
  type Recommendation,
} from '@/lib/site-content';
import { getMessages } from '@/lib/translations';

export function Changelog({ locale, limit }: { locale: Locale; limit?: number }) {
  const messages = getMessages(locale).aboutPage;
  const entries = getChangelogEntries(locale);
  const visibleEntries =
    limit === undefined ? entries : entries.slice(0, Math.max(0, Math.floor(limit)));

  if (visibleEntries.length === 0) {
    return <p className="text-fd-muted-foreground">{messages.changelogEmpty}</p>;
  }

  return (
    <div className="not-prose">
      <ol className="space-y-8 border-l border-fd-border pl-6">
        {visibleEntries.map((entry) => (
          <li key={entry.date} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-6 top-1.5 size-2 -translate-x-1/2 rounded-full bg-fd-primary"
            />
            <time
              dateTime={entry.date}
              className="text-sm font-medium text-fd-muted-foreground"
            >
              {formatChangelogDate(entry.date, locale)}
            </time>
            <h3 className="mt-2 text-base font-semibold">{entry.title}</h3>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              {entry.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContributorCard({
  locale,
  entry,
  recordViews,
}: {
  locale: Locale;
  entry: ContributorSummary;
  recordViews: readonly ContributorRecordView[];
}) {
  const messages = getMessages(locale).aboutPage;

  return (
    <li className="h-full min-w-0">
      <ResponsiveCardDialog>
        <ResponsiveCardDialogTrigger
          ariaLabel={`${messages.openContributorDetails}: ${entry.profile.name}`}
        >
          <div className="p-5 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h4 className="text-base font-semibold tracking-tight">{entry.profile.name}</h4>
              <div className="flex items-center gap-2">
                <ContributorRoleBadge locale={locale} role={entry.profile.role} />
                <span
                  aria-hidden="true"
                  className="pointer-events-none relative z-20 flex size-7 items-center justify-center rounded-full border border-fd-border text-fd-muted-foreground"
                >
                  <Info className="size-4" />
                </span>
              </div>
            </div>
            <ContributorSummaryFields locale={locale} entry={entry} variant="card" />
          </div>
        </ResponsiveCardDialogTrigger>
        <ResponsiveCardDialogContent
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <span>{entry.profile.name}</span>
              <ContributorRoleBadge locale={locale} role={entry.profile.role} />
            </span>
          }
          closeLabel={messages.closeContributorDetails}
          className={entry.profile.role === 'owner' ? 'sm:max-w-2xl' : undefined}
        >
          <ContributorDialogBody locale={locale} entry={entry} recordViews={recordViews} />
        </ResponsiveCardDialogContent>
      </ResponsiveCardDialog>
    </li>
  );
}

export function ContributorDialogSummary({
  locale,
  entry,
}: {
  locale: Locale;
  entry: ContributorSummary;
}) {
  const messages = getMessages(locale).aboutPage;
  const ownerProfile = entry.profile.ownerProfile;

  return (
    <div
      className={entry.profile.role === 'owner' ? undefined : 'border-b border-fd-border pb-7'}
      data-contributor-summary="dialog"
    >
      {ownerProfile ? (
        <div className="space-y-7">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Image
              src={withBasePath(ownerProfile.avatarUrl)}
              alt={messages.ownerProfile.avatarAlt}
              width={256}
              height={256}
              className="size-32 shrink-0 rounded-full border border-fd-border object-cover"
            />
            <div className="w-full min-w-0 flex-1 sm:w-auto">
              <p className="text-sm leading-6 text-fd-muted-foreground">
                {messages.ownerProfile.introduction}
              </p>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="font-medium leading-6 text-fd-muted-foreground">
                    {messages.ownerProfile.contactLabel}
                  </dt>
                  <dd className="mt-1 leading-6 sm:mt-0">{messages.ownerProfile.contactText}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="font-medium leading-6 text-fd-muted-foreground">
                    {messages.ownerProfile.noteLabel}
                  </dt>
                  <dd className="mt-1 leading-6 sm:mt-0">{messages.ownerProfile.noteText}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="border-t border-fd-border pt-6">
            <ContributorSummaryFields locale={locale} entry={entry} variant="dialog" />
          </div>
        </div>
      ) : (
        <ContributorSummaryFields locale={locale} entry={entry} variant="dialog" />
      )}
    </div>
  );
}

export function ContributorDialogBody({
  locale,
  entry,
  recordViews,
}: {
  locale: Locale;
  entry: ContributorSummary;
  recordViews: readonly ContributorRecordView[];
}) {
  const contributorRecords = recordViews
    .filter(({ record }) => record.contributorId === entry.profile.id)
    .sort(
      (left, right) =>
        right.record.acceptedAt.localeCompare(left.record.acceptedAt) ||
        left.record.id.localeCompare(right.record.id),
    );

  return (
    <div className="space-y-7">
      <ContributorDialogSummary locale={locale} entry={entry} />
      {entry.profile.role === 'owner' ? null : (
        <ContributorDetail
          locale={locale}
          profile={entry.profile}
          records={contributorRecords}
          idPrefix={`contributor-${entry.profile.id}`}
        />
      )}
    </div>
  );
}

function ContributorRoleBadge({
  locale,
  role,
}: {
  locale: Locale;
  role: ContributorProfile['role'];
}) {
  const messages = getMessages(locale).aboutPage;

  return (
    <span className="rounded-full bg-fd-accent px-2.5 py-1 text-xs font-medium text-fd-accent-foreground">
      {messages.roleLabels[role]}
    </span>
  );
}

function ContributorSummaryFields({
  locale,
  entry,
  variant,
}: {
  locale: Locale;
  entry: ContributorSummary;
  variant: 'card' | 'dialog';
}) {
  const messages = getMessages(locale).aboutPage;
  const spacingClass = variant === 'card' ? 'mt-5' : 'mt-0';

  if (entry.profile.role === 'contributor') {
    return (
      <dl className={`${spacingClass} grid gap-4 sm:grid-cols-3`}>
        <div>
          <dt className="text-sm font-medium text-fd-muted-foreground">
            {messages.contributionTypesLabel}
          </dt>
          <dd className="mt-1 text-sm leading-6">
            {entry.categories.length > 0 ? (
              <ul aria-label={messages.contributionTypesLabel} className="m-0 list-none p-0">
                {entry.categories.map((category) => (
                  <li key={category}>{messages.categoryLabels[category]}</li>
                ))}
              </ul>
            ) : (
              messages.noContributionTypes
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fd-muted-foreground">
            {messages.acceptedContributionsLabel}
          </dt>
          <dd className="mt-1 text-lg font-semibold">{entry.acceptedCount}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fd-muted-foreground">
            {messages.latestContributionLabel}
          </dt>
          <dd className="mt-1 text-sm leading-6">
            {entry.latestContributionDate ? (
              <time dateTime={entry.latestContributionDate}>
                {formatContributorDate(entry.latestContributionDate, locale)}
              </time>
            ) : (
              messages.noContributionDate
            )}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <div className={spacingClass}>
      <h5 className="text-sm font-medium text-fd-muted-foreground">
        {messages.responsibilitiesLabel}
      </h5>
      {entry.profile.responsibilities.length > 0 ? (
        <ul
          aria-label={messages.responsibilitiesLabel}
          className="mt-2 m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {entry.profile.responsibilities.map((responsibility) => (
            <li key={responsibility} className="rounded-md border px-2.5 py-1 text-sm leading-5">
              {messages.responsibilityLabels[responsibility]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-fd-muted-foreground">{messages.noResponsibilities}</p>
      )}
    </div>
  );
}

function ContributorSection({
  locale,
  id,
  title,
  listLabel,
  emptyMessage,
  entries,
  recordViews,
}: {
  locale: Locale;
  id: string;
  title: string;
  listLabel: string;
  emptyMessage: string;
  entries: readonly ContributorSummary[];
  recordViews: readonly ContributorRecordView[];
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-4 text-fd-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul
          aria-label={listLabel}
          className="not-prose m-0 mt-5 grid list-none gap-4 p-0 sm:grid-cols-2"
        >
          {entries.map((entry) => (
            <ContributorCard
              key={entry.profile.id}
              locale={locale}
              entry={entry}
              recordViews={recordViews}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function Contributors({
  locale,
  groups = getPublicContributorGroups(),
  recordViews = [],
}: {
  locale: Locale;
  groups?: ContributorGroups;
  recordViews?: readonly ContributorRecordView[];
}) {
  const messages = getMessages(locale).aboutPage;
  const isPubliclyVisible = (profile: ContributorProfile) =>
    profile.publicVisibility === undefined
      ? profile.status === 'active'
      : profile.publicVisibility === 'public';
  const publicGroups: ContributorGroups = {
    coreMaintainers: groups.coreMaintainers.filter(
      ({ profile }) => isPubliclyVisible(profile),
    ),
    communityContributors: groups.communityContributors.filter(
      ({ profile }) => isPubliclyVisible(profile),
    ),
  };

  return (
    <div className="not-prose space-y-10" aria-label={messages.contributorsLabel}>
      <ContributorSection
        locale={locale}
        id="core-maintainers"
        title={messages.coreMaintainersTitle}
        listLabel={messages.coreMaintainersLabel}
        emptyMessage={messages.coreMaintainersEmpty}
        entries={publicGroups.coreMaintainers}
        recordViews={recordViews}
      />
      <ContributorSection
        locale={locale}
        id="community-contributors"
        title={messages.communityContributorsTitle}
        listLabel={messages.communityContributorsLabel}
        emptyMessage={messages.communityContributorsEmpty}
        entries={publicGroups.communityContributors}
        recordViews={recordViews}
      />
    </div>
  );
}

function ContributorTargetStats({
  locale,
  summaries,
  records,
  compact = false,
  headingId,
}: {
  locale: Locale;
  summaries: readonly ContributorTargetSummary[];
  records: readonly ContributorRecordView[];
  compact?: boolean;
  headingId: string;
}) {
  const messages = getMessages(locale).aboutPage;
  const targetsByPath = new Map(
    records.flatMap(({ target }) => (target ? [[target.contentPath, target] as const] : [])),
  );
  const visibleSummaries = summaries.flatMap((summary) => {
    const target = targetsByPath.get(summary.contentPath);
    return target ? [{ summary, target }] : [];
  });

  if (visibleSummaries.length === 0) return null;

  const Heading = compact ? 'h5' : 'h2';

  return (
    <section aria-labelledby={headingId} data-contributor-targets>
      <Heading
        id={headingId}
        className={compact ? 'text-base font-semibold tracking-tight' : 'text-xl font-semibold tracking-tight'}
      >
        {messages.contributionTargetStatsTitle}
      </Heading>
      <ul className="not-prose mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
        {visibleSummaries.map(({ summary, target }) => (
          <li key={summary.contentPath}>
            <Link
              href={target.href}
              className="group flex items-center justify-between gap-4 rounded-lg border bg-fd-card px-4 py-3 transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
            >
              <span className="min-w-0 break-words text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                {target.title}
              </span>
              <span className="shrink-0 text-sm text-fd-muted-foreground">
                {summary.count}{' '}
                {summary.count === 1
                  ? messages.contributionRecordLabel
                  : messages.contributionRecordsLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ContributorDetail({
  locale,
  profile,
  records,
  targetSummaries = getContributorTargetSummaries(records.map(({ record }) => record)),
  compact = false,
  idPrefix = 'contributor',
}: {
  locale: Locale;
  profile: ContributorProfile;
  records: readonly ContributorRecordView[];
  targetSummaries?: readonly ContributorTargetSummary[];
  compact?: boolean;
  idPrefix?: string;
}) {
  const messages = getMessages(locale).aboutPage;
  const targetHeadingId = `${idPrefix}-targets-heading`;
  const recordsHeadingId = `${idPrefix}-records-heading`;
  const Heading = compact ? 'h5' : 'h2';

  return (
    <div
      className={compact ? 'not-prose space-y-6' : 'not-prose space-y-10'}
      aria-label={`${profile.name} ${messages.contributionRecordsTitle}`}
      data-contributor-detail
    >
      <ContributorTargetStats
        locale={locale}
        summaries={targetSummaries}
        records={records}
        compact={compact}
        headingId={targetHeadingId}
      />
      <section aria-labelledby={recordsHeadingId}>
        <Heading
          id={recordsHeadingId}
          className={compact ? 'text-base font-semibold tracking-tight' : 'text-xl font-semibold tracking-tight'}
        >
          {messages.contributionRecordsTitle}
        </Heading>
        {records.length === 0 ? (
          <p className={compact ? 'mt-3 text-sm text-fd-muted-foreground' : 'mt-4 text-fd-muted-foreground'}>
            {messages.contributionRecordsEmpty}
          </p>
        ) : (
          <ol className={compact ? 'mt-3 space-y-3 p-0' : 'mt-4 space-y-3 p-0'}>
            {records.map(({ record, target }) => (
              <li
                key={record.id}
                className={`list-none rounded-xl border bg-fd-card ${compact ? 'p-4' : 'p-5'}`}
              >
                <article>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fd-muted-foreground">
                    <time dateTime={record.acceptedAt}>
                      {messages.contributionDateLabel}：
                      {formatContributorDate(record.acceptedAt, locale)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>
                      {messages.contributionCategoryLabel}：
                      {messages.categoryLabels[record.category]}
                    </span>
                  </div>
                  {target ? (
                    <Link
                      href={target.href}
                      className="mt-3 inline-flex max-w-full items-center gap-2 break-words text-sm font-semibold text-fd-foreground hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
                    >
                      <span className="text-fd-muted-foreground">
                        {messages.contributionTargetLabel}：
                      </span>
                      <span>{target.title}</span>
                      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {record.summary?.trim() ? (
                    <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">
                      <span className="font-medium text-fd-foreground">
                        {messages.contributionSummaryLabel}：
                      </span>{' '}
                      {record.summary.trim()}
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function RecommendationCards({
  locale,
  sites,
  emptyMessage,
  listLabel,
}: {
  locale: Locale;
  sites: readonly Recommendation[];
  emptyMessage: string;
  listLabel: string;
}) {
  const messages = getMessages(locale).recommendationsPage;

  if (sites.length === 0) {
    return <p className="text-fd-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="@container">
      <ul
        aria-label={listLabel}
        className="not-prose m-0 grid min-w-0 list-none gap-5 p-0 @min-[30rem]:grid-cols-2 @min-[48rem]:grid-cols-3"
      >
        {sites.map((site) => (
          (() => {
            const localized =
              messages.recommendationItems[
                site.id as keyof typeof messages.recommendationItems
              ];
            const name = localized?.name ?? site.name;
            const description = localized?.description ?? site.description;
            const category = localized?.category ?? site.category;
            const note = localized && 'note' in localized ? localized.note : site.note;
            const imageAlt = localized && 'imageAlt' in localized
              ? localized.imageAlt
              : locale === 'zh-tw' ? site.imageAlt ?? name : name;

            return (
              <li key={site.id} className="h-full min-w-0">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group block h-full min-w-0 overflow-hidden rounded-xl border bg-fd-card transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  <div className="relative aspect-[16/9] overflow-hidden border-b bg-fd-accent">
                    {site.imageUrl ? (
                      <Image
                        src={withBasePath(site.imageUrl)}
                        alt={imageAlt}
                        width={1200}
                        height={675}
                        unoptimized
                        className={
                          site.id === 'official-discord'
                          ? 'h-full w-full bg-black object-contain p-[16%] transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none'
                            : 'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none'
                        }
                      />
                    ) : (
                      <div
                        role="img"
                        aria-label={`${name}：${messages.coverPlaceholder}`}
                        className="flex h-full w-full items-center justify-center bg-fd-primary/10 text-fd-primary"
                      >
                        <FileSpreadsheet className="size-14" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <article className="flex h-full flex-col p-5">
                    <p className="text-sm font-medium text-fd-muted-foreground">{category}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
                      {name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">{description}</p>
                    {note ? (
                      <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">
                        <span className="font-medium text-fd-foreground">{messages.noteLabel}：</span>
                        {note}
                      </p>
                    ) : null}
                    <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium">
                      {messages.openSite}
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </span>
                  </article>
                </a>
              </li>
            );
          })()
        ))}
      </ul>
    </div>
  );
}

export function RecommendationsGrid({ locale }: { locale: Locale }) {
  const messages = getMessages(locale).recommendationsPage;

  return (
    <RecommendationCards
      locale={locale}
      sites={getRecommendations()}
      emptyMessage={messages.empty}
      listLabel={messages.listLabel}
    />
  );
}

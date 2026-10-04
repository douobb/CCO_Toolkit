import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createGameDataEnvelopeSchema,
  getGameDataMetadata,
  parseGameDataEnvelope,
} from './game-data';
import { dataSourceMetadataSchema } from './data-source';
import {
  searchRewardDataEnvelopeSchema,
  searchRewardDataSet,
} from '@/data/game/search-rewards';

const validEnvelope = {
  datasetId: 'test-dataset',
  domain: 'activities',
  schemaVersion: '1.0.0',
  dataVersion: 'test-2026-08-27',
  updatedAt: '2026-08-27',
  sources: [{ name: 'Test source', url: 'https://example.com/source' }],
  payload: { value: 1 },
};

function expectIssueAt(value: unknown, path: (string | number)[]) {
  const result = searchRewardDataEnvelopeSchema.safeParse(value);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues.some((issue) => issue.path.join('.') === path.join('.'))).toBe(
    true,
  );
}

describe('Game Data envelope schema', () => {
  it('validates the real Search Reward dataset and preserves its envelope metadata', () => {
    const result = searchRewardDataEnvelopeSchema.safeParse(searchRewardDataSet);

    expect(result.success).toBe(true);
    expect(searchRewardDataSet).toMatchObject({
      datasetId: 'search-rewards',
      domain: 'activities',
      schemaVersion: '1.0.0',
      dataVersion: 'cco-found-initial-snapshot',
      updatedAt: '2026-08-27',
      sources: [
        {
          name: 'CCO Found',
          url: 'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4',
        },
      ],
    });
    expect(searchRewardDataSet.payload).toHaveLength(240);
  });

  it('locates invalid envelope metadata separately from payload errors', () => {
    expectIssueAt({ ...searchRewardDataSet, datasetId: 'Search Rewards' }, ['datasetId']);
    expectIssueAt({ ...searchRewardDataSet, domain: 'tools' }, ['domain']);
    expectIssueAt({ ...searchRewardDataSet, schemaVersion: 'v1' }, ['schemaVersion']);
    expectIssueAt({ ...searchRewardDataSet, dataVersion: 'version with spaces' }, ['dataVersion']);
    expectIssueAt({ ...searchRewardDataSet, updatedAt: '2026-02-30' }, ['updatedAt']);
    expectIssueAt(
      {
        ...searchRewardDataSet,
        sources: [{ name: 'CCO Found', url: 'http://example.com/source' }],
      },
      ['sources', 0, 'url'],
    );
    expectIssueAt(
      {
        ...searchRewardDataSet,
        sources: [
          ...searchRewardDataSet.sources,
          { name: 'CCO Found mirror', url: searchRewardDataSet.sources[0]?.url },
        ],
      },
      ['sources', 1, 'url'],
    );

    const firstEntry = searchRewardDataSet.payload[0];
    expect(firstEntry).toBeDefined();
    if (!firstEntry) return;

    expectIssueAt(
      {
        ...searchRewardDataSet,
        payload: [{ ...firstEntry, level: 0 }, ...searchRewardDataSet.payload.slice(1)],
      },
      ['payload', 0, 'level'],
    );
    expectIssueAt(
      {
        ...searchRewardDataSet,
        payload: [{ ...firstEntry, mt_p: 1.1 }, ...searchRewardDataSet.payload.slice(1)],
      },
      ['payload', 0, 'mt_p'],
    );
    expectIssueAt(
      {
        ...searchRewardDataSet,
        payload: [...searchRewardDataSet.payload, firstEntry],
      },
      ['payload', searchRewardDataSet.payload.length, 'level'],
    );
  });

  it('rejects malformed source URLs without throwing from safeParse', () => {
    let sourceResult: ReturnType<typeof dataSourceMetadataSchema.safeParse> | undefined;
    expect(() => {
      sourceResult = dataSourceMetadataSchema.safeParse({ name: 'x', url: 'not-url' });
    }).not.toThrow();
    expect(sourceResult?.success).toBe(false);

    let envelopeResult: ReturnType<typeof searchRewardDataEnvelopeSchema.safeParse> | undefined;
    expect(() => {
      envelopeResult = searchRewardDataEnvelopeSchema.safeParse({
        ...searchRewardDataSet,
        sources: [{ name: 'CCO Found', url: 'not-url' }],
      });
    }).not.toThrow();
    expect(envelopeResult?.success).toBe(false);
    if (!envelopeResult || envelopeResult.success) return;

    expect(
      envelopeResult.error.issues.some(
        (issue) => issue.path.join('.') === 'sources.0.url',
      ),
    ).toBe(true);
  });

  it('supports a small domain payload without introducing a global business union', () => {
    const schema = createGameDataEnvelopeSchema(z.object({ value: z.number().int() }));
    const parsed = parseGameDataEnvelope(validEnvelope, z.object({ value: z.number().int() }));

    expect(schema.safeParse(validEnvelope).success).toBe(true);
    expect(parsed.payload).toEqual({ value: 1 });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.payload)).toBe(true);
  });

  it('可從 dataset 投影不含 payload 的共用 metadata', () => {
    const metadata = getGameDataMetadata(searchRewardDataSet);

    expect(metadata).toEqual({
      datasetId: 'search-rewards',
      domain: 'activities',
      schemaVersion: '1.0.0',
      dataVersion: 'cco-found-initial-snapshot',
      updatedAt: '2026-08-27',
      sources: searchRewardDataSet.sources,
    });
    expect(metadata.sources).toBe(searchRewardDataSet.sources);
    expect(metadata).not.toHaveProperty('payload');
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('deep-freezes the real dataset so consumers cannot mutate shared payload', () => {
    expect(Object.isFrozen(searchRewardDataSet)).toBe(true);
    expect(Object.isFrozen(searchRewardDataSet.sources)).toBe(true);
    expect(Object.isFrozen(searchRewardDataSet.sources[0])).toBe(true);
    expect(Object.isFrozen(searchRewardDataSet.payload)).toBe(true);
    expect(Object.isFrozen(searchRewardDataSet.payload[0])).toBe(true);

    expect(() => {
      (searchRewardDataSet.payload as unknown as unknown[]).push(
        searchRewardDataSet.payload[0],
      );
    }).toThrow();
    expect(() => {
      Object.defineProperty(searchRewardDataSet.payload[0], 'mt', { value: 0 });
    }).toThrow();
  });
});

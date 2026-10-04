import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8'),
);

describe('GitHub Pages deployment workflow', () => {
  it('runs on main pushes and manual dispatch, with restricted permissions and concurrency', () => {
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(workflow.on).not.toHaveProperty('pull_request');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'pages',
      'cancel-in-progress': false,
    });

    const mainOnlyDispatch =
      "github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main'";
    expect(workflow.jobs.build.if).toBe(mainOnlyDispatch);
    expect(workflow.jobs.deploy.if).toBe(mainOnlyDispatch);
  });

  it('checks and uploads only the configured static export', () => {
    const { build } = workflow.jobs;
    const steps = build.steps;

    expect(build['runs-on']).toBe('ubuntu-latest');
    expect(build.permissions).toEqual({ contents: 'read', pages: 'read' });
    expect(steps).toContainEqual(
      expect.objectContaining({
        uses: 'actions/checkout@v6',
        with: { 'persist-credentials': false },
      }),
    );
    expect(steps).toContainEqual(
      expect.objectContaining({
        uses: 'actions/setup-node@v6',
        with: { 'node-version': '24', cache: 'npm' },
      }),
    );

    const configurePages = steps.find(
      (step) => step.uses === 'actions/configure-pages@v5',
    );
    expect(configurePages).toBeDefined();
    expect(configurePages.with?.enablement).not.toBe(true);

    expect(steps.map((step) => step.run).filter(Boolean)).toEqual([
      'npm ci',
      'npm run check',
    ]);
    expect(
      steps.some((step) => step['continue-on-error'] === true),
    ).toBe(false);

    const checkStep = steps.find((step) => step.run === 'npm run check');
    expect(checkStep.env).toEqual({
      NEXT_PUBLIC_BASE_PATH: '/CCO_Toolkit',
      NEXT_PUBLIC_SITE_URL: 'https://douobb.github.io',
      NEXT_TELEMETRY_DISABLED: '1',
    });
    expect(steps).toContainEqual(
      expect.objectContaining({
        uses: 'actions/upload-pages-artifact@v4',
        with: { path: 'out' },
      }),
    );
  });

  it('deploys the build artifact with Pages-only deployment permissions', () => {
    const { deploy } = workflow.jobs;

    expect(deploy.needs).toBe('build');
    expect(deploy.permissions).toEqual({
      pages: 'write',
      'id-token': 'write',
    });
    expect(deploy.environment).toEqual({
      name: 'github-pages',
      url: '${{ steps.deployment.outputs.page_url }}',
    });
    expect(deploy.steps).toContainEqual(
      expect.objectContaining({
        id: 'deployment',
        uses: 'actions/deploy-pages@v4',
      }),
    );
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ToolBreakdown,
  ToolBuffSliderField,
  ToolInputField,
  ToolPrimaryActions,
  ToolPresetButton,
  ToolResultCard,
  ToolState,
  ToolValidationSummary,
} from './tool-ui';

describe('共用 Tool UI', () => {
  it('將輸入欄位的限制、單位與錯誤訊息連接到可存取描述', () => {
    const markup = renderToStaticMarkup(
      <ToolInputField
        id="player-level"
        label="玩家等級"
        range="Lv.1–800"
        unit="Lv."
        error="請輸入有效等級。"
        type="number"
      />,
    );

    expect(markup).toContain('for="player-level"');
    expect(markup).toContain('id="player-level"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="player-level-range"');
    expect(markup).toContain('id="player-level-unit"');
    expect(markup).toContain(
      'aria-describedby="player-level-range player-level-error player-level-unit"',
    );
    expect(markup).not.toContain('player-level-hint');
    expect(markup).toContain('role="alert"');
  });

  it('提供可鍵盤操作且顯示目前值的離散 Buff 滑桿', () => {
    const markup = renderToStaticMarkup(
      <ToolBuffSliderField
        id="btc-buff"
        label="BTC 收益加成"
        range="0/40/80/100%"
        unit="%"
        value="40"
        error="請選擇有效 Buff。"
      />,
    );

    expect(markup).toContain('for="btc-buff"');
    expect(markup).toContain('id="btc-buff"');
    expect(markup).toContain('type="range"');
    expect(markup).toContain('min="0"');
    expect(markup).toContain('max="3"');
    expect(markup).toContain('step="1"');
    expect(markup).toContain('value="1"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain('data-buff-percent-values="0,40,80,100"');
    expect(markup).toContain('aria-valuetext="40%"');
    expect(markup).toContain('id="btc-buff-value"');
    expect(markup).toContain('>40%</output>');
    expect(markup).toContain('btc-buff-range');
    expect(markup).toContain('btc-buff-error');
    expect(markup).toContain('btc-buff-value');
  });

  it('以離散索引保留可由滑鼠與觸控抵達的 100% 端點', () => {
    const markup = renderToStaticMarkup(
      <ToolBuffSliderField
        id="exp-buff"
        label="經驗值加成"
        value="100"
      />,
    );

    expect(markup).toContain('max="3"');
    expect(markup).toContain('value="3"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('aria-valuetext="100%"');
    expect(markup).toContain('>100%</output>');
  });

  it('提供可組合的結果、拆解與空／錯誤狀態', () => {
    const markup = renderToStaticMarkup(
      <ToolResultCard
        title="計算結果"
        titleId="result-title"
        titleClassName="site-tool-section-heading"
        validation={<ToolValidationSummary>請修正輸入。</ToolValidationSummary>}
      >
        <ToolBreakdown
          title="結果拆解"
          titleId="breakdown-title"
          columns={2}
          items={[{ id: 'value', label: '預估收益', value: '1,000 AI' }]}
        />
        <ToolBreakdown
          title="列式拆解"
          titleId="row-breakdown-title"
          layout="rows"
          columns={2}
          items={[{ id: 'row-value', label: '投資報酬率', value: '-87.98%' }]}
        />
        <ToolState variant="error" title="無法計算" />
      </ToolResultCard>,
    );

    expect(markup).toContain('aria-labelledby="result-title"');
    expect(markup).toContain('site-tool-section-heading');
    expect(markup).toContain('結果拆解');
    expect(markup).toContain('data-breakdown-layout="rows"');
    expect(markup).toContain('@container');
    expect(markup).toContain('@min-[40rem]:grid-cols-2');
    expect(markup).toContain('border-b border-border');
    expect(markup).toContain('投資報酬率');
    expect(markup).toContain('data-tool-state="error"');
    expect(markup).toContain('無法計算');
    expect(markup).toContain('請修正輸入。');
  });

  it('保留 Button 的標準 props 並支援可選圖示', () => {
    const markup = renderToStaticMarkup(
      <ToolPresetButton
        type="button"
        variant="outline"
        label="恢復預設"
        icon={<span aria-hidden="true">↺</span>}
      />,
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('恢復預設');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('提供固定順序的帶入玩家與本工具重設操作', () => {
    const markup = renderToStaticMarkup(
      <ToolPrimaryActions
        fillPlayer={{ label: '帶入玩家等級', onClick: () => undefined }}
        onReset={() => undefined}
        resetLabel="重設本工具"
      />,
    );

    expect(markup).toContain('data-tool-primary-actions=""');
    expect(markup).toContain('data-tool-fill-player=""');
    expect(markup).toContain('data-tool-reset=""');
    expect(markup.indexOf('帶入玩家等級')).toBeLessThan(markup.indexOf('重設本工具'));
  });
});

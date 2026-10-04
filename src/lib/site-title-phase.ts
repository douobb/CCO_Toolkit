export const SITE_TITLE_PHASE_COUNT = 8;
export const SITE_TITLE_PHASE_STEP_SECONDS = 3;
export const SITE_TITLE_PHASE_STYLE_ID = 'site-title-phase-bootstrap';

const phaseRuleSelector = ':root:root';
const phaseProperty = '--site-title-glow-delay';

export const SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT = `(()=>{var e=document.getElementById('${SITE_TITLE_PHASE_STYLE_ID}');var s=e&&e.sheet;if(!s||s.cssRules.length)return;var p=Math.floor(Math.random()*${SITE_TITLE_PHASE_COUNT});s.insertRule('${phaseRuleSelector}{${phaseProperty}:'+(-p*${SITE_TITLE_PHASE_STEP_SECONDS})+'s}',s.cssRules.length)})()`;

export function setSiteTitlePhase(phase: number): void {
  if (typeof document === 'undefined') return;

  const style = document.getElementById(SITE_TITLE_PHASE_STYLE_ID) as HTMLStyleElement | null;
  const sheet = style?.sheet;
  if (!sheet) return;

  const delay = `${-phase * SITE_TITLE_PHASE_STEP_SECONDS}s`;
  for (const rule of Array.from(sheet.cssRules)) {
    if ('selectorText' in rule && rule.selectorText === phaseRuleSelector) {
      (rule as CSSStyleRule).style.setProperty(phaseProperty, delay);
      return;
    }
  }

  sheet.insertRule(
    `${phaseRuleSelector}{${phaseProperty}:${delay}}`,
    sheet.cssRules.length,
  );
}

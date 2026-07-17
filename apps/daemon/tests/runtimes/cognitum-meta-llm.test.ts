import { describe, expect, it } from 'vitest';

import { cognitumMetaLlmAgentDef } from '../../src/runtimes/defs/cognitum-meta-llm.js';

describe('Cognitum Meta-LLM runtime', () => {
  it('uses Cognitum Auto by default and exposes only managed tier models', () => {
    expect(cognitumMetaLlmAgentDef.buildArgs('', [], [], {})).toContain(
      'open-design-byok/cognitum-auto',
    );
    expect(cognitumMetaLlmAgentDef.fallbackModels.map((model) => model.id)).toEqual([
      'cognitum-auto',
      'cognitum-low',
      'cognitum-mid',
      'cognitum-high',
    ]);
    expect(cognitumMetaLlmAgentDef.supportsCustomModel).toBe(false);
  });
});

import { opencodeByokModelId } from '../byok-opencode.js';
import {
  OPENCODE_PERMISSION_CAPABILITY,
  appendOpenCodePermissionBypass,
} from '../opencode-permissions.js';
import type { RuntimeAgentDef } from '../types.js';

export const COGNITUM_META_LLM_AGENT_ID = 'cognitum-meta-llm';

export const cognitumMetaLlmAgentDef = {
  id: COGNITUM_META_LLM_AGENT_ID,
  name: 'Cognitum Meta-LLM',
  bin: 'opencode-cli',
  fallbackBins: ['opencode'],
  versionArgs: ['--version'],
  ...OPENCODE_PERMISSION_CAPABILITY,
  fallbackModels: [
    { id: 'cognitum-auto', label: 'Cognitum Auto', default: true },
    { id: 'cognitum-low', label: 'Cognitum Low' },
    { id: 'cognitum-mid', label: 'Cognitum Mid' },
    { id: 'cognitum-high', label: 'Cognitum High' },
  ],
  buildArgs: (_prompt, _imagePaths, _extra, options = {}) => {
    const args = ['run', '--format', 'json'];
    appendOpenCodePermissionBypass(args, COGNITUM_META_LLM_AGENT_ID);
    const model = opencodeByokModelId(options.model ?? 'cognitum-auto');
    if (model) args.push('-m', model);
    return args;
  },
  promptViaStdin: true,
  streamFormat: 'json-event-stream',
  eventParser: 'opencode',
  externalMcpInjection: 'opencode-env-content',
  supportsCustomModel: false,
} satisfies RuntimeAgentDef;

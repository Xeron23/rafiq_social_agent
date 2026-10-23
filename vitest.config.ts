import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: 1,
    env: {
      OPENAI_BASE_URL: 'https://je.jerouter.web.id/v1',
      OPENAI_API_KEY: 'jr_cup_a9swi5b1hbb6087jmxw7uhparsv',
      DEFAULT_MODEL: 'jerouter',
    },
    testTimeout: 120000,
    hookTimeout: 30000,
    sequence: {
      concurrent: false,
    },
  },
});

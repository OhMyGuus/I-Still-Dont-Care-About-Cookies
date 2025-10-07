import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
  {
    rules: {
      'semi': [1, 'always'],
      'max-len': 0,
      'no-tabs': 0,
      'no-multi-str': 0,
      'guard-for-in': 0,
    },
  },
];

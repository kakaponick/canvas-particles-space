module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  // src/components/ui is shadcn's generated code, kept as the generator writes it
  ignorePatterns: ['dist', '.eslintrc.cjs', 'src/components/ui'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    'semi': ['error', 'never'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'space-before-function-paren': ['error', 'always'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'eqeqeq': ['error', 'always'],
    'comma-spacing': ['error', { 'before': false, 'after': true }]
  }
}


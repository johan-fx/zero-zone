// Canonical source moved to packages/ui/src/tokens.ts so apps/web-ui can
// share the same operational palette, radii, and status-tone scale. This
// file re-exports it under the historical local path so existing imports
// (`./tokens`) throughout apps/mobile keep working unchanged.
export * from '@zona-cero/ui';

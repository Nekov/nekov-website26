// Single definition of "production", shared by the build and the edge middleware.
// Fail-safe: anything that is not clearly production is treated as staging.
export function isProduction(env = process.env) {
  if (env.SITE_ENV !== 'production') return false;
  return !env.VERCEL_ENV || env.VERCEL_ENV === 'production';
}

export function trackingEnabled(env = process.env) {
  return isProduction(env) && env.ENABLE_TRACKING === 'true';
}

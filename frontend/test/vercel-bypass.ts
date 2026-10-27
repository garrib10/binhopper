// Staging previews stay behind Vercel Deployment Protection. Automated checks get
// through with Vercel's "Protection Bypass for Automation" secret, sent ONLY to the
// Vercel app's origin, never to the Railway API or any other host.
// https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
export const BYPASS_HEADER = 'x-vercel-protection-bypass';

export function bypassHeaders(
  url: string,
  appUrl = process.env.APP_URL,
  secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
): Record<string, string> {
  if (!appUrl || !secret) return {};
  try {
    return new URL(url).origin === new URL(appUrl).origin ? { [BYPASS_HEADER]: secret } : {};
  } catch {
    return {};
  }
}

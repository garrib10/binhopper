// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BYPASS_HEADER, bypassHeaders } from './vercel-bypass';

const app = 'https://binhopper-git-staging-garrib10.vercel.app';

describe('Vercel protection bypass for staging system tests', () => {
  it('adds the secret to requests for the Vercel app origin', () => {
    expect(bypassHeaders(`${app}/albums/1/stores`, app, 's3cret')).toEqual({ [BYPASS_HEADER]: 's3cret' });
    expect(bypassHeaders(`${app}/api/health`, `${app}/`, 's3cret')).toEqual({ [BYPASS_HEADER]: 's3cret' });
  });

  it('never sends the secret to the Railway API or third parties', () => {
    expect(bypassHeaders('https://binhopper-staging.up.railway.app/api/health', app, 's3cret')).toEqual({});
    expect(bypassHeaders('https://api.discogs.com/releases/1', app, 's3cret')).toEqual({});
    expect(bypassHeaders('http://binhopper-git-staging-garrib10.vercel.app/', app, 's3cret')).toEqual({});
  });

  it('adds nothing when no secret or app URL is configured', () => {
    expect(bypassHeaders(`${app}/`, app, undefined)).toEqual({});
    expect(bypassHeaders(`${app}/`, undefined, 's3cret')).toEqual({});
    expect(bypassHeaders('not a url', app, 's3cret')).toEqual({});
  });
});

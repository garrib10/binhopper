import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { useCachedList } from './listCache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((r) => { resolve = r; }), resolve };
}

describe('useCachedList', () => {
  it('shows the last list at once on a return visit, then the fresh one', async () => {
    const first = renderHook(() => useCachedList(1, 'wishlist', async () => ['Rumours']));
    await waitFor(() => expect(first.result.current.state).toEqual({ kind: 'loaded', data: ['Rumours'], refreshing: false }));
    first.unmount();

    const fresh = deferred<string[]>();
    const again = renderHook(() => useCachedList(1, 'wishlist', () => fresh.promise));
    expect(again.result.current.state).toEqual({ kind: 'loaded', data: ['Rumours'], refreshing: true });
    await act(async () => fresh.resolve(['Rumours', 'Blue']));
    expect(again.result.current.state).toEqual({ kind: 'loaded', data: ['Rumours', 'Blue'], refreshing: false });
  });

  it('keeps each account and each sort apart', async () => {
    const mine = renderHook(() => useCachedList(1, 'collection:recent', async () => ['mine']));
    await waitFor(() => expect(mine.result.current.state.kind).toBe('loaded'));
    const never = new Promise<string[]>(() => {});
    expect(renderHook(() => useCachedList(2, 'collection:recent', () => never)).result.current.state).toEqual({ kind: 'loading' });
    expect(renderHook(() => useCachedList(1, 'collection:artist', () => never)).result.current.state).toEqual({ kind: 'loading' });
  });

  it('shows a local change at once and remembers it', async () => {
    const hook = renderHook(() => useCachedList(1, 'wishlist', async () => ['Rumours', 'Blue']));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('loaded'));
    act(() => hook.result.current.update((items) => items.filter((t) => t !== 'Blue')));
    expect(hook.result.current.state).toMatchObject({ data: ['Rumours'] });
    hook.unmount();
    const never = new Promise<string[]>(() => {});
    expect(renderHook(() => useCachedList(1, 'wishlist', () => never)).result.current.state).toMatchObject({ data: ['Rumours'] });
  });

  it('forgets every list when the user signs out', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input) === '/api/auth/me'
      ? new Response(JSON.stringify({ id: 1, username: 'collector-1', email: 'a@example.com', email_verified: true, sign_in_methods: ['password'] }))
      : new Response(null, { status: 204 }));
    function Page() {
      const { state: auth, signOut } = useAuth();
      const owner = auth.status === 'signed-in' ? auth.account.id : null;
      const { state } = useCachedList(owner, 'wishlist', async () => ['Rumours']);
      return <><p>{auth.status} {state.kind}</p><button onClick={() => signOut()}>Sign out</button></>;
    }
    const view = render(<AuthProvider><Page /></AuthProvider>);
    expect(await screen.findByText('signed-in loaded')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByText(/^signed-out/);
    view.unmount();
    const never = new Promise<string[]>(() => {});
    expect(renderHook(() => useCachedList(1, 'wishlist', () => never)).result.current.state).toEqual({ kind: 'loading' });
  });
});

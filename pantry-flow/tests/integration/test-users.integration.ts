import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestUsers, localStack, password, removeTestUsers, withTestUsers } from './local-stack';

test('test users are unique per call and removal deletes exactly them', async () => {
  const stack = localStack();
  const first = await createTestUsers(stack, 2, 'unique');
  const second = await createTestUsers(stack, 2, 'unique').catch(async error => {
    await removeTestUsers(stack.admin, first);
    throw error;
  });
  try {
    const all = [...first, ...second];
    assert.equal(new Set(all.map(user => user.email)).size, 4);
    await removeTestUsers(stack.admin, first);
    for (const user of first) {
      const login = await stack.client().auth.signInWithPassword({ email: user.email, password });
      assert.ok(login.error, `${user.email} should no longer sign in`);
    }
    for (const user of second) {
      const login = await stack.client().auth.signInWithPassword({ email: user.email, password });
      assert.equal(login.error, null, `${user.email} should still sign in`);
    }
  } finally {
    await removeTestUsers(stack.admin, second);
    await removeTestUsers(stack.admin, first);
  }
});

test('withTestUsers removes its users when the body throws', async () => {
  const stack = localStack();
  let id = '';
  await assert.rejects(withTestUsers(1, 'throws', async users => {
    id = users[0].id;
    throw new Error('body failed');
  }), /body failed/);
  assert.ok(id);
  const { data, error } = await stack.admin.auth.admin.getUserById(id);
  assert.ok(error || !data.user, 'user should be gone');
});

test('removeTestUsers tries every id even when one removal fails', async () => {
  const stack = localStack();
  const [user] = await createTestUsers(stack, 1, 'removeall');
  try {
    // A non-UUID id makes deleteUser fail with a genuine (non-404) error before any request is sent.
    await assert.rejects(removeTestUsers(stack.admin, [{ id: 'not-a-uuid' }, user]), /UUID/);
    const login = await stack.client().auth.signInWithPassword({ email: user.email, password });
    assert.ok(login.error, 'the real user should be removed despite the earlier failure');
  } finally {
    await removeTestUsers(stack.admin, [user]);
  }
});

import { changePasswordSchema, createUserSchema, updateUserSchema } from './auth';

function fieldErrors(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('createUserSchema', () => {
  it('normalizes the phone and turns an empty name into null', () => {
    const result = createUserSchema.safeParse({
      phone: '555 12 34 56',
      name: '  ',
      role: 'RESIDENT',
      language: 'ru',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      phone: '+995555123456',
      name: null,
      role: 'RESIDENT',
      language: 'ru',
    });
  });

  it('reports field codes the frontend can translate', () => {
    const result = createUserSchema.safeParse({
      phone: 'abc',
      role: 'ROOT',
      language: 'de',
      password: 'short',
    });
    expect(fieldErrors(result)).toEqual({
      phone: 'INVALID_PHONE',
      role: 'INVALID_VALUE',
      language: 'INVALID_VALUE',
      password: 'PASSWORD_TOO_SHORT',
    });
  });
});

describe('updateUserSchema', () => {
  it('requires every field', () => {
    const result = updateUserSchema.safeParse({});
    expect(fieldErrors(result)).toEqual({
      phone: 'REQUIRED',
      role: 'INVALID_VALUE',
      language: 'INVALID_VALUE',
    });
  });
});

describe('changePasswordSchema', () => {
  it('requires at least 8 characters for the new password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: '1234567' }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: '12345678' }).success,
    ).toBe(true);
  });
});

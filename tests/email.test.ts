import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '../api/vote/email';

describe('isValidEmail', () => {
  it('accepts standard email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last@company.co.uk')).toBe(true);
    expect(isValidEmail('name+tag@domain.org')).toBe(true);
    expect(isValidEmail('user123@test.io')).toBe(true);
  });

  it('rejects emails without an @ symbol', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects emails without a domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects emails without a local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects emails without a TLD dot', () => {
    expect(isValidEmail('user@localhost')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects emails with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
    expect(isValidEmail(' user@example.com ')).toBe(false);
  });

  it('rejects emails with multiple @ symbols', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
    expect(isValidEmail('a@b@c.com')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases the entire address', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    expect(normalizeEmail('LOUD@YELLING.NET')).toBe('loud@yelling.net');
  });

  it('strips plus aliases', () => {
    expect(normalizeEmail('damon+fake@gmail.com')).toBe('damon@gmail.com');
    expect(normalizeEmail('user+newsletter@company.io')).toBe('user@company.io');
  });

  it('strips plus aliases and lowercases together', () => {
    expect(normalizeEmail('Damon+Fake@Gmail.COM')).toBe('damon@gmail.com');
  });

  it('handles multiple plus signs by keeping only the base', () => {
    expect(normalizeEmail('user+a+b+c@test.com')).toBe('user@test.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  user@test.com  ')).toBe('user@test.com');
    expect(normalizeEmail('\tuser@test.com\n')).toBe('user@test.com');
  });

  it('leaves addresses without plus aliases unchanged (aside from lowercasing)', () => {
    expect(normalizeEmail('normal@user.com')).toBe('normal@user.com');
  });

  it('handles edge case of plus at the start of local part', () => {
    expect(normalizeEmail('+tag@domain.com')).toBe('@domain.com');
  });

  it('returns the input lowercased if no @ is present', () => {
    expect(normalizeEmail('nope')).toBe('nope');
  });

  it('preserves dots in the local part', () => {
    expect(normalizeEmail('first.last+tag@gmail.com')).toBe('first.last@gmail.com');
  });

  it('preserves subdomains in the domain', () => {
    expect(normalizeEmail('user+x@mail.corp.example.com')).toBe('user@mail.corp.example.com');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, slugify, getString, getBoolean, getMany, getInteger } from '../scripts/lib/cli.js';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('returns an empty object for an empty argv', () => {
    assert.deepEqual(parseArgs([]), {});
  });

  it('collects positional arguments under the _ key', () => {
    const result = parseArgs(['foo', 'bar', 'baz']);
    assert.deepEqual(result._, ['foo', 'bar', 'baz']);
  });

  it('parses a standalone flag as true', () => {
    const result = parseArgs(['--verbose']);
    assert.equal(result.verbose, true);
  });

  it('parses a flag followed by another flag as true (not the next flag)', () => {
    const result = parseArgs(['--dry-run', '--force']);
    assert.equal(result['dry-run'], true);
    assert.equal(result.force, true);
  });

  it('parses a key-value pair', () => {
    const result = parseArgs(['--name', 'Alice']);
    assert.equal(result.name, 'Alice');
  });

  it('parses multiple distinct key-value pairs', () => {
    const result = parseArgs(['--host', 'localhost', '--port', '3000']);
    assert.equal(result.host, 'localhost');
    assert.equal(result.port, '3000');
  });

  it('collects repeated keys into an array', () => {
    const result = parseArgs(['--tag', 'alpha', '--tag', 'beta', '--tag', 'gamma']);
    assert.deepEqual(result.tag, ['alpha', 'beta', 'gamma']);
  });

  it('parses a flag at the end of argv as true (no following value)', () => {
    const result = parseArgs(['--output', 'file.txt', '--debug']);
    assert.equal(result.output, 'file.txt');
    assert.equal(result.debug, true);
  });

  it('mixes positional and named arguments', () => {
    const result = parseArgs(['positional', '--key', 'value', 'another']);
    assert.deepEqual(result._, ['positional', 'another']);
    assert.equal(result.key, 'value');
  });

  it('a key followed immediately by another --flag gets true, not the flag name', () => {
    // --verbose --output — verbose has no value before --output, so verbose = true
    const result = parseArgs(['--verbose', '--output', 'file.txt']);
    assert.equal(result.verbose, true);
    assert.equal(result.output, 'file.txt');
  });
});

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('converts to lowercase', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('replaces spaces with hyphens', () => {
    assert.equal(slugify('foo bar baz'), 'foo-bar-baz');
  });

  it('replaces non-alphanumeric characters with hyphens', () => {
    assert.equal(slugify('Hello, World!'), 'hello-world');
  });

  it('collapses consecutive non-alphanumeric chars to a single hyphen', () => {
    assert.equal(slugify('hello   world'), 'hello-world');
    assert.equal(slugify('hello---world'), 'hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    assert.equal(slugify('  hello world  '), 'hello-world');
    assert.equal(slugify('---hello---'), 'hello');
  });

  it('preserves numbers', () => {
    assert.equal(slugify('Version 2.0'), 'version-2-0');
  });

  it('truncates to 63 characters', () => {
    const long = 'a'.repeat(100);
    assert.equal(slugify(long).length, 63);
  });

  it('handles an already-valid slug unchanged', () => {
    assert.equal(slugify('my-skill-name'), 'my-skill-name');
  });

  it('handles a string with only non-alphanumeric characters', () => {
    // All chars get replaced, then leading/trailing hyphens stripped
    assert.equal(slugify('---'), '');
  });

  it('coerces a non-string value to string', () => {
    assert.equal(slugify(42), '42');
  });
});

// ---------------------------------------------------------------------------
// getString
// ---------------------------------------------------------------------------

describe('getString', () => {
  it('returns the value for a present key', () => {
    assert.equal(getString({ name: 'Alice' }, 'name'), 'Alice');
  });

  it('returns the fallback when key is absent', () => {
    assert.equal(getString({}, 'name', 'default'), 'default');
  });

  it('returns empty string as default fallback when key is absent', () => {
    assert.equal(getString({}, 'name'), '');
  });

  it('returns the last value when key has an array (repeated flag)', () => {
    assert.equal(getString({ tag: ['alpha', 'beta', 'gamma'] }, 'tag'), 'gamma');
  });

  it('converts a boolean true to string "true"', () => {
    assert.equal(getString({ verbose: true }, 'verbose'), 'true');
  });

  it('converts a numeric value to string', () => {
    const args = parseArgs(['--port', '3000']);
    assert.equal(getString(args, 'port'), '3000');
  });
});

// ---------------------------------------------------------------------------
// getBoolean
// ---------------------------------------------------------------------------

describe('getBoolean', () => {
  it('returns true for a boolean-true flag', () => {
    const args = parseArgs(['--verbose']);
    assert.equal(getBoolean(args, 'verbose'), true);
  });

  it('returns the fallback when key is absent', () => {
    assert.equal(getBoolean({}, 'missing', false), false);
    assert.equal(getBoolean({}, 'missing', true), true);
  });

  it('defaults to false when key is absent and no fallback provided', () => {
    assert.equal(getBoolean({}, 'missing'), false);
  });

  it('returns false for the string "false"', () => {
    assert.equal(getBoolean({ flag: 'false' }, 'flag'), false);
  });

  it('returns false for the string "0"', () => {
    assert.equal(getBoolean({ flag: '0' }, 'flag'), false);
  });

  it('returns false for the string "no"', () => {
    assert.equal(getBoolean({ flag: 'no' }, 'flag'), false);
  });

  it('returns true for any other string value', () => {
    assert.equal(getBoolean({ flag: 'yes' }, 'flag'), true);
    assert.equal(getBoolean({ flag: '1' }, 'flag'), true);
    assert.equal(getBoolean({ flag: 'true' }, 'flag'), true);
    assert.equal(getBoolean({ flag: 'on' }, 'flag'), true);
  });

  it('is case-insensitive for the falsy strings', () => {
    assert.equal(getBoolean({ flag: 'FALSE' }, 'flag'), false);
    assert.equal(getBoolean({ flag: 'No' }, 'flag'), false);
  });
});

// ---------------------------------------------------------------------------
// getMany
// ---------------------------------------------------------------------------

describe('getMany', () => {
  it('returns an empty array when key is absent', () => {
    assert.deepEqual(getMany({}, 'tags'), []);
  });

  it('returns a single value as a one-element array', () => {
    const args = parseArgs(['--tag', 'alpha']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha']);
  });

  it('returns multiple values from a repeated flag', () => {
    const args = parseArgs(['--tag', 'alpha', '--tag', 'beta']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha', 'beta']);
  });

  it('splits comma-separated values into individual entries', () => {
    const args = parseArgs(['--tag', 'alpha,beta,gamma']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha', 'beta', 'gamma']);
  });

  it('trims whitespace from each value', () => {
    const args = parseArgs(['--tag', ' alpha , beta , gamma ']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha', 'beta', 'gamma']);
  });

  it('filters out empty strings after splitting and trimming', () => {
    const args = parseArgs(['--tag', 'alpha,,beta,']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha', 'beta']);
  });

  it('combines repeated flag with comma-separated values', () => {
    const args = parseArgs(['--tag', 'alpha,beta', '--tag', 'gamma']);
    assert.deepEqual(getMany(args, 'tag'), ['alpha', 'beta', 'gamma']);
  });

  it('works with a boolean flag value (coerced to string)', () => {
    // --verbose is parsed as true; getMany coerces to "true" then splits
    const args = parseArgs(['--verbose']);
    const result = getMany(args, 'verbose');
    assert.deepEqual(result, ['true']);
  });
});

// ---------------------------------------------------------------------------
// getInteger (bonus — exported from cli.js)
// ---------------------------------------------------------------------------

describe('getInteger', () => {
  it('parses a valid integer string', () => {
    const args = parseArgs(['--limit', '50']);
    assert.equal(getInteger(args, 'limit', 10), 50);
  });

  it('returns the fallback when key is absent', () => {
    assert.equal(getInteger({}, 'limit', 10), 10);
  });

  it('returns fallback for a non-numeric string', () => {
    assert.equal(getInteger({ limit: 'abc' }, 'limit', 10), 10);
  });

  it('truncates a float string to an integer', () => {
    const args = parseArgs(['--limit', '3.9']);
    assert.equal(getInteger(args, 'limit', 0), 3);
  });
});

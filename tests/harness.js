/*
 * A tiny test runner for tests/run.html, so the same test files run in a
 * browser (double-click run.html) and in Node (`node --test tests/*.test.js`).
 */
(function (root) {
  'use strict';

  var registered = [];

  function fail(message) {
    throw new Error(message);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var keysA = Object.keys(a);
    var keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(function (k) { return deepEqual(a[k], b[k]); });
  }

  var assert = {
    ok: function (value, message) {
      if (!value) fail(message || 'Expected a truthy value, got ' + value);
    },
    equal: function (actual, expected, message) {
      if (actual !== expected) fail(message || 'Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    },
    notEqual: function (actual, expected, message) {
      if (actual === expected) fail(message || 'Did not expect ' + JSON.stringify(actual));
    },
    deepEqual: function (actual, expected, message) {
      if (!deepEqual(actual, expected)) fail(message || 'Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
  };

  function test(name, fn) {
    registered.push({ name: name, fn: fn });
  }

  function run(container) {
    var passed = 0;
    var failed = 0;
    var list = document.createElement('ul');
    registered.forEach(function (t) {
      var item = document.createElement('li');
      try {
        t.fn();
        passed++;
        item.className = 'pass';
        item.textContent = 'PASS  ' + t.name;
      } catch (err) {
        failed++;
        item.className = 'fail';
        item.textContent = 'FAIL  ' + t.name + ': ' + err.message;
      }
      list.appendChild(item);
    });
    var summary = document.createElement('p');
    summary.id = 'summary';
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = passed + ' passed, ' + failed + ' failed';
    container.appendChild(summary);
    container.appendChild(list);
    return { passed: passed, failed: failed };
  }

  root.TestHarness = { test: test, assert: assert, run: run };
})(window);

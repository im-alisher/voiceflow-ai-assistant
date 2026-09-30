/**
 * Environment for unit tests.
 *
 * `AppConfigModule` validates the environment eagerly when it is imported, so
 * any spec that transitively reaches the config barrel needs the required
 * variables to already exist. They are placeholders: no test in this package
 * talks to a real database or verifies a real token, and the boot-time
 * validation these values satisfy is itself covered by the configuration build.
 *
 * Set here rather than in a `.env` file so the suite is hermetic and produces
 * the same result on any machine.
 */
process.env['NODE_ENV'] = 'test';

process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret-value-not-used-in-production';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-value-not-used-in-production';

export {};

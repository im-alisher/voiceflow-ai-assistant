import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

/**
 * DI graph smoke test.
 *
 * Compiles the real composition root, which catches missing providers, tokens
 * that are exported but never imported, and circular module imports — a whole
 * class of failure that would otherwise only appear at boot, in production.
 *
 * `DataSource.initialize` is stubbed because the wiring, not the connection, is
 * what is under test here; nothing in the graph issues a query during
 * compilation. A real connection is exercised separately, where a database is
 * actually available.
 */
describe('AppModule (DI graph)', () => {
  it('resolves every provider', async () => {
    // Resolves with the instance itself, which is what the provider factory
    // hands back, so the entity-manager provider still receives an object.
    const initialize = jest.spyOn(DataSource.prototype, 'initialize').mockImplementation(function (
      this: DataSource,
    ) {
      return Promise.resolve(this);
    });

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

      expect(moduleRef).toBeDefined();
      await moduleRef.close();
    } finally {
      initialize.mockRestore();
    }
  }, 30_000);
});

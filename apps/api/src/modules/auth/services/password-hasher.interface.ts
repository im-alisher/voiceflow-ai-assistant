/** Injectable port for password hashing (bcrypt today, argon2 later). */
export interface PasswordHasher {
  hash(plain: string, saltRounds: number): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
  /** True when an existing hash was produced with weaker parameters. */
  needsRehash(hash: string, saltRounds: number): boolean;
}

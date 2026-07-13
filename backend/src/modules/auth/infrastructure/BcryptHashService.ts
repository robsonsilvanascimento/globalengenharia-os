import bcrypt from 'bcrypt';
import type { HashService } from '../application/ports/HashService';

const SALT_ROUNDS = 10;

/** Implementacao de HashService usando bcrypt. */
export class BcryptHashService implements HashService {
  async compare(senhaPlana: string, hash: string): Promise<boolean> {
    return bcrypt.compare(senhaPlana, hash);
  }

  async hash(senhaPlana: string): Promise<string> {
    return bcrypt.hash(senhaPlana, SALT_ROUNDS);
  }
}

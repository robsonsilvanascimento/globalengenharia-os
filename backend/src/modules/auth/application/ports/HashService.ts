/**
 * Porta para hashing/comparacao de senha em texto puro.
 * Implementacao real (bcrypt) em modules/auth/infrastructure/BcryptHashService.ts.
 */
export interface HashService {
  compare(senhaPlana: string, hash: string): Promise<boolean>;
  hash(senhaPlana: string): Promise<string>;
}

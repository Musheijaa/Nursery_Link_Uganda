import { hash, verify } from '@node-rs/argon2';

// argon2id with the library defaults (OWASP-recommended parameters)
export const hashPassword = (password: string): Promise<string> => hash(password);

export const verifyPassword = (passwordHash: string, password: string): Promise<boolean> => verify(passwordHash, password);

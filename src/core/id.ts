import { createHash } from 'node:crypto';

export function candidateId(ruleId: string, path: string): string {
  return createHash('sha256').update(`${ruleId}\0${path}`).digest('hex').slice(0, 10);
}

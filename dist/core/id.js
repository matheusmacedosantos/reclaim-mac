import { createHash } from 'node:crypto';
export function candidateId(ruleId, path) {
    return createHash('sha256').update(`${ruleId}\0${path}`).digest('hex').slice(0, 10);
}
//# sourceMappingURL=id.js.map
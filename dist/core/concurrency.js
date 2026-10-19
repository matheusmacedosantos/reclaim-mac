export async function mapLimit(values, limit, mapper) {
    const results = new Array(values.length);
    let cursor = 0;
    async function worker() {
        while (cursor < values.length) {
            const index = cursor;
            cursor += 1;
            const value = values[index];
            if (value !== undefined) {
                results[index] = await mapper(value);
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => worker()));
    return results;
}
//# sourceMappingURL=concurrency.js.map
const refusalPattern = /couldn['’]?t find|not (?:covered|mentioned|included)|does not (?:contain|cover)/i;
const citationPattern = /\[\d+\]/;

export function scoreCase(testCase, retrieved, answer) {
    const retrievedDocuments = new Set(retrieved.map((chunk) => chunk.filename));
    const expectedDocuments = testCase.expectedDocuments || [];
    const relevantDocuments = expectedDocuments.filter((filename) => retrievedDocuments.has(filename));
    const retrievalPassed = expectedDocuments.length === 0 || relevantDocuments.length === expectedDocuments.length;
    const answerText = String(answer || "");
    const citationIndexes = Array.from(answerText.matchAll(/\[(\d+)\]/g), (match) => Number(match[1]));
    const citationsValid = citationIndexes.length > 0 && citationIndexes.every((index) => index > 0 && index <= retrieved.length);
    const refusalPassed = !testCase.expectRefusal || refusalPattern.test(answerText);
    const citationPassed = testCase.expectRefusal || citationsValid;
    const requiredTerms = (testCase.requiredTerms || []).map((term) => ({
        term,
        found: answerText.toLowerCase().includes(term.toLowerCase()),
    }));
    const termsPassed = requiredTerms.every((result) => result.found);

    return {
        id: testCase.id,
        retrievalPassed,
        relevantDocuments,
        answerHasCitation: citationPattern.test(answerText),
        citationsValid,
        citationIndexes,
        refusalPassed,
        requiredTerms,
        passed: retrievalPassed && refusalPassed && citationPassed && termsPassed,
    };
}
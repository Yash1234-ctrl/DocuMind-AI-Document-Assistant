import test from "node:test";
import assert from "node:assert/strict";
import { scoreCase } from "../scripts/eval-scoring.js";

test("scores relevant retrieval, required answer terms, and citations", () => {
    const result = scoreCase(
        {
            id: "grounded",
            expectedDocuments: ["water-cycle-notes.pdf"],
            requiredTerms: ["evapor", "precipitation"],
            expectRefusal: false,
        },
        [{ filename: "water-cycle-notes.pdf" }],
        "Water evaporates and returns as precipitation [1]."
    );

    assert.equal(result.passed, true);
    assert.equal(result.retrievalPassed, true);
    assert.equal(result.answerHasCitation, true);
});

test("fails a grounded answer with missing retrieval or citation", () => {
    const result = scoreCase(
        {
            id: "ungrounded",
            expectedDocuments: ["water-cycle-notes.pdf"],
            requiredTerms: ["evapor"],
            expectRefusal: false,
        },
        [{ filename: "other.pdf" }],
        "Water evaporates."
    );

    assert.equal(result.passed, false);
    assert.equal(result.retrievalPassed, false);
    assert.equal(result.answerHasCitation, false);
});

test("rejects citations that refer to passages outside the retrieved result set", () => {
    const result = scoreCase(
        {
            id: "invalid-citation",
            expectedDocuments: ["water-cycle-notes.pdf"],
            requiredTerms: [],
            expectRefusal: false,
        },
        [{ filename: "water-cycle-notes.pdf" }],
        "The cycle has four stages [2]."
    );

    assert.equal(result.answerHasCitation, true);
    assert.equal(result.citationsValid, false);
    assert.equal(result.passed, false);
});

test("checks refusal language for out-of-scope questions", () => {
    const testCase = { id: "refusal", expectedDocuments: [], requiredTerms: [], expectRefusal: true };
    assert.equal(scoreCase(testCase, [{ filename: "water-cycle-notes.pdf" }], "I couldn't find that in your documents.").passed, true);
    assert.equal(scoreCase(testCase, [], "France won the tournament.").passed, false);
});
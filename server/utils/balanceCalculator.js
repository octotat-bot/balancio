/**
 * @module balanceCalculator
 *
 * Pure utility module for computing group balances from Expense and Settlement records.
 * Stateless — receives plain data arrays, returns plain objects.
 * No Mongoose imports; all DB queries stay in the controller.
 *
 * ─── PHASE 1 ────────────────────────────────────────────────────────────────
 * Build pairwiseDebts map from raw expense and settlement documents.
 *
 * For every Expense:
 *   For every split in expense.splits:
 *     Add edge  { from: splitUser, to: payerId, amount: split.amount }
 *     i.e. "splitUser owes payerId this much"
 *
 * For every confirmed Settlement:
 *   Subtract from the relevant edge (the payer has partially cleared their debt).
 *
 * Result: pairwiseDebts[key] is a signed number representing the NET amount
 *   person A owes person B on the canonical key "smallerId_largerId".
 *
 * ─── PHASE 2 ────────────────────────────────────────────────────────────────
 * Derive per-member totals and optional simplification from the pairwise map.
 *
 * simplify=false → return raw pairwise edges (one edge per pair that has debt)
 * simplify=true  → run the min-cash-flow greedy algorithm:
 *   a. Sum all incoming/outgoing edges per user → net balance
 *   b. Split into creditors (net > 0) and debtors (net < 0)
 *   c. Greedily match largest debtor to largest creditor, create a settlement
 *      edge, reduce both, repeat until all balanced
 *   d. Return minimal list of { from, to, amount }
 */

/**
 * Round a number to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build a canonical pairwise key — always smallerId first so A→B and B→A
 * collapse into the same key. The sign of the stored value encodes direction:
 *   positive  → personA owes personB
 *   negative  → personB owes personA
 *
 * @param {string} idA
 * @param {string} idB
 * @returns {{ key: string, aIsSmaller: boolean }}
 */
const pairKey = (idA, idB) => {
    const aIsSmaller = idA < idB;
    return {
        key: aIsSmaller ? `${idA}_${idB}` : `${idB}_${idA}`,
        aIsSmaller,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 1 — Build the pairwise debt map.
 *
 * @param {Array} expenses   - Array of Mongoose Expense documents (or plain objects).
 *                             Each item must expose: paidBy (_id), paidByPending (_id),
 *                             splits[].user (_id), splits[].pendingMemberId (_id), splits[].amount
 * @param {Array} settlements - Array of CONFIRMED Mongoose Settlement documents.
 *                              Each item must expose: from (_id or ObjectId), to (_id or ObjectId), amount
 *
 * @returns {Object} pairwiseMap  Keys are "smallerId_largerId", values are signed net numbers.
 *                                positive → smaller-id person owes larger-id person
 *                                negative → larger-id person owes smaller-id person
 */
export const buildPairwiseMap = (expenses, settlements) => {
    /** @type {Record<string, number>} */
    const map = {};

    /**
     * Add `amount` to the edge meaning "from → to" (frm owes toPerson).
     * @param {string} frm
     * @param {string} toPerson
     * @param {number} amount
     */
    const addEdge = (frm, toPerson, amount) => {
        if (frm === toPerson || amount <= 0) return;
        const { key, aIsSmaller } = pairKey(frm, toPerson);
        if (!(key in map)) map[key] = 0;
        // If frm is the smaller id, positive means frm owes toPerson → add
        // If frm is the larger id, positive means toPerson owes frm → subtract
        map[key] = round2(map[key] + (aIsSmaller ? amount : -amount));
    };

    // Process expenses
    for (const expense of expenses) {
        // Resolve payer id
        let payerId;
        if (expense.paidBy) {
            payerId = (expense.paidBy._id ?? expense.paidBy).toString();
        } else if (expense.paidByPending) {
            payerId = expense.paidByPending.toString();
        } else {
            continue; // No payer — skip
        }

        for (const split of expense.splits) {
            let splitUserId;
            if (split.pendingMemberId) {
                splitUserId = split.pendingMemberId.toString();
            } else if (split.user) {
                splitUserId = (split.user._id ?? split.user).toString();
            } else {
                continue;
            }

            if (splitUserId === payerId) continue; // payer's own share — no debt

            // splitUser owes payerId
            addEdge(splitUserId, payerId, split.amount);
        }
    }

    // Process confirmed settlements — they reduce debt
    for (const s of settlements) {
        const fromId = (s.from._id ?? s.from).toString();
        const toId = (s.to._id ?? s.to).toString();
        // frm paid toId → reduces frm's debt to toId
        addEdge(toId, fromId, s.amount); // reverse direction cancels debt
    }

    return map;
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 2 — Derive settlement edges from the pairwise map.
 *
 * @param {Object}  pairwiseMap  Output of buildPairwiseMap()
 * @param {Object}  memberInfo   Map of { memberId → { _id, name, isPending, ... } }
 *                               Used to enrich the output edges with user info objects.
 * @param {boolean} simplify     If true run min-cash-flow; if false return raw edges.
 *
 * @returns {Array<{ from: Object, to: Object, amount: number }>}
 */
export const deriveSettlementEdges = (pairwiseMap, memberInfo, simplify) => {
    if (!simplify) {
        // Return raw pairwise edges
        const edges = [];
        for (const [key, net] of Object.entries(pairwiseMap)) {
            if (Math.abs(net) < 0.01) continue;
            const [idA, idB] = key.split('_');
            // positive → A owes B
            const fromId = net > 0 ? idA : idB;
            const toId   = net > 0 ? idB : idA;
            const from = memberInfo[fromId];
            const to   = memberInfo[toId];
            if (!from || !to) continue;
            edges.push({ from, to, amount: round2(Math.abs(net)) });
        }
        return edges;
    }

    // Min-cash-flow greedy simplification
    // Step (a): compute net balance per user from pairwise map
    const netBalance = {}; // positive = creditor (others owe them); negative = debtor (they owe)

    for (const [key, net] of Object.entries(pairwiseMap)) {
        if (Math.abs(net) < 0.01) continue;
        const [idA, idB] = key.split('_');
        // positive net → A owes B → A loses, B gains
        if (!(idA in netBalance)) netBalance[idA] = 0;
        if (!(idB in netBalance)) netBalance[idB] = 0;
        netBalance[idA] = round2(netBalance[idA] - net); // A is debtor for `net`
        netBalance[idB] = round2(netBalance[idB] + net); // B is creditor for `net`
    }

    // Step (b): separate creditors and debtors
    const creditors = []; // { id, amount }
    const debtors   = []; // { id, amount }

    for (const [id, bal] of Object.entries(netBalance)) {
        if (bal > 0.01)  creditors.push({ id, amount: bal });
        if (bal < -0.01) debtors.push({ id, amount: Math.abs(bal) });
    }

    // Step (c): greedy matching — largest debtor ↔ largest creditor
    const edges = [];

    while (debtors.length > 0 && creditors.length > 0) {
        // Sort descending by amount
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        const debtor   = debtors[0];
        const creditor = creditors[0];

        const transferAmount = round2(Math.min(debtor.amount, creditor.amount));

        const from = memberInfo[debtor.id];
        const to   = memberInfo[creditor.id];

        if (from && to && transferAmount > 0.01) {
            edges.push({ from, to, amount: transferAmount });
        }

        debtor.amount   = round2(debtor.amount   - transferAmount);
        creditor.amount = round2(creditor.amount - transferAmount);

        if (debtor.amount   < 0.01) debtors.shift();
        if (creditor.amount < 0.01) creditors.shift();
    }

    return edges;
};

/**
 * Convenience helper: compute per-member totals (paid, owes, balance)
 * from the pairwise map without duplicating logic in the controller.
 *
 * @param {Object} pairwiseMap  Output of buildPairwiseMap()
 * @returns {Record<string, { paid: number, owes: number, balance: number }>}
 */
export const computeMemberTotals = (pairwiseMap) => {
    const totals = {};

    const ensureEntry = (id) => {
        if (!(id in totals)) totals[id] = { paid: 0, owes: 0, balance: 0 };
    };

    for (const [key, net] of Object.entries(pairwiseMap)) {
        if (Math.abs(net) < 0.01) continue;
        const [idA, idB] = key.split('_');
        ensureEntry(idA);
        ensureEntry(idB);
        // positive → A owes B → A has debt, B is owed
        totals[idA].owes    = round2(totals[idA].owes    + (net > 0 ? net : 0));
        totals[idB].owes    = round2(totals[idB].owes    + (net < 0 ? Math.abs(net) : 0));
        totals[idA].balance = round2(totals[idA].balance - (net > 0 ? net : 0));
        totals[idB].balance = round2(totals[idB].balance + (net > 0 ? net : 0));
    }

    return totals;
};

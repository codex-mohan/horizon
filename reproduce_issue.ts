
import {
    buildBranchOptionsMap,
    findBranchOptionsForMessage,
    type BranchTreeItem,
    debugPrintTree
} from "./apps/web/lib/tree-utils";

// Mock tree with a fork where one branch has continued (Sequence)
// This represents: Msg 1 -> Fork [Msg 2a, Seq(Msg 2b -> Msg 3)]
const mockTree: BranchTreeItem = {
    type: "sequence",
    items: [
        {
            type: "node",
            value: {
                checkpoint: { checkpoint_id: "cp-1" },
                values: { messages: [{ id: "msg-1", content: "Hi" }] }
            }
        },
        {
            type: "fork",
            items: [
                {
                    type: "node", // Branch 1 (Head)
                    value: {
                        checkpoint: { checkpoint_id: "cp-2a" },
                        values: { messages: [{ id: "msg-2a", content: "A" }] }
                    }
                },
                {
                    type: "sequence", // Branch 2 (Head + Continuation)
                    items: [
                        {
                            type: "node", // Head of Branch 2
                            value: {
                                checkpoint: { checkpoint_id: "cp-2b" },
                                values: { messages: [{ id: "msg-2b", content: "B" }] }
                            }
                        },
                        {
                            type: "node", // Continuation (Should NOT have options)
                            value: {
                                checkpoint: { checkpoint_id: "cp-3" },
                                values: { messages: [{ id: "msg-3", content: "Reply to B" }] }
                            }
                        }
                    ]
                }
            ]
        }
    ]
};

console.log("--- Tree Structure ---");
debugPrintTree(mockTree);

console.log("\n--- Building Branch Options Map ---");
const map = buildBranchOptionsMap(mockTree);

console.log("\n--- Verification ---");

// Helper to check
function check(id: string, shouldHaveOptions: boolean, label: string) {
    const entry = map.get(id);
    const findResult = findBranchOptionsForMessage(mockTree, id);

    const hasMapOptions = !!(entry && entry.branchOptions && entry.branchOptions.length > 0);
    const hasFindOptions = !!(findResult && findResult.branchOptions && findResult.branchOptions.length > 0);

    console.log(`[${label}] Message ${id}:`);
    console.log(`  Map Entry: ${hasMapOptions ? "YES" : "NO"} ${entry ? JSON.stringify(entry.branchOptions) : ""}`);
    console.log(`  FindResult: ${hasFindOptions ? "YES" : "NO"} ${findResult ? JSON.stringify(findResult.branchOptions) : ""}`);

    if (hasMapOptions !== shouldHaveOptions) {
        console.error(`  FAIL: Expected options ${shouldHaveOptions} but got ${hasMapOptions} (Map)`);
    } else {
        console.log("  PASS (Map)");
    }

    if (hasFindOptions !== shouldHaveOptions) {
        console.error(`  FAIL: Expected options ${shouldHaveOptions} but got ${hasFindOptions} (Find)`);
    } else {
        console.log("  PASS (Find)");
    }
}

// 1. Msg 1 (Root) - Should NOT have options (it's before the fork)
check("msg-1", false, "Root Message");

// 2. Msg 2a (Branch 1 Head) - SHOULD have options
check("msg-2a", true, "Branch 1 Head");

// 3. Msg 2b (Branch 2 Head) - SHOULD have options (even though inside Sequence)
check("msg-2b", true, "Branch 2 Head (inside Seq)");

// 4. Msg 3 (Branch 2 Continuation) - Should NOT have options
check("msg-3", false, "Branch 2 Continuation");

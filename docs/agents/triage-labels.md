# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (GitHub Issues on `CAI991108/CAI991108.github.io`).

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

The five default labels are used as-is; all five exist on the repo. An issue carries at most one triage role at a time.

Wayfinding labels are **not** triage roles and are never mixed with them:

| Label               | Used on                                              |
| ------------------- | ---------------------------------------------------- |
| `wayfinder:map`     | the single map issue of a wayfinding effort          |
| `wayfinder:research`| an AFK research ticket                               |
| `wayfinder:prototype`| a HITL prototype ticket                             |
| `wayfinder:grilling`| a HITL conversation ticket                           |
| `wayfinder:task`    | a manual-work ticket that unblocks a decision         |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from the first table.

---
description: Review code and fix issues iteratively
subtask: true
return:
  - Challenge the findings directly against the codebase
  - Implement valid fixes only
  - /fix-tests {loop:5 && until:all tests pass}
---
Review $ARGUMENTS for bugs, security issues, and code quality. Be specific with file references.

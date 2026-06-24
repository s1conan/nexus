---
description: Compare different model opinions on a problem
subtask: true
parallel:
  - /subtask {model:lmstudio/qwen/qwen3.6-35b-a3b && as:qwen}
  - /subtask {model:google/antigravity-gemini-3-flash && as:gemini}
return:
  - "Compare $RESULT[qwen] vs $RESULT[gemini]. Which is better and why?"
---
Analyze $ARGUMENTS and suggest improvements. Be concise.

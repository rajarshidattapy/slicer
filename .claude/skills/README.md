# Project skills

Each skill lives in its own folder with a `SKILL.md` file:

```
.claude/skills/
└── my-skill/
    ├── SKILL.md        # required
    └── ...             # optional helper scripts, references, examples
```

`SKILL.md` template:

```markdown
---
name: my-skill
description: One or two sentences on what the skill does and when Claude should use it.
---

# My skill

Step-by-step instructions Claude should follow when this skill is invoked.
```

Skills in this folder are shared with everyone who clones the repo. Invoke one
with `/my-skill` or let Claude pick it up from its description.

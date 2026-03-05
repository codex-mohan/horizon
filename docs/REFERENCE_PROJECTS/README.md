# Reference Projects

This directory is used to store **cloned or copied reference projects** that AI coding agents can study, adapt patterns from, and implement within Horizon.

## Purpose

When working with an AI coding agent, you may want it to study a specific open-source project's implementation — for example, to understand how a library is used, to replicate a UI pattern, or to adapt an architectural approach. Clone or copy the relevant project (or portions of it) into this directory so the agent can access it as context.

## Usage

```bash
# Clone a reference project
cd docs/REFERENCE_PROJECTS
git clone https://github.com/user/project.git

# Or copy specific files/folders
cp -r /path/to/reference/code ./project-name
```

## Guidelines

- **Temporary**: Reference projects should be treated as temporary. Remove them when no longer needed.
- **Don't commit**: This directory is gitignored to avoid bloating the repository. Only the README.md is tracked.
- **Subset is better**: Where possible, copy only the relevant files instead of entire repositories.
- **Document context**: If you add a project, leave a note below about what it's being referenced for.

## Currently Referenced Projects

_None — add entries here as you clone projects._

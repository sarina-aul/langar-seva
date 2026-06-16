# Magic Patterns ↔ Seva Eats Integration

Design screens in Magic Patterns, then bring components into the Vite React app in `web/`.

**Project URL:** https://project-seva-eats-delivery-platform-244.magicpatterns.app/

## 1. Design in Magic Patterns

1. Open the [Seva Eats project](https://project-seva-eats-delivery-platform-244.magicpatterns.app/).
2. Design mobile-first — most recipients will use phones.
3. Keep the tone **calm and dignified**: generous whitespace, warm cream backgrounds, minimal chrome.
4. Key v1 screens:
   - **Intake form** — contact, address, meals, delivery window, optional notes
   - **Confirmation** — “Pending review” status, no account creation

### Design tokens (map to CSS variables in `web/src/index.css`)

| Magic Patterns token | CSS variable | Value |
|---------------------|--------------|-------|
| Display font (Fraunces) | `--font-display` | `'Fraunces', Georgia, serif` |
| Body font | `--font-body` | system-ui stack |
| Cream background | `--color-cream` | `#fff8f0` |
| Surface / cards | `--color-surface` | `#ffffff` |
| Kesari accent | `--color-kesari` | `#e87820` |
| Kesari dark (hover) | `--color-kesari-dark` | `#c45f10` |
| Kesari light (focus ring) | `--color-kesari-light` | `#fde8d4` |
| Primary text | `--color-text` | `#1a1a18` |
| Secondary text | `--color-text-secondary` | `#5c5f5a` |

Load Fraunces in `web/index.html` via Google Fonts (already wired).

## 2. Pull components via MCP (Cursor)

The **user-magic-patterns** MCP server is enabled in Cursor. Typical workflow:

```
1. get_editor_id_from_url(url: "https://project-seva-eats-delivery-platform-244.magicpatterns.app/")
   → returns editorId

2. get_artifact(editorId: "<id>")
   → returns artifactId + file list

3. read_artifact_files(artifactId: "<id>", fileNames: ["App.tsx", "components/IntakeForm.tsx"])
   → returns generated React/Tailwind code
```

**Important:** Magic Patterns output is a **starting point**, not production-ready. Adapt to this project's conventions:

- Plain CSS modules / CSS files (no Tailwind unless you add it)
- `getSupabase()` from `web/src/lib/supabase.ts` for data
- Types from `web/src/types/database.ts`

### MCP tool reference

| Tool | When to use |
|------|-------------|
| `get_editor_id_from_url` | Resolve project URL → editor ID |
| `get_design_status` | Check if a design generation is complete |
| `get_artifact` | Get latest artifact ID (always refresh — editor is collaborative) |
| `read_artifact_files` | Read specific component files |
| `create_new_artifact` | Branch before editing in Magic Patterns |
| `send_prompt` | Ask Magic Patterns to revise a screen |

## 3. Manual export (no MCP)

1. In Magic Patterns, open the screen you want.
2. Use **Export code** (or copy JSX from the editor).
3. Paste into `web/src/components/` — e.g. replace or extend `IntakeForm.tsx`.
4. Replace Tailwind classes with project CSS variables from the table above.
5. Wire form `onSubmit` to `getSupabase().from('recipients').insert({ ... status: 'pending' })`.

## 4. Recommended file mapping

| Magic Patterns screen | React file |
|----------------------|------------|
| Landing / hero | `web/src/components/Layout.tsx` |
| Intake form | `web/src/components/IntakeForm.tsx` |
| Confirmation | `web/src/components/Confirmation.tsx` |
| Global styles | `web/src/index.css` |

## 5. Design review checklist

- [ ] Mobile viewport (375px) looks correct
- [ ] Touch targets ≥ 44px
- [ ] Focus states visible (kesari ring)
- [ ] Language selector includes Punjabi, Hindi, Urdu
- [ ] Confirmation shows **Pending review** — not “approved”
- [ ] No login/signup CTAs on intake v1

## 6. Keeping design and code in sync

1. Design iteration happens in Magic Patterns.
2. Pull deltas via MCP `read_artifact_files`.
3. Merge visual changes into `web/src/components/*.css` tokens.
4. Keep business logic (Supabase insert, validation) in the React files — don't overwrite from Magic Patterns blindly.

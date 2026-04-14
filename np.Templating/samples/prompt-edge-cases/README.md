# Prompt edge-case templates (np.Templating)

Copy these notes into your `@Templates` (or `@Forms`) folder, or open them from this repo when testing. They are meant to exercise **Command Bar form batching** (NotePlan **3.21+** with `commandBarForms`) and **sequential** fallbacks.

## What to expect on 3.21+

| File | Expected behavior |
|------|-------------------|
| `00-single-string-prompt.md` | **One** `prompt` only → **does not** call `CommandBar.showForm` (batching runs only for **two or more** consecutive batchable prompts). Use for baseline / `textPrompt` path. |
| `00b-two-string-fields-minimal-batch.md` | **Two** plain string prompts → smallest template that should call `showForm` once with **two** `type: 'string'` fields. Check plugin log for `Form fields` (`clo`) output. |
| `01-batch-happy-path.md` | One **multi-field** `CommandBar.showForm` for five questions (text, choice, text, date, date). |
| `02-dependent-choices-sequential.md` | **No** batch: second prompt’s choices depend on the first answer → separate prompts. |
| `03-comment-breaks-batch.md` | Two prompts with a **comment** tag between them — whether that splits batching depends on your NotePlan / template pipeline (comments are often removed early, so you may still see **one** form). Use to double-check behavior on your install. |
| `04-interval-splits-batch.md` | `promptDateInterval` is not form-batchable → breaks the chain; you may see one batched form **after** the interval for the last two `prompt` tags only. |
| `05-promptTag-breaks-batch.md` | `promptTag` is not batchable → prompts around it run separately; tag picker in the middle. |
| `06-const-assignments-batched.md` | Two `const ... = prompt(...)` tags in a row → one form, assignments applied. |
| `07-mixed-output-and-execution-tags.md` | Execution-only `<% ... %>` prompts (no output) plus output `<%- ... %>`; batching still applies to consecutive eligible tags. |
| `08-defaults-and-optional-date.md` | String **default** on a text field; date with default + `canBeEmpty` → check **required** vs optional in the form. |
| `09-promptKey-breaks-batch.md` | `promptKey` in the middle → three steps; no single form for all three. |
| `10-duplicate-var-names-deduped.md` | Two `prompt('x', ...)` tags → one batched form with **deduped** field keys; confirms no collision crash. |

On older NotePlan builds (or when `CommandBar.showForm` is unavailable), the plugin falls back to **one prompt at a time**; behavior should remain correct, only slower.

## References

- [Templating docs — prompts](https://noteplan.co/templates/docs)
- [Command Bar forms](https://help.noteplan.co/article/281-commandbar-forms-plugin)

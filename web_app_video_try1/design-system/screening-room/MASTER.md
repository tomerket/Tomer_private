# Screening Room — Design Master

The source of truth for visual decisions. Tokens live in `app/globals.css` (`@theme` and `@utility`); the living style tile is at **`/design`**. Page-specific overrides go in `pages/<page>.md`.

## Brief
A premium, dark-only video platform. Near-black background, one restrained warm accent, high-contrast white text, tight typography. The thumbnails carry the colour; the interface stays out of their way. Revised 2026-11-10 to follow the owner's reference tiles: three typefaces, mono timecodes, pill controls, numbered sections and caps labels on the tile, and an amber playhead on cards.

## Accent rule
Amber `#EAA64A` marks what is **live, playing, or yours**:
- focus rings
- the card playhead
- upload progress
- the publish switch when on
- the selected thumbnail frame
- the current playlist item
- **exactly one primary action per view**

It never colours headings, body links, large backgrounds or labels that only describe content. The members badge and meta line stay neutral.

## Color
| Token | Hex | Role | Contrast on canvas |
|---|---|---|---|
| `canvas` | `#0A0A0B` | page background | |
| `surface` | `#141416` | panels, fields, avatars | |
| `raised` | `#1C1C1F` | hover fills, image wells | |
| `line` | `#26262A` | hairline borders | |
| `line-strong` | `#34343A` | outline buttons, hovered fields | |
| `fg` | `#F4F4F5` | primary text | 18.0:1 |
| `fg-muted` | `#A6A6AE` | channel, secondary | 8.2:1 |
| `fg-faint` | `#7D7D86` | meta, hints; canvas and surface only | 4.9:1 |
| `accent` | `#EAA64A` | live, playing, yours | 9.5:1 |
| `on-accent` | `#140C02` | text on accent | 9.3:1 on accent |

## Type
**Faces**
- **Space Grotesk:** the display voice, held in reserve.
- **Inter Tight:** the dense interface.
- **Space Mono:** durations, counts and hex values, read as timecode.

| Utility | Face | Weight | Size / line | Tracking |
|---|---|---|---|---|
| `type-display-xl` | Space Grotesk | 700 | 56 / 0.98 | −3% |
| `type-display` (+ `font-display`) | Space Grotesk | 500 | 30 / 1.1 | −2% |
| `type-heading` | Inter Tight | 600 | 20 / 26 | −1.2% |
| `type-title` | Inter Tight | 500 | 14 / 19 | −0.6% |
| `type-body` | Inter Tight | 400 | 15 / 22 | −0.3% |
| `type-meta` | Inter Tight | 400 | 13 / 18, tabular | 0 |
| `type-label` | Inter Tight | 600 | 11 / 14, caps | +12% |
| `type-timecode` | Space Mono | 400 | 12 / 16, tabular | +2% |

## Shape and space
- 4px base. Radius: thumb 10px, control 8px (panels, rows, textarea), chip 4px (badges), pill (buttons, single-line fields).

## Controls
| Variant | Look | Use |
|---|---|---|
| `primary` | amber pill | the one primary action, e.g. Upload |
| `strong` | white pill | a confident secondary, e.g. Publish |
| `outline` | line-strong border | a settled state, e.g. Published |
| `ghost` | surface fill | minor actions, e.g. Edit |

- **Badges:** timecode (Space Mono on black/75 with blur); "● Live" (amber dot) for published; "Members" with a lock; "Draft" in faint caps.
- **Avatars:** 28 / 36 / 56px circles showing the channel initial.

## Thumbnail card (`components/VideoCard.tsx`)
| Part | Spec |
|---|---|
| Image | 16:9, radius 10px, object-cover, 1px inset hairline (white 7%) |
| Hover | image eases to 103% over 500ms; channel turns muted → white |
| Timecode | Space Mono 12px, black/75 + blur, bottom-right 8px, radius 4px; "--:--" until the length is known |
| Playhead | 3px amber bar with glow on the bottom edge; scrubs 0 → 32% on hover |
| Title | Inter Tight 14 / 500, 2-line clamp |
| Channel | Inter Tight 13px, muted → white on hover |
| Meta | Inter Tight 13px faint, tabular; "Members only · 3 days ago" with a lock when gated |
| Avatar | 36px circle, initial, surface → raised on hover |
| Rhythm | 12px image → text, 12px avatar gap |

Real watch progress on the playhead isn't built: it needs stored playback position. For now the playhead is the hover nudge only.

## Feed grid (`.video-grid`) and page container (`.page`)
- Columns: 1, then 2 / 3 / 4 / 5 / 6 at 520 / 840 / 1120 / 1440 / 1800px.
- Gaps: 16px between columns, 36px between rows.
- Gutters: 16 → 24 → 32px. Content caps at 2048px.

## Style tile conventions
Sections carry amber mono numbers (01, 02 …) and caps labels above groups, following the reference. On product pages, caps labels are used sparingly, for grouping only.

## Motion
Only in response to the user: image ease-in, playhead scrub, switch thumb, progress. No scroll reveals. `prefers-reduced-motion` disables transitions.

## Pre-delivery checklist
- [ ] Amber focus ring visible on every control
- [ ] Text contrast ≥ 4.5:1; `fg-faint` only on canvas or surface
- [ ] Tested at 375, 768, 1024, 1440 and 1920px
- [ ] One amber action per view

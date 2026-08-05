# File move map

This map records intended migrations. No active frontend asset or feature file is moved until its imports and route output are verified.

| Current path | Target path | Change | Reason | Verified |
| --- | --- | --- | --- | --- |
| `frontend/src/app/**/page.tsx` | Same route path | Retain thin route files | Preserve App Router URLs | Yes |
| `frontend/src/features/**` | Same paths | Retain | Existing MVVM feature convention | Yes |
| `frontend/src/shared/components/**` | Same paths | Retain | Existing reusable component convention | Yes |
| `frontend/assets/bg.png` | `frontend/public/images/backgrounds/bg.png` | Planned move | Runtime asset normalization | No |
| `frontend/assets/growth-doorway-hill.png` | `frontend/public/images/landing/growth-doorway-hill.png` | Planned move | Runtime asset normalization | No |
| `frontend/assets/Landing Page/*` | `frontend/public/images/landing/*` | Planned rename/move | Public asset names and URL loading | No |
| `frontend/assets/auth-*.png` | `frontend/public/images/authentication/*` | Planned rename/move | Public asset names and URL loading | No |
| `frontend/outputs/` | `ml/outputs/` | Planned relocation | Separate generated ML output | No |
| `frontend/work/` | `work/` | Planned relocation | Separate temporary workspace | No |

Asset moves are intentionally not part of the first structural change because the current landing and auth screens are actively being edited.

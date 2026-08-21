# Legacy Local Feature Baseline

- `index.html` opens as a browser page without a build step.
- Login is a local username marker, not remote authentication.
- New-word learning uses four answer options.
- Review uses FSRS-6 through `ts-fsrs@5.4.1`.
- Keyboard shortcuts: `1-4` select, `Enter` continues, `Escape` exits.
- In-progress sessions are persisted and can be resumed.
- `data.js` contains the checked-in public vocabulary.
- `sentences.js` contains the checked-in exam sentences and translations.
- Excel import and export are available through SheetJS.
- User progress is stored in localStorage and IndexedDB.
- Browser-side GitHub repository access is removed before the rewrite.

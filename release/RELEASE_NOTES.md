## Role Credits Studio v0.2.6.1 — Hybrid Parents + Offline Companion

This is a single coordinated update from **v0.2.6.0**, preserving the existing typing/scroll stability and Homebrew Library updates.

### Character creation and Player sheet
- Actively select one standard Physical, Mental, or Spiritual **parent Ability for each of the six Hybrid Abilities** when creating a character, even if that Hybrid currently has no Dots. The builder prevents completion until all six have a parent.
- Each Hybrid's parent determines its starting Body/Mind/Spirit Dot budget. The chosen parent and associated Core Stat are shown directly beneath that Hybrid on the **Play character sheet**.
- The parent Core Stat is preselected when rolling a Hybrid. The choice persists in the build receipt, saved character, roster and offline save.
- Previously completed v0.2.6.0 characters stay playable. Unassigned legacy Hybrid parents are labeled explicitly rather than guessed.

### Offline Companion and scene tracker
- Open a local Scene directly from the home screen even with an unfinished character, while ordinary Player Sheet, Growth and other play features continue to require a valid build.
- Record the first Mission Resolution from the Character Sheet or Growth without connecting to the Director. This unlocks eligible permanent advancement without automatically granting Tokens.
- Place saved Homebrew Threats on the Scene Map. Every placed copy receives its own Core Stats, Health Tracks, conditions, notes, and Technique Uses without changing the saved template.
- Track Body, Mind and Spirit HP per token in scene controls and collapsible floating sheets. Generic tokens support manually configured maxima.
- Maintain initiative offline: add map combatants or manual entries, rearrange, remove, declare in reverse order, resolve forward, and advance rounds.
- Keep private Threat sheets and HP out of shared public Scene snapshots. Player permissions remain enforced, with host authority preserved.

### Packaging and delivery
- The **same canonical HTML** is synchronized into standalone browser, Windows desktop and Android WebView assets. Windows and Android maintain their existing updater behavior and Android signing/application ID.
- Browser regressions include creation, save/reload, Hybrid rolls, the offline companion fixture and private Threat data checks.

Export a campaign backup before installing. Real Windows updater handoff, Android same-certificate upgrade, keyboard behavior and hosted multiplayer still require physical/device verification before promotion beyond prerelease. Existing release assets must not be overwritten.

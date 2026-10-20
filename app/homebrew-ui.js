      const hbModel = RoleCreditsHomebrew;
      const hbUI = { search: "", type: "", category: "", collection: "", collectionName: "", dependencies: true, selected: new Set(), pending: null, choices: {}, status: "" };

      function hbLibrary() {
        for (const type of Object.keys(hbModel.TYPES)) state.library[type] ||= [];
        state.library.collections ||= [];
        return state.library;
      }
      function hbBackupKey() { return "roleCreditsHomebrewBackup:" + (campaignActive()?.id || "free"); }
      function hbMessage(message) {
        hbUI.status = message;
        const status = document.getElementById("hbStatus");
        if (status) status.textContent = message;
      }
      function hbFiltered() {
        const library = hbLibrary(), collection = library.collections.find(item => item.id === hbUI.collection);
        return hbModel.entries(library).filter(item => (!hbUI.type || item.type === hbUI.type) &&
          (!hbUI.category || hbCategory(item) === hbUI.category) &&
          (!collection || collection.members.some(member => item.type === member.type && item.data.id === member.id)) &&
          (!hbUI.search || JSON.stringify(item.data).toLocaleLowerCase().includes(hbUI.search.toLocaleLowerCase())));
      }
      function hbCategory(item) { return item.data.category || item.data.classification || item.data.type || item.data.scale || item.data.severity || "Uncategorized"; }
      function hbOptions(values, selected, label) {
        return `<option value="">${label}</option>` + values.map(([value, text]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(text)}</option>`).join("");
      }
      function hbButton(action, label, key = "") { return `<button type="button" class="btn" data-hb-action="${action}" data-hb-key="${esc(key)}">${label}</button>`; }

      function renderHomebrewLibrary() {
        const host = document.getElementById("creationLibrary");
        if (!host) return;
        const library = hbLibrary(), all = hbModel.entries(library), visible = hbFiltered();
        const keys = new Set(all.map(hbModel.key));
        hbUI.selected = new Set([...hbUI.selected].filter(itemKey => keys.has(itemKey)));
        const categories = [...new Set(all.filter(item => !hbUI.type || item.type === hbUI.type).map(hbCategory))].sort();
        rcPatchHTML(host, `<section class="hb-library" aria-label="Homebrew Library">
          <div class="hb-heading"><div><small>YOUR OFFLINE WORKSHOP</small><h2>Homebrew Library</h2><p>Browse reusable designs. Share a single item, a collection, or your whole library.</p></div><span class="hb-total">${all.length} items</span></div>
          <div class="hb-toolbar">${hbButton("import", "Import / Restore JSON")}${hbButton("export-all", "Export Library")}${hbButton("backup", "Download Backup")}${hbButton("restore", "Recover Last Local Backup")}</div>
          <p class="hb-status" id="hbStatus" role="status" aria-live="polite">${esc(hbUI.status || "Library imports leave live characters, teams, campaign profiles, and play marks in place.")}</p>
          <div class="hb-filters"><label>Search library<input id="hbSearch" type="search" value="${esc(hbUI.search)}" placeholder="Name, Tags, rules text…"></label>
            <label>Type<select id="hbType">${hbOptions(Object.entries(hbModel.TYPES), hbUI.type, "All types")}</select></label>
            <label>Category<select id="hbCategory">${hbOptions(categories.map(value => [value, value]), hbUI.category, "All categories")}</select></label>
            <label>Collection<select id="hbCollection">${hbOptions(library.collections.map(item => [item.id, item.name]), hbUI.collection, "Whole library")}</select></label></div>
          <div class="hb-toolbar"><label class="hb-check"><input type="checkbox" id="hbSelectVisible" ${visible.length && visible.every(item => hbUI.selected.has(hbModel.key(item))) ? "checked" : ""}> Select visible (${visible.length})</label>
            <span id="hbSelectionCount">${hbUI.selected.size} selected</span>${hbButton("clear-selection", "Clear")}${hbButton("export-selection", "Export Selected")}${hbButton("share-selection", "Share Pack")}
            ${hbUI.collection ? hbButton("export-collection", "Export Collection") + hbButton("remove-collection", "Remove Collection") : ""}</div>
          <div class="hb-toolbar"><label>Collection name<input id="hbCollectionName" value="${esc(hbUI.collectionName)}" placeholder="e.g. Midnight Heist"></label>${hbButton("collection", "Save Selection as Collection")}
            <label class="hb-check"><input id="hbDependencies" type="checkbox" ${hbUI.dependencies ? "checked" : ""}> Include linked designs in exports</label></div>
          <details class="hb-capture"><summary>Save character / build / team snapshots</summary><p>These become reusable library copies. Importing a snapshot never replaces your active sheet.</p><div class="hb-toolbar">
            <label>Capture<select id="hbCaptureType"><option value="characters">Active character</option><option value="characterBuilds">Current character build draft</option><option value="teams">Current team</option><option value="signatures">Character Signature Moves</option></select></label>
            ${hbButton("capture", "Preview Snapshot")}</div></details>
          <div class="hb-grid" id="hbResults">${visible.map(item => {
            const itemKey = hbModel.key(item), data = item.data;
            return `<article class="hb-card" data-key="${esc(itemKey)}"><label class="hb-item-select"><input type="checkbox" data-hb-select="${esc(itemKey)}" ${hbUI.selected.has(itemKey) ? "checked" : ""}> Select ${esc(data.name)}</label>
              <small>${esc(hbModel.TYPES[item.type])} · ${esc(hbCategory(item))}</small><h3>${esc(data.name)}</h3><p>${esc(String(data.description || data.concept || data.premise || data.effect || data.once || data.perk || data.goal || data.question || data.primaryObjective || data.threatenedThing || "Reusable library entry").slice(0, 180))}</p>
              <div class="hb-card-actions">${hbButton("preview", "Preview", itemKey)}${hbButton("export-item", "Export", itemKey)}${hbButton("edit", "Edit", itemKey)}${hbButton("delete", "Delete", itemKey)}</div></article>`;
          }).join("") || `<p class="hb-empty">${all.length ? "No matches. Try a different search or filter." : "Your library is ready. Save a design in any builder, capture a snapshot, or import a pack."}</p>`}</div>
        </section>`);
      }

      function hbDialog(title, body) {
        let dialog = document.getElementById("hbDialog");
        if (!dialog) {
          dialog = document.createElement("dialog");
          dialog.id = "hbDialog";
          dialog.className = "hb-dialog";
          dialog.setAttribute("aria-labelledby", "hbDialogTitle");
          document.body.appendChild(dialog);
        }
        rcPatchHTML(dialog, `<div class="hb-dialog-header"><h2 id="hbDialogTitle">${esc(title)}</h2>${hbButton("close", "Close")}</div><div id="hbDialogBody">${body}</div>`);
        if (!dialog.open) {
          dialog.showModal();
          dialog.querySelector('button[data-hb-action="close"]')?.focus({ preventScroll: true });
        }
      }
      function hbClose() { document.getElementById("hbDialog")?.close(); hbUI.pending = null; }
      function hbImportDialog() {
        hbUI.pending = null;
        hbDialog("Import or restore a Homebrew pack", `<p>Choose a versioned pack, a library backup, or a legacy Studio export. Review every conflict before saving. Up to 18 MB / 5,000 items.</p>
          <label>Choose JSON file<input id="hbImportFile" type="file" accept="application/json,.json"></label>
          <label>Or paste JSON<textarea id="hbImportText" rows="8" spellcheck="false" placeholder="Paste a Homebrew JSON pack"></textarea></label>
          <p id="hbImportError" role="alert"></p>${hbButton("preview-import", "Preview Import")}`);
      }
      function hbPreviewImport(text) {
        try {
          hbUI.pending = hbModel.parse(text);
          hbUI.choices = {};
          hbRenderImport();
        } catch (error) {
          const target = document.getElementById("hbImportError");
          if (target) target.textContent = error.message; else hbMessage(error.message);
        }
      }
      function hbRenderImport() {
        if (!hbUI.pending) return;
        try {
          const plan = hbModel.plan(hbLibrary(), hbUI.pending, hbUI.choices);
          hbDialog("Review import · " + hbUI.pending.name, `<p>${plan.rows.length} entries · ${plan.added} will be saved · ${plan.unresolved.length} conflicts need a choice. No changes have been saved.</p>
            <p>A recovery backup is saved on this device before import. “Replace” changes only the chosen library design. Existing sheets and campaign play data stay in place. Incoming collections with matching names or IDs get a new name and ID.</p>
            <div class="hb-toolbar">${hbButton("skip-conflicts", "Skip All Conflicts")}${hbButton("copy-conflicts", "Keep Copies of Conflicts")}${hbUI.pending.kind === "backup" ? hbButton("preview-restore", "Preview Exact Library Restore") : ""}</div>
            ${plan.warnings.map(warning => `<p class="hb-warning">${esc(warning)}</p>`).join("")}
            <div id="hbImportRows">${plan.rows.map(row => `<article class="hb-import-row" data-key="import-${row.index}"><h3>${esc(row.item.data.name)}</h3><small>${esc(hbModel.TYPES[row.item.type])} · ${esc(row.item.data.id)}</small>
              <label>Import choice<select data-hb-choice="${row.index}">${(row.collisions.length ? [["review", "Choose how to resolve…"], ["skip", "Keep existing / skip incoming"], ["copy", "Keep both with new ID and name"], ...row.collisions.map(item => ["replace:" + item.data.id, "Replace “" + item.data.name + "” (" + item.data.id + ")"])] : [["add", "Add to library"], ["skip", "Skip this item"], ["copy", "Add as a named copy"]]).map(([value, label]) => `<option value="${esc(value)}" ${row.choice === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
              <details><summary>Preview incoming data${row.imported ? " → " + esc(row.imported.name) : ""}</summary><pre>${esc(JSON.stringify(row.item.data, null, 2))}</pre></details></article>`).join("")}</div>
            <p id="hbImportError" role="alert"></p><div class="hb-dialog-footer"><button class="btn yellow" type="button" data-hb-action="commit-import" ${plan.unresolved.length || !plan.added ? "disabled" : ""}>Import ${plan.added} Items</button>${hbButton("close", "Cancel")}</div>`);
        } catch (error) {
          const target = document.getElementById("hbImportError");
          if (target) target.textContent = error.message;
        }
      }
      function hbPersistLibrary(library, createBackup = true) {
        const original = state.library, originalCampaigns = structuredClone(campaignStore);
        const stateStorage = localStorage.getItem("roleCreditsStudio"), campaignStorage = localStorage.getItem(RC_CAMPAIGN_STORE_KEY);
        try {
          if (createBackup) localStorage.setItem(hbBackupKey(), JSON.stringify(hbModel.pack(original, null, { backup: true, name: "Before library change" })));
          state.library = library;
          save(false);
        } catch (error) {
          state.library = original;
          campaignStore = originalCampaigns;
          if (stateStorage != null) localStorage.setItem("roleCreditsStudio", stateStorage);
          if (campaignStorage != null) localStorage.setItem(RC_CAMPAIGN_STORE_KEY, campaignStorage);
          throw new Error("Library was not changed. Storage may be full; download a backup and free device space. " + error.message);
        }
      }
      function hbCommitImport() {
        if (!hbUI.pending) return;
        try {
          const plan = hbModel.plan(hbLibrary(), hbUI.pending, hbUI.choices);
          if (plan.unresolved.length) throw new Error("Resolve every conflict before importing.");
          if (!plan.added) return;
          hbPersistLibrary(plan.library);
          hbClose();
          hbMessage(`Imported ${plan.added} items. The previous library is available through Recover Last Local Backup.`);
          renderCreationSuites();
        } catch (error) { document.getElementById("hbImportError").textContent = error.message; }
      }
      function hbExactRestore(commit = false) {
        if (hbUI.pending?.kind !== "backup") return;
        const source = hbModel.parse(hbUI.pending), next = Object.fromEntries(Object.keys(hbModel.TYPES).map(type => [type, []]));
        for (const item of source.items) next[item.type].push(item.type === "customTags" ? item.data.name : structuredClone(item.data));
        next.collections = structuredClone(source.collections);
        const incoming = new Set(source.items.map(hbModel.key));
        const removed = hbModel.entries(hbLibrary()).filter(item => !incoming.has(hbModel.key(item)));
        if (!commit) {
          hbDialog("Restore this library backup exactly?", `<p>This replaces the current library with ${source.items.length} items and ${source.collections.length} collections from the backup. ${removed.length} current items will be removed. Live characters, teams, scenes, drafts, other campaign libraries, and play marks stay in place.</p>
            <p>A recovery backup of the current library is saved first.</p><h3>Backup items</h3><ul>${source.items.map(item => `<li>${esc(hbModel.TYPES[item.type])}: ${esc(item.data.name)}</li>`).join("")}</ul>
            <h3>Items removed from the library</h3><ul>${removed.map(item => `<li>${esc(item.data.name)}</li>`).join("") || "<li>None</li>"}</ul><p id="hbImportError" role="alert"></p>${hbButton("commit-restore", "Restore Library Snapshot")}${hbButton("close", "Cancel")}`);
          return;
        }
        try { hbPersistLibrary(next); hbClose(); hbUI.selected.clear(); hbUI.collection = ""; hbMessage("Library snapshot restored. Recover Last Local Backup can recover the previous library."); renderCreationSuites(); }
        catch (error) { document.getElementById("hbImportError").textContent = error.message; }
      }
      async function hbDownload(payload, share = false) {
        const json = JSON.stringify(payload, null, 2);
        if (new TextEncoder().encode(json).length > hbModel.MAX_BYTES) throw new Error("Export exceeds 18 MB. Export smaller selections or collections.");
        const name = (payload.name || "Homebrew").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) + ".json";
        if (window.RoleCreditsAndroid?.saveTextFile) { window.RoleCreditsAndroid.saveTextFile(name, json); return; }
        const file = new File([json], name, { type: "application/json" });
        if (share && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: payload.name }); return; }
          catch (error) { if (error.name === "AbortError") return; }
        }
        const url = URL.createObjectURL(file), anchor = document.createElement("a");
        anchor.href = url; anchor.download = name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      function hbExport(keys, name, backup = false, share = false) {
        const dependencies = document.getElementById("hbDependencies")?.checked !== false;
        return hbDownload(hbModel.pack(hbLibrary(), keys, { name, backup, dependencies }), share);
      }
      function hbFind(itemKey) { return hbModel.entries(hbLibrary()).find(item => hbModel.key(item) === itemKey); }
      function hbCapture() {
        const type = document.getElementById("hbCaptureType").value;
        let items;
        if (type === "signatures") items = (state.character.signatureMoves || []).map(signature => ({ type, data: { ...structuredClone(signature), id: hbModel.uid(), name: signature.name || "Signature Move" } }));
        else {
          const snapshot = structuredClone(type === "characters" ? state.character : type === "teams" ? state.team : state.creation.character);
          items = [{ type, data: { id: hbModel.uid(), name: snapshot.name || "Untitled " + hbModel.TYPES[type], snapshot } }];
        }
        if (!items.length) return hbMessage("This character has no Signature Moves to capture.");
        hbPreviewImport(JSON.stringify({ format: hbModel.FORMAT, schemaVersion: 2, name: "Saved snapshots", items }));
      }
      function hbEdit(item) {
        const editors = { cliques: editLibraryClique, backgrounds: editLibraryBackground, techniques: editLibraryTechnique,
          equipment: editLibraryEquipment, assets: editLibraryAsset, threats: editLibraryThreat, adventures: editAdventure,
          missions: editMission, scenes: editScene, crises: editCrisis };
        if (editors[item.type]) return editors[item.type](state.library[item.type].findIndex(existing => existing.id === item.data.id));
        hbDialog("Edit " + item.data.name, `<p>Edit this reusable library copy. Live sheets stay in place.</p><label>Item JSON<textarea id="hbEditText" rows="16" spellcheck="false">${esc(JSON.stringify(item.data, null, 2))}</textarea></label><p id="hbEditError" role="alert"></p>${hbButton("save-edit", "Save Changes", hbModel.key(item))}`);
      }
      async function hbAction(action, itemKey) {
        const library = hbLibrary(), item = hbFind(itemKey);
        if (action === "close") return hbClose();
        if (action === "import") return hbImportDialog();
        if (action === "preview-import") return hbPreviewImport(document.getElementById("hbImportText").value);
        if (action === "commit-import") return hbCommitImport();
        if (action === "preview-restore") return hbExactRestore();
        if (action === "commit-restore") return hbExactRestore(true);
        if (action === "skip-conflicts" || action === "copy-conflicts") {
          const plan = hbModel.plan(library, hbUI.pending, hbUI.choices);
          for (const row of plan.rows) if (row.collisions.length) hbUI.choices[row.index] = action === "skip-conflicts" ? "skip" : "copy";
          return hbRenderImport();
        }
        if (action === "restore") {
          const backup = localStorage.getItem(hbBackupKey());
          if (!backup) return hbMessage("No local recovery backup exists for this campaign yet. Use Import / Restore JSON for a downloaded backup.");
          return hbPreviewImport(backup);
        }
        if (action === "backup") return hbExport(null, "Homebrew_Library_Backup", true);
        if (action === "export-all") return hbExport(null, "Homebrew_Library");
        if (action === "export-item" && item) return hbExport([itemKey], item.data.name);
        if (["export-selection", "share-selection"].includes(action)) {
          if (!hbUI.selected.size) return hbMessage("Select at least one item to export.");
          return hbExport([...hbUI.selected], "Homebrew_Pack", false, action === "share-selection");
        }
        if (action === "export-collection") {
          const collection = library.collections.find(existing => existing.id === hbUI.collection);
          if (collection) return hbExport(collection.members.map(member => member.type + ":" + member.id), collection.name);
        }
        if (action === "capture") return hbCapture();
        if (action === "preview" && item) return hbDialog(item.data.name, `<p>${esc(hbModel.TYPES[item.type])}</p><pre>${esc(JSON.stringify(item.data, null, 2))}</pre>${hbButton("export-item", "Export Item", itemKey)}`);
        if (action === "edit" && item) return hbEdit(item);
        if (action === "save-edit" && item) {
          try {
            const data = JSON.parse(document.getElementById("hbEditText").value);
            if (data.id !== item.data.id) throw new Error("Keep the existing ID when editing. Use import with Keep Both to make a copy.");
            const parsed = hbModel.parse({ format: hbModel.FORMAT, schemaVersion: 2, items: [{ type: item.type, data }] });
            const plan = hbModel.plan(library, parsed, { 0: "replace:" + item.data.id });
            hbPersistLibrary(plan.library); hbClose(); renderHomebrewLibrary();
          } catch (error) { document.getElementById("hbEditError").textContent = error.message; }
          return;
        }
        if (action === "delete" && item) {
          if (!confirm(`Delete “${item.data.name}” from this library? Existing sheets retain their copies; linked library designs may need reselection. A recovery backup is kept.`)) return;
          const next = structuredClone(library);
          next[item.type] = next[item.type].filter(data => item.type === "customTags" ? data !== item.data.name : data.id !== item.data.id);
          next.collections.forEach(collection => { collection.members = collection.members.filter(member => member.type + ":" + member.id !== itemKey); });
          hbPersistLibrary(next); hbUI.selected.delete(itemKey); renderHomebrewLibrary(); return;
        }
        if (action === "collection") {
          const name = document.getElementById("hbCollectionName").value.trim();
          if (!name || !hbUI.selected.size) return hbMessage("Enter a collection name and select its items.");
          if (library.collections.some(collection => collection.name.trim().toLowerCase() === name.toLowerCase())) return hbMessage("That collection name already exists. Choose a new name; nothing was replaced.");
          const next = structuredClone(library), collection = { id: hbModel.uid(), name, members: hbModel.entries(library).filter(entry => hbUI.selected.has(hbModel.key(entry))).map(entry => ({ type: entry.type, id: entry.data.id })) };
          next.collections.push(collection); hbPersistLibrary(next); hbUI.collection = collection.id; hbUI.collectionName = "";
        }
        if (action === "remove-collection") {
          if (!confirm("Remove this collection? Its items remain in your library.")) return;
          const next = structuredClone(library); next.collections = next.collections.filter(collection => collection.id !== hbUI.collection);
          hbPersistLibrary(next); hbUI.collection = "";
        }
        if (action === "clear-selection") hbUI.selected.clear();
        renderHomebrewLibrary();
      }

      document.addEventListener("click", event => {
        const button = event.target.closest("[data-hb-action]");
        if (!button) return;
        Promise.resolve(hbAction(button.dataset.hbAction, button.dataset.hbKey)).catch(error => hbMessage(error.message));
      });
      document.addEventListener("input", event => {
        if (event.target.id === "hbSearch") { hbUI.search = event.target.value; renderHomebrewLibrary(); }
        if (event.target.id === "hbCollectionName") hbUI.collectionName = event.target.value;
      });
      document.addEventListener("change", async event => {
        const target = event.target;
        if (target.id === "hbDependencies") { hbUI.dependencies = target.checked; return; }
        if (["hbType", "hbCategory", "hbCollection"].includes(target.id)) {
          hbUI[{ hbType: "type", hbCategory: "category", hbCollection: "collection" }[target.id]] = target.value;
          if (target.id === "hbType") hbUI.category = "";
          return renderHomebrewLibrary();
        }
        if (target.id === "hbSelectVisible") { hbFiltered().forEach(item => target.checked ? hbUI.selected.add(hbModel.key(item)) : hbUI.selected.delete(hbModel.key(item))); return renderHomebrewLibrary(); }
        if (target.hasAttribute("data-hb-select")) { target.checked ? hbUI.selected.add(target.dataset.hbSelect) : hbUI.selected.delete(target.dataset.hbSelect); return renderHomebrewLibrary(); }
        if (target.hasAttribute("data-hb-choice")) { hbUI.choices[target.dataset.hbChoice] = target.value; return hbRenderImport(); }
        if (target.id === "hbImportFile") {
          const file = target.files[0];
          if (!file) return;
          try {
            if (file.size > hbModel.MAX_BYTES) throw new Error("File exceeds the 18 MB limit.");
            hbPreviewImport(await file.text());
          } catch (error) { document.getElementById("hbImportError").textContent = error.message; }
          target.value = "";
        }
      });

      for (const name of ["renderCharacter", "renderTeam", "renderGrowth", "renderRoster", "renderDirector", "renderCreationSuites", "renderCharacterBuilder", "renderCliqueBackgroundBuilder", "renderTechniqueBuilder", "renderGearAssetBuilder", "renderThreatBuilder", "renderTeamBuilder", "renderAdventureBuilder", "renderMissionSceneBuilder", "renderCrisisBuilder", "renderSignatureBuilder", "renderHomebrewLibrary"]) {
        const renderer = window[name];
        window[name] = (...args) => rcPreserveView(() => renderer(...args));
      }

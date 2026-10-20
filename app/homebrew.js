(function (root) {
  const FORMAT = "RoleCreditsHomebrew", VERSION = 2, MAX_BYTES = 18_000_000, MAX_ITEMS = 5000;
  const TYPES = {
    cliques: "Cliques", backgrounds: "Backgrounds", techniques: "Techniques", equipment: "Equipment",
    assets: "Team Assets", threats: "Threats", situations: "Situations", obstacles: "Obstacles",
    catastrophes: "Catastrophes", adventures: "Adventures", missions: "Missions", scenes: "Scenes",
    crises: "Crises", customTags: "Custom Tags", characters: "Characters", characterBuilds: "Character Builds",
    teams: "Teams", signatures: "Signature Moves"
  };
  const LINKS = { techniqueIds: "techniques", assetIds: "assets", missionIds: "missions", sceneIds: "scenes", threatIds: "threats" };
  const STRINGS = ["category", "type", "subtype", "arena", "ability", "range", "description", "mastery", "longJustification",
    "availability", "classification", "subcategory", "functionText", "effect", "risk", "use", "vulnerability", "notes", "price", "boundary",
    "plus", "minus", "trigger", "once", "d8", "perk", "lifestyleTag", "shape", "role", "goal", "scale", "premise", "majorObjective",
    "recurringOpposition", "stakes", "turningPoint", "endState", "hook", "primaryObjective", "campaignObjective", "campaignTier",
    "failureConsequence", "setup", "approach", "getaway", "fallout", "missionWindow", "economyDial", "question", "purpose",
    "center", "mapSize", "features", "opposition", "objective", "exits", "consequence", "timeChange", "severity", "threatenedThing",
    "whyCannotWait", "ignoredConsequence", "entryType", "sceneFocus", "availablePrep", "resolutionOptions", "aftermath", "missionWindowImpact"];
  const ARRAYS = ["tags", "edge", "d6", "bossFeatures", ...Object.keys(LINKS), "participantIds"];
  const validId = value => typeof value === "string" && /^[a-z0-9][a-z0-9_.:%-]{0,199}$/i.test(value);
  const nameKey = value => String(value).trim().normalize("NFKC").toLocaleLowerCase("en-US");
  const uid = () => "hb-" + (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const fail = message => { throw new Error(message); };
  const key = item => item.type + ":" + item.data.id;

  function checkTree(value, depth = 0) {
    if (depth > 30) fail("JSON is nested too deeply (maximum 30 levels).");
    if (typeof value === "number" && !Number.isFinite(value)) fail("Numbers must be finite.");
    if (typeof value === "string" && value.length > 2_000_000) fail("A text field is too large.");
    if (value && typeof value === "object") {
      for (const [field, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(field)) fail("Unsafe JSON property: " + field);
        checkTree(child, depth + 1);
      }
    }
  }

  function normalizeItem(entry, legacy = false) {
    if (!object(entry) || !Object.hasOwn(TYPES, entry.type)) fail("Unknown homebrew type: " + String(entry?.type));
    const data = clone(entry.data);
    if (!object(data)) fail(entry.type + " item must contain a data object.");
    if (legacy && !data.id) data.id = uid();
    if (!validId(data.id)) fail("Each item needs a safe ID of 1–200 letters, digits, dots, colons, underscores, percent signs or hyphens.");
    if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 300) fail("Each item needs a name (1–300 characters).");
    data.name = data.name.trim();
    for (const field of STRINGS) if (data[field] != null && typeof data[field] !== "string") fail(data.name + ": " + field + " must be text.");
    for (const field of ARRAYS) {
      if (data[field] == null) continue;
      if (legacy && field === "tags" && typeof data.tags === "string") data.tags = data.tags.split(",").map(tag => tag.trim()).filter(Boolean);
      if (!Array.isArray(data[field]) || data[field].some(value => typeof value !== "string")) fail(data.name + ": " + field + " must be a list of text values.");
      if (LINKS[field] && data[field].some(value => !validId(value))) fail(data.name + ": invalid linked item ID.");
    }
    for (const field of ["category", "type", "subtype", "arena", "ability", "range", "availability", "classification", "subcategory", "scale", "shape", "role", "mapSize", "severity", "entryType"]) {
      if (data[field] && /[<>]/.test(data[field])) fail(data.name + ": " + field + " must be plain text without markup.");
    }
    for (const field of ["tags", "edge", "d6", "bossFeatures"]) {
      if (data[field]?.some(value => /[<>]/.test(value))) fail(data.name + ": " + field + " must contain plain text without markup.");
    }
    for (const [field, value] of Object.entries(data)) {
      if (["rank", "rating", "bonus", "uses", "cost", "repair", "reward", "mpr", "ppr", "storyAwards"].includes(field) && (typeof value !== "number" || !Number.isFinite(value))) fail(data.name + ": " + field + " must be a finite number.");
    }
    const defaults = { techniques: { tags: [], description: "", mastery: "", longJustification: "" },
      threats: { tags: [], bossFeatures: [], techniqueIds: [], techniques: [] },
      equipment: { tags: [] }, assets: { tags: [] }, adventures: { missionIds: [] },
      missions: { sceneIds: [], threatIds: [], participantIds: [], obstacles: [], situations: [], catastrophes: [], secondaryObjectives: [], bonusObjectives: [] } };
    if (entry.type === "cliques" && (!Array.isArray(data.edge) || !data.edge.length || !["Body", "Mind", "Spirit"].includes(data.plus) || !["Body", "Mind", "Spirit"].includes(data.minus))) fail(data.name + ": invalid Clique stats or Edge.");
    if (entry.type === "backgrounds" && (typeof data.d8 !== "string" || !Array.isArray(data.d6) || data.d6.length !== 2)) fail(data.name + ": a Background needs one d8 and two d6 Abilities.");
    const numeric = entry.type === "techniques" || entry.type === "equipment" ? "rank" : ["assets", "threats"].includes(entry.type) ? "rating" : "";
    if (numeric && (!Number.isInteger(data[numeric]) || data[numeric] < 1 || data[numeric] > (entry.type === "threats" ? 7 : 5))) fail(data.name + ": invalid " + numeric + ".");
    if (entry.type === "techniques" && data.type != null && !["Attack", "Defense", "Buff", "Debuff", "Control", "Summon", "Utility"].includes(data.type)) fail(data.name + ": unknown Technique type.");
    if (entry.type === "assets" && data.classification != null && !["Facility", "Staff", "Contact", "Stockpile", "Special", "Vehicle"].includes(data.classification)) fail(data.name + ": unknown Asset classification.");
    for (const [field, fallback] of Object.entries(defaults[entry.type] || {})) {
      if (data[field] == null) data[field] = clone(fallback);
      if (Array.isArray(fallback) && !Array.isArray(data[field])) fail(data.name + ": " + field + " must be a list.");
    }
    for (const field of ["secondaryObjectives", "bonusObjectives"]) {
      if (data[field] && data[field].some(value => !object(value) || typeof value.text !== "string" || typeof value.tier !== "string")) fail(data.name + ": invalid objective entry.");
    }
    if (entry.type === "threats") data.techniques = data.techniques.map(technique => normalizeItem({ type: "techniques", data: technique }, true).data);
    for (const field of ["stats", "dice", "health"]) if (data[field] != null && (!object(data[field]) || Object.values(data[field]).some(value => typeof value !== "number" || !Number.isFinite(value)))) fail(data.name + ": invalid " + field + " values.");
    for (const field of ["obstacles", "situations", "catastrophes"]) {
      if (entry.type !== "missions") continue;
      data[field] = data[field].map(component => {
        if (!object(component) || typeof component.name !== "string") fail(data.name + ": invalid " + field + " component.");
        if (field === "obstacles" && [component.resolution, component.failureCost].some(value => value != null && typeof value !== "string")) fail(data.name + ": invalid obstacle text.");
        return field === "obstacles" ? { resolution: "", failureCost: "", ...component } : component;
      });
    }
    if (["characters", "characterBuilds", "teams"].includes(entry.type) && !object(data.snapshot)) fail(data.name + ": missing saved snapshot.");
    return { type: entry.type, data };
  }

  function entries(library) {
    return Object.keys(TYPES).flatMap(type => (library[type] || []).map(data => ({ type, data: type === "customTags" ?
      { id: "tag-" + encodeURIComponent(data), name: data } : clone(data) })));
  }

  function parse(input) {
    let parsed;
    if (typeof input === "string") {
      if (new TextEncoder().encode(input).length > MAX_BYTES) fail("File exceeds the 18 MB limit.");
      try { parsed = JSON.parse(input); } catch { fail("Invalid JSON. Choose a Homebrew pack or library backup."); }
    } else parsed = clone(input);
    checkTree(parsed);
    if (!object(parsed)) fail("Expected a homebrew pack object.");
    const warnings = [];
    let legacy = false, items, collections = [];
    if (parsed.format === FORMAT) {
      if (![1, VERSION].includes(parsed.schemaVersion)) fail("Unsupported schema version " + parsed.schemaVersion + ". Update Role Credits before importing this pack.");
      legacy = parsed.schemaVersion === 1;
      items = parsed.items || (legacy && entries(parsed.library || {}));
      collections = parsed.collections || [];
      if (legacy) warnings.push("Migrated homebrew schema 1 to schema 2.");
    } else {
      const library = parsed.format === "RoleCreditsStudioV2" ? parsed.state?.library : parsed.library || parsed;
      if (!object(library) || !Object.keys(library).some(type => Object.hasOwn(TYPES, type))) fail("No recognized homebrew library found.");
      legacy = true;
      items = entries(library);
      collections = library.collections || [];
      warnings.push("Migrated a legacy library. Only reusable library items are included; live characters and campaigns are preserved.");
    }
    if (!Array.isArray(items) || items.length > MAX_ITEMS) fail("A pack must contain at most 5,000 items.");
    items = items.map(entry => normalizeItem(entry, legacy));
    const seen = new Set();
    for (const item of items) {
      if (seen.has(key(item))) fail("Duplicate ID inside this file: " + key(item) + ". Export separate packs or give these items distinct IDs first.");
      seen.add(key(item));
    }
    if (!Array.isArray(collections) || collections.length > 500) fail("Invalid collections list.");
    const collectionIds = new Set();
    collections = collections.map(collection => {
      if (!object(collection) || typeof collection.id !== "string" || !collection.id || typeof collection.name !== "string" || !collection.name.trim() || !Array.isArray(collection.members)) fail("Invalid collection.");
      if (collectionIds.has(collection.id)) fail("Duplicate collection ID in file.");
      collectionIds.add(collection.id);
      for (const member of collection.members) if (!object(member) || !Object.hasOwn(TYPES, member.type) || typeof member.id !== "string") fail("Invalid collection member.");
      return clone(collection);
    });
    return { format: FORMAT, schemaVersion: VERSION, kind: parsed.kind === "backup" ? "backup" : "pack", name: String(parsed.name || "Imported pack").slice(0, 300), items, collections, warnings };
  }

  function dependencies(item) {
    const found = [];
    function visit(value) {
      if (!value || typeof value !== "object") return;
      for (const [field, child] of Object.entries(value)) {
        if (LINKS[field] && Array.isArray(child)) child.forEach(id => found.push({ type: LINKS[field], id }));
        else if (["cliqueRef", "backgroundRef"].includes(field) && typeof child === "string") found.push({ type: field === "cliqueRef" ? "cliques" : "backgrounds", id: child });
        else if (Array.isArray(child) && field === "techniques") child.forEach(technique => { if (technique?.id) found.push({ type: "techniques", id: technique.id }); });
        visit(child);
      }
    }
    visit(item.data);
    return found;
  }

  function pack(library, selected, options = {}) {
    const all = entries(library), lookup = new Map(all.map(item => [key(item), item]));
    const chosen = selected == null ? new Set(lookup.keys()) : new Set(selected);
    if (options.dependencies !== false) {
      for (const itemKey of chosen) for (const dependency of dependencies(lookup.get(itemKey) || { data: {} })) {
        const dependencyKey = dependency.type + ":" + dependency.id;
        if (lookup.has(dependencyKey)) chosen.add(dependencyKey);
      }
    }
    const items = all.filter(item => chosen.has(key(item)));
    return { format: FORMAT, schemaVersion: VERSION, appVersion: options.appVersion || "0.2.6.0", kind: options.backup ? "backup" : "pack",
      name: options.name || "Homebrew Library", exportedAt: new Date().toISOString(), items,
      collections: clone(library.collections || []).map(collection => ({ ...collection, members: collection.members.filter(member => chosen.has(member.type + ":" + member.id)) })).filter(collection => collection.members.length) };
  }

  function plan(library, source, choices = {}, options = {}) {
    const incoming = parse(source), result = clone(library), rows = [], unresolved = [], mappings = new Map();
    for (const type of Object.keys(TYPES)) result[type] ||= [];
    result.collections ||= [];
    incoming.items.forEach((item, index) => {
      const current = result[item.type].map(data => ({ type: item.type, data: item.type === "customTags" ? { id: "tag-" + encodeURIComponent(data), name: data } : data }));
      const collisions = current.filter(existing => existing.data.id === item.data.id || nameKey(existing.data.name) === nameKey(item.data.name));
      const choice = choices[index] || (collisions.length ? "review" : "add");
      const row = { index, item, collisions, choice };
      rows.push(row);
      if (choice === "review") { unresolved.push(item.data.name); return; }
      if (choice === "skip") {
        const match = collisions.find(existing => existing.data.id === item.data.id) || (collisions.length === 1 && collisions[0]);
        if (match) mappings.set(key(item), match.data.id);
        return;
      }
      let data = clone(item.data);
      if (choice === "add" && collisions.length) { unresolved.push(item.data.name); return; }
      if (choice === "copy") {
        data.id = uid();
        let suffix = 1, candidate = data.name + " (copy)";
        while (current.some(existing => nameKey(existing.data.name) === nameKey(candidate))) candidate = data.name + " (copy " + (++suffix) + ")";
        data.name = candidate;
      } else if (choice.startsWith("replace:")) {
        const target = collisions.find(existing => existing.data.id === choice.slice(8));
        if (!target) fail("Choose an existing item to replace for " + data.name + ".");
        data.id = target.data.id;
        if (current.some(existing => existing.data.id !== data.id && nameKey(existing.data.name) === nameKey(data.name))) fail("Replacing " + data.name + " would leave a second name conflict. Keep a copy instead.");
        result[item.type] = result[item.type].filter(existing => item.type === "customTags" ? nameKey(existing) !== nameKey(target.data.name) : existing.id !== data.id);
      } else if (choice !== "add" && choice !== "copy") fail("Unknown conflict choice.");
      if (item.type === "customTags" && choice === "copy") data.id = "tag-" + encodeURIComponent(data.name);
      mappings.set(key(item), data.id);
      row.imported = data;
      result[item.type].push(item.type === "customTags" ? data.name : data);
    });
    function remap(value) {
      if (!value || typeof value !== "object") return;
      for (const [field, child] of Object.entries(value)) {
        if (LINKS[field] && Array.isArray(child)) value[field] = child.map(id => mappings.get(LINKS[field] + ":" + id) || id);
        else if (["cliqueRef", "backgroundRef"].includes(field)) value[field] = mappings.get((field === "cliqueRef" ? "cliques:" : "backgrounds:") + child) || child;
        else if (field === "techniques" && Array.isArray(child)) child.forEach(technique => { if (technique?.id) technique.id = mappings.get("techniques:" + technique.id) || technique.id; });
        remap(value[field]);
      }
    }
    rows.forEach(row => { if (row.imported) remap(row.imported); });
    const warnings = [...incoming.warnings];
    const available = new Set(entries(result).map(key));
    for (const collection of incoming.collections) {
      const exists = result.collections.some(existing => existing.id === collection.id || nameKey(existing.name) === nameKey(collection.name));
      const copy = clone(collection);
      if (exists) {
        copy.id = uid();
        const originalName = copy.name;
        let suffix = 1;
        do { copy.name = originalName + " (import " + suffix++ + ")"; }
        while (result.collections.some(existing => nameKey(existing.name) === nameKey(copy.name)));
        warnings.push("Collection “" + collection.name + "” will be added as “" + copy.name + "”; the existing collection is kept.");
      }
      copy.members = copy.members.map(member => ({ ...member, id: mappings.get(member.type + ":" + member.id) || member.id }))
        .filter(member => available.has(member.type + ":" + member.id));
      if (copy.members.length) result.collections.push(copy);
    }
    for (const row of rows.filter(row => row.imported)) for (const dependency of dependencies({ data: row.imported })) {
      if (!available.has(dependency.type + ":" + dependency.id)) warnings.push(row.item.data.name + ": linked " + dependency.type + " “" + dependency.id + "” is absent; include it in the pack if needed.");
    }
    if (options.restore && unresolved.length === 0) warnings.push("Restore merges this backup into the current library using your choices. Existing player and campaign state stays in place.");
    return { library: result, rows, unresolved, warnings: [...new Set(warnings)], added: rows.filter(row => row.imported).length };
  }

  root.RoleCreditsHomebrew = { FORMAT, VERSION, MAX_BYTES, TYPES, key, uid, entries, parse, pack, plan, normalizeItem };
  if (typeof module !== "undefined" && module.exports) module.exports = root.RoleCreditsHomebrew;
})(globalThis);

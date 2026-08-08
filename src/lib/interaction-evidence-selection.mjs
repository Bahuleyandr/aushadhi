const ALL_SECTIONS = [...'ABCDEFGHIJ'];

function parseSections(value) {
  const sections = [
    ...new Set(
      String(value)
        .toUpperCase()
        .split(/[^A-J]+/u)
        .flatMap((entry) => [...entry])
        .filter(Boolean),
    ),
  ];
  if (sections.length === 0 || sections.some((section) => !ALL_SECTIONS.includes(section))) {
    throw new Error('--sections must select one or more letters from A through J');
  }
  return sections;
}

function addRuleId(ruleIds, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('--rule-id requires a value');
  }
  const ruleId = value.trim();
  if (!ruleIds.includes(ruleId)) ruleIds.push(ruleId);
}

export function parseInteractionEvidenceSelectionArgs(argv) {
  let sections = ALL_SECTIONS;
  let sawSections = false;
  const ruleIds = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--sections') {
      if (sawSections) throw new Error('--sections may be specified only once');
      if (index + 1 >= argv.length) throw new Error('--sections requires a value');
      sections = parseSections(argv[index + 1]);
      sawSections = true;
      index += 1;
    } else if (argument.startsWith('--sections=')) {
      if (sawSections) throw new Error('--sections may be specified only once');
      sections = parseSections(argument.slice('--sections='.length));
      sawSections = true;
    } else if (argument === '--rule-id') {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
        throw new Error('--rule-id requires a value');
      }
      addRuleId(ruleIds, argv[index + 1]);
      index += 1;
    } else if (argument.startsWith('--rule-id=')) {
      addRuleId(ruleIds, argument.slice('--rule-id='.length));
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }
  return { sections, ruleIds };
}

export function filterInteractionEvidenceRecords(records, ruleIds) {
  if (ruleIds.length === 0) return records;
  const requested = new Set(ruleIds);
  const selected = records.filter((record) => requested.has(record.rule_id));
  const found = new Set(selected.map((record) => record.rule_id));
  for (const ruleId of ruleIds) {
    if (!found.has(ruleId)) throw new Error(`requested rule_id not found: ${ruleId}`);
  }
  return selected;
}

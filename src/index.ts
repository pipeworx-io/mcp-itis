interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * ITIS (Integrated Taxonomic Information System) MCP.
 *
 * ITIS is the authoritative integrated taxonomy (US government) covering plants,
 * animals, fungi, and microbes. Resolve a scientific name to its TSN (Taxonomic
 * Serial Number), walk the full taxonomic hierarchy, and fetch common names.
 * Keyless.
 *
 * Encoding note: ITIS occasionally returns Latin-1 (ISO-8859-1) bytes for author
 * names with diacritics (e.g. "Förster") that are not valid UTF-8. We rely on the
 * WHATWG `res.json()` decode, which replaces invalid bytes with U+FFFD. ASCII
 * fields (tsn, combinedName, rankName, taxonName) are unaffected; only some author
 * diacritics may surface as replacement characters. We deliberately do NOT use
 * `TextDecoder('iso-8859-1')` since Cloudflare Workers may not support it.
 */


const BASE = 'https://www.itis.gov/ITISWebService/jsonservice';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_taxa',
    description:
      'Search ITIS (authoritative US-government integrated taxonomy for plants, animals, fungi, and microbes) by scientific name and resolve it to TSNs (Taxonomic Serial Numbers). Returns matching taxa with tsn, scientific name, author, and kingdom. Keyless. Use the tsn with get_hierarchy or get_common_names.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Scientific name to search, e.g. "Puma concolor".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_hierarchy',
    description:
      'Walk the full taxonomic hierarchy (lineage) for a TSN from ITIS — kingdom down to the taxon and its children. Returns each rank with its tsn, name, rank, and parent_tsn. Pass a TSN from search_taxa. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        tsn: { type: ['string', 'number'], description: 'Taxonomic Serial Number, e.g. 180582.' },
      },
      required: ['tsn'],
    },
  },
  {
    name: 'get_common_names',
    description:
      'Get vernacular (common) names in all languages for a TSN from ITIS, e.g. "Bobcat", "lynx roux". Pass a TSN from search_taxa. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        tsn: { type: ['string', 'number'], description: 'Taxonomic Serial Number, e.g. 180582.' },
      },
      required: ['tsn'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_taxa':
        return await searchTaxa(args);
      case 'get_hierarchy':
        return await getHierarchy(args);
      case 'get_common_names':
        return await getCommonNames(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchTaxa(args: Record<string, unknown>): Promise<unknown> {
  const name = reqStr(args, 'name');
  const data = (await itisGet(`/searchByScientificName?srchKey=${encodeURIComponent(name)}`)) as {
    scientificNames?: Array<Record<string, unknown> | null> | null;
  };
  const entries = (data.scientificNames ?? []).filter(Boolean) as Array<Record<string, unknown>>;
  const taxa = entries.map((e) => ({
    tsn: e.tsn,
    name: e.combinedName,
    author: e.author,
    kingdom: e.kingdom,
  }));
  return { count: taxa.length, taxa };
}

async function getHierarchy(args: Record<string, unknown>): Promise<unknown> {
  const tsn = reqId(args, 'tsn');
  const data = (await itisGet(`/getFullHierarchyFromTSN?tsn=${encodeURIComponent(tsn)}`)) as {
    hierarchyList?: Array<Record<string, unknown> | null> | null;
  };
  const entries = (data.hierarchyList ?? []).filter(Boolean) as Array<Record<string, unknown>>;
  if (entries.length === 0) return { error: 'no hierarchy for tsn', tsn };
  const hierarchy = entries.map((e) => ({
    tsn: e.tsn,
    name: e.taxonName,
    rank: e.rankName,
    parent_tsn: e.parentTsn,
  }));
  return { tsn, hierarchy };
}

async function getCommonNames(args: Record<string, unknown>): Promise<unknown> {
  const tsn = reqId(args, 'tsn');
  const data = (await itisGet(`/getCommonNamesFromTSN?tsn=${encodeURIComponent(tsn)}`)) as {
    commonNames?: Array<Record<string, unknown> | null> | null;
  };
  const entries = (data.commonNames ?? []).filter(Boolean) as Array<Record<string, unknown>>;
  const names = entries.map((e) => ({ name: e.commonName, language: e.language }));
  return { tsn, count: names.length, names };
}

async function itisGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ITIS: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  // Use res.json(): WHATWG decode replaces non-UTF-8 (Latin-1) bytes with U+FFFD
  // rather than throwing. ASCII fields are unaffected.
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing.`);
  return v;
}

function reqId(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim()) return v.trim();
  throw new Error(`Required argument "${key}" is missing. Pass a TSN (string or number).`);
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

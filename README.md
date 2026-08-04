# mcp-itis

ITIS (Integrated Taxonomic Information System) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_taxa` | Search ITIS (authoritative US-government integrated taxonomy for plants, animals, fungi, and microbes) by scientific name and resolve it to TSNs (Taxonomic Serial Numbers). Returns matching taxa with tsn, scientific name, author, and kingdom. Keyless. Use the tsn with get_hierarchy or get_common_names. |
| `get_hierarchy` | Walk the full taxonomic hierarchy (lineage) for a TSN from ITIS — kingdom down to the taxon and its children. Returns each rank with its tsn, name, rank, and parent_tsn. Pass a TSN from search_taxa. Keyless. |
| `get_common_names` | Get vernacular (common) names in all languages for a TSN from ITIS, e.g. "Bobcat", "lynx roux". Pass a TSN from search_taxa. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "itis": {
      "url": "https://gateway.pipeworx.io/itis/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Itis data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

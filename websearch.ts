/**
 * WebSearch Extension for pi
 * 
 * Performs web searches and returns relevant results with source citations.
 * Supports multiple search backends:
 * - Exa API (default, uses free tier: 1,000 requests/month)
 * - DuckDuckGo (fallback, no API key required)
 * 
 * Usage:
 * 1. Copy to ~/.pi/agent/extensions/websearch.ts or .pi/extensions/websearch.ts
 * 2. Set EXA_API_KEY environment variable for Exa API (get free key at https://exa.ai)
 * 3. Uses DuckDuckGo fallback if no API key is set
 */

import type { ExtensionAPI, TruncationResult } from "@mariozechner/pi-coding-agent";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ============
// Types
// ============

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	published?: string;
}

interface WebSearchDetails {
	query: string;
	numResults: number;
	backend: string;
	results: SearchResult[];
	truncation?: TruncationResult;
}

// ============
// Exa API Search
// ============

async function searchExa(query: string, numResults: number = 5): Promise<SearchResult[]> {
	const apiKey = process.env.EXA_API_KEY;
	
	if (!apiKey) {
		throw new Error("EXA_API_KEY not set. Get a free key at https://exa.ai (1,000 free searches/month)");
	}

	const response = await fetch("https://api.exa.ai/search", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
		},
		body: JSON.stringify({
			query,
			num_results: numResults,
			type: "auto",
			contents: {
				highlights: {
					max_characters: 500,
				},
			},
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Exa API error: ${response.status} - ${error}`);
	}

	const data = await response.json();
	
	return (data.results || []).map((result: any) => ({
		title: result.title || "Untitled",
		url: result.url,
		snippet: result.highlights?.[0] || result.text?.substring(0, 500) || "",
		published: result.published,
	}));
}

// ============
// DuckDuckGo Search (Fallback)
// ============

async function searchDuckDuckGo(query: string, numResults: number = 5): Promise<SearchResult[]> {
	const response = await fetch(
		`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&b=${(numResults - 1) * 10}`,
		{
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		}
	);

	if (!response.ok) {
		throw new Error(`DuckDuckGo request failed: ${response.status}`);
	}

	const html = await response.text();
	
	// Parse results
	const results: SearchResult[] = [];
	const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
	
	let match;
	while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
		const url = match[1];
		const actualUrl = url.startsWith("//duckduckgo.com/l/?uddg=") 
			? decodeURIComponent(url.split("uddg=")[1]?.split("&")[0] || "")
			: url;
			
		const title = match[2].replace(/<[^>]+>/g, "").trim();
		const snippet = match[3].replace(/<[^>]+>/g, "").trim();
		
		if (title && actualUrl) {
			results.push({
				title,
				url: actualUrl,
				snippet,
			});
		}
	}

	// Fallback: simpler parsing if main regex fails
	if (results.length === 0) {
		const simpleRegex = /<result[^>]*>[\s\S]*?href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/result>/gi;
		while ((match = simpleRegex.exec(html)) !== null && results.length < numResults) {
			const url = match[1];
			const title = match[2].replace(/<[^>]+>/g, "").trim();
			if (title && url) {
				results.push({
					title,
					url,
					snippet: "",
				});
			}
		}
	}

	return results;
}

// ============
// Format Results
// ============

function formatSearchResults(results: SearchResult[]): string {
	if (results.length === 0) {
		return "No search results found.";
	}

	let output = `Found ${results.length} results:\n\n`;
	
	for (const result of results) {
		output += `## ${result.title}\n`;
		output += `${result.url}\n`;
		if (result.snippet) {
			output += `${result.snippet}\n`;
		}
		output += "\n---\n\n";
	}

	return output;
}

// ============
// Main Extension
// ============

export default function webSearchExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "websearch",
		label: "Web Search",
		description: "Search the web for relevant information. Returns results with titles, URLs, and snippets. Use this for finding current information, researching topics, or gathering information beyond the training data cutoff.",
		parameters: Type.Object({
			query: Type.String({ description: "The search query" }),
			numResults: Type.Optional(Type.Number({ description: "Number of results to return (default: 5, max: 20)" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const { query, numResults = 5 } = params;
			const clampedResults = Math.min(Math.max(numResults, 1), 20);

			// Try Exa first, fall back to DuckDuckGo
			let results: SearchResult[] = [];
			let backend = "exa";
			let errorMessage = "";

			try {
				results = await searchExa(query, clampedResults);
			} catch (err: any) {
				errorMessage = err.message;
				backend = "duckduckgo";
				
				try {
					results = await searchDuckDuckGo(query, clampedResults);
				} catch (ddgErr: any) {
					throw new Error(`All search backends failed. Exa: ${errorMessage}. DuckDuckGo: ${ddgErr.message}`);
				}
			}

			// Format results
			const formattedOutput = formatSearchResults(results);

			// Apply truncation
			const truncation = truncateHead(formattedOutput, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			const details: WebSearchDetails = {
				query,
				numResults: clampedResults,
				backend,
				results,
			};

			let resultText = truncation.content;

			if (truncation.truncated) {
				details.truncation = truncation;
				const truncatedLines = truncation.totalLines - truncation.outputLines;
				resultText += `\n\n[Results truncated: showing some of ${results.length} results. ${truncatedLines} lines omitted.]`;
			}

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		// Custom rendering of tool call
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("websearch "));
			text += theme.fg("accent", `"${args.query}"`);
			if (args.numResults) {
				text += theme.fg("dim", ` (${args.numResults} results)`);
			}
			return new Text(text, 0, 0);
		},

		// Custom rendering of tool result
		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as WebSearchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			if (!details || details.results.length === 0) {
				return new Text(theme.fg("dim", "No results found"), 0, 0);
			}

			let text = theme.fg("success", `${details.results.length} results`);
			text += theme.fg("dim", ` (${details.backend})`);

			if (details.truncation?.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			// In expanded view, show first few results
			if (expanded) {
				for (const result of details.results.slice(0, 3)) {
					text += `\n${theme.fg("accent", result.title)}`;
					text += `\n${theme.fg("dim", result.url)}`;
					if (result.snippet) {
						const snippet = result.snippet.substring(0, 100);
						text += `\n${theme.fg("muted", snippet)}${result.snippet.length > 100 ? "..." : ""}`;
					}
					text += "\n";
				}
				if (details.results.length > 3) {
					text += theme.fg("muted", `... and ${details.results.length - 3} more`);
				}
			}

			return new Text(text, 0, 0);
		},
	});
}

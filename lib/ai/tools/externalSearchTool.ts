// lib/ai/tools/externalSearchTool.ts

/**
 * External Search Tool
 * Integrates Incraax Deep Search (searchIncraax) for real-time external information queries
 * (e.g., current RBI guidelines, regulatory news, live financial updates).
 * Enforces provenance, extracts facts/sources, and avoids fabrication when search returns empty.
 */

import { searchIncraax, isIncraaxSearchConfigured, IncraaxResult } from "@/lib/incraax";
import { AgentTool, ToolResult } from "./types";

export interface ExternalSearchInput {
  query: string;
  maxResults?: number;
}

export interface ExternalSearchOutput {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  totalFound: number;
  sources: string[];
}

export class ExternalSearchTool implements AgentTool<ExternalSearchInput, ExternalSearchOutput> {
  readonly name = "externalSearchTool";
  readonly description = "Searches current external information and RBI regulatory guidelines via Incraax Deep Search.";

  async execute(
    input: ExternalSearchInput,
    context?: Record<string, any>
  ): Promise<ToolResult<ExternalSearchOutput>> {
    const startTime = new Date().toISOString();
    const query = String(input.query || "").trim();

    if (!query) {
      return {
        success: false,
        error: "Search query cannot be empty.",
        provenance: {
          source: "live_api",
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    try {
      if (!isIncraaxSearchConfigured()) {
        return {
          success: true,
          data: {
            query,
            results: [],
            totalFound: 0,
            sources: [],
          },
          provenance: {
            source: "live_api",
            timestamp: new Date().toISOString(),
            confidence: 0.5,
            metadata: { warning: "Incraax search not configured; falling back gracefully." },
          },
        };
      }

      const rawResults: IncraaxResult[] = await searchIncraax(query, {
        maxResults: input.maxResults || 5,
      });

      const cleanResults = (rawResults || []).map((r) => ({
        title: String(r.title || "").trim(),
        url: String(r.url || "").trim(),
        snippet: String(r.snippet || "").trim(),
      })).filter((r) => r.snippet.length > 0 || r.title.length > 0);

      const sources = Array.from(new Set(cleanResults.map((r) => r.url).filter(Boolean)));

      return {
        success: true,
        data: {
          query,
          results: cleanResults,
          totalFound: cleanResults.length,
          sources,
        },
        provenance: {
          source: "live_api",
          timestamp: new Date().toISOString(),
          confidence: cleanResults.length > 0 ? 0.95 : 0.4,
          metadata: {
            totalFound: cleanResults.length,
            sourcesCount: sources.length,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Error occurred during external search.",
        provenance: {
          source: "live_api",
          timestamp: new Date().toISOString(),
          confidence: 0,
          metadata: { error: String(error) },
        },
      };
    }
  }
}

export const externalSearchTool = new ExternalSearchTool();

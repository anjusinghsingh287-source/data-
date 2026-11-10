import { AiResearchItem } from '../data/aiResearchData';

/**
 * Generate Python script for users to run on their local machine to pull true live arXiv API feeds
 * without any browser CORS sandbox limitations.
 */
export function generateLocalArxivScript(topics: string[]): string {
  const queryMap: Record<string, string> = {
    llm: 'cat:cs.CL AND (LLM OR "large language model" OR "chain-of-thought" OR reasoning)',
    diffusion: 'cat:cs.CV AND ("diffusion model" OR "flow matching" OR "video generation")',
    rl: 'cat:cs.LG AND ("reinforcement learning" OR RLHF OR DPO OR GRPO)',
    cv: 'cat:cs.CV AND ("vision-language" OR "gaussian splatting" OR segmentation)',
    nlp: 'cat:cs.CL AND (multilingual OR "information extraction" OR "semantic search")',
    datasets_benchmarks: 'cat:cs.AI AND (benchmark OR dataset OR leaderboard)',
    multimodal: 'cat:cs.AI AND (multimodal OR "vision-language" OR audio)',
    agents: 'cat:cs.AI AND ("autonomous agent" OR "tool use" OR webagent)',
  };

  const activeQueries = topics.map((t) => queryMap[t] || queryMap.llm);
  const combinedQuery = activeQueries.length > 0 ? activeQueries.join(' OR ') : queryMap.llm;

  return `#!/usr/bin/env python3
"""
=============================================================================
ARXIV LIVE RESEARCH FEED HARVESTER (LOCAL MACHINE RUNNER)
=============================================================================
This script connects directly to the official arXiv Open API (export.arxiv.org)
bypassing all browser CORS limitations. It fetches the latest papers matching
your research topics and outputs 'arxiv_live_papers.json' and 'arxiv_live_papers.csv'
which you can upload directly into the Global Data Studio.

Dependencies: Python 3.8+ standard library only (no pip installs required)
Usage:
    python arxiv_live_harvester.py
    python arxiv_live_harvester.py --max 50 --out my_arxiv_feed.json
"""
import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

ARXIV_API = "https://export.arxiv.org/api/query"
DEFAULT_QUERY = """${combinedQuery}"""

# XML Atom namespace
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}


def fetch_arxiv(query, max_results=30, sort_by="submittedDate", sort_order="descending"):
    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": sort_by,
        "sortOrder": sort_order,
    }
    url = f"{ARXIV_API}?{urllib.parse.urlencode(params)}"
    print(f"Connecting to official arXiv API...\\n  URL: {url}\\n")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "arxiv-live-harvester/1.0 (academic-research-tool)"}
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        xml_data = resp.read()

    root = ET.fromstring(xml_data)
    entries = root.findall("atom:entry", ATOM_NS)
    print(f"Successfully harvested {len(entries)} live arXiv preprints.\\n")

    papers = []
    for entry in entries:
        id_tag = entry.find("atom:id", ATOM_NS)
        arxiv_url = id_tag.text.strip() if id_tag is not None else ""
        arxiv_id = arxiv_url.split("/abs/")[-1]

        title_tag = entry.find("atom:title", ATOM_NS)
        title = " ".join(title_tag.text.split()) if title_tag is not None else "Untitled"

        summary_tag = entry.find("atom:summary", ATOM_NS)
        summary = " ".join(summary_tag.text.split()) if summary_tag is not None else ""

        published_tag = entry.find("atom:published", ATOM_NS)
        date = published_tag.text[:10] if published_tag is not None else datetime.now().strftime("%Y-%m-%d")

        authors = []
        for author_tag in entry.findall("atom:author", ATOM_NS):
            name_tag = author_tag.find("atom:name", ATOM_NS)
            if name_tag is not None and name_tag.text:
                authors.append(name_tag.text.strip())
        authors_str = ", ".join(authors[:5]) + (" et al." if len(authors) > 5 else "")

        # Extract primary category
        cat_tag = entry.find("arxiv:primary_category", ATOM_NS)
        primary_cat = cat_tag.attrib.get("term", "cs.AI") if cat_tag is not None else "cs.AI"

        papers.append({
            "id": f"arxiv-{arxiv_id}",
            "title": title,
            "type": "paper",
            "topic": primary_cat,
            "topicId": "llm",
            "authors": authors_str or "arXiv Researchers",
            "sourceVenue": f"arXiv:{arxiv_id}",
            "sourceUrl": arxiv_url,
            "date": date,
            "summary": summary,
            "metrics": f"Category: {primary_cat} · Live arXiv Feed",
            "tags": [primary_cat, "arXiv Live", "Preprint"],
            "isVerifiedLive": True,
        })

    return papers


def main():
    parser = argparse.ArgumentParser(description="Harvest live research papers from arXiv API")
    parser.add_argument("--query", default=DEFAULT_QUERY, help="arXiv search query string")
    parser.add_argument("--max", type=int, default=30, help="Max results to harvest")
    parser.add_argument("--json_out", default="arxiv_live_papers.json", help="Output JSON path")
    parser.add_argument("--csv_out", default="arxiv_live_papers.csv", help="Output CSV path")
    args = parser.parse_args()

    papers = fetch_arxiv(args.query, args.max)

    # Write JSON
    with open(args.json_out, "w", encoding="utf-8") as f:
        json.dump(papers, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(papers)} papers to JSON: {args.json_out}")

    # Write CSV
    if papers:
        fields = ["title", "type", "topic", "authors", "sourceVenue", "sourceUrl", "date", "metrics", "summary"]
        with open(args.csv_out, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(papers)
        print(f"Saved {len(papers)} papers to CSV: {args.csv_out}")

    print("\\n[DONE] You can now import 'arxiv_live_papers.json' directly into the Global Data Studio UI.")


if __name__ == "__main__":
    main()
`;
}

/**
 * Export research feed items to standardized CSV with Excel-compatible UTF-8 BOM
 */
export function exportAiResearchToCSV(items: AiResearchItem[]): string {
  const BOM = '\uFEFF';
  const fields = [
    'title',
    'type',
    'topic',
    'authors',
    'sourceVenue',
    'sourceUrl',
    'date',
    'metrics',
    'summary',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };

  const header = fields.join(',');
  const rows = items.map((item) =>
    fields.map((f) => escapeCsv((item as any)[f])).join(',')
  );

  return BOM + [header, ...rows].join('\n');
}

/**
 * Client-side arXiv API query attempt.
 * Tries direct API fetch; if CORS is blocked by browser sandbox, returns null so caller gracefully falls back.
 */
export async function tryFetchArxivClient(query: string, maxResults = 15): Promise<AiResearchItem[] | null> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/atom+xml, application/xml' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');

    if (entries.length === 0) return null;

    const items: AiResearchItem[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const idTag = entry.getElementsByTagName('id')[0];
      const arxivUrl = idTag?.textContent?.trim() || '';
      const arxivId = arxivUrl.split('/abs/').pop() || `arxiv-${i}`;

      const titleTag = entry.getElementsByTagName('title')[0];
      const title = titleTag?.textContent?.replace(/\s+/g, ' ').trim() || 'Untitled Paper';

      const summaryTag = entry.getElementsByTagName('summary')[0];
      const summary = summaryTag?.textContent?.replace(/\s+/g, ' ').trim() || '';

      const publishedTag = entry.getElementsByTagName('published')[0];
      const date = publishedTag?.textContent?.slice(0, 10) || new Date().toISOString().slice(0, 10);

      const authorTags = entry.getElementsByTagName('author');
      const authorList: string[] = [];
      for (let a = 0; a < authorTags.length; a++) {
        const name = authorTags[a].getElementsByTagName('name')[0]?.textContent?.trim();
        if (name) authorList.push(name);
      }
      const authors = authorList.slice(0, 4).join(', ') + (authorList.length > 4 ? ' et al.' : '');

      items.push({
        id: `arxiv-${arxivId}`,
        title,
        type: 'paper',
        topic: 'LLMs & Reasoning',
        topicId: 'llm',
        authors: authors || 'arXiv Researchers',
        sourceVenue: `arXiv:${arxivId}`,
        sourceUrl: arxivUrl,
        date,
        summary,
        metrics: 'Live arXiv API Verified',
        tags: ['arXiv Live', 'Preprint', 'Verified'],
        isVerifiedLive: true,
      });
    }

    return items;
  } catch (err) {
    // Expected in typical browser CORS environments without server proxy
    return null;
  }
}

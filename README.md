# WebSearch Extension for pi

A web search tool that gives your coding assistant the ability to search the internet and find current, relevant information with source citations.

## Quick Start

### Install the extension
```bash
pi install git:github.com/John-Dekka/pi-websearch
```

That's it. Your assistant can now search the web.

## What It Is

WebSearch is an extension for [pi](https://pi.dev) that adds web search capabilities to your coding assistant. It was created by pi itself. Yes, the clanker wrote this extension. 🥳

When you need information beyond what's in its training data, your assistant can now search the web, find fresh answers, and cite sources properly. No more "my knowledge ends in [date]" explanations. Just answers.

## How It Works

Using WebSearch is simple:

1. **Copy the extension** to your pi extensions folder
2. **Optional: set EXA_API_KEY** for better results (free key at https://exa.ai, 1,000 searches/month)
3. **Use the tool** in your prompts with any search query
4. **Get results** - titles, URLs, and relevant snippets with citations

The extension automatically:

- **Uses two search backends** - Tries Exa API first (smarter, better results), falls back to DuckDuckGo if no API key is set
- **Returns useful information** - Each result includes title, URL, and a snippet so you know what you'll find
- **Handles failures gracefully** - If one backend fails, it tries the other. Your search rarely fails completely
- **Limits results sensibly** - Default 5 results, max 20. Enough to be useful without overwhelming

## Why It's Really Good

### Two Backends, Best Effort

Exa is the primary backend.Iit's smarter than plain search, understands content better, and returns highlights. But you don't *need* an API key. If you skip it, DuckDuckGo just works. Free, no setup, no friction.

### Free Tier That Actually Works

Exa's free tier gives you 1,000 searches per month. That's a lot of searching. Most people will never hit the limit. And DuckDuckGo is always there as a backup.

### Source Citations Included

Every result comes with a URL. You can combine this with `webfetch` to let your clanker pull content from the URLs.

### Resilient Searching

Exa down? API key wrong? DuckDuckGo has your back. The extension tries both backends automatically, so search results rarely fail. Your workflow keeps flowing.

### Created by pi

This extension was written by pi itself. It saw a need, wrote the code, and now it's part of the ecosystem.

## Requirements

- [pi](https://pi.dev) coding agent
- Node.js that supports ES modules
- Optional: Exa API key (free tier available at https://exa.ai)

## License

MIT - Use it, share it, make it better. ♥️

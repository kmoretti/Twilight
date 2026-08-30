<script lang="ts">
    import { onMount } from "svelte";

    type Article = { title: string; link: string; author: string; avatar: string; dateLabel: string; dateTime: number };
    type Stats = { friends_num?: number; active_num?: number; article_num?: number; last_updated_time?: string };
    let { endpoint = "https://fc.081531.xyz/all.json" }: { endpoint?: string } = $props();
    let articles = $state<Article[]>([]);
    let stats = $state<Stats>({});
    let loading = $state(true);
    let error = $state("");
    let shown = $state(0);
    const pageSize = 20;
    const visibleArticles = $derived(articles.slice(0, shown));
    const hasMore = $derived(shown < articles.length);

    function safeUrl(value: unknown) {
        try { const url = new URL(String(value || "")); return url.protocol === "http:" || url.protocol === "https:" ? url.href : ""; } catch { return ""; }
    }
    function parseDate(value: unknown) {
        const label = String(value || "").trim();
        const time = label ? Date.parse(label.replace(/\//g, "-").replace(" ", "T")) : 0;
        return { label: label || "未知时间", time: Number.isNaN(time) ? 0 : time };
    }
    function normalize(payload: any) {
        const seen = new Set<string>();
        return (Array.isArray(payload?.article_data) ? payload.article_data : []).map((item: any) => {
            const link = safeUrl(item?.link); const title = String(item?.title || "").trim();
            if (!link || !title) return null;
            const key = link.replace(/\/+$/, "").toLowerCase(); if (seen.has(key)) return null; seen.add(key);
            const date = parseDate(item?.created || item?.published || item?.updated);
            return { title, link, author: String(item?.author || "未知作者").trim(), avatar: safeUrl(item?.avatar), dateLabel: date.label, dateTime: date.time };
        }).filter(Boolean).sort((a: Article, b: Article) => b.dateTime - a.dateTime) as Article[];
    }
    async function load() {
        loading = true; error = "";
        try { const response = await fetch(endpoint); if (!response.ok) throw new Error(); const payload = await response.json(); articles = normalize(payload); stats = payload?.statistical_data || {}; shown = Math.min(pageSize, articles.length); }
        catch { error = "朋友圈数据加载失败，请稍后重试。"; }
        finally { loading = false; }
    }
    function avatarFallback(author: string) { return author.slice(0, 1).toUpperCase() || "?"; }
    onMount(load);
</script>

<section class="feed" aria-live="polite">
    {#if loading}<div class="state">加载中...</div>
    {:else if error}<div class="state error">{error}<button type="button" onclick={load}>重试</button></div>
    {:else}
        <div class="summary"><span>友链 {stats.friends_num ?? "—"}</span><span>活跃 {stats.active_num ?? "—"}</span><span>文章 {stats.article_num ?? articles.length}</span>{#if stats.last_updated_time}<span>更新于 {stats.last_updated_time}</span>{/if}</div>
        {#if visibleArticles.length === 0}<div class="state">暂无朋友圈动态</div>{:else}<ul class="grid">{#each visibleArticles as article (article.link)}<li class="item"><a class="avatar" href={article.link} target="_blank" rel="noopener noreferrer" aria-label={article.author}>{#if article.avatar}<img src={article.avatar} alt={article.author} loading="lazy" referrerpolicy="no-referrer" onerror={(event) => (event.currentTarget.style.display = "none")} />{:else}<span>{avatarFallback(article.author)}</span>{/if}</a><div class="body"><div class="meta"><span>{article.author}</span><time datetime={article.dateTime ? new Date(article.dateTime).toISOString() : undefined}>{article.dateLabel}</time></div><a class="title" href={article.link} target="_blank" rel="noopener noreferrer">{article.title}</a></div></li>{/each}</ul>{/if}
        {#if hasMore}<button class="more" type="button" onclick={() => shown = Math.min(shown + pageSize, articles.length)}>加载更多</button>{/if}
    {/if}
</section>

<style>
    .feed { --feed-muted: oklch(.48 .02 var(--hue)); --feed-error: oklch(.48 .18 25); display: grid; gap: 1rem; }
    :global(:root.dark) .feed { --feed-muted: oklch(.78 .02 var(--hue)); --feed-error: oklch(.78 .14 25); }.summary { display: flex; flex-wrap: wrap; gap: .5rem 1rem; padding: .8rem 1rem; border: 1px solid var(--line-divider); border-radius: .65rem; color: var(--feed-muted); background: var(--card-bg-transparent); font-size: .8rem; }.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin: 0; padding: 0; list-style: none; }.item { display: flex; min-width: 0; gap: .7rem; padding: .9rem; border: 1px solid var(--line-divider); border-radius: .7rem; background: var(--card-bg); transition: transform .2s, border-color .2s, box-shadow .2s; }.item:hover { transform: translateY(-3px); border-color: var(--primary); box-shadow: 0 5px 18px color-mix(in oklch, var(--primary), transparent 82%); }.avatar { display: grid; place-items: center; flex: 0 0 2.6rem; width: 2.6rem; height: 2.6rem; overflow: hidden; border-radius: 999px; color: var(--deep-text); background: var(--card-bg); font-weight: 700; }.avatar img { width: 100%; height: 100%; object-fit: cover; }.avatar span { display: grid; place-items: center; width: 100%; height: 100%; color: var(--page-bg); background: var(--primary); }.body { min-width: 0; flex: 1; }.meta { display: flex; justify-content: space-between; gap: .4rem; color: var(--feed-muted); font-size: .7rem; }.meta span, .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.title { display: block; margin-top: .35rem; color: var(--deep-text); font-size: .85rem; font-weight: 600; text-decoration: none; }.title:hover { color: var(--primary); }.state { padding: 3rem 1rem; color: var(--feed-muted); text-align: center; }.state.error { color: var(--feed-error); }.state button, .more { margin-left: .7rem; border: 1px solid var(--line-divider); border-radius: .45rem; padding: .4rem .7rem; color: var(--deep-text); background: var(--card-bg); cursor: pointer; }.more { display: block; margin: .25rem auto 0; color: var(--deep-text); }.more:hover, .state button:hover { border-color: var(--primary); color: var(--primary); }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } .summary { gap: .4rem .7rem; } }
</style>

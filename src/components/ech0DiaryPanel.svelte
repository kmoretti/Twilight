<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { refreshFancybox } from "@utils/fancybox";
    import MarkdownIt from "markdown-it";
    import MomentsCard, { type MomentsCardItem } from "./moments/MomentsCard.svelte";
    import MomentGallery from "./moments/MomentGallery.svelte";

    interface EchoExt {
        type: string;
        payload: Record<string, unknown>;
    }
    interface EchoItem {
        id: string;
        content: string;
        username: string;
        created: number; // 毫秒时间戳
        favCount: number;
        tags: string[];
        images: string[];
        ext: EchoExt | null;
    }

    let { ech0Url = "https://m.081531.xyz/api/echo/page", displayName = "", pageSize = 10, voteUrl = "https://vote.081531.xyz", cardStyle = "moments", avatar = "" }: { ech0Url?: string; displayName?: string; pageSize?: number; voteUrl?: string; cardStyle?: "moments" | "classic"; avatar?: string } = $props();

    let items = $state<EchoItem[]>([]);
    let total = $state(0);
    let page = $state(1);
    let loading = $state(true);
    let error = $state("");
    let votes = $state<Record<string, number | null>>({});
    let voting = $state<Record<string, boolean>>({});
    let selectedTag = $state("");
    let listEl = $state<HTMLElement | undefined>(undefined);

    const visibleItems = $derived(selectedTag ? items.filter((item) => item.tags.includes(selectedTag)) : items);
    const totalPages = $derived(Math.max(1, Math.ceil((selectedTag ? visibleItems.length : total) / pageSize)));
    const pageItems = $derived((selectedTag ? visibleItems : items).slice((page - 1) * pageSize, page * pageSize));
    const displayedCount = $derived(selectedTag ? visibleItems.length : total);
    const apiOrigin = $derived.by(() => {
        try { return new URL(ech0Url).origin; } catch { return ""; }
    });

    const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });
    const mdCache: Record<string, string> = {};

    function escapeAttr(value: string) {
        return String(value || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    }
    function resolveUrl(raw: string) {
        const url = String(raw || "").trim();
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (apiOrigin) return `${apiOrigin}${url.startsWith("/") ? url : "/" + url}`;
        return url;
    }
    function looksLikeImage(file: any) {
        const ct = String(file?.content_type || file?.mimeType || "").toLowerCase();
        const url = String(file?.url || file?.image_url || "").toLowerCase();
        if (ct && ct.startsWith("image/")) return true;
        return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/.test(url);
    }
    function parseTime(value: unknown) {
        // created_at 是 Unix 秒（或毫秒）
        const n = Number(value);
        if (!n) return 0;
        return n > 1e12 ? n : n * 1000;
    }
    function normalizeEcho(raw: any): EchoItem {
        const files = Array.isArray(raw?.echo_files)
            ? raw.echo_files.map((f: any) => (f?.file ? f.file : f)).filter(looksLikeImage)
            : [];
        return {
            id: String(raw?.id || ""),
            content: String(raw?.content || ""),
            username: displayName.trim() || "匿名",
            created: parseTime(raw?.created_at),
            favCount: 0,
            tags: (Array.isArray(raw?.tags) ? raw.tags : [])
                .map((t: any) => (typeof t === "string" ? t : String(t?.name || "")))
                .filter(Boolean),
            images: files.map((f: any) => resolveUrl(f?.url || f?.image_url || "")).filter(Boolean),
            ext: raw?.extension && raw?.extension?.type ? raw.extension : null,
        };
    }

    function voteEndpoint(path: string, id: string) {
        const base = voteUrl.replace(/\/+$/, "");
        return `${base}${path}?id=${encodeURIComponent(id)}`;
    }

    function parseVoteCount(payload: unknown): number | null {
        if (typeof payload === "number") return payload;
        if (!payload || typeof payload !== "object") return null;
        const value = payload as Record<string, unknown>;
        for (const key of ["count", "total", "value", "up"]) {
            if (typeof value[key] === "number") return value[key] as number;
        }
        if (value.votes !== undefined) return parseVoteCount(value.votes);
        if (value.data !== undefined) return parseVoteCount(value.data);
        return null;
    }

    async function loadVote(id: string) {
        try {
            const response = await fetch(voteEndpoint("/api/vote/info", id));
            if (!response.ok) throw new Error();
            votes[id] = parseVoteCount(await response.json());
            votes = votes;
        } catch {
            votes[id] = null;
            votes = votes;
        }
    }

    async function toggleVote(id: string) {
        if (voting[id]) return;
        voting[id] = true;
        voting = voting;
        try {
            const response = await fetch(`${voteEndpoint("/api/vote/update", id)}&value=up`);
            if (!response.ok) throw new Error();
            await response.json().catch(() => ({}));
            await loadVote(id);
            votes = votes;
        } catch {
            await loadVote(id);
        } finally {
            voting[id] = false;
            voting = voting;
        }
    }

    async function loadPage(targetPage: number) {
        loading = true;
        error = "";
        try {
            const sep = ech0Url.includes("?") ? "&" : "?";
            const response = await fetch(`${ech0Url}${sep}page=${targetPage}&pageSize=${pageSize}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const data = payload?.data;
            if (!data || !Array.isArray(data.items)) throw new Error("数据格式错误");
            items = data.items.map(normalizeEcho).filter((e: EchoItem) => e.id);
            total = Number(data.total ?? items.length);
            await Promise.all(items.map((item) => loadVote(item.id)));
            page = targetPage;
        } catch (reason) {
            error = reason instanceof Error ? reason.message : "说说数据加载失败";
        } finally {
            loading = false;
        }
    }

    function goPage(next: number) {
        if (next < 1 || next > totalPages || next === page || loading) return;
        void loadPage(next);
    }

    function relativeTime(ms: number) {
        if (!ms) return "";
        const diff = Date.now() - ms;
        const min = Math.floor(diff / 60000);
        if (min < 1) return "刚刚";
        if (min < 60) return `${min} 分钟前`;
        const hours = Math.floor(min / 60);
        if (hours < 24) return `${hours} 小时前`;
        return `${Math.floor(hours / 24)} 天前`;
    }

    function pageNumbers() {
        const current = page;
        const last = totalPages;
        const pages: Array<number | "…"> = [1];
        if (last === 1) return [1];
        if (current > 3) pages.push("…");
        for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) pages.push(i);
        if (current < last - 2) pages.push("…");
        if (last > 1) pages.push(last);
        return pages;
    }

    function renderMarkdown(md: string, group: string) {
        const key = group + "\u241f" + md;
        if (mdCache[key]) return mdCache[key];
        const html = markdown.render(md || "");
        const wrapped = html.replace(/<img\b([^>]*)>/gi, (m, attrs) => {
            const src = (attrs.match(/src="([^"]*)"/i) || [])[1] || "";
            return `<a href="${escapeAttr(src)}" data-fancybox="${group}" class="md-image"><img ${attrs}></a>`;
        });
        mdCache[key] = wrapped;
        return wrapped;
    }

    // 灯箱：Fancybox 通过选择器实时绑定。这里为 markdown 图片补错误占位。
    async function renderFancybox() {
        await tick();
        initMarkdownImages();
        await refreshFancybox();
    }

    function initMarkdownImages() {
        if (!listEl) return;
        listEl.querySelectorAll("[data-md-render] img").forEach((img) => {
            const node = img as HTMLImageElement;
            if (node.dataset.echoTouched) return;
            node.dataset.echoTouched = "1";
            node.referrerPolicy = "no-referrer";
            node.addEventListener("error", () => {
                const a = node.closest("a[data-fancybox]");
                const fb = document.createElement("span");
                fb.className = "md-img-fallback";
                fb.textContent = "图片无法加载";
                if (a && a.parentNode) a.replaceWith(fb);
                else if (node.parentNode) node.replaceWith(fb);
            });
        });
    }

    function handleFileImageError(event: Event) {
        const img = event.currentTarget as HTMLImageElement;
        const a = img.closest("a[data-fancybox]");
        const fb = document.createElement("span");
        fb.className = "md-img-fallback";
        fb.textContent = "图片无法加载";
        if (a && a.parentNode) a.replaceWith(fb);
        else if (img.parentNode) img.replaceWith(fb);
    }

    $effect(() => {
        items;
        page;
        if (listEl) void renderFancybox();
    });

    function githubSegments(repoUrl: string) {
        const seg = String(repoUrl || "").split("/").filter(Boolean);
        const owner = seg.slice(-2)[0] || "";
        const repo = seg.slice(-2)[1] || "";
        return { owner, repo, title: repo || repoUrl };
    }
    function websiteDomain(site: string) {
        try { return new URL(site).hostname.replace(/^www\./, ""); } catch { return site; }
    }

    onMount(() => { void loadPage(1); });

    onDestroy(() => {
        void refreshFancybox();
    });
</script>

<div class="ech0-panel">
    {#if loading}
        <div class="panel-state">加载中...</div>
    {:else if error}
        <div class="panel-state error">{error}<button type="button" class="retry" onclick={() => loadPage(1)}>重试</button></div>
    {:else if items.length === 0}
        <div class="panel-state">暂无说说</div>
    {:else}
        <div class="panel-meta">共 {displayedCount} 条{#if selectedTag}<button type="button" class="clear-tag" onclick={() => { selectedTag = ""; page = 1; }}>清除标签筛选</button>{/if}</div>
        {#if pageItems.length === 0}
            <div class="panel-state">没有包含该标签的说说</div>
        {:else}
        <div class="moment-timeline" bind:this={listEl}>
            {#each pageItems as item (item.id)}
                {#if cardStyle === "moments"}
                    {@const cardItem: MomentsCardItem = { id: item.id, author: item.username, avatar, datetime: relativeTime(item.created), tags: item.tags }}
                    {#snippet content()}
                        {#if item.ext && item.ext.type === "WEBSITE"}
                            {@const w = item.ext.payload}
                            <a class="ext-card" href={String(w?.site || "")} target="_blank" rel="noopener noreferrer"><span class="ext-icon">🌐</span><span class="ext-meta"><span class="ext-title">{String(w?.title || "网站")}</span><span class="ext-sub">{websiteDomain(String(w?.site || ""))}</span></span></a>
                        {/if}
                        {#if item.ext && item.ext.type === "GITHUBPROJ"}
                            {@const g = githubSegments(String(item.ext.payload?.repoUrl || ""))}
                            <a class="ext-card" href={String(item.ext.payload?.repoUrl)} target="_blank" rel="noopener noreferrer"><span class="ext-icon">📦</span><span class="ext-meta"><span class="ext-title">{g.title}</span><span class="ext-sub">{g.owner} / {g.repo}</span></span></a>
                        {/if}
                        {#if item.ext && item.ext.type === "LOCATION"}
                            {@const loc = item.ext.payload}
                            <div class="ext-card no-link"><span class="ext-icon">📍</span><span class="ext-meta"><span class="ext-title">{String(loc?.placeholder || "位置")}</span><span class="ext-sub">{Number(loc?.latitude ?? 0).toFixed(2)}°, {Number(loc?.longitude ?? 0).toFixed(2)}°</span></span></div>
                        {/if}
                        {#if item.ext && item.ext.type === "MUSIC"}<a class="ext-card" href={String(item.ext.payload?.url)} target="_blank" rel="noopener noreferrer"><span class="ext-icon">🎵</span><span class="ext-meta"><span class="ext-title">音乐</span><span class="ext-sub">播放/打开音乐</span></span></a>{/if}
                        {#if item.ext && item.ext.type === "VIDEO"}<a class="ext-card" href={`https://www.bilibili.com/video/${String(item.ext.payload?.videoId || "")}`} target="_blank" rel="noopener noreferrer"><span class="ext-icon">🎬</span><span class="ext-meta"><span class="ext-title">视频</span><span class="ext-sub">{String(item.ext.payload?.videoId || "")}</span></span></a>{/if}
                        {#if item.ext && item.ext.type === "TWEET"}
                            {@const tw = item.ext.payload}
                            <a class="ext-card" href={String(tw?.url)} target="_blank" rel="noopener noreferrer"><span class="ext-icon">𝕏</span><span class="ext-meta"><span class="ext-title">@{String(tw?.username || "推文")}</span><span class="ext-sub">查看推文</span></span></a>
                        {/if}
                        <div class="md-render" data-md-render data-echo-group={`echo-${item.id}`}>{@html renderMarkdown(item.content, "echo-" + item.id)}</div>
                        {#if item.images.length > 0}<MomentGallery images={item.images.map(src => ({ src, alt: "说说图片" }))} />{/if}
                    {/snippet}
                    {#snippet footer()}
                        <span class="moment-tags">{#each item.tags as tag (tag)}<button type="button" class:active={selectedTag === tag} aria-pressed={selectedTag === tag} onclick={() => { selectedTag = selectedTag === tag ? "" : tag; page = 1; }}>{tag}</button>{/each}</span>
                        <button type="button" class="moment-vote" class:voted={votes[item.id] !== null && (votes[item.id] ?? 0) > 0} disabled={voting[item.id]} aria-label="点赞" onclick={() => toggleVote(item.id)}>♡ {votes[item.id] ?? 0}</button>
                    {/snippet}
                    <MomentsCard item={cardItem} {content} {footer} />
                {:else}
                <article class="moment-item card-base">
                    <div class="moment-head">
                        <span class="moment-author">{item.username}</span>
                        <span class="moment-tags">
                            {#each item.tags as tag (tag)}<button type="button" class:active={selectedTag === tag} aria-pressed={selectedTag === tag} onclick={() => { selectedTag = selectedTag === tag ? "" : tag; page = 1; }}>{tag}</button>{/each}
                        </span>
                    </div>
                    <div class="moment-content">
                        {#if item.ext && item.ext.type === "WEBSITE"}
                            {@const w = item.ext.payload}
                            <a class="ext-card" href={String(w?.site || "")} target="_blank" rel="noopener noreferrer">
                                <span class="ext-icon">🌐</span>
                                <span class="ext-meta"><span class="ext-title">{String(w?.title || "网站")}</span><span class="ext-sub">{websiteDomain(String(w?.site || ""))}</span></span>
                            </a>
                        {/if}
                        {#if item.ext && item.ext.type === "GITHUBPROJ"}
                            {@const g = githubSegments(String(item.ext.payload?.repoUrl || ""))}
                            <a class="ext-card" href={String(item.ext.payload?.repoUrl)} target="_blank" rel="noopener noreferrer">
                                <span class="ext-icon">📦</span>
                                <span class="ext-meta"><span class="ext-title">{g.title}</span><span class="ext-sub">{g.owner} / {g.repo}</span></span>
                            </a>
                        {/if}
                        {#if item.ext && item.ext.type === "LOCATION"}
                            {@const loc = item.ext.payload}
                            <div class="ext-card no-link">
                                <span class="ext-icon">📍</span>
                                <span class="ext-meta"><span class="ext-title">{String(loc?.placeholder || "位置")}</span><span class="ext-sub">{Number(loc?.latitude ?? 0).toFixed(2)}°, {Number(loc?.longitude ?? 0).toFixed(2)}°</span></span>
                            </div>
                        {/if}
                        {#if item.ext && item.ext.type === "MUSIC"}
                            <a class="ext-card" href={String(item.ext.payload?.url)} target="_blank" rel="noopener noreferrer">
                                <span class="ext-icon">🎵</span>
                                <span class="ext-meta"><span class="ext-title">音乐</span><span class="ext-sub">播放/打开音乐</span></span>
                            </a>
                        {/if}
                        {#if item.ext && item.ext.type === "VIDEO"}
                            <a class="ext-card" href={`https://www.bilibili.com/video/${String(item.ext.payload?.videoId || "")}`} target="_blank" rel="noopener noreferrer">
                                <span class="ext-icon">🎬</span>
                                <span class="ext-meta"><span class="ext-title">视频</span><span class="ext-sub">{String(item.ext.payload?.videoId || "")}</span></span>
                            </a>
                        {/if}
                        {#if item.ext && item.ext.type === "TWEET"}
                            {@const tw = item.ext.payload}
                            <a class="ext-card" href={String(tw?.url)} target="_blank" rel="noopener noreferrer">
                                <span class="ext-icon">𝕏</span>
                                <span class="ext-meta"><span class="ext-title">@{String(tw?.username || "推文")}</span><span class="ext-sub">查看推文</span></span>
                            </a>
                        {/if}

                        <div class="md-render" data-md-render data-echo-group={`echo-${item.id}`}>
                            {@html renderMarkdown(item.content, "echo-" + item.id)}
                        </div>

                        {#if item.images.length > 0}
                            <div class="moment-images flex flex-wrap gap-2 md:gap-3 mb-3">
                                {#each item.images as src, i (src)}
                                    <a data-fancybox={`echo-${item.id}`} href={src} class="echo-image-link" aria-label="查看图片">
                                        <img src={src} alt="说说图片" loading="lazy" referrerpolicy="no-referrer" onerror={handleFileImageError} />
                                    </a>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    <hr class="moment-divider" />
                    <div class="moment-foot">
                        <span class="moment-time">🕐 {relativeTime(item.created)}</span>
                        <button type="button" class="moment-vote" class:voted={votes[item.id] !== null && (votes[item.id] ?? 0) > 0} disabled={voting[item.id]} aria-label="点赞" onclick={() => toggleVote(item.id)}>♡ {votes[item.id] ?? 0}</button>
                    </div>
                </article>
                {/if}
            {/each}
        </div>
        {/if}
        {#if totalPages > 1}
            <nav class="panel-pagination" aria-label="说说分页">
                <button type="button" disabled={page === 1} onclick={() => goPage(page - 1)}>‹</button>
                {#each pageNumbers() as p (p)}
                    {#if p === "…"}
                        <span class="p-dots">…</span>
                    {:else}
                        <button type="button" class:active={p === page} onclick={() => goPage(p)}>{p}</button>
                    {/if}
                {/each}
                <button type="button" disabled={page === totalPages} onclick={() => goPage(page + 1)}>›</button>
            </nav>
        {/if}
    {/if}
</div>

<style>
    .ech0-panel { --muted: oklch(.48 .02 var(--hue)); display: grid; gap: 1rem; }
    :global(:root.dark) .ech0-panel { --muted: oklch(.78 .02 var(--hue)); }
    .panel-state { padding: 3rem 1rem; color: var(--muted); text-align: center; font-size: .9rem; }
    .panel-state.error { color: oklch(.48 .18 25); }
    :global(:root.dark) .panel-state.error { color: oklch(.78 .14 25); }
    .retry { margin-left: .6rem; border: 1px solid var(--line-divider); border-radius: .45rem; padding: .35rem .7rem; color: var(--deep-text); background: var(--card-bg); cursor: pointer; }
    .retry:hover { color: var(--primary); border-color: var(--primary); }
    .panel-meta { color: var(--muted); font-size: .8rem; }
    .moment-timeline { display: grid; gap: 1rem; }
    .moment-item { padding: 1rem; border-radius: .75rem; background: var(--card-bg); border: 1px solid var(--line-divider); }
    .moment-head { display: flex; justify-content: space-between; align-items: center; gap: .75rem; margin-bottom: .6rem; flex-wrap: wrap; }
    .moment-author { color: var(--deep-text); font-weight: 700; font-size: .9rem; }
    .moment-tags { display: flex; gap: .4rem; flex-wrap: wrap; }
    .moment-tags button { padding: .1rem .5rem; border-radius: 999px; color: var(--muted); background: var(--btn-regular-bg); font-size: .68rem; border: 1px solid var(--line-divider); cursor: pointer; transition: color .2s, border-color .2s, background .2s; }.moment-tags button:hover, .moment-tags button.active { color: var(--page-bg); border-color: var(--primary); background: var(--primary); }.clear-tag { margin-left: .6rem; border: 0; color: var(--primary); background: transparent; font-size: .75rem; cursor: pointer; }
    .md-render { color: var(--deep-text); font-size: .92rem; line-height: 1.7; }
    :global(.md-render hr) { border: 0; border-top: 1px dashed var(--line-divider); margin: 1rem 0; }
    :global(.md-render a) { color: var(--primary); }
    :global(.md-render p) { margin: 0 0 .6rem; }
    :global(.md-render .md-image) { display: inline-block; }
    :global(.md-render img) { max-width: 100%; border-radius: .5rem; }
    :global(.md-img-fallback) { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; padding: .6rem .8rem; color: var(--muted); background: var(--btn-regular-bg); border: 1px dashed var(--line-divider); border-radius: .5rem; font-size: .8rem; }
    .echo-image-link { display: inline-block; }
    .echo-image-link img { max-height: 260px; max-width: 100%; object-fit: contain; border-radius: .5rem; cursor: zoom-in; }
    .moment-divider { border: 0; border-top: 1px solid var(--line-divider); margin: .85rem 0 .7rem; }
    .moment-foot { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: .8rem; }
    .moment-vote { border: 0; padding: 0; color: var(--muted); background: transparent; font-size: .8rem; cursor: pointer; }.moment-vote:hover:not(:disabled), .moment-vote.voted { color: var(--primary); }.moment-vote:disabled { cursor: wait; opacity: .6; }
    .ext-card { display: flex; align-items: center; gap: .7rem; margin: 0 0 .8rem; padding: .7rem .8rem; border: 1px solid var(--line-divider); border-radius: .6rem; background: var(--btn-regular-bg); text-decoration: none; color: var(--deep-text); }
    a.ext-card:hover { border-color: var(--primary); }
    .ext-card.no-link { cursor: default; }
    .ext-icon { flex-shrink: 0; width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--line-divider); color: var(--primary); }
    .ext-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; }
    .ext-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: .88rem; }
    .ext-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: .75rem; }
    .panel-pagination { display: flex; justify-content: center; align-items: center; gap: .35rem; flex-wrap: wrap; margin-top: .5rem; }
    .panel-pagination button { min-width: 2rem; height: 2rem; border: 1px solid var(--line-divider); border-radius: .4rem; color: var(--deep-text); background: var(--card-bg); cursor: pointer; }
    .panel-pagination button:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); }
    .panel-pagination button.active { color: var(--page-bg); border-color: var(--primary); background: var(--primary); }
    .panel-pagination button:disabled { cursor: not-allowed; opacity: .4; }
    .p-dots { color: var(--muted); padding: 0 .3rem; }
    @media (max-width: 512px) { .moment-item { padding: .8rem; } .moment-head { flex-direction: column; align-items: flex-start; gap: .35rem; } }
</style>
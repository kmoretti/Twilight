<script lang="ts">
    import { onMount, tick } from "svelte";
    import { refreshFancybox } from "@utils/fancybox";

    type TgMedia = {
        type: string;
        src: string;
    };

    type TgItem = {
        id: string;
        datetime: string;
        html: string;
        tags: string[];
        media: TgMedia[];
    };

    let { tgUrl = "https://tgtalk.kemiaosw.top", displayName = "", pageSize = 10, voteUrl = "" }: { tgUrl?: string; displayName?: string; pageSize?: number; voteUrl?: string } = $props();

    let items = $state<TgItem[]>([]);
    let page = $state(1);
    let totalCount = $state(0);
    let loading = $state(true);
    let error = $state("");
    let activeTag = $state("");
    let listEl = $state<HTMLElement | undefined>(undefined);
    let votes = $state<Record<string, number | null>>({});
    let voting = $state<Record<string, boolean>>({});

    const author = $derived(displayName.trim() || "匿名");
    const visibleItems = $derived(activeTag ? items.filter((item) => item.tags.some((tag) => normalizeTag(tag) === activeTag)) : items);
    const totalPages = $derived(Math.max(1, Math.ceil((activeTag ? visibleItems.length : totalCount) / pageSize)));
    const pageItems = $derived(visibleItems.slice((page - 1) * pageSize, page * pageSize));
    const apiOrigin = $derived.by(() => {
        try {
            return new URL(tgUrl).origin;
        } catch {
            return "";
        }
    });

    function resolveUrl(value: unknown) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        return apiOrigin ? `${apiOrigin}${raw.startsWith("/") ? raw : `/${raw}`}` : raw;
    }

    function normalizeUrlForComparison(value: string) {
        let normalized = resolveUrl(value);
        for (let index = 0; index < 3; index += 1) {
            try {
                const decoded = decodeURIComponent(normalized);
                if (decoded === normalized) break;
                normalized = decoded;
            } catch {
                break;
            }
        }
        return normalized;
    }

    function normalizeTag(value: string) {
        let normalized = value.trim();
        for (let index = 0; index < 3; index += 1) {
            try {
                const decoded = decodeURIComponent(normalized);
                if (decoded === normalized) break;
                normalized = decoded;
            } catch {
                break;
            }
        }
        return normalized.replace(/^#+/, "").trim().toLocaleLowerCase();
    }

    function getTagFromHref(value: string) {
        try {
            const url = new URL(value, window.location.href);
            return url.searchParams.get("q") || "";
        } catch {
            return "";
        }
    }

    function normalizeMedia(value: unknown, excludedUrls: Set<string>) {
        if (!Array.isArray(value)) return [];
        return value
            .map((media) => typeof media === "string" ? media : media && typeof media === "object" ? (media as Record<string, unknown>).src : "")
            .filter((src): src is string => typeof src === "string" && !!src.trim())
            .map((src) => ({ type: "image", src: resolveUrl(src) }))
            .filter((media) => media.src && !excludedUrls.has(normalizeUrlForComparison(media.src)));
    }

    function getBackgroundImageUrl(value: string) {
        const match = value.match(/background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/i);
        return match && !/^\s*javascript:/i.test(match[2]) ? resolveUrl(match[2]) : "";
    }

    function getEmojiMediaUrls(value: string) {
        const urls = new Set<string>();
        const emojiElements = value.match(/<[^>]*class\s*=\s*(['"])[^'"]*\bemoji\b[^'"]*\1[^>]*>/gi) || [];
        emojiElements.forEach((element) => {
            const style = element.match(/style\s*=\s*(['"])(.*?)\1/i)?.[2] || "";
            const src = getBackgroundImageUrl(style);
            if (src) urls.add(normalizeUrlForComparison(src));
        });
        return urls;
    }

    function sanitizeStyle(value: string) {
        return value.split(";").map((declaration) => {
            const match = declaration.trim().match(/^background-image\s*:\s*url\((['"]?)(.*?)\1\)$/i);
            if (!match || /^\s*javascript:/i.test(match[2])) return "";
            const src = resolveUrl(match[2]);
            return src ? `background-image:url("${src.replace(/"/g, "&quot;")}")` : "";
        }).filter(Boolean).join(";");
    }

    function sanitizeHtml(value: unknown, group: string, bodyMediaUrls = new Set<string>()) {
        if (typeof document === "undefined") return "";
        const template = document.createElement("template");
        template.innerHTML = String(value || "");
        template.content.querySelectorAll("script, style, iframe, object, embed, form, meta, link").forEach((node) => node.remove());
        template.content.querySelectorAll("*").forEach((node) => {
            const isEmoji = node.classList.contains("emoji");
            const originalStyle = isEmoji ? node.getAttribute("style") || "" : "";
            const emojiSrc = originalStyle ? getBackgroundImageUrl(originalStyle) : "";
            if (isEmoji && emojiSrc) bodyMediaUrls.add(normalizeUrlForComparison(emojiSrc));
            if (isEmoji) node.removeAttribute("style");
            [...node.attributes].forEach((attribute) => {
                if (attribute.name.toLowerCase() === "data-fancybox" || attribute.name.toLowerCase().startsWith("on") || attribute.name.toLowerCase() === "srcdoc") node.removeAttribute(attribute.name);
                if (attribute.name.toLowerCase() === "style") {
                    const style = sanitizeStyle(attribute.value);
                    if (style) node.setAttribute("style", style);
                    else node.removeAttribute("style");
                }
                if (["href", "src", "action", "formaction"].includes(attribute.name.toLowerCase()) && /^\s*javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
            });
            if (isEmoji) {
                const background = emojiSrc ? `background-image:url(${JSON.stringify(emojiSrc)});` : "";
                const color = emojiSrc ? "color:transparent;" : "";
                node.textContent = "";
                node.setAttribute("style", `${background}display:inline-block;width:1em;height:1em;overflow:hidden;background-size:contain;background-repeat:no-repeat;background-position:center;vertical-align:-.1em;font-size:1em;line-height:1;${color}`);
            }
        });
        template.content.querySelectorAll("img").forEach((image) => {
            const src = resolveUrl(image.getAttribute("src"));
            if (!src) {
                image.remove();
                return;
            }
            const isEmojiImage = image.closest(".emoji");
            if (isEmojiImage) {
                image.removeAttribute("src");
                image.removeAttribute("data-fancybox");
                return;
            }
            bodyMediaUrls.add(normalizeUrlForComparison(src));
            const link = document.createElement("a");
            link.href = src;
            link.dataset.fancybox = group;
            link.className = "tg-html-image";
            image.replaceWith(link);
            link.append(image);
        });
        return template.innerHTML;
    }

    function parseText(value: string) {
        const labels = value.match(/Labels:\s*([^<\r\n]*?)(?=\s*(?:<br\s*\/?>|$))/i);
        const tags = labels?.[1].split(/[,，、\s]+/).map((tag) => tag.trim()).filter(Boolean) || [];
        let withoutLabels = value;
        if (labels && labels.index !== undefined) {
            const before = value.slice(0, labels.index);
            const after = value.slice(labels.index + labels[0].length).replace(/^\s*<br\s*\/?>\s*/i, "");
            withoutLabels = before.replace(/---\s*$/i, "<hr>") + after;
        }
        const html = withoutLabels.replace(/(^|<br\s*\/?>)\s*---\s*(?=<br\s*\/?>|$)/gi, "$1<hr>");
        return { html, tags };
    }

    function normalizePost(raw: unknown): TgItem | null {
        if (!raw || typeof raw !== "object") return null;
        const post = raw as Record<string, unknown>;
        const id = String(post.id || "");
        const time = typeof post.time === "number" ? post.time : Number(post.time);
        const datetime = Number.isFinite(time) ? new Date(time).toISOString() : "";
        const text = typeof post.text === "string" ? post.text : "";
        if (!id || !datetime || typeof post.text !== "string") return null;
        const { html, tags } = parseText(text);
        const bodyMediaUrls = getEmojiMediaUrls(text);
        const sanitizedHtml = sanitizeHtml(html, `tg-${id}`, bodyMediaUrls);
        const contentTags = [...sanitizedHtml.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
            .map((match) => getTagFromHref(match[2]))
            .filter(Boolean);
        return {
            id,
            datetime,
            html: sanitizedHtml,
            tags: [...new Set([...tags, ...contentTags])],
            media: normalizeMedia(post.image, bodyMediaUrls),
        };
    }

    function formatTime(value: string) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString();
    }

    function handleImageError(event: Event) {
        const img = event.currentTarget as HTMLImageElement;
        const a = img.closest("a[data-fancybox]");
        const fb = document.createElement("span");
        fb.className = "md-img-fallback";
        fb.textContent = "图片无法加载";
        if (a && a.parentNode) a.replaceWith(fb);
        else if (img.parentNode) img.replaceWith(fb);
    }

    async function renderFancybox() {
        await tick();
        if (!listEl) return;
        listEl.querySelectorAll("img").forEach((image) => {
            image.addEventListener("error", handleImageError, { once: true });
        });
        await refreshFancybox();
    }

    async function loadPage() {
        loading = true;
        error = "";
        try {
            const base = tgUrl.replace(/\/+$/, "");
            const url = new URL(`${base}/api/posts`);
            url.searchParams.set("page", "1");
            url.searchParams.set("page_size", String(pageSize));
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload: unknown = await response.json();
            if (!payload || typeof payload !== "object") throw new Error("数据格式错误");
            const root = payload as Record<string, unknown>;
            const rawItems = root.data;
            if (!Array.isArray(rawItems)) throw new Error("数据格式错误");
            items = rawItems.map(normalizePost).filter((item): item is TgItem => item !== null);
            const reportedCount = Number(root.count);
            totalCount = Number.isFinite(reportedCount) && reportedCount >= items.length ? reportedCount : items.length;
            page = 1;
            await renderFancybox();
        } catch (reason) {
            error = reason instanceof Error ? reason.message : "TG 日记加载失败";
        } finally {
            loading = false;
        }
    }

    function retry() {
        void loadPage();
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
        if (!voteUrl) return;
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
        if (!voteUrl || voting[id]) return;
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

    function goPage(targetPage: number) {
        if (targetPage < 1 || targetPage > totalPages || targetPage === page || loading) return;
        page = targetPage;
        void renderFancybox();
    }

    const loadedVoteIds = new Set<string>();
    $effect(() => {
        if (!voteUrl) return;
        pageItems.forEach((item) => {
            if (loadedVoteIds.has(item.id)) return;
            loadedVoteIds.add(item.id);
            void loadVote(item.id);
        });
    });

    function pageNumbers() {
        const pages: Array<number | "…"> = [1];
        if (totalPages === 1) return pages;
        if (page > 3) pages.push("…");
        for (let index = Math.max(2, page - 1); index <= Math.min(totalPages - 1, page + 1); index += 1) pages.push(index);
        if (page < totalPages - 2) pages.push("…");
        pages.push(totalPages);
        return pages;
    }

    function updateFilterFromUrl() {
        if (typeof window === "undefined") return;
        activeTag = normalizeTag(new URL(window.location.href).searchParams.get("q") || "");
        page = 1;
    }

    function setFilter(tag: string) {
        const url = new URL(window.location.href);
        if (activeTag === normalizeTag(tag)) url.searchParams.delete("q");
        else url.searchParams.set("q", tag);
        window.history.pushState({}, "", url);
        updateFilterFromUrl();
    }

    function handleContentClick(event: MouseEvent) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("a");
        if (!link || !listEl?.contains(link)) return;
        const tag = getTagFromHref(link.getAttribute("href") || "");
        if (!tag) return;
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("q", tag);
        window.history.pushState({}, "", url);
        updateFilterFromUrl();
    }

    function handleContentKey(event: KeyboardEvent) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("a");
        if (!link || !listEl?.contains(link)) return;
        event.preventDefault();
        link.click();
    }

    onMount(() => {
        updateFilterFromUrl();
        window.addEventListener("popstate", updateFilterFromUrl);
        void loadPage();
        return () => window.removeEventListener("popstate", updateFilterFromUrl);
    });
</script>

<div class="tg-panel">
    <p class="tg-network-tip">当你看不到图片，说明你是大陆网络，图片依旧来自TG的cdn，故无法显示。</p>
    {#if loading && items.length === 0}
        <div class="panel-state">加载中...</div>
    {:else if error && items.length === 0}
        <div class="panel-state error">{error}<button type="button" class="retry" onclick={retry}>重试</button></div>
    {:else if items.length === 0}
        <div class="panel-state">暂无日记</div>
    {:else}
        {#if activeTag}
            <div class="panel-meta filter-meta"><span>当前筛选：#{activeTag}</span><button type="button" class="clear-tag" onclick={() => { const url = new URL(window.location.href); url.searchParams.delete("q"); window.history.pushState({}, "", url); updateFilterFromUrl(); }}>清除筛选</button></div>
        {/if}
        {#if pageItems.length > 0}
            <div class="tg-timeline" bind:this={listEl} onclick={handleContentClick} onkeydown={handleContentKey} tabindex="0" role="region" aria-label="Diary timeline">
                {#each pageItems as item (item.id)}
                    {@const group = "tg-" + item.id}
                    <article class="tg-item card-base">
                        <div class="tg-head">
                            <span class="tg-author">{author}</span>
                            <span class="tg-tags">
                                {#each item.tags as tag (tag)}<button type="button" class:active={activeTag === normalizeTag(tag)} aria-pressed={activeTag === normalizeTag(tag)} onclick={() => setFilter(tag)}>{tag}</button>{/each}
                            </span>
                        </div>
                        <div class="tg-html prose max-w-none" data-tg-html>{@html sanitizeHtml(item.html, group)}</div>
                        {#if item.media.length > 0}
                            <div class="tg-media moment-images">
                                {#each item.media as media (media.src)}
                                    <a data-fancybox={group} href={media.src} class="tg-media-link">
                                        <img src={media.src} alt="TG 图片" loading="lazy" referrerpolicy="no-referrer" onerror={handleImageError} />
                                    </a>
                                {/each}
                            </div>
                        {/if}
                        <hr class="tg-divider" />
                        <div class="tg-foot">
                            <time class="tg-time" datetime={item.datetime}>{formatTime(item.datetime)}</time>
                            <button type="button" class="tg-vote" class:voted={votes[item.id] !== null && (votes[item.id] ?? 0) > 0} disabled={voting[item.id] || !voteUrl} aria-label="点赞" onclick={() => toggleVote(item.id)}>♡ {votes[item.id] ?? 0}</button>
                        </div>
                    </article>
                {/each}
            </div>
        {:else}
            <div class="panel-state">没有匹配该标签的日记</div>
        {/if}
        {#if totalPages > 1}
            <nav class="panel-pagination" aria-label="说说分页">
                <button type="button" disabled={page === 1 || loading} onclick={() => goPage(page - 1)}>上一页</button>
                {#each pageNumbers() as pageNumber (pageNumber)}
                    {#if pageNumber === "…"}
                        <span class="p-dots">…</span>
                    {:else}
                        <button type="button" class:active={pageNumber === page} disabled={loading} onclick={() => goPage(pageNumber)}>{pageNumber}</button>
                    {/if}
                {/each}
                <button type="button" disabled={page === totalPages || loading} onclick={() => goPage(page + 1)}>下一页</button>
            </nav>
        {/if}
    {/if}
</div>

<style>
    .tg-panel { display: grid; gap: 1rem; }
    .tg-network-tip { margin: 0; padding: .75rem 1rem; color: var(--muted, var(--deep-text)); background: var(--btn-regular-bg); border: 1px solid var(--line-divider); border-radius: .5rem; font-size: .8rem; line-height: 1.6; }
    .panel-state { padding: 2rem 1rem; color: var(--muted, var(--deep-text)); text-align: center; font-size: .9rem; }
    .panel-state.error { color: oklch(.48 .18 25); }
    :global(:root.dark) .panel-state.error { color: oklch(.78 .14 25); }
    .retry { margin-left: .6rem; border: 1px solid var(--line-divider); border-radius: .45rem; padding: .35rem .7rem; color: var(--deep-text); background: var(--card-bg); cursor: pointer; }
    .retry:hover { color: var(--primary); border-color: var(--primary); }
    .panel-meta { color: var(--muted, var(--deep-text)); font-size: .8rem; }
    .filter-meta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .clear-tag { border: 0; color: var(--primary); background: transparent; font-size: .75rem; cursor: pointer; }
    .tg-timeline { display: grid; gap: 1rem; }
    .tg-item { padding: 1rem; border: 1px solid var(--line-divider); }
    .tg-head { display: flex; justify-content: space-between; align-items: center; gap: .75rem; margin-bottom: .75rem; flex-wrap: wrap; }
    .tg-author { color: var(--deep-text); font-weight: 700; font-size: .9rem; }
    .tg-tags { display: flex; gap: .4rem; flex-wrap: wrap; }
    .tg-tags button { padding: .1rem .5rem; border: 1px solid var(--line-divider); border-radius: 999px; color: var(--muted, var(--deep-text)); background: transparent; font-size: .68rem; cursor: pointer; }
    .tg-tags button:hover, .tg-tags button.active { color: var(--page-bg); border-color: var(--primary); background: var(--primary); }
    .tg-html { color: var(--deep-text); font-size: .92rem; line-height: 1.7; }
    :global(.tg-html hr) { border: 0; border-top: 1px dashed var(--line-divider); margin: 1rem 0; }
    :global(.tg-html img) { max-width: 100%; max-height: 420px; border-radius: .5rem; cursor: zoom-in; }
    :global(.tg-html a) { color: var(--primary); }
    :global(.tg-html .emoji) { display: inline-block; width: 1em; height: 1em; vertical-align: -.1em; }
    .tg-media { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: .75rem; }
    .tg-media-link { display: inline-block; }
    .tg-media-link img { max-width: 100%; max-height: 260px; border-radius: .5rem; cursor: zoom-in; object-fit: contain; }
    .tg-divider { margin: .85rem 0 .7rem; border: 0; border-top: 1px solid var(--line-divider); }
    .tg-foot { display: flex; justify-content: space-between; align-items: center; color: var(--muted, var(--deep-text)); font-size: .8rem; }
    .tg-time { color: var(--muted, var(--deep-text)); font-size: .8rem; }
    .tg-vote { border: 0; padding: 0; color: var(--muted, var(--deep-text)); background: transparent; font-size: .8rem; cursor: pointer; }
    .tg-vote:hover:not(:disabled), .tg-vote.voted { color: var(--primary); }
    .tg-vote:disabled { cursor: wait; opacity: .6; }
    .panel-pagination { display: flex; justify-content: center; align-items: center; gap: .35rem; flex-wrap: wrap; margin-top: .5rem; }
    .panel-pagination button { min-width: 2rem; height: 2rem; border: 1px solid var(--line-divider); border-radius: .4rem; padding: 0 .5rem; color: var(--deep-text); background: var(--card-bg); cursor: pointer; }
    .panel-pagination button:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); }
    .panel-pagination button.active { color: var(--page-bg); border-color: var(--primary); background: var(--primary); }
    .panel-pagination button:disabled { cursor: not-allowed; opacity: .4; }
    .p-dots { color: var(--muted, var(--deep-text)); padding: 0 .3rem; }
</style>

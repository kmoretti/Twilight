<script lang="ts">
import { onDestroy, onMount } from "svelte";
import yaml from "js-yaml";
import Icon from "@iconify/svelte";

import { createLatencyIndex, normalizeFriendGroups, normalizeFriendUrl } from "@utils/friends";
import type { FriendGroup } from "@utils/friends";

interface Props {
    source: "remote" | "local";
    remoteUrl: string;
    localGroups: FriendGroup[];
    graveyardUrl: string;
    graveyardTitle: string;
    graveyardDescription: string;
}

interface GraveyardEntry {
    name: string;
    avatar: string;
}

let { source, remoteUrl, localGroups, graveyardUrl, graveyardTitle, graveyardDescription }: Props = $props();

let groups = $state<FriendGroup[]>([]);
let loading = $state(false);

$effect(() => {
    if (source === "local") {
        groups = localGroups;
    }
});
let refreshingLatency = $state(false);
let error = $state("");
let latencyByUrl = $state<Map<string, number>>(new Map());
let latencyRefreshTimer: ReturnType<typeof setInterval> | undefined;
let graveyard = $state<GraveyardEntry[]>([]);
let failedAvatars = $state<Set<string>>(new Set());

async function fetchLatency() {
    if (refreshingLatency) return;
    refreshingLatency = true;
    try {
        const response = await fetch("https://fc.081531.xyz/link.json");
        if (!response.ok) {
            return;
        }
        latencyByUrl = createLatencyIndex(await response.json());
    } catch {
    } finally {
        refreshingLatency = false;
    }
}

async function fetchRemoteGroups() {
    loading = true;
    error = "";
    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        groups = normalizeFriendGroups(yaml.load(text));
    } catch (e) {
        groups = [];
        error = e instanceof Error ? e.message : String(e);
    } finally {
        loading = false;
    }
}

async function fetchGraveyard() {
    try {
        const response = await fetch(graveyardUrl);
        if (!response.ok) {
            return;
        }
        const raw = yaml.load(await response.text());
        if (!Array.isArray(raw)) {
            return;
        }
        graveyard = raw
            .map((item) => (item && typeof item === "object" ? (item as { entry?: unknown }).entry : undefined))
            .filter((entry): entry is { name: unknown; avatar: unknown } => entry !== null && typeof entry === "object")
            .map((entry) => ({
                name: typeof entry.name === "string" ? entry.name.trim() : "",
                avatar: typeof entry.avatar === "string" ? entry.avatar.trim() : "",
            }))
            .filter((entry) => entry.name !== "");
    } catch {
        graveyard = [];
    }
}

function retry() {
    if (source === "remote") {
        fetchRemoteGroups();
    }
}

function openExternal(e: MouseEvent, url: string | undefined) {
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank");
}

function markAvatarFailed(name: string) {
    failedAvatars = new Set(failedAvatars).add(name);
}

function fallbackAvatar(name: string) {
    const initial = name.slice(0, 1).toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="currentColor"/><text x="10" y="14" text-anchor="middle" font-size="11" fill="white">${initial}</text></svg>`)}`;
}

function latencyBadgeClass(latency: number) {
    if (latency < 500) {
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    }
    if (latency < 1000) {
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    }
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

onMount(() => {
    if (source === "remote") {
        fetchRemoteGroups();
    }
    fetchLatency();
    latencyRefreshTimer = setInterval(fetchLatency, 5 * 60 * 1000);
    fetchGraveyard();
});

onDestroy(() => {
    if (latencyRefreshTimer) {
        clearInterval(latencyRefreshTimer);
    }
});
</script>

<div class="flex flex-col gap-8 my-4">
    <div class="flex items-center gap-2.5 px-4 py-2.5 rounded-(--radius-large) text-sm
        border border-(--line-divider) bg-(--btn-regular-bg)
        text-neutral-600 dark:text-neutral-400">
        {#if source === "remote"}
            <Icon icon="mdi:information-outline" class="w-4 h-4 shrink-0 text-(--primary)" />
            <span class="flex-1">友链数据使用 CDN，数据更新需要时间</span>
        {:else}
            <span class="flex-1">刷新站点延迟数据</span>
        {/if}
        <button type="button" aria-label="刷新延迟" disabled={refreshingLatency}
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors duration-300
                text-neutral-500 dark:text-neutral-400 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-60"
            onclick={fetchLatency}>
            <Icon icon={refreshingLatency ? "eos-icons:loading" : "material-symbols:refresh-rounded"} class="text-sm {refreshingLatency ? 'animate-spin' : ''}" />
            <span>{refreshingLatency ? "刷新中..." : "刷新延迟"}</span>
        </button>
    </div>

    {#if loading}
        <div class="flex flex-col items-center justify-center gap-3 py-16 text-neutral-500 dark:text-neutral-400">
            <Icon icon="eos-icons:loading" class="text-2xl" />
            <span class="text-sm">加载中...</span>
        </div>
    {:else if error}
        <div class="flex flex-col items-center justify-center gap-3 py-16">
            <p class="text-sm text-red-500 dark:text-red-400">友链数据加载失败：{error}</p>
            <button type="button"
                class="px-4 py-1.5 rounded-lg text-sm cursor-pointer transition-colors duration-300
                    border border-(--line-divider) text-neutral-600 dark:text-neutral-400
                    hover:border-(--primary) hover:text-(--primary)"
                onclick={retry}>
                重试
            </button>
        </div>
    {:else}
        {#each groups as group, groupIndex (groupIndex)}
            <section>
                <div class="mb-4">
                    <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        {group.className}
                        <span class="text-sm font-normal text-neutral-400 dark:text-neutral-500">
                            · {group.linkList.length} 个站点
                        </span>
                    </h2>
                    {#if group.classDesc}
                        <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            {group.classDesc}
                        </p>
                    {/if}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {#each group.linkList as friend, friendIndex (friendIndex)}
                        <a href={friend.link} target="_blank" rel="noopener noreferrer"
                            class="menu-card group relative flex flex-row items-center p-4 rounded-xl border transition-all duration-300 gap-4">
                            {#if friend.siteshot}
                                <div class="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none
                                    opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <img src={friend.siteshot} alt={friend.name} class="w-full h-full object-cover" loading="lazy" />
                                    <div class="friend-screenshot-overlay absolute inset-0"></div>
                                </div>
                            {/if}
                            <div class="icon-wrapper relative z-10 w-20 h-20 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                                <img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover transition duration-300 group-hover:scale-110" loading="lazy" />
                            </div>
                            <div class="relative z-10 flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                                <h3 class="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-(--primary) transition-colors duration-300 min-w-0">
                                    <span class="truncate">{friend.name}</span>
                                    {#if normalizeFriendUrl(friend.link) && latencyByUrl.get(normalizeFriendUrl(friend.link)!) !== undefined}
                                        {@const latency = latencyByUrl.get(normalizeFriendUrl(friend.link)!)}
                                        <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide {latencyBadgeClass(latency!)}">
                                            {latency} MS
                                        </span>
                                    {/if}
                                </h3>
                                <p class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1 mt-1">
                                    {friend.descr}
                                </p>
                                {#if friend.tags && friend.tags.length > 0}
                                    <div class="flex flex-wrap gap-1.5 mt-2">
                                        {#each friend.tags.slice(0, 3) as tag (tag)}
                                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                                {tag}
                                            </span>
                                        {/each}
                                        {#if friend.tags.length > 3}
                                            <span class="text-[10px] px-2 py-0.5 text-neutral-400">
                                                +{friend.tags.length - 3}
                                            </span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                            <div class="absolute bottom-2 right-3 z-10 flex items-center gap-2">
                                {#if friend.friendslink}
                                    <button type="button" aria-label="友链页"
                                        class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                                        onclick={(e) => openExternal(e, friend.friendslink)}>
                                        <Icon icon="ic:round-link" class="w-3.5 h-3.5 text-neutral-400 hover:text-(--primary) transition-colors duration-300" />
                                    </button>
                                {/if}
                                {#if friend.feeds}
                                    <button type="button" aria-label="RSS 订阅"
                                        class="cursor-pointer"
                                        onclick={(e) => openExternal(e, friend.feeds)}>
                                        <Icon icon="fa6-solid:rss" class="w-3.5 h-3.5 text-neutral-400 hover:text-(--primary) transition-colors duration-300" />
                                    </button>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}

        {#if graveyard.length > 0}
            <section class="graveyard-section">
                <div class="mb-4">
                    <h2 class="text-xl font-bold text-neutral-700 dark:text-neutral-300">{graveyardTitle}</h2>
                    {#if graveyardDescription}
                        <p class="text-sm text-neutral-500 dark:text-neutral-500 mt-1">{graveyardDescription}</p>
                    {/if}
                </div>
                <div class="tombstone-list">
                    {#each graveyard as entry (entry.name)}
                        <span class="tombstone-item">
                            <img
                                class="tombstone-avatar"
                                src={entry.avatar && !failedAvatars.has(entry.name) ? entry.avatar : fallbackAvatar(entry.name)}
                                alt={entry.name}
                                loading="lazy"
                                onerror={() => markAvatarFailed(entry.name)}
                            />
                            <span class="tombstone-name">{entry.name}</span>
                        </span>
                    {/each}
                </div>
            </section>
        {/if}
    {/if}
</div>

<style>
    .menu-card {
        cursor: pointer;
        background-color: none;
        border-color: var(--line-divider);
    }

    .icon-wrapper {
        background-color: color-mix(in oklch, var(--primary), transparent 85%);
        color: var(--primary);
    }

    .friend-screenshot-overlay {
        background: color-mix(in oklch, var(--card-bg), transparent 68%);
    }

    :global(:root.dark) .friend-screenshot-overlay {
        background: color-mix(in oklch, var(--card-bg), transparent 58%);
    }

    .menu-card:hover {
        background-color: color-mix(in oklch, var(--primary), transparent 95%);
        border-color: var(--primary);
        box-shadow: 0 0 20px color-mix(in oklch, var(--primary), transparent 80%);
        translate: 0 -4px;
    }

    .menu-card:hover .icon-wrapper {
        background-color: var(--card-bg);
        color: var(--primary);
        box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary), transparent 18%),
            0 0 15px color-mix(in oklch, var(--primary), transparent 55%);
    }

    .tombstone-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.625rem 1rem;
    }

    .tombstone-item {
        display: inline-flex;
        width: fit-content;
        max-width: 100%;
        align-items: center;
        gap: 0.5rem;
        color: var(--deep-text);
        filter: grayscale(1);
        opacity: 0.78;
        transition: opacity 300ms ease;
    }

    .tombstone-item:hover {
        opacity: 0.95;
    }

    .tombstone-avatar {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        border-radius: 9999px;
        object-fit: cover;
        background-color: color-mix(in oklch, var(--line-divider), transparent 18%);
        color: color-mix(in oklch, var(--text-color, currentColor), transparent 28%);
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--line-divider), transparent 8%);
        filter: grayscale(1) contrast(0.82);
        opacity: 0.78;
    }

    .tombstone-name {
        display: inline-block;
        min-width: 0;
        max-width: 100%;
        flex: 0 1 auto;
        overflow: hidden;
        color: color-mix(in oklch, var(--text-color, currentColor), transparent 15%);
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.25rem;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-bottom: 1px dashed color-mix(in oklch, var(--deep-text), transparent 30%);
    }

    :global(.dark) .tombstone-item {
        color: color-mix(in oklch, var(--deep-text), transparent 22%);
        opacity: 0.72;
    }

    :global(.dark) .tombstone-name {
        color: color-mix(in oklch, var(--deep-text), transparent 15%);
        border-bottom-color: color-mix(in oklch, var(--deep-text), transparent 15%);
    }

    :global(.dark) .tombstone-avatar {
        background-color: color-mix(in oklch, var(--line-divider), transparent 4%);
        color: color-mix(in oklch, white, transparent 34%);
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--line-divider), transparent 2%);
    }

</style>
